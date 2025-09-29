#!/usr/bin/env node

/**
 * Placeholder AI assistant agent for MEW Protocol
 * This is a simplified version that just connects and echoes messages
 * Replace with actual @mew-protocol/mew when available
 */

const WebSocket = require('ws');
const readline = require('readline');

// Configuration from environment
const gateway = process.env.MEW_GATEWAY || 'ws://localhost:8080';
const space = process.env.MEW_SPACE || process.argv[2] || 'default';
const token = process.env.MEW_TOKEN || process.argv[3] || 'assistant-token';
const participantId = process.env.MEW_PARTICIPANT_ID || 'assistant';

console.log(`Assistant agent starting...`);
console.log(`Gateway: ${gateway}`);
console.log(`Space: ${space}`);
console.log(`Participant: ${participantId}`);

// Create WebSocket connection
const ws = new WebSocket(`${gateway}?space=${space}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Handle connection open
ws.on('open', () => {
  console.log('Connected to gateway');

  // Send join message
  const joinMessage = {
    protocol: 'mew/v0.4',
    id: `msg-${Date.now()}`,
    ts: new Date().toISOString(),
    from: participantId,
    kind: 'system/join',
    payload: {}
  };

  ws.send(JSON.stringify(joinMessage));
});

// Handle incoming messages
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    // Log non-system messages
    if (!message.kind?.startsWith('system/')) {
      console.log(`Received: ${message.kind} from ${message.from}`);
    }

    // Simple echo response for chat messages
    if (message.kind === 'chat' && message.from !== participantId) {
      setTimeout(() => {
        const response = {
          protocol: 'mew/v0.4',
          id: `msg-${Date.now()}`,
          ts: new Date().toISOString(),
          from: participantId,
          kind: 'chat',
          payload: {
            text: `I received your message: "${message.payload.text}". (Note: This is a placeholder agent - install @mew-protocol/mew for full functionality)`
          }
        };

        ws.send(JSON.stringify(response));
        console.log('Sent response');
      }, 1000);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Handle errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Handle connection close
ws.on('close', () => {
  console.log('Disconnected from gateway');
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ws.close();
  process.exit(0);
});