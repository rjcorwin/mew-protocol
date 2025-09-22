#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'mcp-driver';
const logPath = process.env.DRIVER_LOG || './driver.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

const pending = new Map();
let currentTest = null;
let testIndex = -1;

const tests = [
  {
    name: 'tools-list',
    send() {
      sendRequest('tools/list', {});
    },
    assert(response) {
      const tools = response.payload?.result?.tools;
      return Array.isArray(tools) && tools.length >= 3;
    },
  },
  {
    name: 'add',
    send() {
      sendRequest('tools/call', { name: 'add', arguments: { a: 5, b: 3 } });
    },
    assert(response) {
      return response.payload?.result === 8;
    },
  },
  {
    name: 'multiply',
    send() {
      sendRequest('tools/call', { name: 'multiply', arguments: { a: 7, b: 9 } });
    },
    assert(response) {
      return response.payload?.result === 63;
    },
  },
  {
    name: 'evaluate',
    send() {
      sendRequest('tools/call', { name: 'evaluate', arguments: { expression: '20 / 4' } });
    },
    assert(response) {
      return response.payload?.result === 5;
    },
  },
  {
    name: 'divide-zero',
    send() {
      sendRequest('tools/call', { name: 'evaluate', arguments: { expression: '10 / 0' } });
    },
    assert(response) {
      const result = response.payload?.result;
      return result === 'Infinity' || result === Infinity || result === null;
    },
  },
  {
    name: 'invalid-tool',
    send() {
      sendRequest('tools/call', { name: 'invalid', arguments: {} });
    },
    assert(response) {
      return response.payload?.success === false && typeof response.payload?.error === 'string';
    },
  },
];

function nextTest() {
  testIndex += 1;
  if (testIndex >= tests.length) {
    append('DONE');
    process.exit(0);
  }

  currentTest = tests[testIndex];
  currentTest.send();
}

function sendRequest(method, params) {
  const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pending.set(id, currentTest);
  const envelope = {
    protocol: 'mew/v0.3',
    id,
    kind: 'mcp/request',
    to: ['calculator-agent'],
    payload: {
      method,
      params,
    },
  };
  process.stdout.write(encodeEnvelope(envelope));
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    nextTest();
    return;
  }

  if (envelope.kind !== 'mcp/response') {
    return;
  }

  const correlation = Array.isArray(envelope.correlation_id)
    ? envelope.correlation_id[0]
    : envelope.correlation_id;
  if (!correlation) {
    return;
  }

  const test = pending.get(correlation);
  if (!test) {
    return;
  }
  pending.delete(correlation);

  const success = Boolean(test.assert(envelope));
  if (success) {
    append(`OK ${test.name}`);
    nextTest();
  } else {
    append(`FAIL ${test.name}`);
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
