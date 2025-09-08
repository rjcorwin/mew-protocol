#!/usr/bin/env node
/**
 * Echo Agent - Echoes chat messages back with "Echo: " prefix
 * For MEUP v0.2 test scenarios
 * 
 * Uses MEUP SDK client for WebSocket communication
 */

// Import the MEUP SDK client
const path = require('path');
const clientPath = path.resolve(__dirname, '../../sdk/typescript-sdk/client/dist/index.js');
const { MEUPClient, ClientEvents } = require(clientPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  token: 'echo-token'
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gateway' || args[i] === '-g') {
    options.gateway = args[i + 1];
    i++;
  } else if (args[i] === '--space' || args[i] === '-s') {
    options.space = args[i + 1];
    i++;
  } else if (args[i] === '--token' || args[i] === '-t') {
    options.token = args[i + 1];
    i++;
  }
}

const participantId = 'echo-agent';

console.log(`Echo agent connecting to ${options.gateway}...`);

// Create MEUP client instance
const client = new MEUPClient({
  gateway: options.gateway,
  space: options.space,
  token: options.token,
  participant_id: participantId,
  capabilities: [],
  reconnect: true
});

// Track if we've sent the initial join message
let joined = false;

// Handle connection events
client.onConnected(() => {
  console.log('Echo agent connected to gateway');
  
  // For compatibility with the gateway, send a join message
  if (!joined) {
    // The MEUPClient doesn't expose the raw WebSocket, so we need to 
    // work around this by using the internal ws property (not ideal but works for now)
    if (client.ws && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({
        type: 'join',
        participantId: participantId,
        space: options.space,
        token: options.token
      }));
      joined = true;
    }
  }
});

// Handle welcome message
client.onWelcome((data) => {
  console.log(`Echo agent welcomed to space. Participants: ${data.participants.length}`);
});

// Handle raw messages to preserve correlation_id functionality
// Using onMessage instead of onChat to get access to the full envelope with ID
client.onMessage((envelope) => {
  // If it's a chat message not from us, echo it with correlation_id
  if (envelope.kind === 'chat' && envelope.from !== participantId) {
    const text = envelope.payload?.text || '';
    
    // Send echo with correlation_id if the original had an id
    client.send({
      kind: 'chat',
      correlation_id: envelope.id ? envelope.id : undefined,
      payload: {
        text: `Echo: ${text}`,
        format: 'plain'
      }
    }).then(() => {
      console.log(`Echoed: "${text}"`);
    }).catch(console.error);
  }
});

// Handle errors
client.onError((error) => {
  console.error('WebSocket error:', error);
});

// Handle disconnection
client.onDisconnected(() => {
  console.log('Echo agent disconnected from gateway');
  process.exit(0);
});

// Connect to the gateway
client.connect().catch((error) => {
  console.error('Failed to connect:', error);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down echo agent...');
  client.disconnect();
  process.exit(0);
});