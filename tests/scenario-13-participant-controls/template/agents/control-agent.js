#!/usr/bin/env node
/**
 * Control agent for participant lifecycle tests.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-13-participant-controls',
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

let messagesInContext = 0;
let tokensUsed = 0;

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

function sendStatus(status, correlationId, target) {
  sendEnvelope({
    kind: 'participant/status',
    to: [target],
    correlation_id: [correlationId],
    payload: {
      status,
      tokens: tokensUsed,
      max_tokens: 20000,
      messages_in_context: messagesInContext,
    }
  });
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
    case 'participant/clear':
      if (addressedToMe) {
        messagesInContext = 0;
        tokensUsed = 0;
        const reason = message.payload?.reason || 'manual';
        sendStatus(`cleared:${reason}`, message.id, message.from);
      }
      break;
    case 'participant/restart':
      if (addressedToMe) {
        messagesInContext = 0;
        tokensUsed = 0;
        sendStatus('restarted', message.id, message.from);
      }
      break;
    case 'participant/shutdown':
      if (addressedToMe) {
        const reason = message.payload?.reason || 'manual';
        sendStatus(`shutting_down:${reason}`, message.id, message.from);
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 200);
      }
      break;
    case 'participant/request-status':
      if (addressedToMe) {
        sendStatus('active', message.id, message.from);
      }
      break;
    case 'chat':
      if (addressedToMe && message.from !== participantId) {
        const text = message.payload?.text ?? '';
        const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
        tokensUsed += estimatedTokens;
        messagesInContext += 1;
        sendEnvelope({
          kind: 'chat',
          to: [message.from],
          correlation_id: [message.id],
          payload: {
            text: `Received: ${text}`
          }
        });
      }
      break;
    default:
      break;
  }
});

process.on('SIGINT', () => {
  ws.close();
});

process.on('SIGTERM', () => {
  ws.close();
});
