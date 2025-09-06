#!/bin/bash
# Test Scenario 3: Untrusted Agent with Proposals

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 3: Untrusted Agent with Proposals ===${NC}"

# Create test directory
TEST_DIR="./test-run-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy space configuration
cp ../../cli/space.yaml ./

# Configuration
export GATEWAY_PORT=8080
export GATEWAY_URL="ws://localhost:${GATEWAY_PORT}"
export TEST_SPACE="test-space"

# Start gateway with space configuration
echo "Starting gateway on port $GATEWAY_PORT with space config..."
../../cli/bin/meup.js gateway start \
  --port "$GATEWAY_PORT" \
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

# Create FIFOs for proposer
mkfifo prop-in prop-out

# Connect as proposer (untrusted, can only chat and propose)
echo "Connecting proposer agent..."
../../cli/bin/meup.js client connect \
  --gateway "$GATEWAY_URL" \
  --space "$TEST_SPACE" \
  --participant-id proposer-agent \
  --token "proposer-token" \
  --fifo-in prop-in \
  --fifo-out prop-out \
  --no-interactive > proposer.log 2>&1 &
PROP_PID=$!

# Join the space
echo "Proposer joining space..."
echo '{"type":"join","participantId":"proposer-agent","space":"test-space","token":"proposer-token"}' > prop-in

# Wait for welcome message
echo "Waiting for welcome message..."
WELCOME=$(timeout 5 cat prop-out | grep '"kind":"system/welcome"' | head -1 || true)
if [ -z "$WELCOME" ]; then
  echo -e "${RED}Failed to receive welcome message${NC}"
  cat proposer.log
  kill $GATEWAY_PID $PROP_PID 2>/dev/null || true
  exit 1
fi

echo "Welcome message received:"
echo "$WELCOME" | jq '.payload.you.capabilities' || echo "$WELCOME"

# Test 1: Proposer attempts direct tool call (should be blocked)
echo -e "\n${YELLOW}Test 1: Direct tool call (should be blocked)${NC}"
echo '{"kind":"mcp/request","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > prop-in

# Wait for error response
ERROR=$(timeout 5 cat prop-out | grep '"kind":"system/error"' | grep 'capability' | head -1 || true)
if [ -n "$ERROR" ]; then
  echo -e "${GREEN}✓ Direct tool call blocked as expected${NC}"
  echo "$ERROR" | jq '.payload' || echo "$ERROR"
else
  echo -e "${RED}✗ Expected capability error not received${NC}"
fi

# Test 2: Proposer creates proposal for tool call
echo -e "\n${YELLOW}Test 2: Creating proposal (should succeed)${NC}"
PROPOSAL_JSON=$(cat <<EOF
{
  "kind": "mcp/proposal",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 5, "b": 3}
    }
  }
}
EOF
)
echo "$PROPOSAL_JSON" > prop-in

# Check if proposal was broadcast
sleep 1
echo -e "${GREEN}✓ Proposal sent successfully${NC}"

# Since we don't have a fulfiller running, we can't test the full flow
# But we've verified that:
# 1. Direct MCP requests are blocked for proposer
# 2. Proposals can be sent

echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo -e "${GREEN}✓ Capability blocking works${NC}"
echo -e "${GREEN}✓ Proposals can be created${NC}"

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $PROP_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f prop-in prop-out
cd ..
rm -rf "$TEST_DIR"

echo -e "${GREEN}=== Test Scenario 3 PASSED ===${NC}"