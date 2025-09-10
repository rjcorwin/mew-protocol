#!/usr/bin/env node
/**
 * MEW ReAct Agent
 * Configurable agent that can be specialized via configuration
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const ReActAgent = require('./react-agent');
const { MCPClient } = require('./mcp-client');

// Import MEW SDK
const clientPath = path.resolve(__dirname, '../../sdk/typescript-sdk/client/dist/index.js');
const { MEWClient, ClientEvents } = require(clientPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'playground',
  token: 'agent-token',
  config: null,
  debug: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gateway' || args[i] === '-g') {
    options.gateway = args[i + 1];
    i++;
  } else if (args[i] === '--space' || args[i] === '-s') {
    options.space = args[i + 1];
    i++;
  } else if (args[i] === '--token' || args[i] === '-t') {
    options.token = args[i + 1];
    i++;
  } else if (args[i] === '--config' || args[i] === '-c') {
    options.config = args[i + 1];
    i++;
  } else if (args[i] === '--debug' || args[i] === '-d') {
    options.debug = true;
  }
}

// Load configuration
let agentConfig = {
  name: 'mew-agent',
  systemPrompt: 'You are a helpful AI assistant in the MEW protocol ecosystem.',
  logLevel: options.debug ? 'debug' : 'info'
};

if (options.config) {
  try {
    if (options.config.endsWith('.yaml') || options.config.endsWith('.yml')) {
      const configContent = fs.readFileSync(options.config, 'utf8');
      const loadedConfig = yaml.load(configContent);
      agentConfig = { ...agentConfig, ...loadedConfig };
    } else if (options.config.endsWith('.json')) {
      const configContent = fs.readFileSync(options.config, 'utf8');
      const loadedConfig = JSON.parse(configContent);
      agentConfig = { ...agentConfig, ...loadedConfig };
    }
    console.log(`Loaded configuration from ${options.config}`);
  } catch (error) {
    console.error(`Failed to load config from ${options.config}:`, error.message);
  }
}

// Environment variable overrides
if (process.env.MEW_AGENT_CONFIG) {
  try {
    const envConfig = JSON.parse(process.env.MEW_AGENT_CONFIG);
    agentConfig = { ...agentConfig, ...envConfig };
  } catch (error) {
    console.error('Failed to parse MEW_AGENT_CONFIG:', error.message);
  }
}

// Create ReAct agent
const agent = new ReActAgent(agentConfig);
const participantId = agentConfig.participantId || agentConfig.name || 'mew-agent';

console.log(`Starting ${participantId} with ReAct architecture...`);
console.log(`Connecting to ${options.gateway}...`);

// Create MEW client
const client = new MEWClient({
  gateway: options.gateway,
  space: options.space,
  token: options.token,
  participant_id: participantId,
  capabilities: [
    { kind: 'chat' },
    { kind: 'mcp/request' },
    { kind: 'mcp/response' }
  ],
  reconnect: true
});

// Create MCP client and connect to agent
const mcpClient = new MCPClient(client, 'mcp-fs-bridge');
agent.setMCPClient(mcpClient);

// Track conversation context
let conversationContext = {
  participants: [],
  messages: [],
  tools: []
};

// Handle connection events
client.on('connected', () => {
  console.log('WebSocket connected');
});

client.on('welcome', (payload) => {
  console.log('Joined space successfully:', payload);
  conversationContext.participants = payload.participants || [];
  
  // Send greeting if configured
  if (agentConfig.greeting) {
    setTimeout(() => {
      client.send({
        kind: 'chat',
        payload: { text: agentConfig.greeting }
      });
    }, 1000);
  }
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

// Handle incoming messages
client.on(ClientEvents.MESSAGE, async (envelope) => {
  console.log(`Received: ${envelope.kind} from ${envelope.from}`);
  
  // Skip system messages as they're handled by specific events
  if (envelope.kind.startsWith('system/')) {
    return;
  }
  
  if (envelope.kind === 'chat' && envelope.from !== participantId) {
    const text = envelope.payload.text;
    
    // Add to conversation history
    conversationContext.messages.push({
      from: envelope.from,
      text: text,
      timestamp: envelope.ts
    });
    
    // Keep conversation history manageable
    if (conversationContext.messages.length > 50) {
      conversationContext.messages = conversationContext.messages.slice(-25);
    }
    
    try {
      // Process through ReAct loop
      const result = await agent.process(text, conversationContext);
      
      // Send response based on result
      if (result.type === 'message' && result.content) {
        client.send({
          kind: 'chat',
          payload: { text: result.content }
        });
        
        // Add our response to history
        conversationContext.messages.push({
          from: participantId,
          text: result.content,
          timestamp: new Date().toISOString()
        });
      } else if (result.type === 'tool_result') {
        // Handle tool execution results
        const response = `Tool ${result.tool} executed: ${result.result}`;
        client.send({
          kind: 'chat',
          payload: { text: response }
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      client.send({
        kind: 'chat',
        payload: { text: `I encountered an error: ${error.message}` }
      });
    }
  }
  
  // Handle MCP responses from the bridge
  if (envelope.kind === 'mcp/response' && envelope.from === 'mcp-fs-bridge') {
    mcpClient.handleResponse(envelope);
  }
});

// Handle agent events
agent.on('error', (error) => {
  console.error('Agent error:', error);
});

// Handle disconnection
client.on(ClientEvents.DISCONNECTED, () => {
  console.log('WebSocket disconnected');
});

// Connect to gateway
client.connect();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  client.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  client.disconnect();
  process.exit(0);
});