#!/usr/bin/env node
const WebSocket = require('ws');

const gatewayUrl = process.env.MEW_GATEWAY || 'ws://localhost:8080';
const spaceId = process.env.MEW_SPACE || 'streams-space';
const token = process.env.MEW_TOKEN || 'streamer-token';
const participantId = process.env.MEW_PARTICIPANT || `streamer-${Date.now()}`;

const ws = new WebSocket(gatewayUrl);

const send = (payload) => {
  ws.send(JSON.stringify(payload));
};

let announced = false;
let streamId = null;

function sendStreamAnnounce() {
  if (announced) return;
  announced = true;
  send({
    protocol: 'mew/v0.3',
    id: `announce-${Date.now()}`,
    kind: 'stream/announce',
    payload: {
      intent: 'llm/tokens',
      desired_id: 'demo-stream',
      formats: [
        {
          id: 'llm/tokens',
          description: 'Tokens emitted from a language model',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              index: { type: 'number' }
            },
            required: ['token', 'index']
          }
        }
      ]
    }
  });
}

function sendStreamStart() {
  if (!streamId) return;
  send({
    protocol: 'mew/v0.3',
    id: `start-${Date.now()}`,
    kind: 'stream/start',
    payload: {
      stream: { stream_id: streamId },
      start_ts: new Date().toISOString()
    }
  });
}

function sendStreamData(sequence, tokenValue) {
  if (!streamId) return;
  send({
    protocol: 'mew/v0.3',
    id: `data-${sequence}-${Date.now()}`,
    kind: 'stream/data',
    payload: {
      stream: { stream_id: streamId },
      sequence,
      format_id: 'llm/tokens',
      content: {
        token: tokenValue,
        index: sequence
      }
    }
  });
}

function sendStreamComplete() {
  if (!streamId) return;
  send({
    protocol: 'mew/v0.3',
    id: `complete-${Date.now()}`,
    kind: 'stream/complete',
    payload: {
      stream: { stream_id: streamId },
      reason: 'scenario-finished'
    }
  });
}

ws.on('open', () => {
  send({
    type: 'join',
    space: spaceId,
    token,
    participantId,
    capabilities: [
      { kind: 'stream/*' },
      { kind: 'chat' },
      { kind: 'system/*' }
    ]
  });
});

ws.on('message', (data) => {
  let envelope;
  try {
    envelope = JSON.parse(data.toString());
  } catch (error) {
    console.error('[streamer] failed to parse envelope', error);
    return;
  }

  if (envelope.kind === 'system/welcome') {
    setTimeout(sendStreamAnnounce, 100);
  }

  if (envelope.kind === 'stream/ready' && envelope.payload?.stream?.creator === participantId) {
    streamId = envelope.payload.stream.stream_id;
    setTimeout(() => {
      sendStreamStart();
      setTimeout(() => sendStreamData(1, 'Hello'), 100);
      setTimeout(() => sendStreamData(2, 'World'), 200);
      setTimeout(sendStreamComplete, 350);
    }, 50);
  }

  if (envelope.kind === 'stream/error' && envelope.payload?.stream?.stream_id === streamId) {
    console.error('[streamer] stream errored', envelope.payload);
    process.exit(1);
  }

  if (envelope.kind === 'stream/complete' && envelope.payload?.stream?.stream_id === streamId) {
    setTimeout(() => {
      ws.close();
    }, 100);
  }
});

ws.on('close', () => {
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('[streamer] websocket error', error);
  process.exit(1);
});
