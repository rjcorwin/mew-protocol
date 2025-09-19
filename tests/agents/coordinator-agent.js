#!/usr/bin/env node
const { encodeEnvelope, FrameParser } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'coordinator';

function send(envelope) {
  process.stdout.write(encodeEnvelope({ protocol: 'mew/v0.3', ...envelope }));
}

function sendGrant() {
  send({
    kind: 'capability/grant',
    to: ['limited-agent'],
    payload: {
      recipient: 'limited-agent',
      capabilities: [
        {
          kind: 'mcp/request',
          payload: {
            method: 'tools/*',
          },
        },
      ],
    },
  });
}

function sendRevoke() {
  send({
    kind: 'capability/revoke',
    to: ['limited-agent'],
    payload: {
      recipient: 'limited-agent',
      capabilities: [
        {
          kind: 'mcp/request',
          payload: {
            method: 'tools/*',
          },
        },
      ],
    },
  });
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    setTimeout(sendGrant, 500);
    setTimeout(sendRevoke, 3000);
  }
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    // ignore
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
