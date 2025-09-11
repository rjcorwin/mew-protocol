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
echo -e "${BLUE}Scenario: TypeScript Agent MCP Requests${NC}"
echo ""

# Set up paths
FIFO_IN="${FIFO_IN:-$TEST_DIR/fifos/test-client-in}"
OUTPUT_LOG="${OUTPUT_LOG:-$TEST_DIR/logs/test-client-output.log}"

# Check if space is running
if [ -z "$SPACE_RUNNING" ]; then
  echo -e "${YELLOW}Note: Space not started by setup.sh, assuming it's already running${NC}"
fi

# Test 1: Check agent welcome and capabilities
echo -e "${BLUE}Test 1: Verifying TypeScript agent connected${NC}"
if timeout $TIMEOUT grep -q "typescript-agent.*joined" "$OUTPUT_LOG"; then
  echo -e "${GREEN}✓ TypeScript agent connected successfully${NC}"
else
  echo -e "${RED}✗ TypeScript agent did not connect${NC}"
  tail -20 "$OUTPUT_LOG"
  exit 1
fi

# Test 2: List tools
echo -e "${BLUE}Test 2: Listing agent tools${NC}"

# Clear output log position
echo "--- Test 2 Start ---" >> "$OUTPUT_LOG"

# Send tools/list request
echo '{
  "kind": "mcp/request",
  "to": ["typescript-agent"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }
}' > "$FIFO_IN"

sleep 2

# Check for tools response
if grep -A 20 "Test 2 Start" "$OUTPUT_LOG" | grep -q '"tools".*"calculate"'; then
  echo -e "${GREEN}✓ Tools list received with calculate tool${NC}"
else
  echo -e "${RED}✗ Tools list not received or missing calculate tool${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 3: Execute calculate tool - addition
echo -e "${BLUE}Test 3: Testing calculate tool (5 + 3)${NC}"

# Clear output log position
echo "--- Test 3 Start ---" >> "$OUTPUT_LOG"

# Send calculate request
echo '{
  "kind": "mcp/request",
  "to": ["typescript-agent"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {
        "operation": "add",
        "a": 5,
        "b": 3
      }
    }
  }
}' > "$FIFO_IN"

sleep 2

# Check for calculation result
if grep -A 10 "Test 3 Start" "$OUTPUT_LOG" | grep -q "5 add 3 = 8"; then
  echo -e "${GREEN}✓ Calculate tool executed correctly (5 + 3 = 8)${NC}"
else
  echo -e "${RED}✗ Calculate tool did not return expected result${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 4: Execute calculate tool - multiplication
echo -e "${BLUE}Test 4: Testing calculate tool (7 * 6)${NC}"

# Clear output log position
echo "--- Test 4 Start ---" >> "$OUTPUT_LOG"

# Send multiply request
echo '{
  "kind": "mcp/request",
  "to": ["typescript-agent"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {
        "operation": "multiply",
        "a": 7,
        "b": 6
      }
    }
  }
}' > "$FIFO_IN"

sleep 2

# Check for calculation result
if grep -A 10 "Test 4 Start" "$OUTPUT_LOG" | grep -q "7 multiply 6 = 42"; then
  echo -e "${GREEN}✓ Calculate tool executed correctly (7 * 6 = 42)${NC}"
else
  echo -e "${RED}✗ Calculate tool did not return expected result${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 5: Test echo tool
echo -e "${BLUE}Test 5: Testing echo tool${NC}"

# Clear output log position
echo "--- Test 5 Start ---" >> "$OUTPUT_LOG"

# Send echo request
echo '{
  "kind": "mcp/request",
  "to": ["typescript-agent"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello from TypeScript agent test!"
      }
    }
  }
}' > "$FIFO_IN"

sleep 2

# Check for echo result
if grep -A 10 "Test 5 Start" "$OUTPUT_LOG" | grep -q "Echo: Hello from TypeScript agent test!"; then
  echo -e "${GREEN}✓ Echo tool executed correctly${NC}"
else
  echo -e "${RED}✗ Echo tool did not return expected result${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 6: Chat interaction
echo -e "${BLUE}Test 6: Testing chat interaction${NC}"

# Clear output log position
echo "--- Test 6 Start ---" >> "$OUTPUT_LOG"

# Send chat message
echo '{
  "kind": "chat",
  "to": ["typescript-agent"],
  "payload": {
    "text": "Hello TypeScript agent, can you help me?",
    "format": "plain"
  }
}' > "$FIFO_IN"

sleep 3

# Check for chat response
if grep -A 10 "Test 6 Start" "$OUTPUT_LOG" | grep -q -E "(assist|help|MEW protocol)"; then
  echo -e "${GREEN}✓ Agent responded to chat message${NC}"
else
  echo -e "${RED}✗ Agent did not respond to chat${NC}"
  echo "Output log content:"
  tail -30 "$OUTPUT_LOG"
  exit 1
fi

# Test 7: Check reasoning messages (if enabled)
echo -e "${BLUE}Test 7: Checking reasoning transparency${NC}"

# Check if reasoning messages were sent
if grep -q "reasoning/start" "$OUTPUT_LOG"; then
  echo -e "${GREEN}✓ Agent sent reasoning/start messages${NC}"
  if grep -q "reasoning/thought" "$OUTPUT_LOG"; then
    echo -e "${GREEN}✓ Agent sent reasoning/thought messages${NC}"
  fi
  if grep -q "reasoning/conclusion" "$OUTPUT_LOG"; then
    echo -e "${GREEN}✓ Agent sent reasoning/conclusion messages${NC}"
  fi
else
  echo -e "${YELLOW}⚠ No reasoning messages found (might be disabled)${NC}"
fi

echo ""
echo -e "${GREEN}=== All Tests Passed ===${NC}"
echo ""

exit 0