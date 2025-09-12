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

let actualParticipantId = null;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`[${msg.from}] ${msg.kind}: ${JSON.stringify(msg.payload).substring(0, 100)}`);
  
  if (msg.kind === 'system/welcome') {
    actualParticipantId = msg.payload.you.id;
    console.log(`\n=== PARTICIPANT ID: ${actualParticipantId} ===`);
    
    setTimeout(() => {
      console.log('\n=== SENDING: Can you calculate 5 + 3? ===\n');
      ws.send(JSON.stringify({
        protocol: 'mew/v0.3',
        id: 'test-msg',
        from: actualParticipantId,  // Use actual assigned ID
        ts: new Date().toISOString(),
        kind: 'chat',
        payload: { text: 'Can you calculate 5 + 3?' }
      }));
    }, 1000);
  }
});

// Keep alive for 30 seconds to check for delayed response
setTimeout(() => {
  console.log('\n=== TEST COMPLETE (30s timeout) ===');
  ws.close();
  process.exit(0);
}, 30000);