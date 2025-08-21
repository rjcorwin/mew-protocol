#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager, AgentConfigData } from './ConfigManager';
import { GenericAgent } from './GenericAgent';
import { OpenAIAgent, OpenAIAgentConfig } from './OpenAIAgent';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();
const configManager = new ConfigManager();

program
  .name('mcpx-agent')
  .description('MCPx Generic Agent - Interact with multiple peers in MCPx topics')
  .version('0.1.0');

// Setup command
program
  .command('setup')
  .description('Configure the MCPx agent')
  .action(async () => {
    console.log(chalk.blue.bold('\n🤖 MCPx Agent Setup\n'));
    
    const config = await promptForConfig();
    
    const spinner = ora('Saving configuration...').start();
    try {
      await configManager.saveConfig(config);
      spinner.succeed('Configuration saved');
      
      console.log(chalk.green('\n✅ Setup complete!'));
      console.log(chalk.gray('\nRun "mcpx-agent start" to launch the agent'));
    } catch (error) {
      spinner.fail('Failed to save configuration');
      console.error(error);
      process.exit(1);
    }
  });

// Start command - now uses OpenAI agent by default
program
  .command('start')
  .description('Start the OpenAI-powered MCPx agent')
  .option('-c, --config <path>', 'Path to custom config file')
  .option('--basic', 'Use basic agent instead of OpenAI agent')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 Starting MCPx Agent\n'));
    
    // Load configuration
    const config = await configManager.loadConfig();
    if (!config) {
      console.error(chalk.red('No configuration found. Run "mcpx-agent setup" first.'));
      process.exit(1);
    }
    
    // Generate auth token if not present
    let authToken = config.server.authToken;
    if (!authToken) {
      const spinner = ora('Generating auth token...').start();
      try {
        authToken = await configManager.generateAuthToken(
          config.server.url,
          config.participant.id,
          config.server.topic
        );
        
        // Save token for future use
        config.server.authToken = authToken;
        await configManager.saveConfig(config);
        
        spinner.succeed('Auth token generated');
      } catch (error) {
        spinner.fail('Failed to generate auth token');
        console.error(error);
        process.exit(1);
      }
    }
    
    if (options.basic) {
      // Use basic GenericAgent
      const agent = new GenericAgent({
        serverUrl: config.server.url,
        topic: config.server.topic,
        participantId: config.participant.id,
        participantName: config.participant.name,
        authToken: authToken,
        respondToChat: config.behavior?.respondToChat,
        chatResponsePatterns: config.behavior?.chatPatterns?.map(p => ({
          pattern: new RegExp(p.pattern, 'i'),
          response: p.response
        })),
        toolCallPatterns: config.behavior?.toolPatterns?.map(p => ({
          trigger: new RegExp(p.trigger, 'i'),
          calls: p.calls.map(c => ({
            ...c,
            params: c.params || {}
          }))
        }))
      });
      
      // Register local tools
      if (config.tools) {
        for (const tool of config.tools) {
          agent.registerTool(tool.name, async (params) => {
            console.log(`Tool called: ${tool.name}`, params);
            return { success: true, message: `Executed ${tool.name}` };
          });
        }
      }
      
      await agent.start();
      console.log(chalk.green('\n✅ Basic Agent is running'));
      
    } else {
      // Use OpenAI agent (default)
      if (!config.openai?.apiKey) {
        console.error(chalk.red('No OpenAI configuration found. Run "mcpx-agent setup" first.'));
        process.exit(1);
      }
      
      const agent = new OpenAIAgent({
        serverUrl: config.server.url,
        topic: config.server.topic,
        participantId: config.participant.id,
        participantName: config.participant.name,
        authToken: authToken,
        openaiApiKey: config.openai.apiKey,
        model: config.openai.model,
        temperature: config.openai.temperature,
        respondToAllMessages: config.openai.respondToAllMessages,
        toolCallConfirmation: config.openai.toolCallConfirmation,
        systemPrompt: config.openai.systemPrompt
      });
      
      await agent.start();
      console.log(chalk.green('\n✅ OpenAI Agent is running!'));
      console.log(chalk.gray(`Model: ${config.openai.model}`));
      console.log(chalk.gray('🧠 AI-powered natural language understanding enabled'));
    }
    
    console.log(chalk.gray(`Topic: ${config.server.topic}`));
    console.log(chalk.gray(`Participant: ${config.participant.id}`));
    console.log(chalk.gray('\nPress Ctrl+C to stop\n'));
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      process.exit(0);
    });
  });

// Reset command
program
  .command('reset')
  .description('Reset agent configuration')
  .action(async () => {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset the configuration?',
        default: false
      }
    ]);
    
    if (confirm) {
      await configManager.deleteConfig();
      console.log(chalk.green('Configuration reset'));
    }
  });

// Interactive mode command
program
  .command('interactive')
  .description('Start agent with interactive chat')
  .action(async () => {
    console.log(chalk.blue.bold('\n💬 MCPx Interactive Agent\n'));
    
    // Load configuration
    const config = await configManager.loadConfig();
    if (!config) {
      console.error(chalk.red('No configuration found. Run "mcpx-agent setup" first.'));
      process.exit(1);
    }
    
    // Generate auth token
    let authToken = config.server.authToken;
    if (!authToken) {
      const spinner = ora('Generating auth token...').start();
      try {
        authToken = await configManager.generateAuthToken(
          config.server.url,
          config.participant.id,
          config.server.topic
        );
        spinner.succeed('Auth token generated');
      } catch (error) {
        spinner.fail('Failed to generate auth token');
        console.error(error);
        process.exit(1);
      }
    }
    
    // Create agent with interactive handlers
    const agent = new GenericAgent({
      serverUrl: config.server.url,
      topic: config.server.topic,
      participantId: config.participant.id,
      participantName: config.participant.name,
      authToken: authToken,
      onChat: async (message) => {
        console.log(chalk.cyan(`[${message.from}]:`), message.text);
      },
      onPeerJoined: async (peer) => {
        console.log(chalk.green(`→ ${peer.name || peer.id} joined`));
      }
    });
    
    await agent.start();
    
    console.log(chalk.green('Connected!'));
    console.log(chalk.gray('Type messages to send to the topic, or commands:'));
    console.log(chalk.gray('  /peers - List connected peers'));
    console.log(chalk.gray('  /tools - List available tools'));
    console.log(chalk.gray('  /call <peer> <tool> <params> - Call a tool'));
    console.log(chalk.gray('  /quit - Exit\n'));
    
    // Interactive input loop
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
    
    rl.prompt();
    
    rl.on('line', async (line: string) => {
      const input = line.trim();
      
      if (input.startsWith('/')) {
        // Handle commands
        const [cmd, ...args] = input.slice(1).split(' ');
        
        switch (cmd) {
          case 'peers':
            const peers = agent.getPeers();
            console.log(chalk.yellow('Connected peers:'));
            peers.forEach(p => {
              console.log(`  - ${p.id} (${p.name || 'unnamed'}) [${p.kind}] - ${p.tools.length} tools`);
            });
            break;
            
          case 'tools':
            const tools = agent.listTools();
            console.log(chalk.yellow('Available tools:'));
            tools.forEach(t => {
              console.log(`  - ${t.peerId}::${t.name} - ${t.description || 'No description'}`);
            });
            break;
            
          case 'call':
            if (args.length < 3) {
              console.log(chalk.red('Usage: /call <peer> <tool> <params>'));
            } else {
              const [peerId, tool, ...paramParts] = args;
              try {
                const params = JSON.parse(paramParts.join(' '));
                const result = await agent.callTool(peerId, tool, params);
                console.log(chalk.green('Result:'), result);
              } catch (error: any) {
                console.log(chalk.red('Error:'), error.message);
              }
            }
            break;
            
          case 'quit':
          case 'exit':
            await agent.stop();
            process.exit(0);
            break;
            
          default:
            console.log(chalk.red(`Unknown command: ${cmd}`));
        }
      } else if (input) {
        // Send as chat message
        agent.sendChat(input);
      }
      
      rl.prompt();
    });
    
    rl.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      await agent.stop();
      process.exit(0);
    });
  });

// Legacy openai command - now just points to start
program
  .command('openai')
  .description('(Deprecated) Use "start" command instead - OpenAI is now the default')
  .action(async () => {
    console.log(chalk.yellow('⚠️  The "openai" command is deprecated.'));
    console.log(chalk.gray('OpenAI integration is now built into the main setup.'));
    console.log(chalk.blue('\nPlease use:'));
    console.log(chalk.white('  mcpx-agent setup   # Configure with OpenAI'));
    console.log(chalk.white('  mcpx-agent start   # Start OpenAI-powered agent'));
  });

// Helper function to prompt for configuration
async function promptForConfig(): Promise<AgentConfigData> {
  console.log(chalk.blue('\n📡 MCPx Connection Setup'));
  
  const connectionAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverUrl',
      message: 'MCPx server URL:',
      default: process.env.MCPX_SERVER_URL || 'ws://localhost:3000',
      validate: (input) => {
        if (!input.startsWith('ws://') && !input.startsWith('wss://')) {
          return 'URL must start with ws:// or wss://';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'topic',
      message: 'Topic to join:',
      default: 'room:general'
    },
    {
      type: 'input',
      name: 'participantId',
      message: 'Agent ID (unique identifier):',
      default: `agent-${Date.now()}`,
      validate: (input) => input.length > 0 || 'Agent ID is required'
    },
    {
      type: 'input',
      name: 'participantName',
      message: 'Agent display name (optional):'
    }
  ]);
  
  console.log(chalk.blue('\n🧠 OpenAI Configuration (Required)'));
  
  // Get OpenAI API key
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const { key } = await inquirer.prompt([
      {
        type: 'password',
        name: 'key',
        message: 'OpenAI API key:',
        mask: '*',
        validate: (input) => input.length > 0 || 'OpenAI API key is required'
      }
    ]);
    apiKey = key;
  } else {
    console.log(chalk.gray(`Using OpenAI API key from environment`));
  }
  
  const openaiAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'model',
      message: 'OpenAI model:',
      default: 'gpt-4-turbo-preview',
      choices: [
        'gpt-4-turbo-preview',
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-5-preview' // For when it's available
      ]
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Temperature (0-2, higher = more creative):',
      default: 0.7,
      validate: (input) => {
        if (input < 0 || input > 2) return 'Temperature must be between 0 and 2';
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'respondToAll',
      message: 'Respond to all messages (vs only when mentioned)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'toolConfirmation',
      message: 'Ask for confirmation before calling tools?',
      default: false
    },
    {
      type: 'input',
      name: 'systemPrompt',
      message: 'Custom system prompt (optional, press Enter for default):'
    }
  ]);
  
  console.log(chalk.blue('\n⚙️ Advanced Behavior (Optional)'));
  
  const behaviorAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addPatterns',
      message: 'Add custom chat response patterns?',
      default: false
    }
  ]);
  
  // Additional behavior configuration
  let chatPatterns: any[] = [];
  
  if (behaviorAnswers.addPatterns) {
    let addMore = true;
    while (addMore) {
      const pattern = await inquirer.prompt([
        {
          type: 'input',
          name: 'pattern',
          message: 'Pattern to match (regex):',
          default: 'hello|hi|hey'
        },
        {
          type: 'input',
          name: 'response',
          message: 'Response:',
          default: 'Hello! How can I help you?'
        }
      ]);
      
      chatPatterns.push(pattern);
      
      const { more } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'more',
          message: 'Add another pattern?',
          default: false
        }
      ]);
      addMore = more;
    }
  }
  
  return {
    server: {
      url: connectionAnswers.serverUrl,
      topic: connectionAnswers.topic
    },
    participant: {
      id: connectionAnswers.participantId,
      name: connectionAnswers.participantName || undefined
    },
    openai: {
      apiKey: apiKey!,
      model: openaiAnswers.model,
      temperature: openaiAnswers.temperature,
      respondToAllMessages: openaiAnswers.respondToAll,
      toolCallConfirmation: openaiAnswers.toolConfirmation,
      systemPrompt: openaiAnswers.systemPrompt || undefined
    },
    behavior: {
      respondToChat: true, // Always true since we're using OpenAI
      chatPatterns: chatPatterns.length > 0 ? chatPatterns : undefined
    }
  };
}

program.parse();