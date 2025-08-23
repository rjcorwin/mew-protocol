#!/usr/bin/env node

// Test script to verify CLI functionality
const { spawn } = require('child_process');

async function getToken() {
  const response = await fetch('http://localhost:3000/v0/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: 'test-cli',
      topic: 'test-room',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function testCLI() {
  try {
    console.log('Getting auth token...');
    const token = await getToken();
    console.log('✓ Got token:', token.substring(0, 20) + '...');
    
    console.log('\nTesting CLI connection...');
    
    // Use the CLI programmatically
    const { MCPxClient } = require('@mcpx-protocol/client');
    
    const client = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-room',
      token: token,
    });
    
    console.log('Connecting to gateway...');
    
    let welcomeReceived = false;
    
    client.on('welcome', (data) => {
      console.log('✓ Received welcome message');
      console.log('  Participant ID:', data.participant_id);
      console.log('  Topic:', data.topic);
      console.log('  Participants:', data.participants.length);
      welcomeReceived = true;
    });
    
    client.on('error', (error) => {
      console.error('✗ Error:', error.message);
    });
    
    await client.connect();
    console.log('✓ Connected successfully');
    
    // Wait for welcome message
    await new Promise(resolve => {
      if (welcomeReceived) {
        resolve();
      } else {
        client.once('welcome', resolve);
      }
    });
    
    // Send a test chat message
    console.log('\nSending test chat message...');
    client.chat('Hello from test CLI!');
    console.log('✓ Chat message sent');
    
    // Get participants
    console.log('\nGetting participants...');
    const peers = client.getPeers();
    console.log('✓ Peers:', peers.length);
    
    // Wait a moment then disconnect
    setTimeout(() => {
      console.log('\nDisconnecting...');
      client.disconnect();
      console.log('✓ Disconnected');
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if gateway is running
fetch('http://localhost:3000/health')
  .then(response => {
    if (response.ok) {
      console.log('✓ Gateway is running');
      testCLI();
    } else {
      console.error('✗ Gateway returned status:', response.status);
      process.exit(1);
    }
  })
  .catch(() => {
    console.error('✗ Gateway is not running. Start it with: npm run dev:gateway');
    process.exit(1);
  });