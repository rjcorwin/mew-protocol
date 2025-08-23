#!/usr/bin/env node
import { MCPxAgent } from '@mcpx-protocol/agent';

/**
 * CoordinatorAgent - An agent that calls other agents' tools
 * This demonstrates how to create an MCP client that uses tools from other agents
 */
class CoordinatorAgent extends MCPxAgent {
  private taskQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  constructor(options: { gateway: string; topic: string; token: string }) {
    super(
      {
        gateway: options.gateway,
        topic: options.topic,
        token: options.token,
        reconnect: true,
      },
      {
        name: 'coordinator-agent',
        description: 'A coordinator that orchestrates other agents',
        version: '1.0.0',
      }
    );
  }

  async onStart(): Promise<void> {
    console.log('Coordinator agent started!');
    this.sendChat('Coordinator agent online. I can orchestrate tasks using other agents\' tools.');
    
    // Start task processor
    this.startTaskProcessor();
    
    // Wait a moment for other agents to connect
    setTimeout(() => {
      this.demonstrateCapabilities();
    }, 3000);
  }

  async onStop(): Promise<void> {
    console.log('Coordinator agent stopping...');
    this.sendChat('Coordinator agent going offline.');
  }

  /**
   * Demonstrate capabilities by discovering and using available tools
   */
  private async demonstrateCapabilities(): Promise<void> {
    try {
      // Get list of peers
      const peers = this.getPeers();
      console.log('Available peers:', peers);
      
      // Find calculator agent if available
      const calculatorPeer = peers.find(p => p.includes('calculator'));
      
      if (calculatorPeer) {
        console.log('Found calculator agent, listing its tools...');
        
        // List tools from calculator
        const tools = await this.callTool(calculatorPeer, 'tools/list', {});
        console.log('Calculator tools:', tools);
        
        // Queue some demo calculations
        this.queueTask(async () => {
          this.sendChat('📋 Demo: Let me calculate 12 + 8 using the calculator agent...');
          const result = await this.callTool(calculatorPeer, 'add', { a: 12, b: 8 });
          console.log('Addition result:', result);
        });
        
        this.queueTask(async () => {
          this.sendChat('📋 Demo: Now calculating 5 × 7...');
          const result = await this.callTool(calculatorPeer, 'multiply', { a: 5, b: 7 });
          console.log('Multiplication result:', result);
        });
        
        this.queueTask(async () => {
          this.sendChat('📋 Demo: Finally, calculating √144...');
          const result = await this.callTool(calculatorPeer, 'sqrt', { n: 144 });
          console.log('Square root result:', result);
        });
      } else {
        this.sendChat('No calculator agent found. Start the calculator-agent example to see tool coordination.');
      }
    } catch (error) {
      console.error('Error demonstrating capabilities:', error);
    }
  }

  /**
   * Process tasks sequentially
   */
  private async startTaskProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.taskQueue.length === 0) {
        return;
      }
      
      this.isProcessing = true;
      const task = this.taskQueue.shift();
      
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Task execution error:', error);
        }
      }
      
      this.isProcessing = false;
    }, 2000);
  }

  /**
   * Queue a task for execution
   */
  private queueTask(task: () => Promise<void>): void {
    this.taskQueue.push(task);
  }

  /**
   * Handle chat messages - respond to commands
   */
  protected onChatMessage(text: string, from: string): void {
    // Skip our own messages
    if (from === this.getParticipantId()) {
      return;
    }

    console.log(`[CHAT] ${from}: ${text}`);

    // Parse simple math expressions
    const mathMatch = text.match(/calculate\s+(\d+)\s*([\+\-\*\/])\s*(\d+)/i);
    if (mathMatch) {
      const [, num1, operator, num2] = mathMatch;
      this.handleMathRequest(from, parseFloat(num1), operator, parseFloat(num2));
    }

    // Handle sqrt requests
    const sqrtMatch = text.match(/sqrt\s+(\d+)/i);
    if (sqrtMatch) {
      const [, num] = sqrtMatch;
      this.handleSqrtRequest(from, parseFloat(num));
    }

    // Handle help
    if (text.toLowerCase().includes('help')) {
      this.sendChat('I can coordinate calculations! Try: "calculate 10 + 5" or "sqrt 25"');
    }
  }

  /**
   * Handle math calculation requests
   */
  private async handleMathRequest(from: string, a: number, operator: string, b: number): Promise<void> {
    const peers = this.getPeers();
    const calculatorPeer = peers.find(p => p.includes('calculator'));
    
    if (!calculatorPeer) {
      this.sendChat(`Sorry ${from}, no calculator agent is available right now.`);
      return;
    }

    let toolName: string;
    switch (operator) {
      case '+':
        toolName = 'add';
        break;
      case '-':
        toolName = 'subtract';
        break;
      case '*':
        toolName = 'multiply';
        break;
      case '/':
        toolName = 'divide';
        break;
      default:
        this.sendChat(`Sorry ${from}, I don't understand the operator "${operator}"`);
        return;
    }

    this.queueTask(async () => {
      try {
        this.sendChat(`Processing "${a} ${operator} ${b}" for ${from}...`);
        const result = await this.callTool(calculatorPeer, toolName, { a, b });
        console.log(`Calculation result for ${from}:`, result);
      } catch (error) {
        console.error('Calculation error:', error);
        this.sendChat(`Sorry ${from}, calculation failed: ${error}`);
      }
    });
  }

  /**
   * Handle square root requests
   */
  private async handleSqrtRequest(from: string, n: number): Promise<void> {
    const peers = this.getPeers();
    const calculatorPeer = peers.find(p => p.includes('calculator'));
    
    if (!calculatorPeer) {
      this.sendChat(`Sorry ${from}, no calculator agent is available right now.`);
      return;
    }

    this.queueTask(async () => {
      try {
        this.sendChat(`Calculating √${n} for ${from}...`);
        const result = await this.callTool(calculatorPeer, 'sqrt', { n });
        console.log(`Square root result for ${from}:`, result);
      } catch (error) {
        console.error('Square root error:', error);
        this.sendChat(`Sorry ${from}, calculation failed: ${error}`);
      }
    });
  }
}

// Get auth token
async function getToken(participantId: string, topic: string): Promise<string> {
  const gateway = process.env.MCPX_GATEWAY?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3000';
  
  const response = await fetch(`${gateway}/v0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, topic }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.token;
}

// Main
async function main() {
  const participantId = process.env.MCPX_PARTICIPANT_ID || 'coordinator-agent';
  const topic = process.env.MCPX_TOPIC || 'test-room';
  const gateway = process.env.MCPX_GATEWAY || 'ws://localhost:3000';
  
  try {
    console.log('Getting auth token...');
    const token = await getToken(participantId, topic);
    
    console.log(`Starting coordinator agent as ${participantId} in topic ${topic}...`);
    const agent = new CoordinatorAgent({ gateway, topic, token });
    await agent.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await agent.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
}

main();