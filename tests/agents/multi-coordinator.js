#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'coordinator-agent';
const workerId = process.env.WORKER_ID || 'worker-agent';
const driverId = process.env.DRIVER_ID || 'multi-driver';
const logPath = process.env.COORDINATOR_LOG ? path.resolve(process.env.COORDINATOR_LOG) : null;
let awaitingWorker = false;

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
  append(`CHAT from ${envelope.from}: ${text}`);

  if (envelope.from === driverId && /coordinate/i.test(text)) {
    const match = text.match(/(\d+)\s*([+*])\s*(\d+)/);
    if (match) {
      const a = Number(match[1]);
      const op = match[2] === '*' ? 'multiply' : 'add';
      const b = Number(match[3]);
      awaitingWorker = true;
      send({
        kind: 'chat',
        to: [workerId],
        payload: {
          text: `Compute ${a} ${op} ${b}`,
          format: 'plain',
        },
      });
      append(`REQUEST worker ${a} ${op} ${b}`);
    }
    return;
  }

  if (envelope.from === workerId && awaitingWorker) {
    awaitingWorker = false;
    send({
      kind: 'chat',
      to: [driverId],
      payload: {
        text,
        format: 'plain',
      },
    });
    append(`FORWARD result ${text}`);
  }
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
