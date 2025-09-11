#!/bin/bash
# Main test runner for Scenario 9: Multi-Agent Coordination Test

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Scenario 9: Multi-Agent Coordination Test ===${NC}"
echo -e "${BLUE}Testing multiple TypeScript agents coordinating tasks${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Generate random port
export TEST_PORT=$((8900 + RANDOM % 100))

# Run setup with the port
echo -e "\n${YELLOW}Step 1: Setting up space...${NC}"
./setup.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Setup failed${NC}"
  exit 1
fi

# Export the paths that tests need
export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"

# Wait for all agents to initialize
echo -e "\n${YELLOW}Step 2: Waiting for agents to initialize...${NC}"
sleep 8

# Function to send message via HTTP and check response
test_coordination() {
  local test_name="$1"
  local request="$2"
  local expected_pattern="$3"
  
  echo ""
  echo "Test: $test_name"
  
  # Clear output log
  > "$OUTPUT_LOG"
  
  # Start monitoring output
  tail -f "$OUTPUT_LOG" > /tmp/multi-agent-response.txt &
  TAIL_PID=$!
  
  # Send request via HTTP API
  echo "Sending request via HTTP API..."
  curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "$request" > /dev/null
  
  # Wait for response
  sleep 5
  
  # Stop monitoring
  kill $TAIL_PID 2>/dev/null || true
  
  # Check for response in any log
  if grep -q "$expected_pattern" /tmp/multi-agent-response.txt 2>/dev/null || \
     grep -q "$expected_pattern" logs/*.log 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $test_name passed"
    return 0
  else
    echo -e "${RED}✗${NC} $test_name failed"
    echo "Expected pattern: $expected_pattern"
    echo "Response received:"
    tail -20 /tmp/multi-agent-response.txt 2>/dev/null || echo "No response captured"
    return 1
  fi
}

echo -e "\n${YELLOW}Step 3: Running multi-agent coordination tests...${NC}"

# Test 1: Broadcast message to all agents
REQUEST_1='{
  "kind": "chat",
  "payload": {
    "text": "Hello all agents! Please respond if you can hear me."
  }
}'

test_coordination \
  "Broadcast to all agents" \
  "$REQUEST_1" \
  "coordinator-agent\|worker-agent"

RESULT_1=$?

# Test 2: Coordinator requests tool list from worker
REQUEST_2='{
  "kind": "chat",
  "to": ["coordinator-agent"],
  "payload": {
    "text": "Can you ask the worker-agent to list its tools?"
  }
}'

test_coordination \
  "Coordinator to worker delegation" \
  "$REQUEST_2" \
  "tools/list"

RESULT_2=$?

# Test 3: Send a proposal that requires coordination
REQUEST_3='{
  "kind": "mcp/proposal",
  "payload": {
    "proposal": {
      "type": "calculation",
      "description": "Complex calculation requiring multiple agents",
      "operation": "multiply",
      "arguments": {
        "a": 7,
        "b": 8
      }
    }
  }
}'

test_coordination \
  "Proposal handling" \
  "$REQUEST_3" \
  "proposal\|56"

RESULT_3=$?

# Test 4: Agent-to-agent communication
REQUEST_4='{
  "kind": "chat",
  "to": ["coordinator-agent"],
  "payload": {
    "text": "Please coordinate with worker-agent to calculate 15 + 25 using the calculator"
  }
}'

test_coordination \
  "Agent-to-agent coordination" \
  "$REQUEST_4" \
  "40\|calculator"

RESULT_4=$?

# Test 5: Multiple agents reasoning together
REQUEST_5='{
  "kind": "chat",
  "payload": {
    "text": "All agents: What is the sum of 10 and 20?"
  }
}'

test_coordination \
  "Multiple agents reasoning" \
  "$REQUEST_5" \
  "reasoning/start.*reasoning/thought\|30"

RESULT_5=$?

# Calculate total result
TOTAL_RESULT=$((RESULT_1 + RESULT_2 + RESULT_3 + RESULT_4 + RESULT_5))

if [ $TOTAL_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ Scenario 9 PASSED${NC}"
else
  echo -e "\n${RED}✗ Scenario 9 FAILED${NC}"
  echo "Failed tests: $TOTAL_RESULT out of 5"
fi

# Cleanup
echo -e "\nCleaning up..."
./teardown.sh

exit $TOTAL_RESULT
