#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'ts-driver';
const logPath = process.env.DRIVER_LOG ? path.resolve(process.env.DRIVER_LOG) : null;
const agentId = process.env.AGENT_ID || 'typescript-agent';

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {
    // ignore logging errors
  }
}

function send(envelope) {
  process.stdout.write(
    encodeEnvelope({
      protocol: 'mew/v0.3',
      ...envelope,
    }),
  );
}

const pending = new Map();
let chatPending = false;

function sendToolsList() {
  const id = `list-${Date.now()}`;
  pending.set(id, {
    name: 'tools-list',
    validate: (payload) => Array.isArray(payload.result?.tools) && payload.result.tools.length >= 2,
  });
  send({
    id,
    kind: 'mcp/request',
    to: [agentId],
    payload: {
      method: 'tools/list',
      params: {},
    },
  });
}

function sendCalculate(op, a, b) {
  const id = `calc-${op}-${Date.now()}`;
  const expected = op === 'add' ? a + b : a * b;
  pending.set(id, {
    name: `calc-${op}`,
    validate: (payload) => typeof payload.result === 'string' && payload.result.includes(`${expected}`),
  });
  send({
    id,
    kind: 'mcp/request',
    to: [agentId],
    payload: {
      method: 'tools/call',
      params: {
        name: 'calculate',
        arguments: { operation: op, a, b },
      },
    },
  });
}

function sendEcho(message) {
  const id = `echo-${Date.now()}`;
  pending.set(id, {
    name: 'echo',
    validate: (payload) => payload.result === `Echo: ${message}`,
  });
  send({
    id,
    kind: 'mcp/request',
    to: [agentId],
    payload: {
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message },
      },
    },
  });
}

function sendChat(message) {
  chatPending = message;
  send({
    kind: 'chat',
    to: [agentId],
    payload: {
      text: message,
      format: 'plain',
    },
  });
}

function runSequence() {
  append('RUN sequence');
  sendToolsList();
  sendCalculate('add', 5, 3);
  sendCalculate('multiply', 7, 6);
  sendEcho('Hello from driver');
  sendChat('How are you?');
}

function handleResponse(envelope) {
  const correlation = Array.isArray(envelope.correlation_id)
    ? envelope.correlation_id[0]
    : envelope.correlation_id;
  if (!correlation) return;
  const entry = pending.get(correlation);
  if (!entry) return;
  pending.delete(correlation);

  const ok = entry.validate(envelope.payload || {});
  if (ok) {
    append(`OK ${entry.name}`);
  } else {
    append(`FAIL ${entry.name}`);
    append(`DEBUG ${JSON.stringify(envelope.payload)}`);
    process.exit(1);
  }

  if (pending.size === 0 && !chatPending) {
    append('DONE');
    process.exit(0);
  }
}

function handleChatResponse(envelope) {
  if (!chatPending) return;
  const text = envelope.payload?.text || '';
  if (text.includes(chatPending)) {
    append('OK chat-response');
    chatPending = false;
  } else {
    append('FAIL chat-response');
    append(`DEBUG ${text}`);
    process.exit(1);
  }
  if (pending.size === 0) {
    append('DONE');
    process.exit(0);
  }
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    runSequence();
    return;
  }

  if (envelope.kind === 'mcp/response' && envelope.from === agentId) {
    handleResponse(envelope);
    return;
  }

  if (envelope.kind === 'chat' && envelope.from === agentId) {
    handleChatResponse(envelope);
  }
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    append(`ERROR ${error.message}`);
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
