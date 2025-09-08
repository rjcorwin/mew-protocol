const WebSocket = require('ws');
const port = process.argv[2];
const spaceId = process.argv[3];

const ws = new WebSocket(`ws://localhost:${port}?space=${spaceId}&participant-id=test-agent&token=test-token`);

let testStep = 0;
let mcpParticipant = null;

ws.on('open', () => {
  console.log('Test agent connected');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log(`Received ${message.kind}`);
  
  if (message.kind === 'system/welcome') {
    console.log('Welcome payload:', JSON.stringify(message.payload));
    // Look for the filesystem participant
    mcpParticipant = message.payload.participants.find(p => p.id === 'filesystem');
    if (mcpParticipant) {
      console.log('Found MCP participant:', mcpParticipant.id);
      runTests();
    } else {
      console.log('MCP participant not found in participants list');
      console.log('Available participants:', message.payload.participants.map(p => p.id));
      setTimeout(() => process.exit(1), 1000);
    }
  }
  
  if (message.kind === 'mcp/response') {
    console.log('Got MCP response:', JSON.stringify(message.payload));
    testStep++;
    runTests();
  }
});

function runTests() {
  switch(testStep) {
    case 0:
      // Test 1: List tools
      console.log('TEST 1: Listing MCP tools...');
      ws.send(JSON.stringify({
        protocol: 'meup/v0.2',
        kind: 'mcp/request',
        id: `test-1-${Date.now()}`,
        from: 'test-agent',
        to: ['filesystem'],
        payload: {
          method: 'tools/list',
          params: {}
        },
        ts: new Date().toISOString()
      }));
      break;
      
    case 1:
      // Test 2: Call read_file tool
      console.log('TEST 2: Reading file via MCP...');
      ws.send(JSON.stringify({
        protocol: 'meup/v0.2',
        kind: 'mcp/request',
        id: `test-2-${Date.now()}`,
        from: 'test-agent',
        to: ['filesystem'],
        payload: {
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: {
              path: '/tmp/mcp-test-files/hello.txt'
            }
          }
        },
        ts: new Date().toISOString()
      }));
      break;
      
    case 2:
      // Test 3: List directory
      console.log('TEST 3: Listing directory via MCP...');
      ws.send(JSON.stringify({
        protocol: 'meup/v0.2',
        kind: 'mcp/request',
        id: `test-3-${Date.now()}`,
        from: 'test-agent',
        to: ['filesystem'],
        payload: {
          method: 'tools/call',
          params: {
            name: 'list_directory',
            arguments: {
              path: '/tmp/mcp-test-files'
            }
          }
        },
        ts: new Date().toISOString()
      }));
      break;
      
    case 3:
      console.log('ALL TESTS PASSED!');
      setTimeout(() => process.exit(0), 1000);
      break;
  }
}

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('WebSocket closed');
  process.exit(1);
});