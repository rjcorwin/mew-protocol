#!/usr/bin/env node

/**
 * A2A Calculator Agent
 * A specialized agent that provides calculation services via the A2A protocol
 */

const http = require('http');
const crypto = require('crypto');

class A2ACalculatorAgent {
  constructor(port = 8080) {
    this.port = port;
    this.tasks = new Map();
    
    // Agent Card describing this agent's capabilities
    this.agentCard = {
      protocolVersion: "0.2.9",
      name: "Calculator Agent",
      description: "Specialized agent for mathematical calculations",
      url: `http://localhost:${port}/a2a/v1`,
      preferredTransport: "JSONRPC",
      provider: {
        organization: "Example Org",
        url: "https://example.com"
      },
      version: "1.0.0",
      capabilities: {
        streaming: false,
        pushNotifications: false
      },
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["application/json", "text/plain"],
      skills: [
        {
          id: "arithmetic",
          name: "Arithmetic Operations",
          description: "Perform basic and advanced mathematical calculations",
          tags: ["math", "calculator", "arithmetic"],
          examples: [
            "Calculate: 41 + 1",
            "What is 2^10?",
            "Compute the square root of 144"
          ],
          inputModes: ["text/plain", "application/json"],
          outputModes: ["application/json", "text/plain"]
        }
      ],
      supportsAuthenticatedExtendedCard: false
    };
  }

  start() {
    const server = http.createServer((req, res) => {
      // CORS headers for browser testing
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Serve Agent Card at well-known location
      if (req.url === '/.well-known/agent-card.json' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.agentCard, null, 2));
        return;
      }

      // Handle A2A protocol endpoints
      if (req.url === '/a2a/v1' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const request = JSON.parse(body);
            this.handleA2ARequest(request, res);
          } catch (error) {
            this.sendError(res, -32700, 'Parse error');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(this.port, () => {
      console.log(`🚀 A2A Calculator Agent running on http://localhost:${this.port}`);
      console.log(`📋 Agent Card available at http://localhost:${this.port}/.well-known/agent-card.json`);
    });
  }

  handleA2ARequest(request, res) {
    const { method, params, id } = request;

    switch (method) {
      case 'message/send':
        this.handleMessageSend(params, id, res);
        break;
      case 'tasks/get':
        this.handleTasksGet(params, id, res);
        break;
      case 'tasks/cancel':
        this.handleTasksCancel(params, id, res);
        break;
      default:
        this.sendError(res, -32601, 'Method not found');
    }
  }

  handleMessageSend(params, requestId, res) {
    const { message } = params;
    const taskId = params.taskId || this.generateId();
    
    // Get or create task
    let task = this.tasks.get(taskId);
    if (!task) {
      task = {
        id: taskId,
        contextId: this.generateId(),
        status: { state: 'submitted' },
        history: [],
        artifacts: [],
        kind: 'task'
      };
      this.tasks.set(taskId, task);
    }

    // Add message to history
    task.history.push({
      ...message,
      taskId,
      contextId: task.contextId
    });

    // Process the message
    const userText = message.parts.find(p => p.kind === 'text')?.text || '';
    
    try {
      // Extract mathematical expression from the text
      const result = this.processCalculation(userText);
      
      // Update task status
      task.status = { 
        state: 'completed',
        timestamp: new Date().toISOString()
      };
      
      // Add result as artifact
      task.artifacts.push({
        artifactId: this.generateId(),
        name: 'calculation_result',
        parts: [
          {
            kind: 'text',
            text: `The result is ${result}`
          },
          {
            kind: 'data',
            data: {
              expression: userText,
              result: result,
              timestamp: new Date().toISOString()
            }
          }
        ]
      });

      // Send response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        result: task
      }));
    } catch (error) {
      // Update task with error
      task.status = {
        state: 'failed',
        message: {
          role: 'agent',
          parts: [{
            kind: 'text',
            text: `Error: ${error.message}`
          }]
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        result: task
      }));
    }
  }

  handleTasksGet(params, requestId, res) {
    const { id } = params;
    const task = this.tasks.get(id);
    
    if (!task) {
      this.sendError(res, -32001, 'Task not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      result: task
    }));
  }

  handleTasksCancel(params, requestId, res) {
    const { id } = params;
    const task = this.tasks.get(id);
    
    if (!task) {
      this.sendError(res, -32001, 'Task not found');
      return;
    }

    if (task.status.state === 'completed' || task.status.state === 'failed') {
      this.sendError(res, -32002, 'Task cannot be canceled');
      return;
    }

    task.status = {
      state: 'canceled',
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      result: task
    }));
  }

  processCalculation(text) {
    // Extract numbers and operations from natural language
    const patterns = [
      /(\d+)\s*\+\s*(\d+)/,          // Addition
      /(\d+)\s*-\s*(\d+)/,           // Subtraction
      /(\d+)\s*\*\s*(\d+)/,          // Multiplication
      /(\d+)\s*\/\s*(\d+)/,          // Division
      /(\d+)\s*\^\s*(\d+)/,          // Power
      /(\d+)\s*to\s*the\s*power\s*of\s*(\d+)/i, // Power (natural language)
      /square\s*root\s*of\s*(\d+)/i, // Square root
      /sqrt\s*\(?\s*(\d+)\s*\)?/i    // Square root (function notation)
    ];

    // Try each pattern
    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      if (match) {
        switch (i) {
          case 0: // Addition
            return parseInt(match[1]) + parseInt(match[2]);
          case 1: // Subtraction
            return parseInt(match[1]) - parseInt(match[2]);
          case 2: // Multiplication
            return parseInt(match[1]) * parseInt(match[2]);
          case 3: // Division
            const divisor = parseInt(match[2]);
            if (divisor === 0) throw new Error('Division by zero');
            return parseInt(match[1]) / divisor;
          case 4: // Power (symbol)
          case 5: // Power (natural language)
            return Math.pow(parseInt(match[1]), parseInt(match[2]));
          case 6: // Square root (natural language)
          case 7: // Square root (function)
            const num = parseInt(match[1]);
            if (num < 0) throw new Error('Cannot take square root of negative number');
            return Math.sqrt(num);
        }
      }
    }

    // Try to evaluate as a simple expression
    const sanitized = text.replace(/[^0-9+\-*/().\s]/g, '');
    if (sanitized.trim()) {
      try {
        // WARNING: eval is used here for simplicity - use math.js or similar in production
        const result = Function('"use strict"; return (' + sanitized + ')')();
        return result;
      } catch (error) {
        throw new Error('Could not parse mathematical expression from: ' + text);
      }
    }

    throw new Error('No mathematical expression found in: ' + text);
  }

  sendError(res, code, message) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code,
        message
      }
    }));
  }

  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Start the agent
const agent = new A2ACalculatorAgent(8080);
agent.start();