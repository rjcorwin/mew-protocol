#!/bin/bash
# Test Scenario 2: MCP Tool Execution with Calculator Agent (Fixed FIFO handling)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 2: MCP Tool Execution ===${NC}"

# Create test directory
TEST_DIR="./test-run-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy space configuration
cp ../../cli/space.yaml ./

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway with space configuration
echo "Starting gateway on port $PORT..."
../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"

# Start calculator agent
echo "Starting calculator agent..."
node ../../tests/agents/calculator.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "calculator-token" \
  > calculator.log 2>&1 &
CALC_PID=$!

sleep 2

# Check if calculator is running
if ! kill -0 $CALC_PID 2>/dev/null; then
  echo -e "${RED}Calculator agent failed to start${NC}"
  cat calculator.log
  kill $GATEWAY_PID 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}✓ Calculator agent started${NC}"

# Connect test client with FIFO mode
mkfifo cli-in cli-out

# Start reading from FIFO in background (this is the key fix)
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

# Wait for client to connect
sleep 3

# Test 1: List available tools
echo -e "\n${YELLOW}Test 1: Listing tools${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > cli-in

sleep 2

if grep -q '"tools":\[' responses.txt; then
  echo -e "${GREEN}✓ Tools list received${NC}"
  # Extract and display tools
  TOOLS_MSG=$(grep '"tools":\[' responses.txt | head -1)
  echo "Available tools:"
  echo "$TOOLS_MSG" | jq -r '.payload.result.tools[].name' 2>/dev/null | sed 's/^/  - /'
else
  echo -e "${RED}✗ Failed to get tools list${NC}"
fi

# Test 2: Add function
echo -e "\n${YELLOW}Test 2: Testing add function (5 + 3)${NC}"
echo '{"id":"req-add-1","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > cli-in

sleep 2

if grep -q '"text":"8"' responses.txt; then
  echo -e "${GREEN}✓ Add function returned 8${NC}"
else
  echo -e "${RED}✗ Add function failed${NC}"
fi

# Test 3: Multiply function
echo -e "\n${YELLOW}Test 3: Testing multiply function (7 * 6)${NC}"
echo '{"id":"req-mult-1","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":7,"b":6}}}}' > cli-in

sleep 2

if grep -q '"text":"42"' responses.txt; then
  echo -e "${GREEN}✓ Multiply function returned 42${NC}"
else
  echo -e "${RED}✗ Multiply function failed${NC}"
fi

# Test 4: Evaluate expression
echo -e "\n${YELLOW}Test 4: Testing evaluate expression (2 * (3 + 4))${NC}"
echo '{"id":"req-eval-1","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"2 * (3 + 4)"}}}}' > cli-in

sleep 2

if grep -q '"text":"14"' responses.txt; then
  echo -e "${GREEN}✓ Evaluate function returned 14${NC}"
else
  echo -e "${RED}✗ Evaluate function failed${NC}"
fi

# Test 5: Error handling (invalid expression)
echo -e "\n${YELLOW}Test 5: Testing error handling (invalid expression)${NC}"
echo '{"id":"req-eval-error","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"2 * (3 +"}}}}' > cli-in

sleep 2

if grep -q '"error"' responses.txt && grep -q 'Invalid expression' responses.txt; then
  echo -e "${GREEN}✓ Error handling works${NC}"
else
  echo -e "${RED}✗ Error handling failed${NC}"
fi

# Stop reading from FIFO
kill $CAT_PID 2>/dev/null || true

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
PASS_COUNT=0
FAIL_COUNT=0

# Check each test result
if grep -q '"tools":\[' responses.txt; then
  echo -e "${GREEN}✓ Tool list works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Tool list failed${NC}"
  ((FAIL_COUNT++))
fi

if grep -q '"text":"8"' responses.txt; then
  echo -e "${GREEN}✓ Add function works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Add function failed${NC}"
  ((FAIL_COUNT++))
fi

if grep -q '"text":"42"' responses.txt; then
  echo -e "${GREEN}✓ Multiply function works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Multiply function failed${NC}"
  ((FAIL_COUNT++))
fi

if grep -q '"text":"14"' responses.txt; then
  echo -e "${GREEN}✓ Evaluate function works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Evaluate function failed${NC}"
  ((FAIL_COUNT++))
fi

if grep -q '"error"' responses.txt && grep -q 'Invalid expression' responses.txt; then
  echo -e "${GREEN}✓ Error handling works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Error handling failed${NC}"
  ((FAIL_COUNT++))
fi

echo ""
echo "Calculator processed $(grep -c 'Received MCP request' calculator.log || echo 0) requests"
echo "Client received $(grep -c '"kind":"mcp/response"' responses.txt || echo 0) MCP responses"
echo ""
echo "Tests passed: $PASS_COUNT / 5"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}=== SCENARIO 2 PASSED ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 2 FAILED ===${NC}"
  echo -e "\n${YELLOW}Debug output:${NC}"
  echo "Last 5 calculator log entries:"
  tail -5 calculator.log
  echo ""
  echo "Sample response from responses.txt:"
  head -5 responses.txt | jq -c '{kind, from, correlation_id, result: .payload.result, error: .payload.error}' 2>/dev/null || head -5 responses.txt
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $CALC_PID 2>/dev/null || true
kill $CLI_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f cli-in cli-out responses.txt
cd ..
rm -rf "$TEST_DIR"

exit $EXIT_CODE