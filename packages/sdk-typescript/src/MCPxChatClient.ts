import { MCPxClient, MCPxConfig } from './MCPxClient';
import * as readline from 'readline';
import chalk from 'chalk';
import Debug from 'debug';

const debug = Debug('mcpxp:chat:client');

export interface MCPxChatConfig extends MCPxConfig {
  // Additional chat-specific config can go here
}

export interface ChatMessage {
  from: string;
  content: string;
  participantName?: string;
  timestamp: string;
}

export class MCPxChatClient extends MCPxClient {
  private rl?: readline.Interface;
  private messageHistory: ChatMessage[] = [];
  
  constructor(config: MCPxChatConfig) {
    super(config);
    this.setupChatHandlers();
  }
  
  private setupChatHandlers(): void {
    // Handle incoming chat messages
    this.on('chat', (message: any) => {
      const chatMessage: ChatMessage = {
        from: message.from || 'unknown',
        content: message.content,
        participantName: message.participantName,
        timestamp: message.timestamp || new Date().toISOString()
      };
      
      this.messageHistory.push(chatMessage);
      
      // Don't show our own messages in interactive mode (we already see them)
      if (chatMessage.from === this.config.participantId && this.rl) {
        return;
      }
      
      this.displayMessage(chatMessage);
    });
    
    // Handle peer events
    this.on('presence', (event: any) => {
      if (this.rl) {
        if (event.status === 'joined') {
          console.log(chalk.gray(`→ ${event.participantName || event.participantId} joined`));
        } else if (event.status === 'left') {
          console.log(chalk.gray(`← ${event.participantName || event.participantId} left`));
        }
      }
    });
    
    // Handle connection events
    this.on('connected', () => {
      if (this.rl) {
        console.log(chalk.green('✓ Connected to topic'));
      }
    });
    
    this.on('disconnected', () => {
      if (this.rl) {
        console.log(chalk.red('✗ Disconnected'));
      }
    });
    
    this.on('error', (error: Error) => {
      if (this.rl) {
        console.error(chalk.red('Error:'), error.message);
      }
    });
  }
  
  private displayMessage(message: ChatMessage): void {
    const name = message.participantName || message.from;
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    if (message.from === 'system') {
      console.log(chalk.gray(`[${time}] ${message.content}`));
    } else {
      console.log(chalk.cyan(`[${time}] ${name}:`) + ` ${message.content}`);
    }
  }
  
  // Interactive mode
  async startInteractive(): Promise<void> {
    await this.connect();
    
    console.log(chalk.bold(`\nJoined topic: ${this.config.topic}`));
    console.log(chalk.gray('Type your message and press Enter to send. Type /quit to exit.\n'));
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
    
    this.rl.prompt();
    
    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      
      if (trimmed === '/quit' || trimmed === '/exit') {
        this.rl?.close();
        this.disconnect();
        process.exit(0);
      }
      
      if (trimmed === '/help') {
        console.log(chalk.gray('Commands:'));
        console.log(chalk.gray('  /quit - Exit the chat'));
        console.log(chalk.gray('  /help - Show this help'));
        console.log(chalk.gray('  /history - Show message history'));
        console.log(chalk.gray('  /clear - Clear the screen'));
      } else if (trimmed === '/history') {
        console.log(chalk.gray('\n--- Message History ---'));
        this.messageHistory.forEach(msg => this.displayMessage(msg));
        console.log(chalk.gray('--- End History ---\n'));
      } else if (trimmed === '/clear') {
        console.clear();
      } else if (trimmed) {
        this.sendMessage(trimmed);
      }
      
      this.rl?.prompt();
    });
  }
  
  // Send methods
  sendMessage(content: string, to?: string | string[]): void {
    this.sendChat(content, to);
  }
  
  // One-shot message send
  async sendOneShot(message: string): Promise<void> {
    await this.connect();
    this.sendMessage(message);
    
    // Wait a bit for the message to be sent
    await new Promise(resolve => setTimeout(resolve, 100));
    this.disconnect();
  }
  
  // Getters
  getHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }
}