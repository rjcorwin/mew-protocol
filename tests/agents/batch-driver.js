#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'batch-driver';
const agentId = process.env.AGENT_ID || 'batch-agent';
const logPath = process.env.BATCH_DRIVER_LOG ? path.resolve(process.env.BATCH_DRIVER_LOG) : null;

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

const chunks = [];
let started = false;

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome' && !started) {
    append('WELCOME');
    started = true;
    send({
      kind: 'chat',
      to: [agentId],
      payload: {
        text: 'request data batch',
        format: 'plain',
      },
    });
    return;
  }

  if (envelope.kind === 'chat' && envelope.from === agentId) {
    const text = envelope.payload?.text || '';
    append(`RECV ${text}`);
    if (text.startsWith('DATA ')) {
      chunks.push(text.slice(5));
      return;
    }
    if (text.startsWith('COMPLETE')) {
      if (chunks.length === 3 && chunks.every((v, i) => v === `chunk-${i + 1}`)) {
        append('OK batch-sequence');
        append('DONE');
        process.exit(0);
      } else {
        append('FAIL batch-sequence');
        process.exit(1);
      }
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

process.stdin.on('close', () => process.exit(1));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
