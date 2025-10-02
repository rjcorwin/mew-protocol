#!/usr/bin/env node
/**
 * Worker agent for scenario 10. Proxies MCP requests from the coordinator to
 * the calculator participant and returns responses.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-10-multi-agent',
  token: 'worker-token',
  id: 'worker-agent',
  log: './logs/worker.log'
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
      options.id = args[i + 1];
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

const participantId = options.id;
const logPath = path.resolve(process.cwd(), options.log);
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function writeLog(event, extra) {
  const entry = { timestamp: new Date().toISOString(), event };
  if (extra) {
    entry.extra = extra;
  }
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  console.log(`[worker] ${event}`, extra ?? '');
}

let envelopeCounter = 0;
const pendingForwards = new Map();

function nextId(prefix) {
  envelopeCounter += 1;
  return `${participantId}-${prefix}-${Date.now()}-${envelopeCounter}`;
}

const ws = new WebSocket(options.gateway, { handshakeTimeout: 15000 });

ws.on('open', () => {
  writeLog('connected', { gateway: options.gateway });
  ws.send(JSON.stringify({
    type: 'join',
    space: options.space,
    token: options.token,
    participantId
  }));
});

ws.on('error', (error) => {
  writeLog('error', { message: error.message });
});

ws.on('close', (code, reason) => {
  writeLog('closed', { code, reason: reason?.toString() });
  process.exit(0);
});

function sendEnvelope(envelope) {
  const fullEnvelope = {
    protocol: 'mew/v0.4',
    id: envelope.id ?? nextId('env'),
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope
  };
  ws.send(JSON.stringify(fullEnvelope));
  writeLog('sent', { kind: fullEnvelope.kind, id: fullEnvelope.id, to: fullEnvelope.to });
  return fullEnvelope.id;
}

function forwardRequest(targetParticipant, originalEnvelope) {
  const forwardId = nextId('forward');
  pendingForwards.set(forwardId, {
    requester: originalEnvelope.from,
    originalId: originalEnvelope.id
  });

  sendEnvelope({
    id: forwardId,
    kind: 'mcp/request',
    to: [targetParticipant],
    payload: originalEnvelope.payload
  });
}

function handleIncomingRequest(message) {
  if (!Array.isArray(message.to) || !message.to.includes(participantId)) {
    return;
  }

  const method = message.payload?.method;
  if (!method) {
    return;
  }

  if (method === 'tools/list' || method === 'tools/call') {
    forwardRequest('calculator-agent', message);
    return;
  }

  sendEnvelope({
    kind: 'mcp/response',
    to: [message.from],
    correlation_id: [message.id],
    payload: {
      jsonrpc: '2.0',
      id: message.payload?.id ?? nextId('err'),
      error: {
        code: -32601,
        message: `Worker cannot handle method: ${method}`
      }
    }
  });
}

function handleForwardResponse(message) {
  const forwardId = message.correlation_id?.[0] ?? message.id;
  if (!forwardId || !pendingForwards.has(forwardId)) {
    return;
  }

  const original = pendingForwards.get(forwardId);
  pendingForwards.delete(forwardId);

  sendEnvelope({
    kind: 'mcp/response',
    to: [original.requester],
    correlation_id: [original.originalId],
    payload: message.payload
  });
}

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    writeLog('parse-error', { error: error.message });
    return;
  }

  if (message.kind === 'system/welcome') {
    writeLog('welcome', { you: message.payload?.you });
    return;
  }

  if (message.kind === 'mcp/request') {
    handleIncomingRequest(message);
    return;
  }

  if (message.kind === 'mcp/response' && Array.isArray(message.to) && message.to.includes(participantId)) {
    handleForwardResponse(message);
  }
});

process.on('SIGINT', () => {
  ws.close();
});

process.on('SIGTERM', () => {
  ws.close();
});
