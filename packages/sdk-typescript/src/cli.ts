#!/usr/bin/env node

import { Command } from 'commander';
import { MCPxChatClient } from './MCPxChatClient';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Debug from 'debug';
import dotenv from 'dotenv';

dotenv.config();

const debug = Debug('mcpx:chat:cli');

const program = new Command();

program
  .name('mcpx-chat')
  .description('Command-line chat interface for MCPx topics')
  .version('0.1.0');

program
  .command('send <message>')
  .description('Send a single message to a topic (non-interactive)')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'Topic to join', 'room:general')
  .option('-i, --id <id>', 'Participant ID', 'cli-user')
  .option('-n, --name <name>', 'Display name')
  .option('-a, --auth <token>', 'Authentication token')
  .option('-c, --config <path>', 'Config file path')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--wait <ms>', 'Wait for responses (milliseconds)', '3000')
  .action(async (message, options) => {
    if (options.verbose) {
      Debug.enable('mcpx:*');
    }

    const config = loadConfig(options);
    
    const client = new MCPxChatClient({
      serverUrl: config.server || options.server,
      topic: config.topic || options.topic,
      participantId: config.id || options.id,
      participantName: config.name || options.name,
      authToken: config.auth || options.auth
    });

    try {
      await client.connect();
      await client.sendMessage(message);
      
      // Wait for any responses
      const waitTime = parseInt(options.wait);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      await client.disconnect();
      process.exit(0);  // Explicitly exit after disconnecting
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'Topic to join', 'room:general')
  .option('-i, --id <id>', 'Participant ID', 'cli-user')
  .option('-n, --name <name>', 'Display name')
  .option('-a, --auth <token>', 'Authentication token')
  .option('-c, --config <path>', 'Config file path')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--show-tools', 'Show available tools on startup')
  .action(async (options) => {
    if (options.verbose) {
      Debug.enable('mcpx:*');
    }

    const config = loadConfig(options);
    
    const client = new MCPxChatClient({
      serverUrl: config.server || options.server,
      topic: config.topic || options.topic,
      participantId: config.id || options.id,
      participantName: config.name || options.name,
      authToken: config.auth || options.auth
    });

    try {
      await client.connect();
      
      if (options.showTools) {
        client.showTools();
      }
      
      await client.startInteractive();
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('tools')
  .description('List available tools in a topic')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'Topic to join', 'room:general')
  .option('-i, --id <id>', 'Participant ID', 'cli-user')
  .option('-n, --name <name>', 'Display name')
  .option('-a, --auth <token>', 'Authentication token')
  .option('-c, --config <path>', 'Config file path')
  .option('-p, --peer <id>', 'Filter tools by peer ID')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    if (options.verbose) {
      Debug.enable('mcpx:*');
    }

    const config = loadConfig(options);
    
    const client = new MCPxChatClient({
      serverUrl: config.server || options.server,
      topic: config.topic || options.topic,
      participantId: config.id || options.id,
      participantName: config.name || options.name,
      authToken: config.auth || options.auth
    });

    try {
      await client.connect();
      
      // Wait for peers to be discovered
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      client.showTools(options.peer);
      
      await client.disconnect();
      process.exit(0);  // Explicitly exit after disconnecting
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('call <peer> <tool> [params...]')
  .description('Call a tool on a peer')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <topic>', 'Topic to join', 'room:general')
  .option('-i, --id <id>', 'Participant ID', 'cli-user')
  .option('-n, --name <name>', 'Display name')
  .option('-a, --auth <token>', 'Authentication token')
  .option('-c, --config <path>', 'Config file path')
  .option('-j, --json', 'Output result as JSON')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (peer, tool, params, options) => {
    if (options.verbose) {
      Debug.enable('mcpx:*');
    }

    const config = loadConfig(options);
    
    const client = new MCPxChatClient({
      serverUrl: config.server || options.server,
      topic: config.topic || options.topic,
      participantId: config.id || options.id,
      participantName: config.name || options.name,
      authToken: config.auth || options.auth
    });

    try {
      await client.connect();
      
      // Wait for peers to be discovered
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Parse params as JSON if provided
      let parsedParams = {};
      if (params.length > 0) {
        try {
          parsedParams = JSON.parse(params.join(' '));
        } catch {
          // If not JSON, treat as key=value pairs
          params.forEach((param: string) => {
            const [key, value] = param.split('=');
            if (key && value) {
              (parsedParams as any)[key] = value;
            }
          });
        }
      }
      
      const result = await client.callTool(peer, tool, parsedParams);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Result:', result);
      }
      
      await client.disconnect();
      process.exit(0);  // Explicitly exit after disconnecting
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Create or update configuration file')
  .option('-s, --server <url>', 'MCPx server URL')
  .option('-t, --topic <topic>', 'Default topic')
  .option('-i, --id <id>', 'Default participant ID')
  .option('-n, --name <name>', 'Default display name')
  .option('-a, --auth <token>', 'Default authentication token')
  .option('--global', 'Save to global config location')
  .action(async (options) => {
    const configPath = options.global 
      ? path.join(os.homedir(), '.mcpx', 'chat-config.json')
      : './mcpx-chat.json';
    
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    if (options.server) config.server = options.server;
    if (options.topic) config.topic = options.topic;
    if (options.id) config.id = options.id;
    if (options.name) config.name = options.name;
    if (options.auth) config.auth = options.auth;
    
    // Ensure directory exists for global config
    if (options.global) {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Configuration saved to ${configPath}`);
  });

function loadConfig(options: any): any {
  let config = {};
  
  // Try to load config file
  const configPaths = [
    options.config,
    './mcpx-chat.json',
    path.join(os.homedir(), '.mcpx', 'chat-config.json')
  ].filter(Boolean);
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      debug(`Loaded config from ${configPath}`);
      break;
    }
  }
  
  return config;
}

program.parse();