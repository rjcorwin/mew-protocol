#!/usr/bin/env node
import { MCPxAgent } from '@mcpx-protocol/agent';

/**
 * EchoBot - An agent that echoes back any chat message it receives
 * Demonstrates message handling and simple chat interaction
 */
class EchoBot extends MCPxAgent {
  private echoCount = 0;

  constructor(options: { gateway: string; topic: string; token: string }) {
    super({
      gateway: options.gateway,
      topic: options.topic,
      token: options.token,
      reconnect: true,
    });
  }

  async onStart(): Promise<void> {
    console.log('Echo bot started!');
    this.sendChat('Echo bot online. I will echo your messages!');
  }

  async onStop(): Promise<void> {
    console.log('Echo bot stopping...');
    this.sendChat('Echo bot going offline.');
  }

  // Echo any incoming chat messages
  protected onChatMessage(text: string, from: string): void {
    // Don't echo our own messages
    if (from === this.getParticipantId()) {
      return;
    }

    console.log(`[RECEIVED] ${from}: ${text}`);
    
    this.echoCount++;
    const echoMessage = `[Echo #${this.echoCount}] ${from} said: "${text}"`;
    
    console.log(`[ECHOING] ${echoMessage}`);
    this.sendChat(echoMessage);
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
  const participantId = process.env.MCPX_PARTICIPANT_ID || 'echo-bot';
  const topic = process.env.MCPX_TOPIC || 'test-room';
  const gateway = process.env.MCPX_GATEWAY || 'ws://localhost:3000';
  
  try {
    console.log('Getting auth token...');
    const token = await getToken(participantId, topic);
    
    console.log(`Starting echo bot as ${participantId} in topic ${topic}...`);
    const bot = new EchoBot({ gateway, topic, token });
    await bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();