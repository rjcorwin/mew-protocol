#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'stream-driver';
const agentId = process.env.AGENT_ID || 'streaming-agent';
const logPath = process.env.STREAM_DRIVER_LOG ? path.resolve(process.env.STREAM_DRIVER_LOG) : null;

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

let events = [];
let requestSent = false;

function handleEvent(kind, payload) {
  events.push(kind);
  append(`${kind} ${payload?.message || payload?.text || ''}`);
  if (!requestSent) return;
  if (kind === 'chat') {
    const hasStart = events.includes('reasoning/start');
    const thoughts = events.filter((k) => k === 'reasoning/thought').length;
    const hasConclusion = events.includes('reasoning/conclusion');
    if (hasStart && thoughts >= 2 && hasConclusion && /123/.test(payload?.text || '')) {
      append('OK streaming-sequence');
      append('DONE');
      process.exit(0);
    }
  }
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome' && !requestSent) {
    append('WELCOME');
    requestSent = true;
    send({
      kind: 'chat',
      to: [agentId],
      payload: {
        text: 'Please stream your reasoning for 123',
        format: 'plain',
      },
    });
    return;
  }

  if (envelope.from !== agentId) return;

  switch (envelope.kind) {
    case 'reasoning/start':
    case 'reasoning/thought':
    case 'reasoning/conclusion':
      handleEvent(envelope.kind, envelope.payload);
      break;
    case 'chat':
      handleEvent('chat', envelope.payload);
      break;
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
