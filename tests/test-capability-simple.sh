#!/bin/bash
# Simple test for capability system using CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Testing Capability System with CLI ===${NC}"

# Create test directory
TEST_DIR="/tmp/meup-test-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy space configuration
cp /Users/rj/Git/rjcorwin/mcpx-protocol/cli/space.yaml ./

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway
echo "Starting gateway on port $PORT..."
/Users/rj/Git/rjcorwin/mcpx-protocol/cli/bin/meup.js gateway start \
  --port $PORT \
  --space-config ./space.yaml \
  --log-level debug \
  > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 2

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started on port $PORT${NC}"

# Create FIFOs
mkfifo test-in test-out

# Connect as limited-agent (only has chat capability)
echo "Connecting limited-agent..."
/Users/rj/Git/rjcorwin/mcpx-protocol/cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space "test-space" \
  --participant-id "limited-agent" \
  --token "limited-token" \
  --fifo-in test-in \
  --fifo-out test-out \
  > client.log 2>&1 &
CLIENT_PID=$!

# Wait for client to connect
sleep 1

# Check for welcome message
echo "Checking welcome message..."
if timeout 2 cat test-out | grep -q "system/welcome"; then
  echo -e "${GREEN}✓ Welcome message received${NC}"
  WELCOME=$(timeout 1 cat test-out | grep "system/welcome" | head -1)
  echo "Capabilities: $(echo "$WELCOME" | grep -o '"capabilities":\[[^]]*\]')"
else
  echo -e "${RED}✗ No welcome message${NC}"
  cat client.log
fi

# Test 1: Try to send MCP request (should be blocked)
echo -e "\n${YELLOW}Test 1: MCP request (should be blocked)${NC}"
echo '{"kind":"mcp/request","payload":{"method":"tools/list","params":{}}}' > test-in

# Wait for error
sleep 1
if timeout 2 cat test-out | grep -q "capability_violation"; then
  echo -e "${GREEN}✓ MCP request blocked as expected${NC}"
else
  echo -e "${RED}✗ MCP request not blocked${NC}"
fi

# Test 2: Try to send chat (should work)
echo -e "\n${YELLOW}Test 2: Chat message (should work)${NC}"
echo '{"kind":"chat","payload":{"text":"Hello from limited agent"}}' > test-in

# Check if chat was broadcast
sleep 1
if timeout 2 cat test-out | grep -q '"kind":"chat"'; then
  echo -e "${GREEN}✓ Chat message sent successfully${NC}"
else
  echo -e "${RED}✗ Chat message failed${NC}"
fi

echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Gateway log tail:"
tail -5 gateway.log | grep -E "(Capability|participant)" || true

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $CLIENT_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f test-in test-out
cd /
rm -rf "$TEST_DIR"

echo -e "${GREEN}=== Test Complete ===${NC}"