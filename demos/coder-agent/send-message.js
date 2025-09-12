#!/usr/bin/env node
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected, sending join...');
  ws.send(JSON.stringify({
    type: 'join',
    participantId: 'test-sender',
    space: 'coder-demo',
    token: 'human-token'
  }));
  
  setTimeout(() => {
    console.log('Sending chat message...');
    ws.send(JSON.stringify({
      protocol: 'mew/v0.3',
      id: 'test-msg',
      from: 'test-sender',
      ts: new Date().toISOString(),
      kind: 'chat',
      payload: { text: 'what is 7+7' }
    }));
    
    setTimeout(() => {
      console.log('Done');
      ws.close();
      process.exit(0);
    }, 3000);
  }, 1000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.kind === 'chat' && msg.from === 'coder-agent') {
    console.log(`AGENT RESPONSE: ${msg.payload.text}`);
  }
});