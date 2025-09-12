#!/usr/bin/env node

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    protocol: 'mew/v0.3',
    kind: 'system/join',
    token: 'human-token',
    space: 'coder-demo',
    participant_id: 'human'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`Message from ${msg.from}:`);
  console.log(JSON.stringify(msg, null, 2));
  
  if (msg.kind === 'system/welcome') {
    console.log('\n=== PARTICIPANT INFO ===');
    console.log(`Requested participant_id: human`);
    console.log(`Actual participant_id: ${msg.payload.you.id}`);
    console.log(`Participant IDs match: ${msg.payload.you.id === 'human'}`);
    
    // Close after getting welcome
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 1000);
  }
});

// Safety timeout
setTimeout(() => {
  console.log('Timeout');
  ws.close();
  process.exit(0);
}, 10000);