#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { MEWClient } = require('@mew-protocol/client');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[sdk-consumer] Missing environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

const gateway = requiredEnv('MEW_GATEWAY');
const space = requiredEnv('MEW_SPACE');
const token = requiredEnv('MEW_TOKEN');
const participantId = requiredEnv('MEW_PARTICIPANT');
const logPath = requiredEnv('STREAM_LOG');

fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, '', 'utf8');

const client = new MEWClient({
  gateway,
  space,
  token,
  participant_id: participantId,
});

const append = (entry) => {
  try {
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('[sdk-consumer] failed to append log', error);
  }
};

client.onWelcome((payload) => {
  append({ event: 'welcome', you: payload?.you?.id });
});

client.onStreamReady((envelope) => {
  append({ event: 'ready', stream: envelope.payload?.stream });
});

client.onStreamStart((envelope) => {
  append({ event: 'start', stream: envelope.payload?.stream });
});

client.onStreamData((envelope) => {
  append({
    event: 'data',
    stream: envelope.payload?.stream,
    sequence: envelope.payload?.sequence,
    content: envelope.payload?.content,
  });
});

client.onStreamComplete((envelope) => {
  const streamId = envelope.payload?.stream?.stream_id;
  append({ event: 'complete', stream: envelope.payload?.stream });

  if (streamId) {
    const record = client.getStream(streamId);
    if (record) {
      append({ event: 'record', record });
    }
  }

  setTimeout(() => {
    client.disconnect();
    process.exit(0);
  }, 200);
});

client.onStreamError((envelope) => {
  append({ event: 'error', payload: envelope.payload });
  client.disconnect();
  process.exit(1);
});

client.onError((error) => {
  append({ event: 'client-error', message: error.message });
});

client.connect().catch((error) => {
  append({ event: 'connect-error', message: error.message });
  process.exit(1);
});
