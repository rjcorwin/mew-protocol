#!/usr/bin/env node
/**
 * Calculator Agent - Provides MCP math tools (add, multiply, evaluate)
 * For MEUP v0.2 test scenarios
 */

const WebSocket = require('ws');

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

console.log(`Calculator agent connecting to ${options.gateway}...`);

const ws = new WebSocket(options.gateway);

ws.on('open', () => {
  console.log('Calculator agent connected to gateway');
  
  // Send join message (gateway-specific)
  ws.send(JSON.stringify({
    type: 'join',
    participantId: participantId,
    space: options.space,
    token: options.token
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    // Handle MCP requests addressed to us
    if (message.kind === 'mcp/request' && 
        (!message.to || message.to.includes(participantId))) {
      
      const method = message.payload?.method;
      const params = message.payload?.params || {};
      const requestId = message.payload?.id;
      
      console.log(`Received MCP request: ${method}`);
      
      let response;
      
      try {
        if (method === 'tools/list') {
          // Return available tools
          response = {
            kind: 'mcp/response',
            to: [message.from],
            correlation_id: [message.id],
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
            to: [message.from],
            correlation_id: [message.id],
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
            to: [message.from],
            correlation_id: [message.id],
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
          to: [message.from],
          correlation_id: [message.id],
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
      
      ws.send(JSON.stringify(response));
      console.log(`Sent response for ${method}`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Calculator agent disconnected from gateway');
  process.exit(0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down calculator agent...');
  ws.close();
  process.exit(0);
});