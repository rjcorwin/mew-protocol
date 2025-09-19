#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'research-agent';
const logPath = process.env.DRIVER_LOG || './reasoning-driver.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

const requestId = `req-${Date.now()}`;
const reasoningId = `reason-${Date.now()}`;
const pending = new Map();
let stepIndex = -1;

const steps = [
  {
    name: 'chat-request',
    action() {
      sendEnvelope({
        id: requestId,
        kind: 'chat',
        context: undefined,
        payload: {
          text: 'Calculate the total cost with tax',
        },
      });
      append('OK chat-request');
      nextStep();
    },
  },
  {
    name: 'reason-start',
    action() {
      sendEnvelope({
        id: `start-${Date.now()}`,
        kind: 'reasoning/start',
        correlation_id: [requestId],
        context: reasoningId,
        payload: {
          message: 'Starting calculation for total cost',
        },
      });
      append('OK reason-start');
      nextStep();
    },
  },
  {
    name: 'thought-1',
    action() {
      sendEnvelope({
        kind: 'reasoning/thought',
        context: reasoningId,
        payload: {
          message: 'Compute base cost: 5 x 12',
        },
      });
      append('OK thought-1');
      nextStep();
    },
  },
  {
    name: 'calc-base',
    action() {
      sendCalc('multiply', { a: 5, b: 12 }, 60);
    },
  },
  {
    name: 'thought-2',
    action() {
      sendEnvelope({
        kind: 'reasoning/thought',
        context: reasoningId,
        payload: {
          message: 'Compute tax: base x 0.08',
        },
      });
      append('OK thought-2');
      nextStep();
    },
  },
  {
    name: 'calc-tax',
    action() {
      sendCalc('multiply', { a: 60, b: 0.08 }, 4.8);
    },
  },
  {
    name: 'thought-3',
    action() {
      sendEnvelope({
        kind: 'reasoning/thought',
        context: reasoningId,
        payload: {
          message: 'Add base and tax',
        },
      });
      append('OK thought-3');
      nextStep();
    },
  },
  {
    name: 'calc-total',
    action() {
      sendCalc('add', { a: 60, b: 4.8 }, 64.8);
    },
  },
  {
    name: 'reason-conclusion',
    action() {
      sendEnvelope({
        kind: 'reasoning/conclusion',
        context: reasoningId,
        payload: {
          message: 'Total cost is $64.80',
        },
      });
      append('OK reason-conclusion');
      nextStep();
    },
  },
  {
    name: 'final-chat',
    action() {
      sendEnvelope({
        kind: 'chat',
        correlation_id: [requestId],
        payload: {
          text: 'Final total: $64.80',
        },
      });
      append('OK final-chat');
      append('DONE');
      process.exit(0);
    },
  },
];

function sendEnvelope(envelope) {
  const message = { protocol: 'mew/v0.3', ...envelope };
  if (message.context === undefined) {
    message.context = reasoningId;
  }
  process.stdout.write(encodeEnvelope(message));
}

function sendCalc(name, args, expected) {
  const id = `calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  pending.set(id, { name: steps[stepIndex].name, expected });
  const envelope = {
    id,
    kind: 'mcp/request',
    to: ['calculator-agent'],
    context: reasoningId,
    payload: {
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    },
  };
  process.stdout.write(encodeEnvelope({ protocol: 'mew/v0.3', ...envelope }));
}

function nextStep() {
  stepIndex += 1;
  if (stepIndex >= steps.length) {
    append('DONE');
    process.exit(0);
  }
  steps[stepIndex].action();
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    nextStep();
    return;
  }

  if (envelope.kind === 'mcp/response' && envelope.from === 'calculator-agent') {
    const pendingEntry = pending.get(envelope.correlation_id);
    if (!pendingEntry) {
      return;
    }
    pending.delete(envelope.correlation_id);

    const { expected, name } = pendingEntry;
    const result = envelope.payload?.result;
    const contextMatches = envelope.context === reasoningId;
    const numericMatches = Math.abs(Number(result) - expected) < 1e-6;

    if (contextMatches && numericMatches) {
      append(`OK ${name}`);
      nextStep();
    } else {
      append(`FAIL ${name}`);
      append(`DEBUG result=${result} expected=${expected} context=${envelope.context}`);
      process.exit(1);
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

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
