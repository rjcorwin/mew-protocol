#!/usr/bin/env node
/**
 * Echo Agent - Echoes chat messages back with "Echo: " prefix
 * For MEUP v0.2 test scenarios
 */

const WebSocket = require('ws');

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

const ws = new WebSocket(options.gateway);

ws.on('open', () => {
  console.log('Echo agent connected to gateway');
  
  // Send join message (gateway-specific)
  ws.send(JSON.stringify({
    type: 'join',
    participantId: participantId,
    space: options.space,
    token: options.token
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    // Echo chat messages (but not our own)
    if (message.kind === 'chat' && message.from !== participantId) {
      const text = message.payload?.text || '';
      
      // Send echo response
      const echoMessage = {
        kind: 'chat',
        payload: {
          text: `Echo: ${text}`,
          format: 'plain'
        }
      };
      
      // Preserve correlation_id if the original message had an id
      if (message.id) {
        echoMessage.correlation_id = [message.id];
      }
      
      ws.send(JSON.stringify(echoMessage));
      console.log(`Echoed: "${text}"`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Echo agent disconnected from gateway');
  process.exit(0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down echo agent...');
  ws.close();
  process.exit(0);
});