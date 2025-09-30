// @ts-nocheck
import { Command } from 'commander';
import WebSocket from 'ws';
import { MEWAgent } from '../../agent/index.js';

const agent = new Command('agent').description('Agent management');

agent
  .command('start')
  .description('Start a built-in agent')
  .requiredOption('-t, --type <type>', 'Agent type (echo|calculator|fulfiller)')
  .requiredOption('-g, --gateway <url>', 'WebSocket URL')
  .requiredOption('-s, --space <space>', 'Space to join')
  .option('--token <token>', 'Authentication token')
  .action(async (options) => {
    const agentType = options.type;
    const participantId = `${agentType}-agent`;

    console.log(`Starting ${agentType} agent as ${participantId}...`);

    // Connect to gateway
    const ws = new WebSocket(options.gateway);

    ws.on('open', () => {
      console.log('Agent connected to gateway');

      // Send join message
      ws.send(
        JSON.stringify({
          type: 'join',
          participantId,
          space: options.space,
          token: options.token,
        }),
      );
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`Agent received message: ${JSON.stringify(message)}`);

      // Skip our own messages
      if (message.from === participantId) {
        console.log('Skipping own message');
        return;
      }

      // Handle based on agent type
      switch (agentType) {
        case 'echo':
          handleEchoAgent(ws, message);
          break;
        case 'calculator':
          handleCalculatorAgent(ws, message);
          break;
        case 'fulfiller':
          handleFulfillerAgent(ws, message);
          break;
        default:
          console.error(`Unknown agent type: ${agentType}`);
      }
    });

    ws.on('error', (error) => {
      console.error('Agent WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('Agent disconnected from gateway');
      process.exit(0);
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nStopping agent...');
      ws.close();
      process.exit(0);
    });
  });

// Echo agent handler
function handleEchoAgent(ws, message) {
  if (message.kind === 'chat') {
    const text = message.payload?.text;
    if (text) {
      console.log(`Echo agent received: "${text}"`);

      // Send echo response
      ws.send(
        JSON.stringify({
          kind: 'chat',
          payload: {
            text: `Echo: ${text}`,
          },
        }),
      );
    }
  }
}

// Calculator agent handler
function handleCalculatorAgent(ws, message) {
  if (message.kind === 'mcp/request') {
    const method = message.payload?.method;
    const params = message.payload?.params;

    if (method === 'tools/list') {
      // Return available tools
      ws.send(
        JSON.stringify({
          kind: 'mcp/response',
          correlation_id: [message.id],
          payload: {
            result: {
              tools: [
                {
                  name: 'add',
                  description: 'Add two numbers',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      a: { type: 'number' },
                      b: { type: 'number' },
                    },
                    required: ['a', 'b'],
                  },
                },
                {
                  name: 'multiply',
                  description: 'Multiply two numbers',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      a: { type: 'number' },
                      b: { type: 'number' },
                    },
                    required: ['a', 'b'],
                  },
                },
                {
                  name: 'evaluate',
                  description: 'Evaluate a math expression',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      expression: { type: 'string' },
                    },
                    required: ['expression'],
                  },
                },
              ],
            },
          },
        }),
      );
    } else if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      let result;
      let error = null;

      try {
        switch (toolName) {
          case 'add':
            result = args.a + args.b;
            break;
          case 'multiply':
            result = args.a * args.b;
            break;
          case 'evaluate':
            // Simple eval (dangerous in production!)
            try {
              result = eval(args.expression);
            } catch (e) {
              error = { message: 'Invalid expression' };
            }
            break;
          default:
            error = { message: `Unknown tool: ${toolName}` };
        }
      } catch (e) {
        error = { message: e.message };
      }

      if (error) {
        ws.send(
          JSON.stringify({
            kind: 'mcp/response',
            correlation_id: [message.id],
            payload: {
              error,
            },
          }),
        );
      } else {
        ws.send(
          JSON.stringify({
            kind: 'mcp/response',
            correlation_id: [message.id],
            payload: {
              result: {
                content: [
                  {
                    type: 'text',
                    text: String(result),
                  },
                ],
              },
            },
          }),
        );
      }

      console.log(`Calculator: ${toolName}(${JSON.stringify(args)}) = ${result || error?.message}`);
    }
  }
}

// Fulfiller agent handler
function handleFulfillerAgent(ws, message) {
  if (message.kind === 'mcp/proposal') {
    console.log(`Fulfiller agent saw proposal: ${message.id}`);

    // Auto-fulfill the proposal by copying its payload and adding correlation_id
    const fulfillment = {
      kind: 'mcp/request',
      correlation_id: [message.id],
      payload: message.payload,
    };

    ws.send(JSON.stringify(fulfillment));
    console.log(`Fulfiller agent fulfilled proposal: ${message.id}`);
  }
}

// Add run command for full MEWAgent
agent
  .command('run')
  .description('Run a full MEWAgent with OpenAI/Claude integration')
  .requiredOption('-g, --gateway <url>', 'WebSocket URL')
  .requiredOption('-s, --space <space>', 'Space to join')
  .requiredOption('--id <id>', 'Participant ID')
  .option('-t, --token <token>', 'Authentication token')
  .action(async (options) => {
    try {
      const agent = new MEWAgent({
        gateway: options.gateway,
        space: options.space,
        participantId: options.id,
        token: options.token,
      });

      await agent.connect();
      console.log(`MEWAgent ${options.id} connected to ${options.space}`);

      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\nStopping agent...');
        await agent.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start agent:', error);
      process.exit(1);
    }
  });

export default agent;
