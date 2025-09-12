#!/bin/bash
# Check script - Runs test assertions
#
# Can be run standalone after setup.sh or called by test.sh
#
# IMPORTANT: Tool Discovery Behavior
# -----------------------------------
# Agents should automatically discover ALL tools from ALL participants when they join a space.
# Tools should be presented as a unified list with naming convention: "participant-id:tool-name"
# When an agent needs to call a tool, it should:
#   1. Identify which participant owns the tool (from the prefix)
#   2. Send the appropriate mcp/request or mcp/proposal to that participant
#   3. The agent's implementation handles the routing transparently
#
# This test validates the propose->fulfill->response pattern where:
# - Agent with limited capabilities creates proposals for operations it cannot perform
# - Human or authorized participant fulfills the proposal
# - Target participant executes and responds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timeout for operations
TIMEOUT=10
# Retry settings for agent responses
MAX_RETRIES=5
RETRY_SLEEP=2

# If TEST_DIR not set, we're running standalone
if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: TypeScript Agent Propose->Fulfill->Response Pattern${NC}"
echo ""

# Set up paths
OUTPUT_LOG="${OUTPUT_LOG:-$TEST_DIR/logs/test-client-output.log}"
TEST_PORT="${TEST_PORT:-8080}"

# Check if space is running
if [ -z "$SPACE_RUNNING" ]; then
  echo -e "${YELLOW}Note: Space not started by setup.sh, assuming it's already running${NC}"
fi

# Helper function to retry checking for patterns in log
check_log_with_retry() {
  local start_marker="$1"
  local pattern="$2"
  local max_retries="${3:-$MAX_RETRIES}"
  local retry_sleep="${4:-$RETRY_SLEEP}"
  
  for i in $(seq 1 $max_retries); do
    if grep -A 20 "$start_marker" "$OUTPUT_LOG" | grep -q "$pattern"; then
      return 0
    fi
    if [ $i -lt $max_retries ]; then
      sleep $retry_sleep
    fi
  done
  return 1
}

# Test 1: Check agents connected and capabilities
echo -e "${BLUE}Test 1: Verifying agents connected with correct capabilities${NC}"
if timeout $TIMEOUT grep -q '"id":"typescript-agent"' "$OUTPUT_LOG"; then
  echo -e "${GREEN}✓ TypeScript agent connected successfully${NC}"
else
  echo -e "${RED}✗ TypeScript agent did not connect${NC}"
  tail -20 "$OUTPUT_LOG"
  exit 1
fi

if timeout $TIMEOUT grep -q '"id":"fulfiller-agent"' "$OUTPUT_LOG"; then
  echo -e "${GREEN}✓ Fulfiller agent connected successfully${NC}"
else
  echo -e "${RED}✗ Fulfiller agent did not connect${NC}"
  tail -20 "$OUTPUT_LOG"
  exit 1
fi

# Test 2: Human asks agent to perform calculation, agent creates proposal
echo -e "${BLUE}Test 2: Human asks agent to calculate, agent creates proposal${NC}"

# Clear output log position
echo "--- Test 2 Start ---" >> "$OUTPUT_LOG"

# Human asks TypeScript agent to add two numbers via chat
# Note: The agent should know about the 'add' tool from automatic discovery
# and should create a proposal since it lacks tools/call capability
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "chat",
    "to": ["typescript-agent"],
    "payload": {
      "text": "Can you add 7 and 9 for me?",
      "format": "plain"
    }
  }' > /dev/null

# Check if a proposal was sent (with retries)
if check_log_with_retry "Test 2 Start" '"kind":"mcp/proposal".*"method":"tools/call"'; then
  echo -e "${GREEN}✓ TypeScript agent sent proposal for tools/call${NC}"
  
  # Extract proposal ID for fulfillment
  PROPOSAL_ID=$(grep -A 20 "Test 2 Start" "$OUTPUT_LOG" | grep '"kind":"mcp/proposal"' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  Proposal ID: $PROPOSAL_ID"
  
  # Verify proposal contains correct tool call
  if grep -A 20 "Test 2 Start" "$OUTPUT_LOG" | grep -q '"name":"add"'; then
    echo -e "${GREEN}✓ Proposal contains add tool call${NC}"
  else
    echo -e "${RED}✗ Proposal does not contain expected tool call${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ TypeScript agent did not send proposal after $MAX_RETRIES retries${NC}"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 3: Human fulfills the proposal
echo -e "${BLUE}Test 3: Human fulfills agent's proposal with correlation_id${NC}"

# Clear output log position
echo "--- Test 3 Start ---" >> "$OUTPUT_LOG"

# Extract the latest proposal details
PROPOSAL_JSON=$(grep -A 20 "Test 2 Start" "$OUTPUT_LOG" | grep '"kind":"mcp/proposal"' | head -1)
PROPOSAL_ID=$(echo "$PROPOSAL_JSON" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# Human fulfills the proposal by sending mcp/request with correlation_id
# The request should go to fulfiller-agent which has the calculate tool
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"kind\": \"mcp/request\",
    \"to\": [\"fulfiller-agent\"],
    \"correlation_id\": [\"$PROPOSAL_ID\"],
    \"payload\": {
      \"jsonrpc\": \"2.0\",
      \"id\": 300,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"add\",
        \"arguments\": {\"a\": 7, \"b\": 9}
      }
    }
  }" > /dev/null

# Check if the fulfiller responded with the calculation result (with retries)
if check_log_with_retry "Test 3 Start" '"kind":"mcp/response".*"result"'; then
  echo -e "${GREEN}✓ Fulfiller agent responded to fulfilled request${NC}"
  
  # Verify the response contains the correct calculation result
  # The result should be in the response: 7 + 9 = 16
  if grep -A 10 "Test 3 Start" "$OUTPUT_LOG" | grep -q '"result":.*16'; then
    echo -e "${GREEN}✓ Response contains correct calculation result (16)${NC}"
  else
    echo -e "${RED}✗ Response doesn't contain expected result (16)${NC}"
    echo "Expected the fulfiller to respond with the calculation result containing 16"
    echo "Output after Test 3:"
    grep -A 30 "Test 3 Start" "$OUTPUT_LOG"
    exit 1
  fi
else
  echo -e "${RED}✗ Fulfiller agent did not respond to request after $MAX_RETRIES retries${NC}"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 4: Agent can respond to direct tools/list request
echo -e "${BLUE}Test 4: Agent responds to direct tools/list request (has mcp/response)${NC}"

# Clear output log position
echo "--- Test 4 Start ---" >> "$OUTPUT_LOG"

# Send a direct tools/list request
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "mcp/request",
    "to": ["typescript-agent"],
    "payload": {
      "jsonrpc": "2.0",
      "id": 400,
      "method": "tools/list",
      "params": {}
    }
  }' > /dev/null

# The agent should respond directly to tools/list since it has mcp/response capability (with retries)
if check_log_with_retry "Test 4 Start" '"kind":"mcp/response".*"tools"'; then
  echo -e "${GREEN}✓ TypeScript agent responded with tools list${NC}"
else
  echo -e "${RED}✗ TypeScript agent did not respond with tools after $MAX_RETRIES retries${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 5: Verify agent respects capability constraints
echo -e "${BLUE}Test 5: Verifying agent respects capability constraints${NC}"

# Check logs for any capability violations from the TypeScript agent
if grep -q "typescript-agent.*capability.*violation" "$OUTPUT_LOG"; then
  echo -e "${YELLOW}⚠ TypeScript agent had capability violations${NC}"
  exit 1
else
  echo -e "${GREEN}✓ No capability violations from TypeScript agent${NC}"
fi

echo ""
echo -e "${GREEN}=== All Tests Passed ===${NC}"
echo -e "${GREEN}✓ Propose->Fulfill->Response pattern working correctly${NC}"
echo ""

exit 0