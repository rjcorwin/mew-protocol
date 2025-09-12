#!/usr/bin/env node

const WebSocket = require('ws');

console.log('Testing connection to MEW space...');

const ws = new WebSocket('ws://localhost:8080?space=coder-demo', {
  headers: {
    Authorization: 'Bearer human-token'
  }
});

ws.on('open', () => {
  console.log('Connected!');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`Received: ${msg.kind} from ${msg.from}`);
  
  if (msg.kind === 'system/welcome') {
    console.log('Welcome received, sending test message...');
    
    // Send a test chat message
    const testMsg = {
      protocol: 'mew/v0.3',
      id: 'test-1',
      ts: new Date().toISOString(),
      from: 'human',
      to: ['coder-agent'],
      kind: 'chat',
      payload: {
        text: 'Hello, can you create a simple test.txt file with the content "Hello World"?'
      }
    };
    
    ws.send(JSON.stringify(testMsg));
    console.log('Sent test message');
    
    // Close after 10 seconds
    setTimeout(() => {
      console.log('Closing connection');
      ws.close();
      process.exit(0);
    }, 10000);
  }
});

ws.on('error', (err) => {
  console.error('Error:', err);
});