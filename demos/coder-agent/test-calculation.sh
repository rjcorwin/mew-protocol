#!/bin/bash

echo "Testing coder-agent calculation..."

# Connect and listen for all messages
node << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
let gotResponse = false;

ws.on('open', () => {
  console.log('✓ Connected');
  ws.send(JSON.stringify({
    protocol: 'mew/v0.3',
    kind: 'system/join',
    token: 'human-token',
    space: 'coder-demo',
    participant_id: 'test-human-calc'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.kind === 'system/welcome') {
    console.log('✓ Joined space');
    setTimeout(() => {
      console.log('→ Sending: Can you calculate 5 + 3 for me?');
      ws.send(JSON.stringify({
        protocol: 'mew/v0.3',
        id: 'calc-test',
        from: 'test-human-calc',
        ts: new Date().toISOString(),
        kind: 'chat',
        payload: { text: 'Can you calculate 5 + 3 for me?' }
      }));
    }, 1000);
  } else if (msg.kind === 'chat' && msg.from !== 'test-human-calc') {
    console.log(`← [${msg.from}]: ${msg.payload.text}`);
    gotResponse = true;
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 500);
  } else if (msg.kind === 'reasoning/start') {
    console.log(`  [${msg.from}] is thinking...`);
  } else if (msg.kind === 'reasoning/thought') {
    console.log(`  [${msg.from}] reasoning: ${msg.payload.reasoning || '...'}`);
  } else if (msg.kind === 'reasoning/conclusion') {
    console.log(`  [${msg.from}] concluded reasoning`);
  } else if (msg.kind === 'mcp/proposal') {
    console.log(`  [${msg.from}] created proposal: ${msg.payload.method}`);
  }
});

setTimeout(() => {
  if (!gotResponse) {
    console.log('✗ Timeout - no chat response received');
    ws.close();
    process.exit(1);
  }
}, 10000);
EOF