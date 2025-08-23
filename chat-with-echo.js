#!/usr/bin/env node

const { MCPxClient } = require('@mcpx-protocol/client');

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

async function chatWithEchoBot() {
  try {
    console.log('Getting auth token...');
    const token = await getToken('user-client', 'test-room');
    console.log('✓ Got token');
    
    const client = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-room',
      token: token,
    });
    
    // Set up event listeners
    client.on('welcome', (data) => {
      console.log('✓ Connected to topic:', data.topic);
      console.log('  Participants:', data.participants.map(p => p.id).join(', '));
    });
    
    client.on('chat', (envelope) => {
      const sender = envelope.sender?.id || 'unknown';
      const text = envelope.data?.text || '';
      console.log(`[${sender}]: ${text}`);
    });
    
    client.on('peer_joined', (data) => {
      console.log(`→ ${data.participant.id} joined`);
    });
    
    client.on('peer_left', (data) => {
      console.log(`← ${data.participant_id} left`);
    });
    
    client.on('error', (error) => {
      console.error('Error:', error.message);
    });
    
    // Connect
    console.log('Connecting to gateway...');
    await client.connect();
    
    // Wait for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send chat messages
    console.log('\nSending messages to echo bot...\n');
    
    client.chat('Hello echo bot!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    client.chat('How are you doing?');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    client.chat('Testing 1-2-3');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n✅ Demo complete! Disconnecting...');
    client.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the demo
chatWithEchoBot();