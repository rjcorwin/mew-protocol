#!/usr/bin/env node
/**
 * Scenario 1 echo agent implemented with a minimal WebSocket client.
 * It joins the configured space and echoes chat messages back to the sender.
 */

const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-1-basic',
  token: 'echo-token'
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--gateway' || arg === '-g') {
    options.gateway = args[i + 1];
    i += 1;
  } else if (arg === '--space' || arg === '-s') {
    options.space = args[i + 1];
    i += 1;
  } else if (arg === '--token' || arg === '-t') {
    options.token = args[i + 1];
    i += 1;
  }
}

const participantId = 'echo-agent';
const PROTOCOL_VERSION = 'mew/v0.4';
let messageCounter = 0;

const ws = new WebSocket(options.gateway, {
  handshakeTimeout: 15000
});

function sendEnvelope(envelope) {
  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not open');
  }

  const fullEnvelope = {
    protocol: PROTOCOL_VERSION,
    id: `${participantId}-${Date.now()}-${messageCounter += 1}`,
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope
  };

  ws.send(JSON.stringify(fullEnvelope));
}

ws.on('open', () => {
  console.log(`Echo agent connected to ${options.gateway}`);
  const joinMessage = {
    type: 'join',
    space: options.space,
    token: options.token,
    participantId,
    capabilities: []
  };
  ws.send(JSON.stringify(joinMessage));
});

ws.on('message', (raw) => {
  const data = raw.toString();

  if (data.startsWith('#')) {
    // Stream frames are not used in this scenario
    return;
  }

  let message;
  try {
    message = JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse message from gateway:', error);
    return;
  }

  if (message.type === 'welcome') {
    console.log('Received welcome event from gateway');
    return;
  }

  if (message.kind === 'system/ping') {
    sendEnvelope({ kind: 'system/pong', correlation_id: message.id });
    return;
  }

  if (message.kind === 'chat' && message.from !== participantId) {
    const text = message?.payload?.text ?? '';
    sendEnvelope({
      kind: 'chat',
      correlation_id: message.id,
      payload: {
        text: `Echo: ${text}`,
        format: 'plain'
      }
    });
    console.log(`Echoed message: ${text}`);
  }
});

ws.on('error', (error) => {
  console.error('Echo agent WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`Echo agent disconnected (code ${code}) ${reason?.toString?.() ?? ''}`);
  process.exit(0);
});

const shutdown = () => {
  console.log('Shutting down echo agent...');
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
