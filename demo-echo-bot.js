#!/usr/bin/env node

/**
 * Demo script showing how to interact with the echo-bot via MCPx protocol
 * This sends a few messages to the echo bot and displays the responses
 */

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

async function demoEchoBot() {
  console.log('MCPx Echo Bot Demo');
  console.log('==================\n');
  
  try {
    // 1. Get authentication token
    console.log('1. Getting authentication token...');
    const token = await getToken('demo-user', 'test-room');
    console.log('   ✓ Got token\n');
    
    // 2. Create and configure client
    console.log('2. Creating MCPx client...');
    const client = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-room',
      token: token,
    });
    
    // 3. Set up event handlers
    client.on('welcome', (data) => {
      console.log('   ✓ Connected to topic:', data.topic);
      const participants = data.participants.map(p => p.id);
      console.log('   ✓ Participants in room:', participants.join(', '));
      console.log();
    });
    
    client.on('chat', (envelope) => {
      const sender = envelope.sender?.id || 'unknown';
      const text = envelope.data?.text || '';
      
      // Show messages from others (not our own)
      if (sender !== 'demo-user') {
        console.log(`   📨 [${sender}]: ${text}`);
      }
    });
    
    client.on('peer_joined', (data) => {
      console.log(`   → ${data.participant.id} joined the room`);
    });
    
    client.on('peer_left', (data) => {
      console.log(`   ← ${data.participant_id} left the room`);
    });
    
    client.on('error', (error) => {
      console.error('   ❌ Error:', error.message);
    });
    
    // 4. Connect to the gateway
    console.log('3. Connecting to gateway...');
    await client.connect();
    
    // Wait for welcome message
    await new Promise((resolve) => {
      client.once('welcome', resolve);
    });
    
    // 5. Send test messages to the echo bot
    console.log('4. Sending messages to echo bot:\n');
    
    const messages = [
      'Hello echo bot!',
      'Can you hear me?',
      'This is a test message',
      'Echo echo echo!'
    ];
    
    for (const msg of messages) {
      console.log(`   💬 [demo-user]: ${msg}`);
      client.chat(msg);
      
      // Wait a bit between messages to see responses
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // 6. Wait a bit more to receive any final responses
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 7. Disconnect
    console.log('\n5. Demo complete! Disconnecting...');
    client.disconnect();
    console.log('   ✓ Disconnected\n');
    
    console.log('✅ Demo finished successfully!');
    console.log('\nTo run the CLI interactively, you need to run it in a terminal with TTY support.');
    console.log('You can also build your own client using @mcpx-protocol/client as shown in this demo.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. The gateway is running (npm run dev:gateway)');
    console.error('2. The echo bot is running (in examples/echo-bot: npm start)');
    process.exit(1);
  }
}

// Check if gateway is running first
fetch('http://localhost:3000/health')
  .then(response => {
    if (response.ok) {
      console.log('✓ Gateway is running at http://localhost:3000\n');
      demoEchoBot();
    } else {
      console.error('❌ Gateway returned status:', response.status);
      console.error('Start it with: npm run dev:gateway');
      process.exit(1);
    }
  })
  .catch(() => {
    console.error('❌ Gateway is not running!');
    console.error('Start it with: npm run dev:gateway');
    process.exit(1);
  });