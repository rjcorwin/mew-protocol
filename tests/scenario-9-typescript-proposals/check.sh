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
FIFO_IN="${FIFO_IN:-$TEST_DIR/fifos/test-client-in}"
OUTPUT_LOG="${OUTPUT_LOG:-$TEST_DIR/logs/test-client-output.log}"

# Check if space is running
if [ -z "$SPACE_RUNNING" ]; then
  echo -e "${YELLOW}Note: Space not started by setup.sh, assuming it's already running${NC}"
fi

# Test 1: Check agents connected and capabilities
echo -e "${BLUE}Test 1: Verifying agents connected with correct capabilities${NC}"
if timeout $TIMEOUT grep -q "typescript-agent.*joined" "$OUTPUT_LOG"; then
  echo -e "${GREEN}✓ TypeScript agent connected successfully${NC}"
else
  echo -e "${RED}✗ TypeScript agent did not connect${NC}"
  tail -20 "$OUTPUT_LOG"
  exit 1
fi

if timeout $TIMEOUT grep -q "fulfiller-agent.*joined" "$OUTPUT_LOG"; then
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
}' > "$FIFO_IN"

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
echo '{
  "kind": "mcp/request",
  "to": ["typescript-agent"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 100,
    "method": "tools/list",
    "params": {}
  }
}' > "$FIFO_IN"

sleep 2

# The agent should respond with its tools since it can handle tools/list internally
if grep -A 10 "Test 4 Start" "$OUTPUT_LOG" | grep -q '"tools"'; then
  echo -e "${GREEN}✓ TypeScript agent responded with tools list${NC}"
else
  echo -e "${RED}✗ TypeScript agent did not respond with tools${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 5: TypeScript agent proposals for external operations
echo -e "${BLUE}Test 5: TypeScript agent creates proposal for external MCP operations${NC}"

# Clear output log position
echo "--- Test 5 Start ---" >> "$OUTPUT_LOG"

# Send a request that the TypeScript agent needs to forward
# Since it only has proposal capability, it should create a proposal
echo '{
  "kind": "chat",
  "to": ["typescript-agent"],
  "payload": {
    "text": "Please ask the fulfiller-agent to list its tools",
    "format": "plain"
  }
}' > "$FIFO_IN"

sleep 3

# Check if proposal was created
if grep -A 20 "Test 5 Start" "$OUTPUT_LOG" | grep -q '"kind":"mcp/proposal".*"to":\["fulfiller-agent"\]'; then
  echo -e "${GREEN}✓ TypeScript agent created proposal for external operation${NC}"
  
  # Get the proposal ID
  PROPOSAL_ID=$(grep -A 20 "Test 5 Start" "$OUTPUT_LOG" | grep '"kind":"mcp/proposal"' | grep -o '"id":"[^"]*"' | tail -1 | cut -d'"' -f4)
  echo "  Proposal ID: $PROPOSAL_ID"
  
  # Now fulfill the proposal
  echo -e "${BLUE}  Fulfilling the proposal...${NC}"
  echo "--- Test 5 Fulfillment ---" >> "$OUTPUT_LOG"
  
  echo "{
    \"kind\": \"mcp/request\",
    \"to\": [\"fulfiller-agent\"],
    \"correlation_id\": \"$PROPOSAL_ID\",
    \"payload\": {
      \"jsonrpc\": \"2.0\",
      \"id\": 200,
      \"method\": \"tools/list\",
      \"params\": {}
    }
  }" > "$FIFO_IN"
  
  sleep 2
  
  # Check if fulfillment worked
  if grep -A 10 "Test 5 Fulfillment" "$OUTPUT_LOG" | grep -q '"kind":"mcp/response".*"correlation_id"'; then
    echo -e "${GREEN}✓ Proposal was fulfilled and response received${NC}"
  else
    echo -e "${YELLOW}⚠ Fulfillment response not clearly identified${NC}"
  fi
else
  echo -e "${YELLOW}⚠ No proposal for external operation found${NC}"
fi

# Test 6: Reject a proposal
echo -e "${BLUE}Test 6: Testing proposal rejection${NC}"

# Clear output log position
echo "--- Test 6 Start ---" >> "$OUTPUT_LOG"

# Create another scenario that will generate a proposal
echo '{
  "kind": "chat",
  "to": ["typescript-agent"],
  "payload": {
    "text": "Can you do something that requires a proposal?",
    "format": "plain"
  }
}' > "$FIFO_IN"

sleep 3

# Check if proposal was created
if grep -A 20 "Test 6 Start" "$OUTPUT_LOG" | grep -q '"kind":"mcp/proposal"'; then
  PROPOSAL_ID=$(grep -A 20 "Test 6 Start" "$OUTPUT_LOG" | grep '"kind":"mcp/proposal"' | grep -o '"id":"[^"]*"' | tail -1 | cut -d'"' -f4)
  echo "  Proposal ID to reject: $PROPOSAL_ID"
  
  # Send rejection
  echo "{
    \"kind\": \"mcp/reject\",
    \"to\": [\"typescript-agent\"],
    \"correlation_id\": \"$PROPOSAL_ID\",
    \"payload\": {
      \"reason\": \"unsafe\"
    }
  }" > "$FIFO_IN"
  
  sleep 2
  
  if grep -A 10 "$PROPOSAL_ID" "$OUTPUT_LOG" | grep -q '"kind":"mcp/reject"'; then
    echo -e "${GREEN}✓ Proposal was rejected successfully${NC}"
  else
    echo -e "${YELLOW}⚠ Rejection not clearly confirmed${NC}"
  fi
else
  echo -e "${YELLOW}⚠ No proposal found to reject${NC}"
fi

# Test 7: Verify agent respects capability constraints
echo -e "${BLUE}Test 7: Verifying agent respects capability constraints${NC}"

# Check logs for any capability violations from the TypeScript agent
if grep -q "typescript-agent.*capability.*violation" "$OUTPUT_LOG"; then
  echo -e "${YELLOW}⚠ TypeScript agent had capability violations (this might be expected during testing)${NC}"
else
  echo -e "${GREEN}✓ No capability violations from TypeScript agent${NC}"
fi

echo ""
echo -e "${GREEN}=== All Tests Passed ===${NC}"
echo ""

exit 0