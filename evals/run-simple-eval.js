#!/usr/bin/env node

/**
 * Simple Evaluation Runner for MEW Protocol Coder Agent
 * 
 * Sends requests to the running coder agent and captures responses
 */

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const GATEWAY_URL = 'ws://localhost:8080';
const SPACE_ID = 'coder-demo';
const TOKEN = 'eval-token';

class SimpleEvalRunner {
  constructor() {
    this.messages = [];
    this.workspace = {};
    this.ws = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to MEW space...');
      
      this.ws = new WebSocket(`${GATEWAY_URL}?space=${SPACE_ID}`, {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      });

      this.ws.on('open', () => {
        console.log('✅ Connected to gateway');
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
        
        // Resolve once we receive welcome
        if (message.kind === 'system/welcome') {
          resolve();
        }
      });

      this.ws.on('error', (err) => {
        console.error('❌ WebSocket error:', err);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('🔌 Disconnected from gateway');
      });
    });
  }

  handleMessage(message) {
    // Store all messages for analysis
    this.messages.push(message);
    
    // Skip system messages in console
    if (message.kind === 'system/welcome' || message.kind === 'system/presence') {
      return;
    }
    
    // Log interesting messages
    const timestamp = new Date(message.ts).toLocaleTimeString();
    console.log(`[${timestamp}] ${message.from}: ${message.kind}`);
    
    // Handle proposals from coder-agent
    if (message.kind === 'mcp/proposal' && message.from === 'coder-agent') {
      this.handleProposal(message);
    }
  }

  async handleProposal(proposal) {
    console.log(`   📋 Proposal: ${proposal.payload?.params?.name}`);
    
    // Auto-approve by sending fulfillment
    const fulfillment = {
      protocol: 'mew/v0.3',
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'evaluator',
      to: proposal.to || ['mcp-fs-bridge'],
      kind: 'mcp/request',
      correlation_id: [proposal.id],
      payload: {
        jsonrpc: '2.0',
        id: Date.now(),
        method: proposal.payload.method,
        params: proposal.payload.params
      }
    };
    
    // Wait a bit to simulate human approval
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`   ✅ Approving proposal to ${fulfillment.to[0]}`);
    this.ws.send(JSON.stringify(fulfillment));
  }

  async sendChatMessage(text, to = ['coder-agent']) {
    const message = {
      protocol: 'mew/v0.3',
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'evaluator',
      to,
      kind: 'chat',
      payload: { text }
    };
    
    console.log(`\n📨 Sending: "${text}"`);
    this.ws.send(JSON.stringify(message));
  }

  async waitForCompletion(timeoutMs = 30000) {
    console.log('⏳ Waiting for agent to complete...\n');
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        // Check for timeout
        if (Date.now() - startTime > timeoutMs) {
          console.log('⏱️  Timeout reached');
          clearInterval(checkInterval);
          resolve();
          return;
        }
        
        // Check for completion signals
        const recentMessages = this.messages.slice(-10);
        const hasConclusion = recentMessages.some(m => 
          m.kind === 'reasoning/conclusion' && m.from === 'coder-agent'
        );
        
        const hasFinalResponse = recentMessages.some(m => 
          m.kind === 'chat' && 
          m.from === 'coder-agent' &&
          (m.payload?.text?.toLowerCase().includes('created') ||
           m.payload?.text?.toLowerCase().includes('complete') ||
           m.payload?.text?.toLowerCase().includes('done') ||
           m.payload?.text?.toLowerCase().includes('updated') ||
           m.payload?.text?.toLowerCase().includes('added'))
        );
        
        if (hasConclusion && hasFinalResponse) {
          console.log('✅ Agent completed task');
          clearInterval(checkInterval);
          setTimeout(resolve, 1000); // Wait for any final messages
        }
      }, 500);
    });
  }

  async runScenario(scenario) {
    console.log('\n' + '='.repeat(60));
    console.log(`📋 Scenario: ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    console.log('='.repeat(60));
    
    // Send the request
    await this.sendChatMessage(scenario.request);
    
    // Wait for completion
    await this.waitForCompletion(scenario.timeout || 30000);
    
    // Analyze results
    this.analyzeResults(scenario);
  }

  analyzeResults(scenario) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS');
    console.log('='.repeat(60));
    
    // Count message types
    const messageCounts = {};
    for (const msg of this.messages) {
      if (msg.from === 'coder-agent') {
        messageCounts[msg.kind] = (messageCounts[msg.kind] || 0) + 1;
      }
    }
    
    console.log('\n📈 Agent Activity:');
    for (const [kind, count] of Object.entries(messageCounts)) {
      console.log(`   ${kind}: ${count}`);
    }
    
    // Check for expected patterns
    if (scenario.expectedPatterns) {
      console.log('\n🔍 Pattern Checks:');
      for (const pattern of scenario.expectedPatterns) {
        const found = this.messages.some(m => {
          if (pattern.kind && m.kind !== pattern.kind) return false;
          if (pattern.from && m.from !== pattern.from) return false;
          if (pattern.contains) {
            const text = JSON.stringify(m);
            return pattern.contains.every(str => text.includes(str));
          }
          return true;
        });
        
        const status = found ? '✅' : '❌';
        console.log(`   ${status} ${pattern.description}`);
      }
    }
    
    // Show proposals
    const proposals = this.messages.filter(m => 
      m.kind === 'mcp/proposal' && m.from === 'coder-agent'
    );
    
    if (proposals.length > 0) {
      console.log('\n📝 Proposals Made:');
      for (const prop of proposals) {
        const toolName = prop.payload?.params?.name || 'unknown';
        const target = prop.to?.[0] || 'broadcast';
        console.log(`   - ${toolName} → ${target}`);
      }
    }
    
    // Show final response
    const finalChat = this.messages
      .filter(m => m.kind === 'chat' && m.from === 'coder-agent')
      .pop();
    
    if (finalChat) {
      console.log('\n💬 Final Response:');
      console.log(`   "${finalChat.payload?.text}"`);
    }
  }

  async saveResults(scenarioName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${scenarioName}_${timestamp}.json`;
    const filepath = path.join(__dirname, 'results', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify({
      scenario: scenarioName,
      timestamp: new Date().toISOString(),
      messageCount: this.messages.length,
      messages: this.messages
    }, null, 2));
    
    console.log(`\n💾 Results saved to: results/${filename}`);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Test scenarios
const scenarios = [
  {
    name: 'Create Todo App',
    description: 'Create a simple todo list HTML application',
    request: `Please create a simple todo list app as index.html with:
- An input field to add todos
- A button to add the todo  
- A list to show todos
- Ability to mark todos complete with checkboxes
- Delete buttons for each todo
- Include CSS and JavaScript in the HTML file`,
    expectedPatterns: [
      {
        description: 'Agent reads or writes files',
        kind: 'mcp/proposal',
        contains: ['write_file', 'index.html']
      },
      {
        description: 'Agent reasons about the task',
        kind: 'reasoning/start',
        from: 'coder-agent'
      }
    ],
    timeout: 45000
  },
  {
    name: 'Change Background Color',
    description: 'Modify existing HTML file to change background color',
    request: 'Please read the index.html file and change the background color to light blue (#e3f2fd)',
    expectedPatterns: [
      {
        description: 'Agent reads the file first',
        kind: 'mcp/proposal',
        contains: ['read']
      },
      {
        description: 'Agent edits or writes the file',
        kind: 'mcp/proposal',
        contains: ['edit_file', 'write_file']
      }
    ],
    timeout: 30000
  },
  {
    name: 'Add Priority Feature',
    description: 'Add a priority dropdown to the todo app',
    request: `Please add a priority feature to the todo app in index.html:
- Add a dropdown with High, Medium, Low priority options
- Show priority as a colored badge on each todo
- Use red for High, yellow for Medium, green for Low`,
    expectedPatterns: [
      {
        description: 'Agent reads existing file',
        kind: 'mcp/proposal',
        contains: ['read']
      },
      {
        description: 'Agent modifies the file',
        kind: 'mcp/proposal',
        contains: ['edit_file', 'write_file']
      }
    ],
    timeout: 45000
  }
];

// Main execution
async function main() {
  const runner = new SimpleEvalRunner();
  
  try {
    // Connect to space
    await runner.connect();
    
    // Wait a bit for everything to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run scenarios
    for (const scenario of scenarios) {
      await runner.runScenario(scenario);
      await runner.saveResults(scenario.name.toLowerCase().replace(/\s+/g, '-'));
      
      // Clear messages for next scenario
      runner.messages = [];
      
      // Wait between scenarios
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All scenarios completed!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
  } finally {
    runner.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}