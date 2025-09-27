#!/usr/bin/env node
/**
 * Control Agent used for exercising new envelope kinds in integration tests.
 * Connects to the MEW gateway via raw WebSocket and reacts to chat commands
 * by emitting chat acknowledgements/cancellations, reasoning control envelopes,
 * participant lifecycle status updates, and stream lifecycle notifications.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  token: 'control-token',
  participant_id: 'control-agent',
  log: null,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--gateway':
    case '-g':
      options.gateway = args[i + 1];
      i++;
      break;
    case '--space':
    case '-s':
      options.space = args[i + 1];
      i++;
      break;
    case '--token':
    case '-t':
      options.token = args[i + 1];
      i++;
      break;
    case '--id':
      options.participant_id = args[i + 1];
      i++;
      break;
    case '--log':
      options.log = args[i + 1];
      i++;
      break;
    default:
      break;
  }
}

const participantId = options.participant_id;
const logPath = options.log ? path.resolve(process.cwd(), options.log) : null;
if (logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
}

function appendLog(entry) {
  if (!logPath) return;
  try {
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write control-agent log entry:', error);
  }
}

function generateId(prefix) {
  const random = Math.floor(Math.random() * 100000);
  return `${prefix}-${Date.now()}-${random}`;
}

const ws = new WebSocket(options.gateway);

let lastAcknowledgeTarget = null;
let messagesInContext = 0;
let tokensUsed = 0;
let reasoningCounter = 0;
let currentReasoningContext = null;
let streamCounter = 0;
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

function recordChatContext(text) {
  if (typeof text === 'string' && text.length > 0) {
    const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
    tokensUsed += estimatedTokens;
    messagesInContext += 1;
  }
}

function sendStatus(status, correlationId, target) {
  const payload = {
    status,
    tokens: tokensUsed,
    max_tokens: 20000,
    messages_in_context: messagesInContext,
  };

  sendEnvelope({
    kind: 'participant/status',
    to: [target],
    correlation_id: [correlationId],
    payload,
  });
}

ws.on('open', () => {
  console.log(`Control agent connected to ${options.gateway}`);
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
    console.error('Failed to parse incoming message:', error);
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
        currentReasoningContext = null;
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
        const streamId = activeStreamId || 'unknown-stream';
        activeStreamId = null;
        sendEnvelope({
          kind: 'chat',
          to: [closedBy],
          correlation_id: [message.id],
          payload: {
            text: `Stream closed: ${streamId} (${reason})`,
            format: 'plain',
          },
        });
      }
      break;
    default:
      break;
  }
});

ws.on('error', (error) => {
  console.error('Control agent WebSocket error:', error);
  appendLog({ event: 'error', message: error.message });
});

ws.on('close', () => {
  console.log('Control agent disconnected');
  appendLog({ event: 'disconnected' });
});

process.on('SIGINT', () => {
  console.log('Control agent shutting down');
  appendLog({ event: 'sigint' });
  ws.close();
  process.exit(0);
});

function handleChatCommand(message) {
  const text = (message.payload?.text || '').trim();
  if (!text) return;

  recordChatContext(text);

  const lower = text.toLowerCase();

  if (lower === 'ack_test' || lower === 'ack please') {
    lastAcknowledgeTarget = message.id;
    sendEnvelope({
      kind: 'chat/acknowledge',
      to: [message.from],
      correlation_id: [message.id],
      payload: { status: 'received' },
    });
    return;
  }

  if ((lower === 'cancel_test' || lower === 'cancel ack') && lastAcknowledgeTarget) {
    sendEnvelope({
      kind: 'chat/cancel',
      to: [message.from],
      correlation_id: [lastAcknowledgeTarget],
      payload: { reason: 'dismissed' },
    });
    return;
  }

  if (lower === 'start_reasoning' || lower === 'start reasoning') {
    reasoningCounter += 1;
    currentReasoningContext = `reasoning-context-${reasoningCounter}`;
    sendEnvelope({
      id: `reasoning-start-${reasoningCounter}`,
      kind: 'reasoning/start',
      to: [message.from],
      correlation_id: [message.id],
      payload: {
        message: `Beginning reasoning session ${reasoningCounter}`,
      },
    });
    return;
  }

  if ((lower === 'cancel_reasoning' || lower === 'cancel reasoning') && currentReasoningContext) {
    sendEnvelope({
      kind: 'reasoning/cancel',
      to: [message.from],
      correlation_id: [message.id],
      context: `reasoning-start-${reasoningCounter}`,
      payload: {
        reason: 'cancelled_by_test',
      },
    });
    currentReasoningContext = null;
    return;
  }

  if (lower === 'open_stream' || lower === 'open stream') {
    streamCounter += 1;
    const requestId = `stream-request-${streamCounter}`;
    sendEnvelope({
      id: requestId,
      kind: 'stream/request',
      payload: {
        direction: 'upload',
        description: `test-stream-${streamCounter}`,
      },
    });
    return;
  }

  if (lower === 'status') {
    sendStatus('active', message.id, message.from);
  }
}
