#!/usr/bin/env node
/**
 * Control agent for stream lifecycle tests. Reuses chat control behaviour.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-12-stream-controls',
  token: 'control-token',
  participant_id: 'control-agent',
  log: './logs/control-agent.log'
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case '--gateway':
    case '-g':
      options.gateway = args[i + 1];
      i += 1;
      break;
    case '--space':
    case '-s':
      options.space = args[i + 1];
      i += 1;
      break;
    case '--token':
    case '-t':
      options.token = args[i + 1];
      i += 1;
      break;
    case '--id':
      options.participant_id = args[i + 1];
      i += 1;
      break;
    case '--log':
      options.log = args[i + 1];
      i += 1;
      break;
    default:
      break;
  }
}

const participantId = options.participant_id;
const logPath = path.resolve(process.cwd(), options.log);
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function appendLog(entry) {
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

function generateId(prefix) {
  const random = Math.floor(Math.random() * 100000);
  return `${prefix}-${Date.now()}-${random}`;
}

const ws = new WebSocket(options.gateway, { handshakeTimeout: 15000 });

let activeStreamId = null;

function sendEnvelope(envelope) {
  const fullEnvelope = {
    protocol: 'mew/v0.4',
    id: envelope.id || generateId('env'),
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope,
  };

  ws.send(JSON.stringify(fullEnvelope));
  appendLog({ direction: 'out', envelope: fullEnvelope });
}

ws.on('open', () => {
  appendLog({ event: 'connected', gateway: options.gateway });
  ws.send(JSON.stringify({
    type: 'join',
    participantId,
    space: options.space,
    token: options.token,
  }));
});

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    appendLog({ event: 'parse-error', error: error.message });
    return;
  }

  appendLog({ direction: 'in', envelope: message });

  const addressedToMe = !message.to || message.to.length === 0 || message.to.includes(participantId);

  switch (message.kind) {
    case 'chat':
      if (!addressedToMe || message.from === participantId) {
        return;
      }
      handleChatCommand(message);
      break;
    case 'stream/open':
      if (addressedToMe) {
        activeStreamId = message.payload?.stream_id || 'unknown-stream';
        const openedBy = message.from || 'unknown';
        sendEnvelope({
          kind: 'chat',
          to: [openedBy],
          correlation_id: [message.id],
          payload: {
            text: `Stream opened: ${activeStreamId}`,
            format: 'plain',
          },
        });
      }
      break;
    case 'stream/close':
      if (addressedToMe) {
        const reason = message.payload?.reason || 'unknown';
        const closedBy = message.from || 'unknown';
        sendEnvelope({
          kind: 'chat',
          to: [closedBy],
          correlation_id: [message.id],
          payload: {
            text: `Stream closed: ${activeStreamId} (${reason})`,
            format: 'plain',
          },
        });
        activeStreamId = null;
      }
      break;
    default:
      break;
  }
});

function handleChatCommand(message) {
  const text = message.payload?.text ?? '';

  if (text === 'open_stream') {
    activeStreamId = `stream-${generateId('id')}`;
    sendEnvelope({
      kind: 'stream/request',
      correlation_id: [message.id],
      payload: {
        modes: ['text'],
        metadata: {
          hint: 'Requesting stream for collaborative editing'
        }
      }
    });
  }
}

process.on('SIGINT', () => {
  ws.close();
});

process.on('SIGTERM', () => {
  ws.close();
});
