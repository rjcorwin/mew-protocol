#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'streaming-agent';
const logPath = process.env.STREAM_AGENT_LOG ? path.resolve(process.env.STREAM_AGENT_LOG) : null;
const driverId = process.env.DRIVER_ID || 'stream-driver';

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

function emitStream() {
  const baseId = `stream-${Date.now()}`;
  send({
    id: `${baseId}-start`,
    kind: 'reasoning/start',
    to: [driverId],
    payload: {
      message: 'Starting streamed reasoning',
    },
  });
  append('EMIT start');
  send({
    id: `${baseId}-thought1`,
    kind: 'reasoning/thought',
    to: [driverId],
    payload: {
      message: 'Thinking step 1',
    },
  });
  append('EMIT thought1');
  send({
    id: `${baseId}-thought2`,
    kind: 'reasoning/thought',
    to: [driverId],
    payload: {
      message: 'Thinking step 2',
    },
  });
  append('EMIT thought2');
  send({
    id: `${baseId}-end`,
    kind: 'reasoning/conclusion',
    to: [driverId],
    payload: {
      message: 'Finished with answer 123',
    },
  });
  append('EMIT conclusion');
  send({
    kind: 'chat',
    to: [driverId],
    payload: {
      text: 'Final answer: 123',
      format: 'plain',
    },
  });
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    return;
  }
  if (envelope.kind === 'chat' && envelope.from === driverId) {
    append(`CHAT ${envelope.payload?.text || ''}`);
    emitStream();
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
