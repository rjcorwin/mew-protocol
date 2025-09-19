#!/usr/bin/env node
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'echo-agent';

function send(envelope) {
  const enriched = {
    protocol: 'mew/v0.3',
    ...envelope,
  };
  process.stdout.write(encodeEnvelope(enriched));
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    return;
  }
  if (envelope.from === participantId) {
    return;
  }
  if (envelope.kind !== 'chat') {
    return;
  }

  const messageText = envelope.payload?.text || '';
  const response = {
    kind: 'chat',
    correlation_id: envelope.id || envelope.correlation_id,
    payload: {
      text: `Echo: ${messageText}`,
      format: envelope.payload?.format || 'plain',
    },
  };
  send(response);
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    console.error('Echo agent failed to parse input:', error.message);
  }
});

process.stdin.on('close', () => {
  process.exit(0);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
