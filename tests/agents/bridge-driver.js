#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'bridge-driver';
const logPath = process.env.DRIVER_LOG || './bridge-driver.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

const pending = new Map();
let stepIndex = -1;

const steps = [
  {
    name: 'tools-list',
    action() {
      sendRequest('tools/list', {}, (payload) => Array.isArray(payload.result?.tools));
    },
  },
  {
    name: 'read-file',
    action() {
      sendRequest('tools/call', { name: 'read_file', arguments: { path: '/tmp/file.txt' } }, (payload) => {
        return typeof payload.result === 'string' && payload.result.includes('/tmp/file.txt');
      });
    },
  },
  {
    name: 'invalid-tool',
    action() {
      sendRequest('tools/call', { name: 'unknown', arguments: {} }, (payload) => {
        return payload.success === false && /unknown/.test(payload.error || '');
      });
    },
  },
  {
    name: 'done',
    action() {
      append('DONE');
      process.exit(0);
    },
  },
];

function nextStep() {
  stepIndex += 1;
  if (stepIndex >= steps.length) {
    append('DONE');
    process.exit(0);
  }
  steps[stepIndex].action();
}

function sendRequest(method, params, validate) {
  const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  pending.set(id, { name: steps[stepIndex].name, validate });
  process.stdout.write(
    encodeEnvelope({
      protocol: 'mew/v0.3',
      id,
      kind: 'mcp/request',
      to: ['bridge-agent'],
      payload: {
        method,
        params,
      },
    }),
  );
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    nextStep();
    return;
  }

  if (envelope.kind !== 'mcp/response' || envelope.from !== 'bridge-agent') {
    return;
  }

  const pendingEntry = pending.get(envelope.correlation_id);
  if (!pendingEntry) {
    return;
  }
  pending.delete(envelope.correlation_id);

  const valid = pendingEntry.validate(envelope.payload || {});
  if (valid) {
    append(`OK ${pendingEntry.name}`);
    nextStep();
  } else {
    append(`FAIL ${pendingEntry.name}`);
    append(`DEBUG payload=${JSON.stringify(envelope.payload)}`);
    process.exit(1);
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
