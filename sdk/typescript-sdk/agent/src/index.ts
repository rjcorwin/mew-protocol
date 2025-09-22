#!/usr/bin/env node

import { MEWAgent, AgentConfig } from './MEWAgent';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Parse command line arguments
function parseArgs(): { options: any; configFile?: string } {
  const args = process.argv.slice(2);
  const options: any = {
    transport: (process.env.MEW_TRANSPORT as string) || 'stdio',
    gateway: process.env.MEW_GATEWAY,
    space: process.env.MEW_SPACE || 'playground',
    token: process.env.MEW_TOKEN || 'agent-token',
    participantId: process.env.MEW_PARTICIPANT_ID || 'typescript-agent',
    model: process.env.OPENAI_MODEL,
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    debug: false,
    config: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--gateway':
      case '-g':
        options.gateway = args[++i];
        options.transport = 'websocket';
        break;
      case '--transport':
        options.transport = args[++i];
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
      case '--model':
      case '-m':
        options.model = args[++i];
        break;
      case '--api-key':
      case '-k':
        options.apiKey = args[++i];
        break;
      case '--openai-url':
      case '--base-url':
        options.baseURL = args[++i];
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
  -g, --gateway <url>     Gateway WebSocket URL (implies --transport websocket)
      --transport <mode>  Transport to use: stdio | websocket (default: stdio)
  -s, --space <name>      Space name to join (default: playground)
  -t, --token <token>     Authentication token (default: agent-token)
  -i, --id <id>          Participant ID (default: typescript-agent)
  -m, --model <model>    OpenAI model to use (default: gpt-4o)
  -k, --api-key <key>    OpenAI API key
  --openai-url <url>     Custom OpenAI API base URL (for alternative providers)
  -c, --config <file>    Configuration file (YAML or JSON)
  -d, --debug            Enable debug logging
  -h, --help            Show this help message

Environment Variables:
  MEW_GATEWAY           Gateway URL
  MEW_TRANSPORT         stdio | websocket
  MEW_SPACE            Space name
  MEW_TOKEN            Authentication token
  MEW_PARTICIPANT_ID   Participant ID
  OPENAI_API_KEY       OpenAI API key
  OPENAI_MODEL         OpenAI model (default: gpt-4o)
  OPENAI_BASE_URL      Custom OpenAI API base URL
  MEW_AGENT_CONFIG     JSON configuration (overrides file config)

Example:
  mew-agent --space dev --id my-agent               # STDIO via parent process
  mew-agent --gateway ws://localhost:8080 --transport websocket
  mew-agent --config agent-config.yaml
  mew-agent --model gpt-3.5-turbo --api-key sk-...
  mew-agent --openai-url http://localhost:11434/v1 --model llama2  # For Ollama
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

// Main function
async function main(): Promise<void> {
  const { options, configFile } = parseArgs();

  // Build agent configuration
  const transport = (options.transport as string | undefined)?.toLowerCase() === 'websocket'
    ? 'websocket'
    : 'stdio';

  if (transport === 'websocket' && !options.gateway) {
    options.gateway = 'ws://localhost:8080';
  }

  let agentConfig: AgentConfig = {
    transport,
    gateway: options.gateway,
    space: options.space,
    token: options.token,
    participant_id: options.participantId,
    reconnect: true,
    logLevel: options.debug ? 'debug' : 'info',
    name: options.participantId,
    systemPrompt: 'You are a helpful TypeScript-based AI assistant in the MEW protocol ecosystem.',
    reasoningEnabled: true,
    autoRespond: true,
    model: options.model || 'gpt-4o',
    apiKey: options.apiKey,
    baseURL: options.baseURL,
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
  if (agentConfig.transport === 'websocket') {
    console.log(`Connecting via WebSocket ${agentConfig.gateway} (space: ${agentConfig.space})`);
  } else {
    console.log(`Connecting via STDIO (space: ${agentConfig.space})`);
  }

  const agent = new MEWAgent(agentConfig);

  console.log('Agent will discover tools from other participants');

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
export { MEWAgent, AgentConfig };
