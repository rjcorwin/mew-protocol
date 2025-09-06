#!/bin/bash
# Test the capability system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Testing Capability System ===${NC}"

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

echo -e "${GREEN}✓ Gateway started${NC}"

# Test with limited token using Node.js WebSocket
echo "Testing capability enforcement..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:$PORT');

ws.on('open', () => {
  console.log('Connected, sending join...');
  // Join as limited-agent (only has chat capability)
  ws.send(JSON.stringify({
    kind: 'system/join',
    participantId: 'limited-test',
    space: 'test-space',
    token: 'limited-token'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg.kind);
  
  if (msg.kind === 'system/welcome') {
    console.log('Capabilities:', JSON.stringify(msg.payload.you.capabilities));
    
    // Try to send MCP request (should be blocked)
    console.log('Attempting MCP request...');
    ws.send(JSON.stringify({
      kind: 'mcp/request',
      payload: { method: 'tools/list', params: {} }
    }));
    
    // Try to send chat (should work)
    setTimeout(() => {
      console.log('Attempting chat message...');
      ws.send(JSON.stringify({
        kind: 'chat',
        payload: { text: 'Hello world' }
      }));
    }, 500);
    
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 2000);
  } else if (msg.kind === 'system/error') {
    console.log('Error received:', msg.payload.error);
    if (msg.payload.error === 'capability_violation') {
      console.log('✓ Capability violation detected as expected');
    }
  } else if (msg.kind === 'chat') {
    console.log('✓ Chat message received');
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});
" 2>&1 | tee test.log

# Check results
if grep -q "capability_violation" test.log; then
  echo -e "${GREEN}✓ Capability enforcement working${NC}"
else
  echo -e "${RED}✗ Capability enforcement not working${NC}"
  cat gateway.log
fi

# Cleanup
kill $GATEWAY_PID 2>/dev/null || true
cd /
rm -rf "$TEST_DIR"

echo -e "${GREEN}=== Test Complete ===${NC}"