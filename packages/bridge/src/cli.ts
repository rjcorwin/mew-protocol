#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager, generateAuthToken, validateMCPServerConfig } from './config/ConfigManager';
import { BridgeService } from './services/BridgeService';
import { BridgeConfig, createDefaultConfig } from './types/config';

const program = new Command();

program
  .name('mcpx-bridge')
  .description('MCPx Bridge - Connect MCP servers to MCPx topics')
  .version('0.1.0');

// Setup command - interactive configuration
program
  .command('setup')
  .description('Interactive setup of bridge configuration')
  .option('-f, --file <path>', 'Configuration file path', 'bridge-config.json')
  .action(async (options) => {
    const configManager = new ConfigManager(options.file);
    
    console.log(chalk.blue('MCPx Bridge Setup'));
    console.log('This will guide you through setting up the bridge configuration.\n');

    try {
      const config = await interactiveSetup(configManager);
      
      const spinner = ora('Saving configuration...').start();
      configManager.saveConfig(config);
      spinner.succeed('Configuration saved');
      
      console.log(chalk.green(`\nConfiguration saved to: ${configManager.getConfigPath()}`));
      console.log(chalk.yellow('Run `mcpx-bridge start` to begin bridging.'));
      
    } catch (error) {
      console.error(chalk.red('Setup failed:'), (error as Error).message);
      process.exit(1);
    }
  });

// Start command
program
  .command('start')
  .description('Start the bridge service')
  .option('-c, --config <path>', 'Configuration file path', 'bridge-config.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    const configManager = new ConfigManager(options.config);
    
    try {
      const config = configManager.loadConfig();
      
      if (options.verbose) {
        console.log(chalk.blue('Starting with configuration:'));
        console.log(JSON.stringify(config, null, 2));
      }
      
      const bridge = new BridgeService(config);
      
      // Set up event handlers
      bridge.on('started', () => {
        console.log(chalk.green('✓ Bridge started successfully'));
      });
      
      bridge.on('error', (error) => {
        console.error(chalk.red('Bridge error:'), error.message);
      });
      
      bridge.on('mcpxMessage', (envelope) => {
        if (options.verbose) {
          console.log(chalk.gray(`MCPx: ${envelope.from} -> ${envelope.kind}`));
        }
      });
      
      bridge.on('mcpMessage', (method, params) => {
        if (options.verbose) {
          console.log(chalk.gray(`MCP: ${method}`));
        }
      });
      
      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\nShutting down...'));
        await bridge.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\nShutting down...'));
        await bridge.stop();
        process.exit(0);
      });
      
      // Start the bridge
      await bridge.start();
      
    } catch (error) {
      console.error(chalk.red('Failed to start bridge:'), (error as Error).message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Configuration file path', 'bridge-config.json')
  .action((options) => {
    const configManager = new ConfigManager(options.config);
    const validation = configManager.validateConfigFile();
    
    if (validation.valid) {
      console.log(chalk.green('✓ Configuration is valid'));
    } else {
      console.log(chalk.red('✗ Configuration is invalid:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  - ${error}`));
      });
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test connections without starting the bridge')
  .option('-c, --config <path>', 'Configuration file path', 'bridge-config.json')
  .action(async (options) => {
    const configManager = new ConfigManager(options.config);
    
    try {
      const config = configManager.loadConfig();
      
      console.log(chalk.blue('Testing connections...\n'));
      
      // Test MCPx connection
      const mcpxSpinner = ora('Testing MCPx connection...').start();
      try {
        const response = await fetch(`${config.mcpx.server}/health`);
        if (response.ok) {
          mcpxSpinner.succeed('MCPx server is reachable');
        } else {
          mcpxSpinner.fail(`MCPx server returned ${response.status}`);
        }
      } catch (error) {
        mcpxSpinner.fail(`MCPx server unreachable: ${(error as Error).message}`);
      }
      
      // Test MCP server config
      const mcpSpinner = ora('Validating MCP server configuration...').start();
      const mcpValidation = validateMCPServerConfig(config.mcp_server);
      if (mcpValidation.valid) {
        mcpSpinner.succeed('MCP server configuration is valid');
      } else {
        mcpSpinner.fail(`MCP server config invalid: ${mcpValidation.error}`);
      }
      
      console.log(chalk.green('\n✓ All tests completed'));
      
    } catch (error) {
      console.error(chalk.red('Test failed:'), (error as Error).message);
      process.exit(1);
    }
  });

// Run command - quick start with MCP server command
program
  .command('run <mcp-command...>')
  .description('Run bridge with an MCP server command directly')
  .option('-s, --server <url>', 'MCPx server URL', 'ws://localhost:3000')
  .option('-t, --topic <name>', 'Topic to join', 'test-room')
  .option('-i, --id <id>', 'Participant ID (defaults to MCP command name)')
  .option('-n, --name <name>', 'Display name (defaults to MCP command name)')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (mcpCommand, options) => {
    const command = mcpCommand[0];
    const args = mcpCommand.slice(1);
    
    // Extract command name for defaults
    const commandName = command.split('/').pop()?.split('.')[0] || 'mcp-server';
    const participantId = options.id || `${commandName}-bridge`;
    const displayName = options.name || `${commandName} Bridge`;
    
    console.log(chalk.blue('MCPx Bridge - Quick Start'));
    console.log(chalk.gray(`MCP Server: ${mcpCommand.join(' ')}`));
    console.log(chalk.gray(`MCPx Server: ${options.server}`));
    console.log(chalk.gray(`Topic: ${options.topic}`));
    console.log(chalk.gray(`Participant: ${displayName} (${participantId})\n`));
    
    try {
      // Generate authentication token
      const tokenSpinner = ora('Generating authentication token...').start();
      const token = await generateAuthToken(
        options.server,
        participantId,
        options.topic
      );
      tokenSpinner.succeed('Authentication token generated');
      
      // Create runtime configuration
      const config: BridgeConfig = {
        mcpx: {
          server: options.server,
          topic: options.topic,
          token
        },
        participant: {
          id: participantId,
          name: displayName,
          kind: 'agent'
        },
        mcp_server: {
          type: 'stdio',
          command,
          args
        },
        options: {
          reconnectAttempts: 5,
          reconnectDelay: 1000,
          heartbeatInterval: 30000,
          logLevel: options.verbose ? 'debug' : 'info'
        }
      };
      
      // Start the bridge
      const bridge = new BridgeService(config);
      
      // Set up event handlers
      bridge.on('started', () => {
        console.log(chalk.green('✓ Bridge started successfully'));
        console.log(chalk.yellow('\nPress Ctrl+C to stop the bridge\n'));
      });
      
      bridge.on('error', (error) => {
        console.error(chalk.red('Bridge error:'), error.message);
      });
      
      if (options.verbose) {
        bridge.on('mcpxMessage', (envelope) => {
          console.log(chalk.gray(`MCPx: ${envelope.from} -> ${envelope.kind}`));
        });
        
        bridge.on('mcpMessage', (method, params) => {
          console.log(chalk.gray(`MCP: ${method}`));
        });
      }
      
      // Graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\nShutting down...'));
        await bridge.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\nShutting down...'));
        await bridge.stop();
        process.exit(0);
      });
      
      // Start the bridge
      await bridge.start();
      
    } catch (error) {
      console.error(chalk.red('Failed to start bridge:'), (error as Error).message);
      process.exit(1);
    }
  });

async function interactiveSetup(configManager: ConfigManager): Promise<BridgeConfig> {
  const defaultConfig = createDefaultConfig();
  
  // MCPx configuration
  console.log(chalk.yellow('MCPx Server Configuration:'));
  const mcpxAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'server',
      message: 'MCPx server URL:',
      default: defaultConfig.mcpx?.server,
      validate: (input: string) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'topic',
      message: 'Topic to join:',
      default: defaultConfig.mcpx?.topic,
      validate: (input: string) => input.trim().length > 0 || 'Topic cannot be empty'
    }
  ]);

  // Participant configuration
  console.log(chalk.yellow('\nParticipant Configuration:'));
  const participantAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Participant ID:',
      default: defaultConfig.participant?.id,
      validate: (input: string) => input.trim().length > 0 || 'Participant ID cannot be empty'
    },
    {
      type: 'input',
      name: 'name',
      message: 'Display name:',
      default: defaultConfig.participant?.name,
      validate: (input: string) => input.trim().length > 0 || 'Display name cannot be empty'
    },
    {
      type: 'list',
      name: 'kind',
      message: 'Participant type:',
      choices: ['agent', 'robot', 'human'],
      default: defaultConfig.participant?.kind
    }
  ]);

  // MCP server configuration
  console.log(chalk.yellow('\nMCP Server Configuration:'));
  const mcpTypeAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'MCP server transport:',
      choices: [
        { name: 'Standard I/O (stdio)', value: 'stdio' },
        { name: 'WebSocket (websocket)', value: 'websocket' },
        { name: 'Server-Sent Events (sse)', value: 'sse' }
      ],
      default: 'stdio'
    }
  ]);

  let mcpServerConfig;
  switch (mcpTypeAnswer.type) {
    case 'stdio':
      const stdioAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: 'Command to run MCP server:',
          default: 'python',
          validate: (input: string) => input.trim().length > 0 || 'Command cannot be empty'
        },
        {
          type: 'input',
          name: 'args',
          message: 'Command arguments (space-separated):',
          default: 'server.py',
          filter: (input: string) => input.trim().split(' ').filter((arg: string) => arg.length > 0)
        }
      ]);
      
      mcpServerConfig = {
        type: 'stdio' as const,
        command: stdioAnswers.command,
        args: stdioAnswers.args
      };
      break;

    case 'websocket':
    case 'sse':
      const urlAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: `${mcpTypeAnswer.type.toUpperCase()} URL:`,
          validate: (input: string) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        }
      ]);
      
      mcpServerConfig = {
        type: mcpTypeAnswer.type,
        url: urlAnswer.url
      };
      break;

    default:
      throw new Error('Invalid transport type');
  }

  // Generate authentication token
  console.log(chalk.yellow('\nGenerating authentication token...'));
  const spinner = ora('Authenticating with MCPx server...').start();
  
  try {
    const token = await generateAuthToken(
      mcpxAnswers.server,
      participantAnswers.id,
      mcpxAnswers.topic
    );
    spinner.succeed('Authentication token generated');
    
    return {
      mcpx: {
        server: mcpxAnswers.server,
        topic: mcpxAnswers.topic,
        token
      },
      participant: {
        id: participantAnswers.id,
        name: participantAnswers.name,
        kind: participantAnswers.kind
      },
      mcp_server: mcpServerConfig,
      options: defaultConfig.options!
    };
    
  } catch (error) {
    spinner.fail('Failed to generate authentication token');
    throw error;
  }
}

program.parse();