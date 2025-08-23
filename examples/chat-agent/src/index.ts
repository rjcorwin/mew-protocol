#!/usr/bin/env node
import { MCPxAgent } from '@mcpx-protocol/agent';

/**
 * ChatAgent - A simple agent that only sends and receives chat messages
 * This example demonstrates the most basic MCPx agent functionality
 */
class ChatAgent extends MCPxAgent {
  private messageCount = 0;

  constructor(options: { gateway: string; topic: string; token: string }) {
    super({
      gateway: options.gateway,
      topic: options.topic,
      token: options.token,
      reconnect: true,
    });
  }

  async onStart(): Promise<void> {
    console.log('Chat agent started!');
    
    // Send initial greeting
    this.sendChat('Hello! I am a simple chat agent.');
    
    // Send periodic messages
    setInterval(() => {
      this.messageCount++;
      this.sendChat(`Message #${this.messageCount} from chat agent`);
    }, 30000); // Every 30 seconds
  }

  async onStop(): Promise<void> {
    console.log('Chat agent stopping...');
    this.sendChat('Goodbye!');
  }

  // Override to handle incoming chat messages
  protected onChatMessage(text: string, from: string): void {
    console.log(`[CHAT] ${from}: ${text}`);
    
    // Respond to greetings
    if (text.toLowerCase().includes('hello') && from !== this.getParticipantId()) {
      this.sendChat(`Hello ${from}! Nice to meet you.`);
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
  const participantId = process.env.MCPX_PARTICIPANT_ID || 'chat-agent';
  const topic = process.env.MCPX_TOPIC || 'test-room';
  const gateway = process.env.MCPX_GATEWAY || 'ws://localhost:3000';
  
  try {
    console.log('Getting auth token...');
    const token = await getToken(participantId, topic);
    
    console.log(`Starting chat agent as ${participantId} in topic ${topic}...`);
    const agent = new ChatAgent({ gateway, topic, token });
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