#!/usr/bin/env node
/**
 * Scenario 9 calculator participant implemented via the MEW TypeScript participant SDK.
 * Exposes simple math tools that can be called when proposals are fulfilled.
 */

const { MEWParticipant } = require('@mew-protocol/participant');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-9-typescript-proposals',
  token: 'calculator-token',
  participant_id: 'calculator-agent'
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case '--gateway':
    case '-g':
      options.gateway = args[i + 1];
      i += 1;
      break;
    case '--space':
    case '-s':
      options.space = args[i + 1];
      i += 1;
      break;
    case '--token':
    case '-t':
      options.token = args[i + 1];
      i += 1;
      break;
    case '--id':
      options.participant_id = args[i + 1];
      i += 1;
      break;
    default:
      break;
  }
}

class CalculatorParticipant extends MEWParticipant {
  constructor(opts) {
    super(opts);

    this.registerTool({
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First addend' },
          b: { type: 'number', description: 'Second addend' }
        },
        required: ['a', 'b']
      },
      execute: async ({ a, b }) => Number(a) + Number(b)
    });

    this.registerTool({
      name: 'multiply',
      description: 'Multiply two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      },
      execute: async ({ a, b }) => Number(a) * Number(b)
    });

    this.registerTool({
      name: 'evaluate',
      description: 'Evaluate a JavaScript expression',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        },
        required: ['expression']
      },
      execute: async ({ expression }) => {
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict"; return (' + expression + ')')();
        return result;
      }
    });
  }

  async onReady() {
    console.log('Calculator participant ready with add/multiply/evaluate tools');
  }
}

const participant = new CalculatorParticipant({
  gateway: options.gateway,
  space: options.space,
  token: options.token,
  participant_id: options.participant_id
});

participant.connect().catch((error) => {
  console.error('Calculator participant failed to connect:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  participant.disconnect().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  participant.disconnect().finally(() => process.exit(0));
});
