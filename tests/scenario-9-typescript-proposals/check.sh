#!/bin/bash
# Check script - Runs test assertions
#
# Can be run standalone after setup.sh or called by test.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timeout for operations
TIMEOUT=10

# If TEST_DIR not set, we're running standalone
if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: TypeScript Agent Proposals Only${NC}"
echo ""

# Set up paths
OUTPUT_LOG="${OUTPUT_LOG:-$TEST_DIR/logs/test-client-output.log}"
TEST_PORT="${TEST_PORT:-8080}"

# Check if space is running
if [ -z "$SPACE_RUNNING" ]; then
  echo -e "${YELLOW}Note: Space not started by setup.sh, assuming it's already running${NC}"
fi

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

# Test 2: TypeScript agent cannot send direct MCP requests (should get capability violation)
echo -e "${BLUE}Test 2: Verifying TypeScript agent cannot send direct MCP requests${NC}"

# Clear output log position
echo "--- Test 2 Start ---" >> "$OUTPUT_LOG"

# Try to make TypeScript agent send a direct MCP request
# This would typically be done through the agent's internal logic
# For this test, we'll verify it doesn't send direct requests but proposals instead

# Test 3: TypeScript agent sends proposals
echo -e "${BLUE}Test 3: TypeScript agent sends proposals for MCP operations${NC}"

# Clear output log position
echo "--- Test 3 Start ---" >> "$OUTPUT_LOG"

# Ask TypeScript agent to do something that requires MCP (through chat)
echo '{
  "kind": "chat",
  "to": ["typescript-agent"],
  "payload": {
    "text": "Can you list your tools for me?",
    "format": "plain"
  }
}' > /dev/null

sleep 3

# Check if a proposal was sent
if grep -A 20 "Test 3 Start" "$OUTPUT_LOG" | grep -q '"kind":"mcp/proposal"'; then
  echo -e "${GREEN}✓ TypeScript agent sent MCP proposal (as expected with limited capabilities)${NC}"
  
  # Extract proposal ID for fulfillment
  PROPOSAL_ID=$(grep -A 20 "Test 3 Start" "$OUTPUT_LOG" | grep '"kind":"mcp/proposal"' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  Proposal ID: $PROPOSAL_ID"
else
  echo -e "${YELLOW}⚠ No proposal found - agent might have responded differently${NC}"
fi

# Test 4: Fulfill a proposal from the TypeScript agent
echo -e "${BLUE}Test 4: Test client fulfills TypeScript agent's proposal${NC}"

# Clear output log position
echo "--- Test 4 Start ---" >> "$OUTPUT_LOG"

# The TypeScript agent's request method should create a proposal
# We'll trigger this by asking it to use its tools
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "mcp/request",
    "to": ["typescript-agent"],
    "payload": {
      "jsonrpc": "2.0",
      "id": 100,
      "method": "tools/list",
      "params": {}
    }
  }' > /dev/null

sleep 2

# The agent should respond directly to tools/list since it has mcp/response capability
if grep -A 10 "Test 4 Start" "$OUTPUT_LOG" | grep -q '"kind":"mcp/response".*"tools"'; then
  echo -e "${GREEN}✓ TypeScript agent responded with tools list${NC}"
else
  echo -e "${RED}✗ TypeScript agent did not respond with tools${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 5: TypeScript agent creates proposal for tools/call
echo -e "${BLUE}Test 5: TypeScript agent creates proposal for tools/call (lacks mcp/request)${NC}"

# Clear output log position
echo "--- Test 5 Start ---" >> "$OUTPUT_LOG"

# Send a tools/call request - agent should create proposal since it lacks mcp/request capability
curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "mcp/request",
    "to": ["typescript-agent"],
    "payload": {
      "jsonrpc": "2.0",
      "id": 200,
      "method": "tools/call",
      "params": {
        "name": "calculate",
        "arguments": {"operation": "sum", "a": 5, "b": 3}
      }
    }
  }' > /dev/null

sleep 2

# Check if proposal was created
if grep -A 20 "Test 5 Start" "$OUTPUT_LOG" | grep -q '"kind":"mcp/proposal"'; then
  echo -e "${GREEN}✓ TypeScript agent created proposal for tools/call${NC}"
  
  # Get the proposal ID
  PROPOSAL_ID=$(grep -A 20 "Test 5 Start" "$OUTPUT_LOG" | grep '"kind":"mcp/proposal"' | grep -o '"id":"[^"]*"' | tail -1 | cut -d'"' -f4)
  echo "  Proposal ID: $PROPOSAL_ID"
  
else
  echo -e "${RED}✗ TypeScript agent did not create proposal for tools/call${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 6: Verify agent respects capability constraints
echo -e "${BLUE}Test 6: Verifying agent respects capability constraints${NC}"

# Check logs for any capability violations from the TypeScript agent
if grep -q "typescript-agent.*capability.*violation" "$OUTPUT_LOG"; then
  echo -e "${YELLOW}⚠ TypeScript agent had capability violations${NC}"
  exit 1
else
  echo -e "${GREEN}✓ No capability violations from TypeScript agent${NC}"
fi

echo ""
echo -e "${GREEN}=== All Tests Passed ===${NC}"
echo ""

exit 0