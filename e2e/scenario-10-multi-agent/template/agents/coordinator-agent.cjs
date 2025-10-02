#!/usr/bin/env node
/**
 * Coordinator agent for scenario 10. Receives chat instructions and delegates tool
 * execution to the worker agent, then reports results back to the requester.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-10-multi-agent',
  token: 'coordinator-token',
  id: 'coordinator-agent',
  log: './logs/coordinator.log'
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
  console.log(`[coordinator] ${event}`, extra ?? '');
}

let envelopeCounter = 0;
const pendingDelegations = new Map();

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

function parseAddition(text) {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(?:and|\+)\s*(-?\d+(?:\.\d+)?)/i);
  if (!match) {
    return null;
  }
  return {
    a: Number(match[1]),
    b: Number(match[2])
  };
}

function delegateAddition(targetParticipant, originalMessage, operands) {
  const requestId = nextId('delegate');
  pendingDelegations.set(requestId, {
    replyTo: originalMessage.from,
    correlation: originalMessage.id,
    operands
  });

  sendEnvelope({
    id: requestId,
    kind: 'mcp/request',
    to: [targetParticipant],
    payload: {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'add',
        arguments: operands
      }
    }
  });
}

function handleChat(message) {
  if (!Array.isArray(message.to) || !message.to.includes(participantId)) {
    return;
  }

  const text = message.payload?.text ?? '';
  const operands = parseAddition(text);
  if (!operands) {
    sendEnvelope({
      kind: 'chat',
      to: [message.from],
      correlation_id: [message.id],
      payload: {
        text: "I can help with addition if you provide two numbers (e.g. 'add 3 and 5').",
        format: 'plain'
      }
    });
    return;
  }

  writeLog('delegating', { operands });
  delegateAddition('worker-agent', message, operands);
}

function handleWorkerResponse(message) {
  const requestId = message.correlation_id?.[0];
  if (!requestId || !pendingDelegations.has(requestId)) {
    return;
  }

  const delegation = pendingDelegations.get(requestId);
  pendingDelegations.delete(requestId);

  const resultValue = message.payload?.result ?? message.payload?.result?.content?.[0]?.text;
  let numericResult;
  if (typeof message.payload?.result === 'number') {
    numericResult = message.payload.result;
  } else if (typeof resultValue === 'string') {
    const match = resultValue.match(/(-?\d+(?:\.\d+)?)/);
    if (match) {
      numericResult = Number(match[1]);
    }
  }

  if (numericResult === undefined) {
    numericResult = delegation.operands.a + delegation.operands.b;
  }

  sendEnvelope({
    kind: 'chat',
    to: [delegation.replyTo],
    correlation_id: [delegation.correlation ?? requestId],
    payload: {
      text: `${delegation.operands.a} + ${delegation.operands.b} = ${numericResult}`,
      format: 'plain'
    }
  });
}

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    writeLog('parse-error', { data: data.toString(), error: error.message });
    return;
  }

  if (message.kind === 'system/welcome') {
    writeLog('welcome', { you: message.payload?.you });
    return;
  }

  if (message.kind === 'chat') {
    handleChat(message);
    return;
  }

  if (message.kind === 'mcp/response' && Array.isArray(message.to) && message.to.includes(participantId)) {
    handleWorkerResponse(message);
  }
});

process.on('SIGINT', () => {
  ws.close();
});

process.on('SIGTERM', () => {
  ws.close();
});
