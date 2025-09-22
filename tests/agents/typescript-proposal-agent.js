#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'typescript-proposal-agent';
const driverId = process.env.REQUESTER_ID || 'ts-proposal-driver';
const logPath = process.env.TS_PROPOSAL_LOG ? path.resolve(process.env.TS_PROPOSAL_LOG) : null;

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {
    // ignore logging errors in tests
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

let pendingProposalId = null;
let awaitingResult = false;
let lastRequest = null;
let lastRequester = driverId;
let proposalSent = false;

function createProposal(operation, a, b) {
  const proposalId = `proposal-${Date.now()}`;
  pendingProposalId = proposalId;
  awaitingResult = true;
  lastRequest = { operation, a, b };
  append(`PROPOSE ${operation} ${a} ${b}`);
  send({
    id: proposalId,
    kind: 'mcp/proposal',
    to: [driverId],
    payload: {
      method: 'tools/call',
      params: {
        name: operation,
        arguments: { operation, a, b },
      },
    },
  });
}

function handleChat(envelope) {
  const text = envelope.payload?.text || '';
  append(`CHAT ${text}`);

  if (awaitingResult) {
    const expect = lastRequest
      ? String(lastRequest.operation === 'add'
          ? lastRequest.a + lastRequest.b
          : lastRequest.a * lastRequest.b)
      : '';
    const isResult = /Result:/i.test(text) || (!!expect && text.includes(expect)) || /^-?\d+(\.\d+)?$/.test(text.trim());
    if (!isResult) {
      return;
    }

    append('RECEIVED result chat');
    send({
      kind: 'chat',
      to: [lastRequester],
      payload: {
        text,
        format: 'plain',
      },
    });
    awaitingResult = false;
    pendingProposalId = null;
    lastRequest = null;
  }
}

const parser = new FrameParser((envelope) => {
  append(`RECV ${envelope.kind || 'unknown'}`);
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    if (!proposalSent) {
      proposalSent = true;
      setTimeout(() => createProposal('add', 7, 9), 200);
    }
    return;
  }
  if (envelope.kind === 'chat' && envelope.from === driverId) {
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
