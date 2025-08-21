# MCPx Agent

A configurable agent for participating in MCPx topics and interacting with multiple peers.

## Features

- 🤖 **Generic Agent Framework** - Build custom agents that can interact with multiple MCP servers
- 💬 **Chat Interaction** - Respond to chat messages with pattern matching
- 🔧 **Tool Calling** - Discover and call tools from any peer in the topic
- ⚙️ **Configurable Behavior** - Define patterns and automated responses
- 🎮 **Interactive Mode** - Manual control with chat interface

## Installation

```bash
cd agent
npm install
npm run build
```

## Quick Start

### 1. Setup

Configure your agent (now includes OpenAI by default):

```bash
npm run cli setup
```

This will prompt you for:
- 📡 **MCPx Connection**: Server URL, topic, agent ID
- 🧠 **OpenAI Configuration**: API key, model (ready for GPT-5!), temperature
- ⚙️ **Advanced Settings**: Response patterns, system prompt

### 2. Start the Agent

Run your intelligent OpenAI-powered agent:

```bash
npm run cli start
```

The agent will automatically:
- 🧠 **Understand natural language requests** like "Can you check the weather in SF and schedule a meeting?"
- 🔧 **Discover and call tools** from any peer in the topic
- 💬 **Respond conversationally** and explain what it's doing
- 🎯 **Handle multi-step tasks** by coordinating multiple tool calls

### 3. Advanced Options

```bash
# Use basic agent without AI (legacy mode)
npm run cli start --basic

# Reset configuration
npm run cli reset
```

### 4. Interactive Mode

For manual interaction:

```bash
npm run cli interactive
```

Commands in interactive mode:
- `/peers` - List connected peers
- `/tools` - List available tools
- `/call <peer> <tool> <params>` - Call a tool
- `/quit` - Exit

## Configuration

The agent configuration is stored in `~/.mcpx/agent-config.json`:

```json
{
  "server": {
    "url": "ws://localhost:3000",
    "topic": "room:general"
  },
  "participant": {
    "id": "my-agent",
    "name": "My Agent"
  },
  "behavior": {
    "respondToChat": true,
    "chatPatterns": [
      {
        "pattern": "hello|hi",
        "response": "Hello! I'm an MCPx agent."
      }
    ]
  }
}
```

## Programmatic Usage

```typescript
import { GenericAgent } from '@mcpx/agent';

const agent = new GenericAgent({
  serverUrl: 'ws://localhost:3000',
  topic: 'room:general',
  participantId: 'my-agent',
  authToken: 'your-token',
  
  // Chat responses
  respondToChat: true,
  chatResponsePatterns: [
    {
      pattern: /weather in (.+)/i,
      response: (match) => `I'll check the weather in ${match[1]}`
    }
  ],
  
  // Custom handlers
  onChat: async (message, agent) => {
    console.log(`Chat: ${message.text}`);
  },
  
  onPeerJoined: async (peer, agent) => {
    console.log(`New peer: ${peer.id}`);
    // Discover their tools
    const tools = agent.listTools(peer.id);
    console.log(`Available tools:`, tools);
  }
});

await agent.start();

// Interact programmatically
agent.sendChat('Hello everyone!');

// Call a tool on a specific peer
const result = await agent.callTool('weather-agent', 'getWeather', {
  location: 'San Francisco'
});
```

## Advanced Features

### Custom Tool Handlers

Register tools that other peers can call:

```typescript
agent.registerTool('myTool', async (params) => {
  // Handle tool call
  return { result: 'success' };
});
```

### Tool Automation

Configure automatic tool calls based on chat triggers:

```json
{
  "behavior": {
    "toolPatterns": [
      {
        "trigger": "schedule a meeting",
        "calls": [
          {
            "tool": "checkCalendar",
            "params": {}
          },
          {
            "tool": "sendInvite",
            "params": {
              "attendees": ["@all"]
            }
          }
        ]
      }
    ]
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev

# Run tests
npm test
```

## Examples

### OpenAI Agent Usage

```bash
# Start the OpenAI agent
npm run cli openai

# In the topic, users can now say things like:
# "Can you check the weather in San Francisco?"
# "Please get my calendar for today and tomorrow"
# "Search for recent emails about the project"
# "Call the weather service and tell me if I need an umbrella"

# The agent will:
# 1. Understand the request
# 2. Find the right tools/peers
# 3. Make the appropriate calls
# 4. Respond with results in natural language
```

### Weather Agent

```typescript
const weatherAgent = new GenericAgent({
  participantId: 'weather-agent',
  // ... connection config
  
  onChat: async (message, agent) => {
    if (message.text.includes('weather')) {
      const result = await fetchWeather();
      agent.sendChat(`Current weather: ${result}`);
    }
  }
});

weatherAgent.registerTool('getWeather', async (params) => {
  return await fetchWeather(params.location);
});
```

### Coordinator Agent

```typescript
const coordinator = new GenericAgent({
  participantId: 'coordinator',
  // ... connection config
  
  onPeerJoined: async (peer, agent) => {
    // Coordinate new peers
    const tools = agent.listTools(peer.id);
    agent.sendChat(`Welcome ${peer.name}! You have ${tools.length} tools available.`);
  }
});
```