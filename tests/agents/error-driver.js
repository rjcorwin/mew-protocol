#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'error-driver';
const logPath = process.env.DRIVER_LOG || './error-driver.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

let currentStep = null;
const pending = new Map();

const steps = [
  {
    name: 'invalid-tool',
    action() {
      sendCalc('invalid', {}, false, 'Tool not found');
    },
  },
  {
    name: 'large-message',
    action() {
      const largeText = 'A'.repeat(8192);
      sendEnvelope({
        kind: 'chat',
        payload: {
          text: largeText,
        },
      });
      append('OK large-message');
      nextStep();
    },
  },
  {
    name: 'rapid-fire',
    action() {
      let remaining = 5;
      for (let i = 0; i < 5; i++) {
        const id = `rapid-${Date.now()}-${i}`;
        pending.set(id, {
          step: 'rapid-fire',
          expected: i,
          onSuccess: () => {
            remaining -= 1;
            if (remaining === 0) {
              append('OK rapid-fire');
              nextStep();
            }
          },
        });
        sendEnvelope({
          id,
          kind: 'mcp/request',
          to: ['calculator-agent'],
          payload: {
            method: 'tools/call',
            params: {
              name: 'add',
              arguments: { a: i, b: 1 },
            },
          },
        });
      }
    },
  },
  {
    name: 'done',
    action() {
      append('DONE');
      process.exit(0);
    },
  },
];

function nextStep() {
  currentStep = steps.shift();
  if (!currentStep) {
    append('DONE');
    process.exit(0);
  }
  currentStep.action();
}

function sendEnvelope(envelope) {
  process.stdout.write(encodeEnvelope({ protocol: 'mew/v0.3', ...envelope }));
}

function sendCalc(toolName, args, expectSuccess, errorIncludes) {
  const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  pending.set(id, {
    step: currentStep.name,
    expectSuccess,
    errorIncludes,
  });
  sendEnvelope({
    id,
    kind: 'mcp/request',
    to: ['calculator-agent'],
    payload: {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    },
  });
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

    if (pendingEntry.step === 'rapid-fire') {
      if (envelope.payload?.success === true) {
        pendingEntry.onSuccess();
      } else {
        append('FAIL rapid-fire');
        process.exit(1);
      }
      return;
    }

    const { expectSuccess, errorIncludes, step } = pendingEntry;
    const success = envelope.payload?.success !== false;

    if (expectSuccess === success) {
      if (expectSuccess) {
        append(`OK ${step}`);
      } else {
        const errorMsg = envelope.payload?.error || '';
        if (errorIncludes && !errorMsg.includes(errorIncludes)) {
          append(`FAIL ${step}`);
          append(`DEBUG error=${errorMsg}`);
          process.exit(1);
        }
        append(`OK ${step}`);
      }
      nextStep();
    } else {
      append(`FAIL ${step}`);
      append(`DEBUG payload=${JSON.stringify(envelope.payload)}`);
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
