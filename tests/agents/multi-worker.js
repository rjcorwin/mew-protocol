#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'worker-agent';
const logPath = process.env.WORKER_LOG ? path.resolve(process.env.WORKER_LOG) : null;

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

function handleChat(envelope) {
  const text = envelope.payload?.text || '';
  append(`CHAT ${text}`);
  const match = text.match(/(-?\d+)\s*(add|multiply)\s*(-?\d+)/i);
  if (!match) return;
  const a = Number(match[1]);
  const op = match[2].toLowerCase();
  const b = Number(match[3]);
  const result = op === 'multiply' ? a * b : a + b;
  send({
    kind: 'chat',
    to: [envelope.from || 'coordinator-agent'],
    payload: {
      text: `Result: ${result}`,
      format: 'plain',
    },
  });
  append(`RESULT ${result}`);
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    return;
  }
  if (envelope.kind === 'chat') {
    handleChat(envelope);
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
