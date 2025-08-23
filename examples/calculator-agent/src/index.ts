#!/usr/bin/env node
import { MCPxAgent, Tool, ToolExecutionContext, ToolExecutionResult } from '@mcpx-protocol/agent';

/**
 * CalculatorAgent - An agent that exposes calculator tools via MCP
 * This demonstrates how to create an MCP server that provides tools
 */
class CalculatorAgent extends MCPxAgent {
  constructor(options: { gateway: string; topic: string; token: string }) {
    super(
      {
        gateway: options.gateway,
        topic: options.topic,
        token: options.token,
        reconnect: true,
      },
      {
        name: 'calculator-agent',
        description: 'A calculator agent that provides math tools',
        version: '1.0.0',
      }
    );
  }

  async onStart(): Promise<void> {
    console.log('Calculator agent started!');
    this.sendChat('Calculator agent online. I provide math tools: add, subtract, multiply, divide, sqrt, power');
  }

  async onStop(): Promise<void> {
    console.log('Calculator agent stopping...');
    this.sendChat('Calculator agent going offline.');
  }

  /**
   * List available tools
   */
  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'add',
        description: 'Add two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'subtract',
        description: 'Subtract two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Number to subtract' },
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
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'divide',
        description: 'Divide two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'Dividend' },
            b: { type: 'number', description: 'Divisor' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'sqrt',
        description: 'Calculate square root',
        inputSchema: {
          type: 'object',
          properties: {
            n: { type: 'number', description: 'Number to find square root of' },
          },
          required: ['n'],
        },
      },
      {
        name: 'power',
        description: 'Raise a number to a power',
        inputSchema: {
          type: 'object',
          properties: {
            base: { type: 'number', description: 'Base number' },
            exponent: { type: 'number', description: 'Exponent' },
          },
          required: ['base', 'exponent'],
        },
      },
    ];
  }

  /**
   * Execute a tool
   */
  async executeTool(name: string, params: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    console.log(`[TOOL CALL] ${context.from} called ${name} with params:`, params);

    try {
      let result: number;
      let explanation: string;

      switch (name) {
        case 'add':
          result = params.a + params.b;
          explanation = `${params.a} + ${params.b} = ${result}`;
          break;

        case 'subtract':
          result = params.a - params.b;
          explanation = `${params.a} - ${params.b} = ${result}`;
          break;

        case 'multiply':
          result = params.a * params.b;
          explanation = `${params.a} × ${params.b} = ${result}`;
          break;

        case 'divide':
          if (params.b === 0) {
            throw new Error('Division by zero');
          }
          result = params.a / params.b;
          explanation = `${params.a} ÷ ${params.b} = ${result}`;
          break;

        case 'sqrt':
          if (params.n < 0) {
            throw new Error('Cannot calculate square root of negative number');
          }
          result = Math.sqrt(params.n);
          explanation = `√${params.n} = ${result}`;
          break;

        case 'power':
          result = Math.pow(params.base, params.exponent);
          explanation = `${params.base}^${params.exponent} = ${result}`;
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      // Announce the calculation in chat
      this.sendChat(`📊 Calculation for ${context.from}: ${explanation}`);

      return {
        content: [
          {
            type: 'text',
            text: explanation,
          },
        ],
        isError: false,
      };
    } catch (error: any) {
      console.error(`[TOOL ERROR] ${name}:`, error.message);
      
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Handle chat messages
  protected onChatMessage(text: string, from: string): void {
    // Skip our own messages and echo bot's echoes
    if (from === this.getParticipantId() || from === 'echo-bot' || from === 'echo-bot-test') {
      return;
    }

    console.log(`[CHAT] ${from}: ${text}`);

    // Respond to direct help requests (not echoes)
    if (!text.includes('[Echo') && (text.toLowerCase().includes('help') || text.toLowerCase() === 'tools')) {
      this.sendChat('Available tools: add, subtract, multiply, divide, sqrt, power. Use /tools command to list details.');
    }
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
  const participantId = process.env.MCPX_PARTICIPANT_ID || 'calculator-agent';
  const topic = process.env.MCPX_TOPIC || 'test-room';
  const gateway = process.env.MCPX_GATEWAY || 'ws://localhost:3000';
  
  try {
    console.log('Getting auth token...');
    const token = await getToken(participantId, topic);
    
    console.log(`Starting calculator agent as ${participantId} in topic ${topic}...`);
    const agent = new CalculatorAgent({ gateway, topic, token });
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