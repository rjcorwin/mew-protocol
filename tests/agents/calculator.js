#!/usr/bin/env node
/**
 * Calculator Agent - Provides MCP math tools (add, multiply, evaluate)
 * For MEUP v0.2 test scenarios
 */

const path = require('path');

// Import MEUPClient from the SDK
const clientPath = path.resolve(__dirname, '../../sdk/typescript-sdk/client/dist/index.js');
const { MEUPClient } = require(clientPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  token: 'calculator-token'
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
  }
}

const participantId = 'calculator-agent';

// Available tools
const tools = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'evaluate',
    description: 'Evaluate a mathematical expression',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string' }
      },
      required: ['expression']
    }
  }
];

// Tool implementations
function executeTool(name, args) {
  switch (name) {
    case 'add':
      return args.a + args.b;
    case 'multiply':
      return args.a * args.b;
    case 'evaluate':
      try {
        // Simple safe eval for basic math expressions
        const result = Function('"use strict"; return (' + args.expression + ')')();
        return result;
      } catch (error) {
        throw new Error(`Invalid expression: ${error.message}`);
      }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create MEUP client
const client = new MEUPClient({
  gateway: options.gateway,
  space: options.space,
  token: options.token,
  participant_id: participantId,
  capabilities: [],
  reconnect: true
});

console.log(`Calculator agent connecting to ${options.gateway}...`);

// Track if we've sent the initial join message
let joined = false;

// Handle connection events
client.onConnected(() => {
  console.log('Calculator agent connected to gateway');
  
  // For compatibility with the gateway, send a join message
  if (!joined) {
    // Send the join message using the client's send method
    client.send({
      type: 'join',
      participantId: participantId,
      space: options.space,
      token: options.token
    });
    joined = true;
  }
});

// Connect to gateway
client.connect()
  .catch((error) => {
    console.error('Failed to connect:', error);
    process.exit(1);
  });

// Handle incoming messages
client.onMessage((envelope) => {
  try {
    // Handle MCP requests addressed to us
    if (envelope.kind === 'mcp/request' && 
        (!envelope.to || envelope.to.includes(participantId))) {
      
      const method = envelope.payload?.method;
      const params = envelope.payload?.params || {};
      const requestId = envelope.payload?.id;
      
      console.log(`Received MCP request: ${method}`);
      
      let response;
      
      try {
        if (method === 'tools/list') {
          // Return available tools
          response = {
            kind: 'mcp/response',
            to: [envelope.from],
            correlation_id: envelope.id ? [envelope.id] : undefined,
            payload: {
              jsonrpc: '2.0',
              id: requestId,
              result: {
                tools: tools
              }
            }
          };
        } else if (method === 'tools/call') {
          // Execute tool
          const toolName = params.name;
          const toolArgs = params.arguments || {};
          const result = executeTool(toolName, toolArgs);
          
          response = {
            kind: 'mcp/response',
            to: [envelope.from],
            correlation_id: envelope.id ? [envelope.id] : undefined,
            payload: {
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [{
                  type: 'text',
                  text: String(result)
                }]
              }
            }
          };
        } else {
          // Method not supported
          response = {
            kind: 'mcp/response',
            to: [envelope.from],
            correlation_id: envelope.id ? [envelope.id] : undefined,
            payload: {
              jsonrpc: '2.0',
              id: requestId,
              error: {
                code: -32601,
                message: `Method not found: ${method}`
              }
            }
          };
        }
      } catch (error) {
        // Tool execution error
        response = {
          kind: 'mcp/response',
          to: [envelope.from],
          correlation_id: envelope.id ? [envelope.id] : undefined,
          payload: {
            jsonrpc: '2.0',
            id: requestId,
            error: {
              code: -32603,
              message: error.message
            }
          }
        };
      }
      
      client.send(response);
      console.log(`Sent response for ${method}`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

client.onError((error) => {
  console.error('Client error:', error);
});

client.onDisconnected(() => {
  console.log('Calculator agent disconnected from gateway');
  process.exit(0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down calculator agent...');
  client.disconnect();
  process.exit(0);
});