#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'limited-agent';
const logPath = process.env.DRIVER_LOG || './limited-driver.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

let grantReceived = false;
let revokeReceived = false;
let awaitingResponse = false;

function sendRequest() {
  const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  awaitingResponse = id;
  const envelope = {
    protocol: 'mew/v0.3',
    id,
    kind: 'mcp/request',
    to: ['calculator-agent'],
    payload: {
      method: 'tools/call',
      params: {
        name: 'add',
        arguments: { a: 2, b: 3 },
      },
    },
  };
  process.stdout.write(encodeEnvelope(envelope));
}

function maybeFinish() {
  if (grantReceived && revokeReceived && !awaitingResponse) {
    append('DONE');
    process.exit(0);
  }
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    return;
  }

  if (envelope.kind === 'capability/grant' && envelope.from === 'coordinator') {
    grantReceived = true;
    append('GRANT');
    sendRequest();
    return;
  }

  if (envelope.kind === 'capability/revoke' && envelope.from === 'coordinator') {
    revokeReceived = true;
    append('REVOKE');
    maybeFinish();
    return;
  }

  if (
    envelope.kind === 'mcp/response' &&
    envelope.from === 'calculator-agent' &&
    awaitingResponse &&
    envelope.correlation_id === awaitingResponse
  ) {
    awaitingResponse = false;
    const result = envelope.payload?.result;
    if (result === 5) {
      append('OK tool-call');
    } else {
      append('FAIL tool-call');
      process.exit(1);
    }
    maybeFinish();
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
