#!/usr/bin/env node

const { MCPxClient } = require('@mcpx-protocol/client');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

async function getToken(participantId, topic) {
  const response = await fetch('http://localhost:3000/v0/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, topic }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function main() {
  try {
    console.log('MCPx Interactive Chat Client');
    console.log('============================');
    console.log('Connecting to test-room where echo-bot is running...\n');
    
    const token = await getToken('human-user', 'test-room');
    
    const client = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-room',
      token: token,
    });
    
    // Set up event listeners
    client.on('welcome', (data) => {
      console.log('✓ Connected to topic:', data.topic);
      console.log('Participants:', data.participants.map(p => `${p.id} (${p.type})`).join(', '));
      console.log('\nType messages to chat with the echo bot. Type "quit" to exit.\n');
      rl.prompt();
    });
    
    client.on('chat', (envelope) => {
      const sender = envelope.sender?.id || 'unknown';
      const text = envelope.data?.text || '';
      
      // Don't show our own messages again
      if (sender !== 'human-user') {
        console.log(`\n[${sender}]: ${text}`);
        rl.prompt();
      }
    });
    
    client.on('peer_joined', (data) => {
      console.log(`\n→ ${data.participant.id} joined`);
      rl.prompt();
    });
    
    client.on('peer_left', (data) => {
      console.log(`\n← ${data.participant_id} left`);
      rl.prompt();
    });
    
    client.on('error', (error) => {
      console.error('\nError:', error.message);
      rl.prompt();
    });
    
    // Connect
    await client.connect();
    
    // Handle user input
    rl.on('line', async (line) => {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        client.disconnect();
        rl.close();
        process.exit(0);
      }
      
      if (trimmed) {
        try {
          // Wait a bit to ensure we're authenticated
          await new Promise(resolve => setTimeout(resolve, 100));
          client.chat(trimmed);
          console.log(`[You]: ${trimmed}`);
        } catch (error) {
          console.error('Failed to send message:', error.message);
        }
      }
      
      rl.prompt();
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();