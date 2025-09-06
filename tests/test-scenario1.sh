#!/bin/bash
# Test Scenario 1: Basic Message Flow with Echo Agent (Fixed FIFO handling)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 1: Basic Message Flow ===${NC}"

# Create test directory
TEST_DIR="./test-run-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy space configuration
cp ../../cli/space.yaml ./

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway with space configuration
echo "Starting gateway on port $PORT with space config..."
../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway to be ready
echo "Waiting for gateway to start..."
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"

# Start echo agent directly  
echo "Starting echo agent..."
node ../../tests/agents/echo.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "echo-token" \
  > echo.log 2>&1 &
ECHO_PID=$!

# Wait for echo agent to connect
sleep 2

# Check if echo agent is running
if ! kill -0 $ECHO_PID 2>/dev/null; then
  echo -e "${RED}Echo agent failed to start${NC}"
  cat echo.log
  exit 1
fi

echo -e "${GREEN}✓ Echo agent started${NC}"

# Connect test client with FIFO mode
mkfifo cli-in cli-out

# Start a background process to continuously read from FIFO
cat cli-out > responses.txt &
CAT_PID=$!

echo "Connecting test client..."
../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id test-client \
  --token "test-token" \
  --fifo-in cli-in \
  --fifo-out cli-out \
  > client.log 2>&1 &
CLI_PID=$!

# Wait for client to connect and receive welcome message
echo "Waiting for client to connect..."
sleep 3

# Test: Send chat message from CLI
echo -e "\n${YELLOW}Sending chat message...${NC}"
echo '{"kind":"chat","payload":{"text":"Hello echo"}}' > cli-in

# Wait for echo response
echo "Waiting for echo response..."
sleep 3

# Stop reading from FIFO
kill $CAT_PID 2>/dev/null || true

# Check if we got an echo response
echo -e "\n${YELLOW}Checking results...${NC}"
if [ -f responses.txt ]; then
  echo "Responses file size: $(wc -c < responses.txt) bytes"
  echo "Number of messages received: $(grep -c '"kind"' responses.txt || echo 0)"
  
  if grep -q 'Echo: Hello echo' responses.txt; then
    echo -e "${GREEN}✓ Echo response received${NC}"
    
    # Extract and verify the echo message
    ECHO_MSG=$(grep 'Echo: Hello echo' responses.txt | head -1)
    
    # Check message structure
    if echo "$ECHO_MSG" | jq -e '.kind == "chat"' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Response has correct kind${NC}"
    else
      echo -e "${YELLOW}⚠ Could not verify kind field${NC}"
    fi
    
    if echo "$ECHO_MSG" | jq -e '.from == "echo-agent"' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Response from echo-agent${NC}"
    else
      echo -e "${YELLOW}⚠ Could not verify from field${NC}"
    fi
    
    if echo "$ECHO_MSG" | jq -e '.payload.text | contains("Echo: Hello echo")' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Response contains echoed text${NC}"
    else
      echo -e "${YELLOW}⚠ Could not verify payload text${NC}"
    fi
  else
    echo -e "${RED}✗ No echo response found${NC}"
    echo "Messages received:"
    cat responses.txt | jq -c '{kind, from, text: .payload.text}' 2>/dev/null || cat responses.txt
  fi
else
  echo -e "${RED}✗ No responses file created${NC}"
fi

# Debug information
echo -e "\n${YELLOW}Debug Information:${NC}"
echo "Gateway log (last 10 lines):"
tail -10 gateway.log | grep -v "^$"
echo ""
echo "Echo agent log:"
cat echo.log | grep -v "^$"
echo ""
echo "Client log (last 10 lines):"
tail -10 client.log | grep -v "^$"

# Pass/Fail Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
PASS_COUNT=0
FAIL_COUNT=0

if grep -q 'Echo: Hello echo' responses.txt 2>/dev/null; then
  echo -e "${GREEN}✓ Echo message flow works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Echo message flow failed${NC}"
  ((FAIL_COUNT++))
fi

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}=== SCENARIO 1 PASSED ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 1 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $ECHO_PID 2>/dev/null || true
kill $CLI_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f cli-in cli-out responses.txt
cd ..
rm -rf "$TEST_DIR"

exit $EXIT_CODE