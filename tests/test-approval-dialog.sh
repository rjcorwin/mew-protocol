#!/bin/bash
#
# Test script for MCP Operation Approval Dialog
# Tests the Option 2 implementation (Simple Numbered List MVP)
#

# Setup
set -e
cd "$(dirname "$0")/.."

echo "MEW Protocol - MCP Operation Approval Dialog Test"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test setup
TEST_DIR="/tmp/mew-test-approval-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    cd /
    rm -rf "$TEST_DIR"
    pkill -f "mew-test-approval" 2>/dev/null || true
}
trap cleanup EXIT

# Create a test space configuration
cat > space.yaml <<EOF
space:
  id: test-approval-space
  name: "MCP Approval Test Space"
  description: "Testing MCP operation approval dialogs"

participants:
  human:
    capabilities:
      - kind: "mcp/*"
      - kind: "chat"

  untrusted-agent:
    command: "node"
    args: ["./agent.js"]
    auto_start: true
    capabilities:
      - kind: "mcp/proposal"  # Can only propose, not execute
      - kind: "chat"

  target-service:
    command: "node"
    args: ["./service.js"]
    auto_start: true
    capabilities:
      - kind: "mcp/response"
      - kind: "chat"
EOF

# Create a simple agent that sends proposals
cat > agent.js <<'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/ws?space=test-approval-space');

ws.on('open', () => {
  console.log('Untrusted agent connected');

  // Wait for welcome, then send a proposal
  setTimeout(() => {
    const proposal = {
      protocol: 'mew/v0.3',
      id: `proposal-${Date.now()}`,
      ts: new Date().toISOString(),
      from: 'untrusted-agent',
      to: ['target-service'],
      kind: 'mcp/proposal',
      payload: {
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: 'config.json',
            content: '{\n  "name": "my-app"\n}'
          }
        }
      }
    };

    console.log('Sending MCP proposal...');
    ws.send(JSON.stringify(proposal));
  }, 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.kind === 'system/welcome') {
    console.log('Agent received welcome');
  }
});
EOF

# Create a simple service that responds to requests
cat > service.js <<'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/ws?space=test-approval-space');

ws.on('open', () => {
  console.log('Target service connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);

  if (msg.kind === 'mcp/request' && msg.to?.includes('target-service')) {
    console.log('Service received MCP request:', msg.payload.method);

    // Send response
    const response = {
      protocol: 'mew/v0.3',
      id: `response-${Date.now()}`,
      ts: new Date().toISOString(),
      from: 'target-service',
      to: [msg.from],
      kind: 'mcp/response',
      correlation_id: [msg.id],
      payload: {
        jsonrpc: '2.0',
        id: msg.payload.id,
        result: {
          content: [{
            type: 'text',
            text: 'Operation completed successfully'
          }]
        }
      }
    };

    ws.send(JSON.stringify(response));
    console.log('Service sent response');
  }
});
EOF

echo -e "${GREEN}Test Setup Complete${NC}"
echo ""
echo "This test will:"
echo "1. Start a gateway with the test space"
echo "2. Launch an untrusted agent that sends MCP proposals"
echo "3. Connect as human participant to see approval dialog"
echo ""
echo -e "${YELLOW}Instructions:${NC}"
echo "- When you see the approval dialog, press '1' to approve"
echo "- The dialog should show:"
echo "  * Participant: untrusted-agent"
echo "  * Method: tools/call"
echo "  * Tool: write_file"
echo "  * Target: target-service"
echo "  * Arguments displayed in a box"
echo ""
echo "Press Enter to start the test..."
read

# Start gateway in background
echo -e "\n${GREEN}Starting gateway...${NC}"
npx @mew-protocol/cli gateway start --port 8080 --space-config ./space.yaml > gateway.log 2>&1 &
GATEWAY_PID=$!
sleep 3

# Check if gateway started
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${RED}Gateway failed to start. Check gateway.log${NC}"
    cat gateway.log
    exit 1
fi

echo -e "${GREEN}Gateway started successfully${NC}"
echo ""
echo -e "${YELLOW}Connecting as human participant...${NC}"
echo -e "${YELLOW}Watch for the approval dialog to appear!${NC}"
echo ""

# Connect as human with advanced UI
npx @mew-protocol/cli client connect \
  --gateway ws://localhost:8080 \
  --space test-approval-space \
  --participant-id human

echo ""
echo -e "${GREEN}Test Complete!${NC}"
echo ""
echo "If you saw the approval dialog with:"
echo "- Simple numbered list (1. Yes, 2. No)"
echo "- Clear operation details"
echo "- Arguments in a bordered box"
echo ""
echo "Then the Option 2 implementation is working correctly!"