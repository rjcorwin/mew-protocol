#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'proposal-driver';
const logPath = process.env.DRIVER_LOG || './proposal-driver.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

let testIndex = -1;
let awaiting = null;

const tests = [
  {
    name: 'add-proposal',
    send() {
      sendProposal({ name: 'add', arguments: { a: 10, b: 5 } });
      awaiting = (envelope) => envelope.payload?.text?.includes('15');
    },
  },
  {
    name: 'multiply-proposal',
    send() {
      sendProposal({ name: 'multiply', arguments: { a: 7, b: 8 } });
      awaiting = (envelope) => envelope.payload?.text?.includes('56');
    },
  },
  {
    name: 'invalid-proposal',
    send() {
      sendProposal({ name: 'invalid_tool', arguments: {} });
      awaiting = (envelope) => /error/i.test(envelope.payload?.text || '');
    },
  },
];

function nextTest() {
  testIndex += 1;
  if (testIndex >= tests.length) {
    append('DONE');
    process.exit(0);
  }

  const test = tests[testIndex];
  awaiting = null;
  test.send();
}

function sendProposal({ name, arguments: args }) {
  const envelope = {
    protocol: 'mew/v0.3',
    id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'mcp/proposal',
    to: ['fulfiller-agent'],
    payload: {
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
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

  if (envelope.kind === 'chat' && envelope.from === 'fulfiller-agent') {
    if (awaiting && awaiting(envelope)) {
      append(`OK ${tests[testIndex].name}`);
      nextTest();
    }
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
