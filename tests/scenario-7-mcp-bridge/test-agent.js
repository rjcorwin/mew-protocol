#!/usr/bin/env node
/**
 * Test Agent for MCP Bridge scenario - Simple WebSocket client
 */

const WebSocket = require('ws');
const port = process.argv[2];
const spaceId = process.argv[3];

console.log('Test agent starting with args:', process.argv);
console.log('Port:', port, 'Space:', spaceId);

if (!port || !spaceId) {
  console.error('ERROR: Missing port or spaceId arguments');
  console.error('Usage: node test-agent.js <port> <spaceId>');
  process.exit(1);
}

const wsUrl = `ws://localhost:${port}`;
console.log('Connecting to:', wsUrl);

const ws = new WebSocket(wsUrl);

let testStep = 0;
let mcpParticipant = null;
let isAuthenticated = false;

ws.on('open', () => {
  console.log('WebSocket connected, sending join...');
  
  // Send join message per MEW v0.2 spec
  ws.send(JSON.stringify({
    protocol: 'mew/v0.2',
    kind: 'system/join',
    id: `join-${Date.now()}`,
    from: 'test-agent',
    payload: {
      space: spaceId,
      participantId: 'test-agent',
      token: 'test-token'
    },
    ts: new Date().toISOString()
  }));
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  process.exit(1);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log(`Received ${message.kind}`, message.from ? `from ${message.from}` : '');
  
  // Debug output for all messages
  if (message.kind !== 'system/welcome' && message.kind !== 'system/presence') {
    console.log('Full message:', JSON.stringify(message, null, 2));
  }
  
  if (message.kind === 'system/welcome') {
    isAuthenticated = true;
    console.log('Authenticated! Welcome payload participants:', message.payload.participants?.length || 0, 'participants');
    
    // Look for the filesystem participant
    mcpParticipant = message.payload.participants?.find(p => p.id === 'filesystem');
    if (mcpParticipant) {
      console.log('Found MCP participant:', mcpParticipant.id);
      setTimeout(() => runTests(), 2000); // Wait for MCP to fully initialize
    } else {
      console.log('MCP participant not found in participants list');
      console.log('Available participants:', message.payload.participants?.map(p => p.id) || []);
      console.log('Waiting for filesystem to join...');
    }
  }
  
  if (message.kind === 'system/presence' && message.payload?.event === 'join') {
    console.log('Participant joined:', message.payload.participant?.id);
    if (message.payload.participant?.id === 'filesystem') {
      mcpParticipant = message.payload.participant;
      console.log('Filesystem joined! Starting tests in 2 seconds...');
      setTimeout(() => runTests(), 2000);
    }
  }
  
  if (message.kind === 'mcp/response') {
    console.log('Got MCP response:', JSON.stringify(message.payload));
    testStep++;
    runTests();
  }
});

function runTests() {
  if (!isAuthenticated) {
    console.log('Waiting for authentication...');
    return;
  }
  
  switch(testStep) {
    case 0:
      // Test 1: List tools
      console.log('TEST 1: Listing MCP tools...');
      ws.send(JSON.stringify({
        protocol: 'mew/v0.2',
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
        protocol: 'mew/v0.2',
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
        protocol: 'mew/v0.2',
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

ws.on('close', () => {
  console.log('WebSocket closed');
  process.exit(1);
});