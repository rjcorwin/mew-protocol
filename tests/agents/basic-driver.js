#!/usr/bin/env node
const fs = require('fs');
const { StringDecoder } = require('string_decoder');

const participantId = process.env.MEW_PARTICIPANT_ID || 'driver';
const logPath = process.env.DRIVER_LOG || './driver.log';
fs.mkdirSync(require('path').dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

function encodeEnvelope(envelope) {
  const json = JSON.stringify(envelope);
  const length = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${length}\r\n\r\n${json}`;
}

class FrameParser {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.decoder = new StringDecoder('utf8');
    this.buffer = Buffer.alloc(0);
    this.expectedLength = null;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.process();
  }

  process() {
    while (true) {
      if (this.expectedLength === null) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = this.buffer.slice(0, headerEnd).toString('utf8');
        const match = header.match(/Content-Length: (\d+)/i);
        if (!match) throw new Error('Invalid frame header');
        this.expectedLength = Number(match[1]);
        this.buffer = this.buffer.slice(headerEnd + 4);
      }
      if (this.buffer.length < this.expectedLength) return;
      const payload = this.buffer.slice(0, this.expectedLength);
      this.buffer = this.buffer.slice(this.expectedLength);
      this.expectedLength = null;
      const json = this.decoder.write(payload);
      const envelope = JSON.parse(json);
      this.onMessage(envelope);
    }
  }
}

const parser = new FrameParser(handleEnvelope);
process.stdin.on('data', (chunk) => parser.push(chunk));
process.stdin.on('end', () => process.exit(0));

const state = {
  currentIndex: -1,
  awaiting: null,
};

const largeText = 'A'.repeat(1000);

const tests = [
  {
    name: 'simple',
    start() {
      sendChat('Hello, echo!');
      state.awaiting = (env) => env.payload?.text === 'Echo: Hello, echo!';
    },
  },
  {
    name: 'correlation',
    start() {
      sendChat('Test with ID', 'msg-123');
      state.awaiting = (env) =>
        env.correlation_id && env.correlation_id.includes('msg-123');
    },
  },
  {
    name: 'multiple',
    start() {
      state.expected = new Set(['Echo: Message 1', 'Echo: Message 2', 'Echo: Message 3']);
      ['Message 1', 'Message 2', 'Message 3'].forEach((text) => sendChat(text));
      state.awaiting = (env) => {
        const msg = env.payload?.text;
        if (state.expected.delete(msg)) {
          return state.expected.size === 0;
        }
        return false;
      };
    },
  },
  {
    name: 'large',
    start() {
      sendChat(largeText);
      state.awaiting = (env) => env.payload?.text === `Echo: ${largeText}`;
    },
  },
  {
    name: 'rapid',
    start() {
      state.expectedRapid = 5;
      for (let i = 1; i <= 5; i++) {
        sendChat(`Rapid ${i}`);
      }
      state.awaiting = (env) => {
        const msg = env.payload?.text;
        if (msg && msg.startsWith('Echo: Rapid')) {
          state.expectedRapid -= 1;
          return state.expectedRapid === 0;
        }
        return false;
      };
    },
  },
];

function nextTest() {
  state.currentIndex += 1;
  if (state.currentIndex >= tests.length) {
    append('DONE');
    process.exit(0);
  }
  const test = tests[state.currentIndex];
  state.awaiting = null;
  test.start();
}

function handleEnvelope(envelope) {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    nextTest();
    return;
  }

  if (envelope.kind !== 'chat') return;
  if (envelope.from === participantId) return;

  if (state.awaiting && state.awaiting(envelope)) {
    append(`OK ${tests[state.currentIndex].name}`);
    nextTest();
  }
}

function sendChat(text, id) {
  const envelope = {
    protocol: 'mew/v0.3',
    kind: 'chat',
    payload: {
      text,
      format: 'plain',
    },
  };
  if (id) {
    envelope.id = id;
  }
  process.stdout.write(encodeEnvelope(envelope));
}

process.on('SIGINT', () => process.exit(0));
