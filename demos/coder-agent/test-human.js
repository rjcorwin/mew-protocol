#!/usr/bin/env node

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
let participantId = null;

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
  console.log(`[${msg.from}] ${msg.kind}: ${JSON.stringify(msg.payload).substring(0, 100)}`);
  
  if (msg.kind === 'system/welcome') {
    participantId = msg.payload.you.id;
    console.log(`\n=== CONFIRMED PARTICIPANT ID: ${participantId} ===`);
    
    setTimeout(() => {
      console.log('\n=== SENDING: what is 3+3 ===\n');
      ws.send(JSON.stringify({
        protocol: 'mew/v0.3',
        id: 'test-msg',
        from: participantId,  // Use confirmed participant ID
        ts: new Date().toISOString(),
        kind: 'chat',
        payload: { text: 'what is 3+3' }
      }));
    }, 1000);
  }
  
  // Log chat messages specifically
  if (msg.kind === 'chat' && msg.from === 'coder-agent') {
    console.log(`\n🎉 RECEIVED CHAT RESPONSE: ${msg.payload.text}\n`);
  }
});

// Keep alive for 10 seconds
setTimeout(() => {
  console.log('\n=== TEST COMPLETE ===');
  ws.close();
  process.exit(0);
}, 10000);