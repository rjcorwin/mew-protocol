#!/usr/bin/env node
/**
 * Send one or more MEW envelopes over WebSocket using the provided participant token.
 * Usage: node send_ws_messages.js <wsUrl> <token> <participantId> <jsonMessage> [...jsonMessage]
 */

const WebSocket = require('ws');

const [, , wsUrl, token, participantId, ...messageArgs] = process.argv;

if (!wsUrl || !token || !participantId || messageArgs.length === 0) {
  console.error('Usage: node send_ws_messages.js <wsUrl> <token> <participantId> <jsonMessage> [...jsonMessage]');
  process.exit(1);
}

let messages;
try {
  messages = messageArgs.map((arg) => JSON.parse(arg));
} catch (error) {
  console.error('Failed to parse JSON message:', error);
  process.exit(1);
}

const spaceMatch = /[?&]space=([^&]+)/.exec(wsUrl);
const space = spaceMatch ? decodeURIComponent(spaceMatch[1]) : 'default';

const ws = new WebSocket(wsUrl, {
  headers: {
    Authorization: `Bearer ${token}`
  },
  handshakeTimeout: 15000
});

ws.on('open', () => {
  const joinEnvelope = {
    type: 'join',
    space,
    token,
    participantId
  };

  ws.send(JSON.stringify(joinEnvelope));

  let index = 0;
  const sendNext = () => {
    if (index >= messages.length) {
      setTimeout(() => ws.close(), 200);
      return;
    }
    ws.send(JSON.stringify(messages[index]));
    index += 1;
    setTimeout(sendNext, 150);
  };

  setTimeout(sendNext, 200);
});

ws.on('message', (data) => {
  process.stdout.write(data.toString());
  process.stdout.write('\n');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  process.exit(0);
});

setTimeout(() => {
  console.error('Timed out waiting for WebSocket completion');
  ws.close();
}, 7000);
