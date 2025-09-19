#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'batch-agent';
const driverId = process.env.DRIVER_ID || 'batch-driver';
const logPath = process.env.BATCH_AGENT_LOG ? path.resolve(process.env.BATCH_AGENT_LOG) : null;

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

function emitChunks() {
  const chunks = ['chunk-1', 'chunk-2', 'chunk-3'];
  chunks.forEach((chunk, index) => {
    send({
      kind: 'chat',
      to: [driverId],
      payload: {
        text: `DATA ${chunk}`,
        format: 'plain',
      },
    });
    append(`EMIT ${chunk}`);
  });
  send({
    kind: 'chat',
    to: [driverId],
    payload: {
      text: 'COMPLETE all chunks delivered',
      format: 'plain',
    },
  });
  append('EMIT COMPLETE');
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    return;
  }
  if (envelope.kind === 'chat' && envelope.from === driverId) {
    append(`REQUEST ${envelope.payload?.text || ''}`);
    emitChunks();
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
