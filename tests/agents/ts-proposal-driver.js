#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'ts-proposal-driver';
const logPath = process.env.DRIVER_LOG ? path.resolve(process.env.DRIVER_LOG) : null;
const agentId = process.env.AGENT_ID || 'typescript-proposal-agent';

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {
    // ignore logging errors
  }
}

function send(envelope) {
  process.stdout.write(
    encodeEnvelope({
      protocol: 'mew/v0.3',
      ...envelope,
    }),
  );
}

let awaitingResult = false;

function fulfillProposal(envelope) {
  const params = envelope.payload?.params || {};
  const args = params.arguments || {};
  const operation = args.operation || 'add';
  const a = Number(args.a || 0);
  const b = Number(args.b || 0);
  const result = operation === 'multiply' ? a * b : a + b;
  append(`FULFILL ${operation} ${a} ${b} -> ${result}`);
  awaitingResult = true;
  send({
    kind: 'chat',
    to: [agentId],
    payload: {
      text: `Result: ${result}`,
      format: 'plain',
    },
  });
}

function handleChat(envelope) {
  if (!awaitingResult) return;
  const text = envelope.payload?.text || '';
  if (text.includes('Result')) {
    append('OK chat-result');
    append('DONE');
    process.exit(0);
  }
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    return;
  }

  if (envelope.kind === 'mcp/proposal' && envelope.from === agentId) {
    append('RECEIVED proposal');
    fulfillProposal(envelope);
    return;
  }

  if (envelope.kind === 'chat' && envelope.from === agentId) {
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
