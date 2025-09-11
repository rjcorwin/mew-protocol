#!/usr/bin/env node

import { MEWAgent, AgentConfig } from './MEWAgent';
import { Tool } from '@mew-protocol/participant';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Parse command line arguments
function parseArgs(): { options: any; configFile?: string } {
  const args = process.argv.slice(2);
  const options: any = {
    gateway: process.env.MEW_GATEWAY || 'ws://localhost:8080',
    space: process.env.MEW_SPACE || 'playground',
    token: process.env.MEW_TOKEN || 'agent-token',
    participantId: process.env.MEW_PARTICIPANT_ID || 'typescript-agent',
    debug: false,
    config: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--gateway':
      case '-g':
        options.gateway = args[++i];
        break;
      case '--space':
      case '-s':
        options.space = args[++i];
        break;
      case '--token':
      case '-t':
        options.token = args[++i];
        break;
      case '--id':
      case '-i':
        options.participantId = args[++i];
        break;
      case '--config':
      case '-c':
        options.config = args[++i];
        break;
      case '--debug':
      case '-d':
        options.debug = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return { options, configFile: options.config };
}

function printHelp(): void {
  console.log(`
MEW TypeScript Agent Example

Usage: mew-agent [options]

Options:
  -g, --gateway <url>     Gateway WebSocket URL (default: ws://localhost:8080)
  -s, --space <name>      Space name to join (default: playground)
  -t, --token <token>     Authentication token (default: agent-token)
  -i, --id <id>          Participant ID (default: typescript-agent)
  -c, --config <file>    Configuration file (YAML or JSON)
  -d, --debug            Enable debug logging
  -h, --help            Show this help message

Environment Variables:
  MEW_GATEWAY           Gateway URL
  MEW_SPACE            Space name
  MEW_TOKEN            Authentication token
  MEW_PARTICIPANT_ID   Participant ID
  MEW_AGENT_CONFIG     JSON configuration (overrides file config)

Example:
  mew-agent --gateway ws://localhost:8080 --space dev --id my-agent
  mew-agent --config agent-config.yaml
`);
}

// Load configuration from file
function loadConfig(filePath: string): Partial<AgentConfig> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) as Partial<AgentConfig>;
    } else if (ext === '.json') {
      return JSON.parse(content);
    } else {
      throw new Error(`Unsupported config file format: ${ext}`);
    }
  } catch (error: any) {
    console.error(`Failed to load config from ${filePath}:`, error.message);
    return {};
  }
}

// Create sample tools
function createSampleTools(): Tool[] {
  return [
    {
      name: 'get_time',
      description: 'Get the current time',
      inputSchema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., UTC, America/New_York)',
          },
        },
      },
      execute: async (input: any) => {
        const date = new Date();
        return {
          content: [
            {
              type: 'text',
              text: `Current time: ${date.toISOString()}`,
            },
          ],
        };
      },
    },
    {
      name: 'echo',
      description: 'Echo back the input',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo',
          },
        },
        required: ['message'],
      },
      execute: async (input: any) => {
        return {
          content: [
            {
              type: 'text',
              text: `Echo: ${input.message}`,
            },
          ],
        };
      },
    },
    {
      name: 'calculate',
      description: 'Perform basic arithmetic',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'Operation to perform',
          },
          a: {
            type: 'number',
            description: 'First operand',
          },
          b: {
            type: 'number',
            description: 'Second operand',
          },
        },
        required: ['operation', 'a', 'b'],
      },
      execute: async (input: any) => {
        const { operation, a, b } = input;
        let result: number;

        switch (operation) {
          case 'add':
            result = a + b;
            break;
          case 'subtract':
            result = a - b;
            break;
          case 'multiply':
            result = a * b;
            break;
          case 'divide':
            if (b === 0) {
              throw new Error('Division by zero');
            }
            result = a / b;
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `${a} ${operation} ${b} = ${result}`,
            },
          ],
        };
      },
    },
  ];
}

// Main function
async function main(): Promise<void> {
  const { options, configFile } = parseArgs();

  // Build agent configuration
  let agentConfig: AgentConfig = {
    gateway: options.gateway,
    space: options.space,
    token: options.token,
    participant_id: options.participantId,
    reconnect: true,
    logLevel: options.debug ? 'debug' : 'info',
    name: options.participantId,
    systemPrompt: 'You are a helpful TypeScript-based AI assistant in the MEW protocol ecosystem.',
    thinkingEnabled: true,
    autoRespond: true,
    maxIterations: 5,
  };

  // Load config file if provided
  if (configFile) {
    const fileConfig = loadConfig(configFile);
    agentConfig = { ...agentConfig, ...fileConfig };
    console.log(`Loaded configuration from ${configFile}`);
  }

  // Apply environment variable overrides
  if (process.env.MEW_AGENT_CONFIG) {
    try {
      const envConfig = JSON.parse(process.env.MEW_AGENT_CONFIG);
      agentConfig = { ...agentConfig, ...envConfig };
      console.log('Applied configuration from MEW_AGENT_CONFIG');
    } catch (error: any) {
      console.error('Failed to parse MEW_AGENT_CONFIG:', error.message);
    }
  }

  // Create the agent
  console.log(`Starting MEW TypeScript Agent: ${agentConfig.participant_id}`);
  console.log(`Connecting to ${agentConfig.gateway} (space: ${agentConfig.space})`);

  const agent = new MEWAgent(agentConfig);

  // Register sample tools
  const tools = createSampleTools();
  tools.forEach((tool) => agent.addTool(tool));
  console.log(`Registered ${tools.length} tools`);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    agent.stop();
    process.exit(0);
  });

  // Start the agent
  try {
    await agent.start();
    console.log('Agent connected successfully!');
  } catch (error: any) {
    console.error('Failed to start agent:', error.message);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as a module
export { MEWAgent, AgentConfig, createSampleTools };
