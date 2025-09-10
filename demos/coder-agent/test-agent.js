#!/usr/bin/env node
/**
 * Simple test agent to debug connection issues
 */

const WebSocket = require('ws');

const gateway = 'ws://localhost:8080';
const token = 'coder-token';
const space = 'simple-coder';

console.log('Connecting to', gateway);

const ws = new WebSocket(gateway, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Space-ID': space
  }
});

ws.on('open', () => {
  console.log('WebSocket connected');
  
  // Send auth message
  const authMessage = {
    protocol: 'mew/v0.3',
    kind: 'auth',
    from: 'test-agent',
    to: 'system:gateway',
    payload: {
      token: token,
      participant_id: 'test-agent',
      capabilities: [
        { kind: 'chat' }
      ]
    }
  };
  
  console.log('Sending auth:', authMessage);
  ws.send(JSON.stringify(authMessage));
});

ws.on('message', (data) => {
  const envelope = JSON.parse(data.toString());
  console.log('Received:', envelope.kind, 'from', envelope.from);
  
  if (envelope.kind === 'system/welcome') {
    console.log('Successfully joined space!');
    
    // Send a test message
    setTimeout(() => {
      const chatMessage = {
        protocol: 'mew/v0.3',
        kind: 'chat',
        from: 'test-agent',
        payload: {
          text: 'Hello from test agent!'
        }
      };
      console.log('Sending chat message');
      ws.send(JSON.stringify(chatMessage));
    }, 1000);
  }
  
  if (envelope.kind === 'chat' && envelope.from !== 'test-agent') {
    console.log('Got chat:', envelope.payload.text);
    
    // Echo back
    const response = {
      protocol: 'mew/v0.3',
      kind: 'chat',
      from: 'test-agent',
      payload: {
        text: `You said: "${envelope.payload.text}"`
      }
    };
    ws.send(JSON.stringify(response));
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed:', code, reason.toString());
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  ws.close();
  process.exit(0);
});