#!/usr/bin/env node

/**
 * Protocol Composition Example
 * Shows how MCP, A2A, and MEUP can work together in a single system
 * 
 * Architecture:
 * - Corporate Assistant uses MCP to access local tools
 * - Corporate Assistant uses A2A to delegate to Math Service
 * - Math Service uses MCP to access its calculator
 * - All interactions are visible in MEUP space for monitoring
 */

const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const readline = require('readline');

// ============================================================================
// MCP Calculator Server (embedded in Math Service)
// ============================================================================
class MCPCalculator {
  calculate(expression) {
    const sanitized = expression.replace(/[^0-9+\-*/().\s^]/g, '');
    try {
      // Handle power operator
      const processed = sanitized.replace(/\^/g, '**');
      const result = Function('"use strict"; return (' + processed + ')')();
      return result;
    } catch (error) {
      throw new Error('Invalid expression');
    }
  }

  calculateAdvanced(operation, operands) {
    switch (operation) {
      case 'compound_interest':
        // P(1 + r/n)^(nt)
        const [principal, rate, time, n = 1] = operands;
        return principal * Math.pow(1 + rate/n, n * time);
      case 'factorial':
        let result = 1;
        for (let i = 2; i <= operands[0]; i++) result *= i;
        return result;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}

// ============================================================================
// A2A Math Service (with embedded MCP calculator)
// ============================================================================
class MathService {
  constructor(port = 8081) {
    this.port = port;
    this.calculator = new MCPCalculator();
    this.tasks = new Map();
    this.meupConnection = null;
    
    this.agentCard = {
      protocolVersion: "0.2.9",
      name: "Math Service",
      description: "Advanced mathematical computation service",
      url: `http://localhost:${port}/a2a/v1`,
      preferredTransport: "JSONRPC",
      skills: [{
        id: "advanced-math",
        name: "Advanced Mathematics",
        description: "Complex calculations including compound interest, factorials, etc.",
        inputModes: ["text/plain", "application/json"],
        outputModes: ["application/json"]
      }]
    };
  }

  connectToMEUP() {
    this.meupConnection = new WebSocket('ws://localhost:3000/ws?space=default', {
      headers: { 'Authorization': 'Bearer math-service-token' }
    });

    this.meupConnection.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.kind === 'system/welcome') {
        console.log('[Math Service] Connected to MEUP space');
        this.broadcastToMEUP('chat', { 
          text: 'Math Service online and ready for calculations',
          format: 'plain'
        });
      }
    });
  }

  broadcastToMEUP(kind, payload) {
    if (this.meupConnection && this.meupConnection.readyState === WebSocket.OPEN) {
      this.meupConnection.send(JSON.stringify({ kind, payload }));
    }
  }

  start() {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.url === '/.well-known/agent-card.json' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.agentCard));
        return;
      }

      if (req.url === '/a2a/v1' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const request = JSON.parse(body);
            this.handleA2ARequest(request, res);
          } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request' }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(this.port, () => {
      console.log(`[Math Service] Running on port ${this.port}`);
      this.connectToMEUP();
    });
  }

  handleA2ARequest(request, res) {
    const { method, params, id } = request;
    
    if (method === 'message/send') {
      const taskId = this.generateId();
      const userText = params.message.parts.find(p => p.kind === 'text')?.text || '';
      
      // Broadcast to MEUP that we're processing
      this.broadcastToMEUP('reasoning/start', {
        message: `Processing math request: "${userText}"`
      });

      try {
        let result;
        
        // Check for compound interest
        if (userText.toLowerCase().includes('compound interest')) {
          const numbers = userText.match(/\d+(\.\d+)?/g);
          if (numbers && numbers.length >= 3) {
            const [principal, ratePercent, years] = numbers.map(Number);
            const rate = ratePercent / 100;
            
            this.broadcastToMEUP('reasoning/thought', {
              message: `Using MCP calculator for compound interest: P=${principal}, r=${rate}, t=${years}`
            });
            
            result = this.calculator.calculateAdvanced('compound_interest', [principal, rate, years]);
            result = `$${result.toFixed(2)}`;
          }
        } else {
          // Try basic calculation
          this.broadcastToMEUP('reasoning/thought', {
            message: 'Using MCP calculator for basic arithmetic'
          });
          
          const expression = userText.replace(/[^\d+\-*/().\s^]/g, '');
          result = this.calculator.calculate(expression);
        }

        const task = {
          id: taskId,
          status: { state: 'completed' },
          artifacts: [{
            parts: [{
              kind: 'text',
              text: `Result: ${result}`
            }]
          }],
          kind: 'task'
        };

        this.broadcastToMEUP('reasoning/conclusion', {
          message: `Calculation complete: ${result}`
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id, result: task }));
      } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            id: taskId,
            status: { state: 'failed', message: error.message },
            kind: 'task'
          }
        }));
      }
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2);
  }
}

// ============================================================================
// Corporate Assistant (uses MCP for local tools, A2A for delegation)
// ============================================================================
class CorporateAssistant {
  constructor() {
    this.mathServiceUrl = 'http://localhost:8081/a2a/v1';
    this.meupConnection = null;
    this.localTools = {
      getTime: () => new Date().toISOString(),
      getCompanyPolicy: (topic) => `Company policy on ${topic}: Approved with manager consent.`
    };
  }

  connectToMEUP() {
    this.meupConnection = new WebSocket('ws://localhost:3000/ws?space=default', {
      headers: { 'Authorization': 'Bearer assistant-token' }
    });

    this.meupConnection.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.kind === 'system/welcome') {
        console.log('[Corporate Assistant] Connected to MEUP space');
        this.broadcastToMEUP('chat', {
          text: 'Corporate Assistant ready to help',
          format: 'plain'
        });
      }
    });
  }

  broadcastToMEUP(kind, payload) {
    if (this.meupConnection && this.meupConnection.readyState === WebSocket.OPEN) {
      this.meupConnection.send(JSON.stringify({ kind, payload }));
    }
  }

  async handleUserRequest(request) {
    console.log(`[Corporate Assistant] Processing: "${request}"`);
    
    // Broadcast reasoning to MEUP
    this.broadcastToMEUP('reasoning/start', {
      message: `Analyzing request: "${request}"`
    });

    // Check if it's a math question
    if (request.match(/compound interest|calculate|what's|what is|\d+\s*[\+\-\*\/\^]/i)) {
      this.broadcastToMEUP('reasoning/thought', {
        message: 'This requires mathematical computation. Delegating to Math Service via A2A.'
      });

      // In MEUP, propose the delegation (visible to all)
      this.broadcastToMEUP('mcp/proposal', {
        method: 'delegate_to_math_service',
        params: { query: request }
      });

      // Actually delegate via A2A
      try {
        const result = await this.delegateToMathService(request);
        
        this.broadcastToMEUP('reasoning/conclusion', {
          message: `Received result from Math Service: ${result}`
        });
        
        return result;
      } catch (error) {
        this.broadcastToMEUP('system/error', {
          error: 'delegation_failed',
          message: error.message
        });
        throw error;
      }
    }

    // Check for local tool usage
    if (request.toLowerCase().includes('time')) {
      this.broadcastToMEUP('reasoning/thought', {
        message: 'Using local MCP tool: getTime'
      });
      
      const time = this.localTools.getTime();
      
      this.broadcastToMEUP('reasoning/conclusion', {
        message: `Current time: ${time}`
      });
      
      return `The current time is ${time}`;
    }

    if (request.toLowerCase().includes('policy')) {
      this.broadcastToMEUP('reasoning/thought', {
        message: 'Using local MCP tool: getCompanyPolicy'
      });
      
      const policy = this.localTools.getCompanyPolicy('general');
      
      this.broadcastToMEUP('reasoning/conclusion', {
        message: `Policy retrieved: ${policy}`
      });
      
      return policy;
    }

    return "I'm not sure how to help with that request.";
  }

  async delegateToMathService(query) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'message/send',
        params: {
          message: {
            role: 'user',
            parts: [{ kind: 'text', text: query }]
          }
        }
      };

      const options = {
        hostname: 'localhost',
        port: 8081,
        path: '/a2a/v1',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.result && response.result.artifacts) {
              const text = response.result.artifacts[0].parts[0].text;
              resolve(text);
            } else {
              reject(new Error('Invalid response from Math Service'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(request));
      req.end();
    });
  }

  start() {
    this.connectToMEUP();
  }
}

// ============================================================================
// System Orchestrator
// ============================================================================
async function runComposedSystem() {
  console.log('🚀 Starting Composed Protocol System');
  console.log('=====================================\n');
  console.log('Architecture:');
  console.log('  - Corporate Assistant (MCP + A2A client)');
  console.log('  - Math Service (A2A server + MCP tools)');
  console.log('  - MEUP Gateway (visibility & control)');
  console.log('  - All interactions visible in MEUP space\n');

  // Check if MEUP gateway is running
  const testWs = new WebSocket('ws://localhost:3000/ws?space=default');
  testWs.on('error', () => {
    console.error('❌ MEUP Gateway is not running. Please start ../meup/gateway.js first.');
    process.exit(1);
  });

  testWs.on('open', () => {
    testWs.close();
    
    // Start services
    const mathService = new MathService(8081);
    const assistant = new CorporateAssistant();
    
    mathService.start();
    
    // Give services time to connect
    setTimeout(() => {
      assistant.start();
    }, 500);

    // Run demo scenarios
    setTimeout(async () => {
      console.log('\n' + '='.repeat(60));
      console.log('DEMO: Compound Interest Calculation');
      console.log('='.repeat(60) + '\n');

      const result1 = await assistant.handleUserRequest(
        "Calculate the compound interest on $10,000 at 5% for 3 years"
      );
      console.log(`[Result] ${result1}\n`);

      setTimeout(async () => {
        console.log('='.repeat(60));
        console.log('DEMO: Simple Calculation');
        console.log('='.repeat(60) + '\n');

        const result2 = await assistant.handleUserRequest("What's 41 + 1?");
        console.log(`[Result] ${result2}\n`);

        setTimeout(async () => {
          console.log('='.repeat(60));
          console.log('DEMO: Local Tool Usage');
          console.log('='.repeat(60) + '\n');

          const result3 = await assistant.handleUserRequest("What time is it?");
          console.log(`[Result] ${result3}\n`);

          // Interactive mode
          console.log('='.repeat(60));
          console.log('INTERACTIVE MODE');
          console.log('Type questions or "quit" to exit');
          console.log('='.repeat(60) + '\n');

          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          const prompt = () => {
            rl.question('> ', async (input) => {
              if (input.toLowerCase() === 'quit') {
                process.exit(0);
              }

              try {
                const result = await assistant.handleUserRequest(input);
                console.log(`[Result] ${result}\n`);
              } catch (error) {
                console.error(`[Error] ${error.message}\n`);
              }

              prompt();
            });
          };

          prompt();
        }, 2000);
      }, 2000);
    }, 2000);
  });
}

// Run the system
runComposedSystem();