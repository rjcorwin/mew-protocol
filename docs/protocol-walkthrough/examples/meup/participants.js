#!/usr/bin/env node

/**
 * MEUP Participants Demo
 * Simulates multiple participants in a MEUP space
 */

const WebSocket = require('ws');
const readline = require('readline');

class MEUPParticipant {
  constructor(role, token) {
    this.role = role;
    this.token = token;
    this.id = null;
    this.capabilities = null;
    this.ws = null;
    this.participants = new Map();
    this.pendingProposals = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:3000/ws?space=default', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      this.ws.on('open', () => {
        console.log(`[${this.role}] Connected to MEUP gateway`);
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
        
        // Resolve on welcome message
        if (message.kind === 'system/welcome') {
          resolve();
        }
      });

      this.ws.on('error', (error) => {
        console.error(`[${this.role}] WebSocket error:`, error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log(`[${this.role}] Disconnected from gateway`);
      });
    });
  }

  handleMessage(message) {
    switch (message.kind) {
      case 'system/welcome':
        this.handleWelcome(message);
        break;
      case 'system/presence':
        this.handlePresence(message);
        break;
      case 'chat':
        this.handleChat(message);
        break;
      case 'mcp/proposal':
        this.handleProposal(message);
        break;
      case 'mcp/request':
        this.handleRequest(message);
        break;
      case 'mcp/response':
        this.handleResponse(message);
        break;
      case 'mcp/reject':
        this.handleReject(message);
        break;
      case 'reasoning/start':
      case 'reasoning/thought':
      case 'reasoning/conclusion':
        this.handleReasoning(message);
        break;
      case 'system/error':
        this.handleError(message);
        break;
    }
  }

  handleWelcome(message) {
    this.id = message.payload.you.id;
    this.capabilities = message.payload.you.capabilities;
    console.log(`[${this.role}] Joined as ${this.id} with capabilities:`, 
      this.capabilities.map(c => c.kind).join(', '));
    
    message.payload.participants.forEach(p => {
      this.participants.set(p.id, p);
    });
  }

  handlePresence(message) {
    const { event, participant } = message.payload;
    if (event === 'join') {
      this.participants.set(participant.id, participant);
      console.log(`[${this.role}] ${participant.id} joined the space`);
    } else if (event === 'leave') {
      this.participants.delete(participant.id);
      console.log(`[${this.role}] ${participant.id} left the space`);
    }
  }

  handleChat(message) {
    if (message.from !== this.id) {
      console.log(`[${this.role}] 💬 ${message.from}: ${message.payload.text}`);
    }
  }

  handleProposal(message) {
    console.log(`[${this.role}] 📝 Proposal from ${message.from}:`, 
      JSON.stringify(message.payload, null, 2));
    this.pendingProposals.set(message.id, message);
  }

  handleRequest(message) {
    if (message.to && message.to.includes(this.id)) {
      console.log(`[${this.role}] 📨 Request from ${message.from}:`,
        JSON.stringify(message.payload, null, 2));
    }
  }

  handleResponse(message) {
    console.log(`[${this.role}] 📤 Response from ${message.from}:`,
      JSON.stringify(message.payload, null, 2));
  }

  handleReject(message) {
    console.log(`[${this.role}] ❌ Rejection from ${message.from}:`,
      message.payload.reason);
  }

  handleReasoning(message) {
    if (message.kind === 'reasoning/start') {
      console.log(`[${this.role}] 🤔 ${message.from} is thinking: ${message.payload.message}`);
    } else if (message.kind === 'reasoning/thought') {
      console.log(`[${this.role}]    💭 ${message.payload.message}`);
    } else if (message.kind === 'reasoning/conclusion') {
      console.log(`[${this.role}]    ✅ Conclusion: ${message.payload.message}`);
    }
  }

  handleError(message) {
    console.error(`[${this.role}] ⚠️ Error:`, message.payload);
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendChat(text) {
    this.sendMessage({
      kind: 'chat',
      payload: { text, format: 'plain' }
    });
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// Assistant Agent - can only propose
class AssistantAgent extends MEUPParticipant {
  constructor() {
    super('Assistant', 'assistant-token');
  }

  async handleUserQuestion(question) {
    // Start reasoning
    this.sendMessage({
      kind: 'reasoning/start',
      payload: { message: `Processing question: "${question}"` }
    });

    // Send reasoning thoughts
    this.sendMessage({
      kind: 'reasoning/thought',
      context: 'reasoning-1',
      payload: { message: 'This appears to be a mathematical calculation.' }
    });

    this.sendMessage({
      kind: 'reasoning/thought',
      context: 'reasoning-1',
      payload: { message: 'I need to use the calculator tool, but I only have proposal capability.' }
    });

    // Propose calculation
    const proposalId = this.generateId();
    this.sendMessage({
      id: proposalId,
      kind: 'mcp/proposal',
      to: ['calculator'],
      payload: {
        method: 'tools/call',
        params: {
          name: 'calculate',
          arguments: { expression: question.replace(/[^\d+\-*/().\s]/g, '') }
        }
      }
    });

    this.sendMessage({
      kind: 'reasoning/conclusion',
      context: 'reasoning-1',
      payload: { message: 'Proposed calculation to calculator agent.' }
    });

    console.log(`[Assistant] Proposed calculation (proposal ${proposalId})`);
  }
}

// Calculator Agent - has full MCP capabilities
class CalculatorAgent extends MEUPParticipant {
  constructor() {
    super('Calculator', 'calculator-token');
  }

  handleRequest(message) {
    super.handleRequest(message);
    
    if (message.to && message.to.includes(this.id)) {
      const { method, params } = message.payload;
      
      if (method === 'tools/call' && params.name === 'calculate') {
        try {
          // Perform calculation
          const result = this.calculate(params.arguments.expression);
          
          // Send response
          this.sendMessage({
            kind: 'mcp/response',
            to: [message.from],
            correlation_id: [message.id],
            payload: {
              jsonrpc: '2.0',
              id: message.payload.id || 1,
              result: {
                content: [{
                  type: 'text',
                  text: String(result)
                }]
              }
            }
          });
          
          // Also send a chat message for visibility
          this.sendChat(`Calculation result: ${params.arguments.expression} = ${result}`);
        } catch (error) {
          this.sendMessage({
            kind: 'mcp/response',
            to: [message.from],
            correlation_id: [message.id],
            payload: {
              jsonrpc: '2.0',
              id: message.payload.id || 1,
              error: {
                code: -32603,
                message: error.message
              }
            }
          });
        }
      }
    }
  }

  calculate(expression) {
    // Simple, safe evaluation for basic math
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    try {
      // WARNING: eval is used here for simplicity - use math.js or similar in production
      const result = Function('"use strict"; return (' + sanitized + ')')();
      return result;
    } catch (error) {
      throw new Error('Invalid expression');
    }
  }
}

// Human Observer - can approve proposals
class HumanObserver extends MEUPParticipant {
  constructor() {
    super('Observer', 'observer-token');
    this.autoApprove = false;
  }

  handleProposal(message) {
    super.handleProposal(message);
    
    if (this.autoApprove) {
      // Auto-approve after a short delay
      setTimeout(() => {
        this.approveProposal(message);
      }, 1000);
    } else {
      console.log(`[Observer] Type 'approve ${message.id.substring(0, 8)}' to approve this proposal`);
    }
  }

  approveProposal(proposal) {
    console.log(`[Observer] Approving proposal ${proposal.id}`);
    
    // Fulfill the proposal by sending the actual request
    this.sendMessage({
      kind: 'mcp/request',
      to: proposal.to,
      correlation_id: [proposal.id],
      payload: {
        jsonrpc: '2.0',
        id: 1,
        ...proposal.payload
      }
    });
  }

  rejectProposal(proposalId, reason = 'unsafe') {
    const proposal = this.pendingProposals.get(proposalId);
    if (proposal) {
      this.sendMessage({
        kind: 'mcp/reject',
        to: [proposal.from],
        correlation_id: [proposalId],
        payload: { reason }
      });
    }
  }
}

// Demo orchestration
async function runDemo() {
  console.log('🚀 Starting MEUP Calculator Demo');
  console.log('================================\n');

  // Create participants
  const assistant = new AssistantAgent();
  const calculator = new CalculatorAgent();
  const observer = new HumanObserver();
  
  // Set observer to auto-approve for demo
  observer.autoApprove = true;

  // Connect all participants
  try {
    await Promise.all([
      assistant.connect(),
      calculator.connect(),
      observer.connect()
    ]);
  } catch (error) {
    console.error('Failed to connect participants:', error);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SIMULATION: User asks "What\'s 41 + 1?"');
  console.log('='.repeat(60) + '\n');

  // Simulate user asking a question
  setTimeout(() => {
    const user = { sendChat: (text) => {
      assistant.sendMessage({
        kind: 'chat',
        payload: { text, format: 'plain' }
      });
    }};
    
    console.log('[User] 💬 What\'s 41 + 1?');
    assistant.sendChat('User asks: What\'s 41 + 1?');
    assistant.handleUserQuestion('41 + 1');
  }, 1000);

  // Second calculation after a delay
  setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('SIMULATION: User asks "What\'s 2^10?"');
    console.log('='.repeat(60) + '\n');
    
    assistant.sendChat('User asks: What\'s 2^10?');
    assistant.handleUserQuestion('2^10');
  }, 5000);

  // Interactive mode
  setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('INTERACTIVE MODE');
    console.log('Commands:');
    console.log('  chat <message> - Send a chat message');
    console.log('  calc <expression> - Assistant proposes a calculation');
    console.log('  auto on/off - Toggle auto-approval of proposals');
    console.log('  quit - Exit');
    console.log('='.repeat(60) + '\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      rl.question('> ', (input) => {
        const [command, ...args] = input.split(' ');
        const text = args.join(' ');

        switch (command) {
          case 'chat':
            observer.sendChat(text);
            break;
          case 'calc':
            assistant.sendChat(`User asks: ${text}`);
            assistant.handleUserQuestion(text);
            break;
          case 'auto':
            if (args[0] === 'on') {
              observer.autoApprove = true;
              console.log('Auto-approval enabled');
            } else if (args[0] === 'off') {
              observer.autoApprove = false;
              console.log('Auto-approval disabled');
            }
            break;
          case 'approve':
            const proposalId = Array.from(observer.pendingProposals.keys())
              .find(id => id.startsWith(args[0]));
            if (proposalId) {
              observer.approveProposal(observer.pendingProposals.get(proposalId));
            } else {
              console.log('Proposal not found');
            }
            break;
          case 'quit':
            process.exit(0);
          default:
            console.log('Unknown command');
        }
        prompt();
      });
    };

    prompt();
  }, 8000);
}

// Check if gateway is running
const testWs = new WebSocket('ws://localhost:3000/ws?space=default');
testWs.on('error', () => {
  console.error('❌ Gateway is not running. Please start gateway.js first.');
  process.exit(1);
});
testWs.on('open', () => {
  testWs.close();
  runDemo();
});