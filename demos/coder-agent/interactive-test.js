#!/usr/bin/env node

const WebSocket = require('ws');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let ws;
let participantId = 'human-test-' + Date.now();

function connect() {
  ws = new WebSocket('ws://localhost:8080');
  
  ws.on('open', () => {
    console.log('✓ Connected to gateway');
    
    // Send join
    ws.send(JSON.stringify({
      protocol: 'mew/v0.3',
      kind: 'system/join',
      token: 'human-token',
      space: 'coder-demo',
      participant_id: participantId
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.kind === 'system/welcome') {
      console.log('✓ Joined space as:', participantId);
      console.log('Other participants:', msg.payload.participants.map(p => p.id).join(', '));
      console.log('\nReady! Type your messages (or "quit" to exit):');
      promptUser();
    } else if (msg.kind === 'chat') {
      console.log(`\n[${msg.from}]: ${msg.payload.text}`);
      if (msg.from !== participantId) {
        promptUser();
      }
    } else if (msg.kind === 'reasoning/start') {
      console.log(`\n[${msg.from}] thinking...`);
    } else if (msg.kind === 'mcp/proposal') {
      console.log(`\n[${msg.from}] proposed: ${msg.payload.method}`);
    } else if (msg.kind === 'mcp/request' && msg.from !== participantId) {
      console.log(`\n[${msg.from}] executing: ${msg.payload.method}`);
    }
  });
  
  ws.on('close', () => {
    console.log('\nDisconnected from gateway');
    process.exit(0);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    process.exit(1);
  });
}

function sendMessage(text) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      protocol: 'mew/v0.3',
      id: 'msg-' + Date.now(),
      from: participantId,
      ts: new Date().toISOString(),
      kind: 'chat',
      payload: { text }
    }));
  }
}

function promptUser() {
  rl.question('> ', (input) => {
    if (input.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      ws.close();
      rl.close();
      process.exit(0);
    } else {
      sendMessage(input);
      // Continue prompting
      setTimeout(() => promptUser(), 100);
    }
  });
}

console.log('Connecting to coder-agent space...');
connect();