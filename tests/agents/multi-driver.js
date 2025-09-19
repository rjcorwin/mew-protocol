#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'multi-driver';
const coordinatorId = process.env.COORDINATOR_ID || 'coordinator-agent';
const logPath = process.env.DRIVER_LOG ? path.resolve(process.env.DRIVER_LOG) : null;

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {}
}

function send(envelope) {
  process.stdout.write(
    encodeEnvelope({
      protocol: 'mew/v0.3',
      ...envelope,
    }),
  );
}

let started = false;
let done = false;

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome' && !started) {
    append('WELCOME');
    started = true;
    send({
      kind: 'chat',
      to: [coordinatorId],
      payload: {
        text: 'Please coordinate with worker-agent to compute 15 + 25',
        format: 'plain',
      },
    });
    append('REQUEST coordination 15 + 25');
    return;
  }

  if (envelope.kind === 'chat' && envelope.from === coordinatorId) {
    append(`COORDINATOR_RESPONSE ${envelope.payload?.text || ''}`);
    if (!done && /40/.test(envelope.payload?.text || '')) {
      done = true;
      append('OK coordination');
      append('DONE');
      setTimeout(() => process.exit(0), 200);
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

process.stdin.on('close', () => process.exit(done ? 0 : 1));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
