#!/usr/bin/env node

/**
 * Auto-fulfiller for MEW Protocol proposals
 * Automatically fulfills proposals by sending them to the correct participant
 */

const WebSocket = require('ws');

const args = process.argv.slice(2);
let gatewayUrl = 'ws://localhost:8080';
let space = 'coder-demo';
let token = 'fulfiller-token';
let participantId = 'auto-fulfiller';

// Parse command line arguments
for (let i = 0; i < args.length; i += 2) {
  switch (args[i]) {
    case '--gateway':
      gatewayUrl = args[i + 1];
      break;
    case '--space':
      space = args[i + 1];
      break;
    case '--token':
      token = args[i + 1];
      break;
    case '--participant-id':
      participantId = args[i + 1];
      break;
  }
}

console.log(`Auto-fulfiller starting...`);
console.log(`Gateway: ${gatewayUrl}`);
console.log(`Space: ${space}`);
console.log(`Token: ${token}`);
console.log(`Participant ID: ${participantId}`);

const ws = new WebSocket(`${gatewayUrl}?space=${space}`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

ws.on('open', () => {
  console.log('Connected to gateway');
  
  // Send join message to properly join the space
  const joinMessage = {
    type: 'join',
    space: space,
    token: token,
    participantId: participantId,
    capabilities: [] // Auto-fulfiller capabilities defined in space.yaml
  };
  
  console.log('Sending join message:', JSON.stringify(joinMessage));
  ws.send(JSON.stringify(joinMessage));
  
  console.log('Waiting for messages...');
  console.log('WebSocket state:', ws.readyState);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  // Log ALL messages for debugging
  console.log(`Raw message received: ${msg.kind} from ${msg.from}`);
  
  // Handle system messages
  if (msg.kind === 'system/welcome') {
    console.log('Welcome message received!');
    console.log('My ID:', msg.payload?.you?.id);
    console.log('My capabilities:', JSON.stringify(msg.payload?.you?.capabilities, null, 2));
    console.log('Participants in space:', msg.payload?.participants?.map(p => p.id).join(', '));
    return;
  }
  
  if (msg.kind === 'system/presence') {
    console.log(`Presence event: ${msg.payload?.event} - ${msg.payload?.participant?.id}`);
    return;
  }
  
  // Log received messages
  const timestamp = new Date(msg.ts).toLocaleTimeString();
  console.log(`[${timestamp}] ${msg.from} → ${msg.kind}`);
  
  // Auto-fulfill proposals
  if (msg.kind === 'mcp/proposal') {
    console.log(`  PROPOSAL DETECTED:`);
    console.log(`    From: ${msg.from}`);
    console.log(`    To: ${msg.to ? msg.to.join(', ') : '(broadcast)'}`);
    console.log(`    Method: ${msg.payload?.method}`);
    console.log(`    Tool: ${msg.payload?.params?.name}`);
    
    // Extract target from proposal's 'to' field or default to mcp-fs-bridge
    const target = msg.to?.[0] || 'mcp-fs-bridge';
    
    // Create fulfillment
    const fulfillment = {
      protocol: 'mew/v0.3',
      id: `fulfill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ts: new Date().toISOString(),
      from: participantId,
      to: [target], // Send to the correct participant!
      kind: 'mcp/request',
      correlation_id: [msg.id],
      payload: {
        jsonrpc: '2.0',
        id: Date.now(),
        method: msg.payload.method,
        params: msg.payload.params
      }
    };
    
    console.log(`  FULFILLING → ${target}`);
    console.log(`    Correlation: ${msg.id}`);
    
    // Send fulfillment after a brief delay
    setTimeout(() => {
      ws.send(JSON.stringify(fulfillment));
      console.log(`  ✓ Fulfillment sent to ${target}`);
    }, 500);
  }
  
  // Log responses
  if (msg.kind === 'mcp/response') {
    if (msg.payload.result) {
      const content = msg.payload.result.content;
      if (content && Array.isArray(content)) {
        const text = content.map(c => c.text).join('\n');
        console.log(`  RESPONSE: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      }
    } else if (msg.payload.error) {
      console.log(`  ERROR: ${msg.payload.error.message}`);
    }
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

ws.on('close', () => {
  console.log('Disconnected from gateway');
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  ws.close();
});

console.log('Auto-fulfiller running. Press Ctrl+C to stop.');