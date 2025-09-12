#!/usr/bin/env node

const WebSocket = require('ws');

async function test() {
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.on('open', () => {
    console.log('Connected to gateway');
    
    // Send join
    ws.send(JSON.stringify({
      protocol: 'mew/v0.3',
      kind: 'system/join',
      token: 'human-token',
      space: 'coder-demo',
      participant_id: 'test-human'
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Received:', msg.kind);
    
    if (msg.kind === 'system/welcome') {
      console.log('Welcome received, sending calculation request...');
      
      // Wait a bit for agents to be ready
      setTimeout(() => {
        ws.send(JSON.stringify({
          protocol: 'mew/v0.3',
          id: 'calc-1',
          from: 'test-human',
          ts: new Date().toISOString(),
          kind: 'chat',
          payload: {
            text: 'Can you calculate 5 + 3 for me?'
          }
        }));
        console.log('Sent calculation request');
      }, 2000);
    }
    
    if (msg.kind === 'chat' && msg.from === 'coder-agent') {
      console.log('Agent response:', msg.payload.text);
      ws.close();
      process.exit(0);
    }
  });
  
  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('Test timed out - no response from agent');
    ws.close();
    process.exit(1);
  }, 10000);
}

test().catch(console.error);