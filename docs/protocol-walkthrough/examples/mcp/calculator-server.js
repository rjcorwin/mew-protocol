#!/usr/bin/env node

/**
 * MCP Calculator Server
 * A simple calculator tool exposed via Model Context Protocol
 */

const readline = require('readline');

class MCPCalculatorServer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    this.rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        this.sendError(null, -32700, 'Parse error');
      }
    });
  }

  handleMessage(message) {
    const { id, method, params } = message;

    switch (method) {
      case 'initialize':
        this.handleInitialize(id, params);
        break;
      case 'tools/list':
        this.handleToolsList(id);
        break;
      case 'tools/call':
        this.handleToolCall(id, params);
        break;
      default:
        this.sendError(id, -32601, 'Method not found');
    }
  }

  handleInitialize(id, params) {
    this.send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: 'calculator-server',
          version: '1.0.0'
        }
      }
    });
  }

  handleToolsList(id) {
    this.send({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'calculate',
            description: 'Perform mathematical calculations',
            inputSchema: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: 'Mathematical expression to evaluate (e.g., "41 + 1")'
                }
              },
              required: ['expression']
            }
          },
          {
            name: 'calculate_advanced',
            description: 'Perform advanced calculations with memory',
            inputSchema: {
              type: 'object',
              properties: {
                operation: {
                  type: 'string',
                  enum: ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt'],
                  description: 'The operation to perform'
                },
                operands: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Numbers to operate on'
                }
              },
              required: ['operation', 'operands']
            }
          }
        ]
      }
    });
  }

  handleToolCall(id, params) {
    const { name, arguments: args } = params;

    try {
      let result;
      
      switch (name) {
        case 'calculate':
          result = this.calculate(args.expression);
          break;
        case 'calculate_advanced':
          result = this.calculateAdvanced(args.operation, args.operands);
          break;
        default:
          this.sendError(id, -32602, `Unknown tool: ${name}`);
          return;
      }

      this.send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: String(result)
            }
          ]
        }
      });
    } catch (error) {
      this.send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        }
      });
    }
  }

  calculate(expression) {
    // Simple, safe evaluation for basic math
    // In production, use a proper math parser
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    if (sanitized !== expression) {
      throw new Error('Invalid characters in expression');
    }
    
    try {
      // WARNING: eval is used here for simplicity - use math.js or similar in production
      const result = Function('"use strict"; return (' + sanitized + ')')();
      return result;
    } catch (error) {
      throw new Error('Invalid expression');
    }
  }

  calculateAdvanced(operation, operands) {
    if (!operands || operands.length === 0) {
      throw new Error('No operands provided');
    }

    switch (operation) {
      case 'add':
        return operands.reduce((a, b) => a + b, 0);
      case 'subtract':
        return operands.reduce((a, b) => a - b);
      case 'multiply':
        return operands.reduce((a, b) => a * b, 1);
      case 'divide':
        if (operands.includes(0) && operands.indexOf(0) > 0) {
          throw new Error('Division by zero');
        }
        return operands.reduce((a, b) => a / b);
      case 'power':
        if (operands.length !== 2) {
          throw new Error('Power requires exactly 2 operands');
        }
        return Math.pow(operands[0], operands[1]);
      case 'sqrt':
        if (operands.length !== 1) {
          throw new Error('Square root requires exactly 1 operand');
        }
        if (operands[0] < 0) {
          throw new Error('Cannot take square root of negative number');
        }
        return Math.sqrt(operands[0]);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  send(message) {
    console.log(JSON.stringify(message));
  }

  sendError(id, code, message) {
    this.send({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    });
  }
}

// Start the server
new MCPCalculatorServer();

// Log to stderr so it doesn't interfere with protocol messages
console.error('MCP Calculator Server started (stdio transport)');