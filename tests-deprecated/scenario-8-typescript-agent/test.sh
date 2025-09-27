#!/bin/bash
# Main test runner for Scenario 8: TypeScript Agent Basic Test

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Scenario 8: TypeScript Agent Basic Test ===${NC}"
echo -e "${BLUE}Testing TypeScript SDK agent functionality${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Generate random port
export TEST_PORT=$((8800 + RANDOM % 100))

# Run setup with the port
echo -e "\n${YELLOW}Step 1: Setting up space...${NC}"
./setup.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Setup failed${NC}"
  exit 1
fi

# Export the paths that tests need
export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"
export AGENT_LOG="$TEST_DIR/logs/ts-agent-output.log"

# Wait for TypeScript agent to initialize
echo -e "\n${YELLOW}Step 2: Waiting for TypeScript agent to initialize...${NC}"
sleep 5

# Function to send message via HTTP and check response
test_agent_interaction() {
  local test_name="$1"
  local request="$2"
  local expected_pattern="$3"
  
  echo ""
  echo "Test: $test_name"
  
  # Clear output log
  > "$OUTPUT_LOG"
  
  # Start monitoring output
  tail -f "$OUTPUT_LOG" > /tmp/ts-agent-response.txt &
  TAIL_PID=$!
  
  # Send request via HTTP API
  echo "Sending request via HTTP API..."
  curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "$request" > /dev/null
  
  # Wait for response
  sleep 3
  
  # Stop monitoring
  kill $TAIL_PID 2>/dev/null || true
  
  # Check for response
  if grep -q "$expected_pattern" /tmp/ts-agent-response.txt 2>/dev/null || grep -q "$expected_pattern" "$AGENT_LOG" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $test_name passed"
    return 0
  else
    echo -e "${RED}✗${NC} $test_name failed"
    echo "Expected pattern: $expected_pattern"
    echo "Response received:"
    tail -10 /tmp/ts-agent-response.txt 2>/dev/null || echo "No response captured"
    return 1
  fi
}

echo -e "\n${YELLOW}Step 3: Running TypeScript agent tests...${NC}"

# Test 1: Chat interaction
REQUEST_1='{
  "kind": "chat",
  "to": ["typescript-agent"],
  "payload": {
    "text": "Hello, TypeScript agent! Can you respond?"
  }
}'

test_agent_interaction \
  "Chat interaction" \
  "$REQUEST_1" \
  "chat"

RESULT_1=$?

# Test 2: List tools from TypeScript agent
REQUEST_2='{
  "kind": "mcp/request",
  "id": "test-tools-list",
  "to": ["typescript-agent"],
  "payload": {
    "method": "tools/list",
    "params": {}
  }
}'

test_agent_interaction \
  "List agent tools" \
  "$REQUEST_2" \
  "get_time\|echo\|calculate"

RESULT_2=$?

# Test 3: Call echo tool
REQUEST_3='{
  "kind": "mcp/request",
  "id": "test-echo",
  "to": ["typescript-agent"],
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Testing TypeScript agent echo"
      }
    }
  }
}'

test_agent_interaction \
  "Call echo tool" \
  "$REQUEST_3" \
  "Echo: Testing TypeScript agent echo"

RESULT_3=$?

# Test 4: Call calculate tool
REQUEST_4='{
  "kind": "mcp/request",
  "id": "test-calc",
  "to": ["typescript-agent"],
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {
        "operation": "add",
        "a": 10,
        "b": 5
      }
    }
  }
}'

test_agent_interaction \
  "Call calculate tool" \
  "$REQUEST_4" \
  "10.*add.*5.*=.*15"

RESULT_4=$?

# Test 5: Test reasoning/thinking
REQUEST_5='{
  "kind": "chat",
  "to": ["typescript-agent"],
  "payload": {
    "text": "Can you help me with something?"
  }
}'

test_agent_interaction \
  "Reasoning/thinking test" \
  "$REQUEST_5" \
  "reasoning/start\|thinking"

RESULT_5=$?

# Calculate total result
TOTAL_RESULT=$((RESULT_1 + RESULT_2 + RESULT_3 + RESULT_4 + RESULT_5))

if [ $TOTAL_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ Scenario 8 PASSED${NC}"
else
  echo -e "\n${RED}✗ Scenario 8 FAILED${NC}"
fi

# Cleanup
echo -e "\nCleaning up..."
./teardown.sh

exit $TOTAL_RESULT
