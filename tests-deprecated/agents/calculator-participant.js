#!/usr/bin/env node
/**
 * Calculator Agent - Provides MCP math tools (add, multiply, evaluate)
 * Using MEWParticipant base class for cleaner, promise-based code
 */

const path = require('path');

// Import MEWParticipant from the SDK
const participantPath = path.resolve(__dirname, '../../sdk/typescript-sdk/participant/dist/index.js');
const { MEWParticipant } = require(participantPath);

class CalculatorAgent extends MEWParticipant {
  constructor(options) {
    super(options);
    
    // Register calculator tools - they'll be automatically handled
    this.registerTool({
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' }
        },
        required: ['a', 'b']
      },
      execute: async (args) => {
        return args.a + args.b;
      }
    });
    
    this.registerTool({
      name: 'multiply',
      description: 'Multiply two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' }
        },
        required: ['a', 'b']
      },
      execute: async (args) => {
        return args.a * args.b;
      }
    });
    
    this.registerTool({
      name: 'evaluate',
      description: 'Evaluate a mathematical expression',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Mathematical expression to evaluate' }
        },
        required: ['expression']
      },
      execute: async (args) => {
        try {
          // Simple safe eval for basic math expressions
          const result = Function('"use strict"; return (' + args.expression + ')')();
          // Convert Infinity to a string for JSON serialization
          if (!isFinite(result)) {
            return result.toString(); // Returns "Infinity" or "-Infinity" 
          }
          return result;
        } catch (error) {
          throw new Error(`Invalid expression: ${error.message}`);
        }
      }
    });
  }
  
  async onReady() {
    console.log('Calculator agent ready!');
    console.log('Registered 3 tools: add, multiply, evaluate');
    
    // Add debug logging for all incoming messages
    this.onMessage((envelope) => {
      console.log(`Calculator received ${envelope.kind} from ${envelope.from}:`, JSON.stringify(envelope.payload));
    });
  }
  
  async onShutdown() {
    console.log('Calculator agent shutting down...');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  token: 'calculator-token',
  participant_id: 'calculator-agent'
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gateway' || args[i] === '-g') {
    options.gateway = args[i + 1];
    i++;
  } else if (args[i] === '--space' || args[i] === '-s') {
    options.space = args[i + 1];
    i++;
  } else if (args[i] === '--token' || args[i] === '-t') {
    options.token = args[i + 1];
    i++;
  } else if (args[i] === '--id') {
    options.participant_id = args[i + 1];
    i++;
  }
}

// Create and start the agent
const agent = new CalculatorAgent(options);

console.log(`Starting calculator agent with MEWParticipant...`);
console.log(`Gateway: ${options.gateway}`);
console.log(`Space: ${options.space}`);

agent.connect()
  .then(() => {
    console.log('Calculator agent connected successfully');
  })
  .catch(error => {
    console.error('Failed to connect:', error);
    process.exit(1);
  });

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  agent.disconnect();
  process.exit(0);
});