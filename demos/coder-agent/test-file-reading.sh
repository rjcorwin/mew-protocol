#!/bin/bash

# Test the coder agent's ability to read files using tools

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to script directory
cd "$(dirname "$0")"

echo -e "${YELLOW}Starting MEW space with coder agent...${NC}"

# Start the space in background
../../cli/bin/mew.js space up --config space.yaml &
SPACE_PID=$!

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Connect as human and send test message
echo -e "${GREEN}Connecting as human to test file reading...${NC}"

# Create a test file
echo "This is a test file for the coder agent to read!" > workspace/test.txt

# Send message asking to read the file
node -e "
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080', {
  headers: {
    'Authorization': 'Bearer human-token'
  }
});

ws.on('open', () => {
  console.log('Connected as human');
  
  // Send join message
  ws.send(JSON.stringify({
    protocol: 'mew/v0.3',
    kind: 'auth',
    from: 'human',
    payload: {
      token: 'human-token',
      participant_id: 'human',
      space: 'coder-demo'
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.kind === 'system/welcome') {
    console.log('Joined space, sending test message...');
    
    // Send message asking to read file
    setTimeout(() => {
      ws.send(JSON.stringify({
        protocol: 'mew/v0.3',
        kind: 'chat',
        from: 'human',
        to: ['coder-agent'],
        payload: {
          text: 'Can you read the file test.txt and tell me what it contains?'
        }
      }));
      console.log('Sent request to read test.txt');
    }, 2000);
  }
  
  // Log proposals and responses
  if (msg.kind === 'mcp/proposal' && msg.from === 'coder-agent') {
    console.log('Coder agent created proposal:', JSON.stringify(msg.payload, null, 2));
    
    // Auto-approve the proposal if it's for reading
    if (msg.payload.method === 'tools/call' && 
        (msg.payload.params.name === 'read_file' || msg.payload.params.name === 'read_resource')) {
      console.log('Auto-approving read proposal...');
      
      // Fulfill the proposal
      ws.send(JSON.stringify({
        protocol: 'mew/v0.3',
        kind: 'mcp/request',
        from: 'human',
        to: ['mcp-fs-bridge'],
        correlation_id: [msg.id],
        payload: {
          jsonrpc: '2.0',
          id: Date.now(),
          method: msg.payload.method,
          params: msg.payload.params
        }
      }));
    }
  }
  
  if (msg.kind === 'chat' && msg.from === 'coder-agent') {
    console.log('Coder agent response:', msg.payload.text);
    
    // Check if the response contains the file content
    if (msg.payload.text.includes('test file')) {
      console.log('✅ SUCCESS: Agent was able to read the file!');
      process.exit(0);
    }
  }
  
  if (msg.kind === 'reasoning/thought' && msg.from === 'coder-agent') {
    console.log('Agent reasoning:', msg.payload.message);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('❌ TIMEOUT: Test did not complete within 30 seconds');
  process.exit(1);
}, 30000);
" &

CLIENT_PID=$!

# Wait for test to complete
wait $CLIENT_PID
TEST_RESULT=$?

# Cleanup
echo -e "${YELLOW}Cleaning up...${NC}"
kill $SPACE_PID 2>/dev/null
../../cli/bin/mew.js space down 2>/dev/null

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}Test passed!${NC}"
else
  echo -e "${RED}Test failed!${NC}"
fi

exit $TEST_RESULT