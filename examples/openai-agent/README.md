# @mcpx-protocol/openai-agent

An intelligent MCPx agent powered by OpenAI's GPT models that can engage in natural conversations and orchestrate other agents' tools.

## Features

### 🤖 Intelligent Chat Responses
- Uses OpenAI GPT models (configurable)
- Maintains conversation context
- Responds naturally to messages in the chat room

### 🛠️ MCP Tool Provider
Provides three MCP tools for other agents:
- **generate_text** - Generate text from prompts
- **analyze_sentiment** - Analyze sentiment of text
- **summarize** - Summarize long text

### 🔧 Tool Orchestration
- Automatically discovers tools from other agents
- Can call tools on behalf of users
- Integrates tool results into responses

### 💬 Natural Language Understanding
- Understands context and intent
- Can handle complex queries
- Provides helpful, concise responses

## Installation

### Global Install (Recommended)

```bash
npm install -g @mcpx-protocol/openai-agent
```

### Local Development

```bash
git clone https://github.com/rjcorwin/mcpx-protocol.git
cd mcpx-protocol/examples/openai-agent
npm install
```

## Setup

### 1. Get OpenAI API Key

Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

### 2. Configure (Optional)

For global install, set environment variables:
```bash
export OPENAI_API_KEY=sk-your-api-key-here
export OPENAI_MODEL=gpt-4o  # Optional: defaults to gpt-4o-mini
```

For local development, create `.env` file:
```bash
cp .env.example .env
# Edit .env with your API key
```

### 3. Optional Configuration

You can customize the agent behavior in `.env`:

```env
# Model selection (gpt-4o, gpt-4o-mini, gpt-3.5-turbo)
OPENAI_MODEL=gpt-4o-mini

# Response length
OPENAI_MAX_TOKENS=500

# Creativity (0.0 = deterministic, 1.0 = creative)
OPENAI_TEMPERATURE=0.7

# Custom system prompt
OPENAI_SYSTEM_PROMPT="You are a helpful AI assistant..."

# MCPx settings
MCPX_GATEWAY=ws://localhost:3000
MCPX_TOPIC=test-room
MCPX_PARTICIPANT_ID=openai-agent
```

## Running the Agent

### Global Install

```bash
# Basic usage
OPENAI_API_KEY=your-key mcpx-openai-agent

# With custom settings
OPENAI_API_KEY=your-key OPENAI_MODEL=gpt-4o MCPX_TOPIC=my-room mcpx-openai-agent
```

### Local Development

```bash
# Basic usage
npm start

# With custom settings
OPENAI_MODEL=gpt-4o OPENAI_TEMPERATURE=0.9 npm start

# Development mode (auto-restart)
npm run dev
```

## Testing the Agent

### 1. Start the Gateway and Other Agents

```bash
# Terminal 1: Gateway
npm run dev:gateway

# Terminal 2: OpenAI Agent
cd examples/openai-agent
npm start

# Terminal 3: Calculator Agent (for tool testing)
npm run example:calculator

# Terminal 4: Connect with CLI
npm run cli -- ws://localhost:3000 test-room user
```

### 2. Test Chat Interactions

```
You: Hello AI!
OpenAI: 🤖 Hello! I'm here to help. How can I assist you today?

You: What's the weather like?
OpenAI: 🤖 I don't have access to real-time weather data, but I can help you with many other things...

You: Can you explain quantum computing?
OpenAI: 🤖 Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously...
```

### 3. Test Tool Discovery and Usage

When calculator agent is running:
```
You: Can you calculate 25 * 4 for me?
OpenAI: 🤖 Let me calculate that for you...
[Calls calculator agent's multiply tool]
OpenAI: 🤖 25 * 4 equals 100.
```

### 4. Test MCP Tools

Other agents or users can call the OpenAI agent's tools:

```bash
# Generate text
/call openai-agent generate_text {"prompt": "Write a haiku about coding"}

# Analyze sentiment
/call openai-agent analyze_sentiment {"text": "I love this new feature!"}

# Summarize text
/call openai-agent summarize {"text": "Long article text here...", "max_length": 30}
```

## How It Works

### Architecture

```
User Message
    ↓
OpenAI Agent
    ↓
GPT Model ←→ Tool Discovery
    ↓           ↓
Response    Tool Calls
    ↓           ↓
Chat Room ← Results
```

### Message Flow

1. **Receives chat message** from any participant
2. **Adds to conversation history** for context
3. **Checks for available tools** from other agents
4. **Sends to OpenAI** with context and tools
5. **Processes response**:
   - Direct response → Send to chat
   - Tool calls → Execute and integrate results
6. **Maintains history** (trimmed to prevent overflow)

### Tool Integration

The agent can discover and use tools from other agents:

1. **Discovery**: On startup, queries all peers for their tools
2. **Registration**: Maps tools to OpenAI function definitions
3. **Execution**: When GPT suggests a tool, calls it via MCP
4. **Integration**: Includes results in final response

## Advanced Usage

### Custom System Prompts

Create specialized agents with custom prompts:

```env
# Code reviewer
OPENAI_SYSTEM_PROMPT="You are a code review expert. Analyze code for bugs, performance, and best practices."

# Teacher
OPENAI_SYSTEM_PROMPT="You are a patient teacher. Explain concepts simply and provide examples."

# Creative writer
OPENAI_SYSTEM_PROMPT="You are a creative writer. Use vivid language and storytelling."
```

### Model Selection

Different models for different use cases:

- **gpt-4o**: Best quality, higher cost
- **gpt-4o-mini**: Good balance of quality and cost
- **gpt-3.5-turbo**: Fastest and cheapest

### Temperature Tuning

Adjust creativity vs consistency:

- **0.0-0.3**: Factual, consistent responses
- **0.4-0.7**: Balanced (default)
- **0.8-1.0**: Creative, varied responses

## Cost Considerations

OpenAI API usage incurs costs:

- **Input tokens**: Conversation history + prompts
- **Output tokens**: Generated responses
- **Tool calls**: Additional tokens for function calling

Tips to manage costs:
1. Use `gpt-4o-mini` for testing
2. Set reasonable `OPENAI_MAX_TOKENS`
3. Monitor usage in OpenAI dashboard
4. Consider implementing rate limiting

## Troubleshooting

### "OPENAI_API_KEY environment variable is required"
- Create `.env` file with your API key
- Ensure `.env` is in the agent directory

### "Failed to get token"
- Check gateway is running
- Verify MCPX_GATEWAY URL

### No responses from agent
- Check console for errors
- Verify API key is valid
- Check OpenAI API status

### Tools not being discovered
- Ensure other agents are connected
- Check they're exposing MCP tools
- Look for discovery logs in console

## Security Notes

- **Never commit `.env` files** with API keys
- Use environment variables in production
- Consider rate limiting for public deployments
- Monitor API usage to prevent abuse

## Future Enhancements

- [ ] Streaming responses for long content
- [ ] Image generation with DALL-E
- [ ] Vision capabilities with GPT-4V
- [ ] Memory/context persistence
- [ ] Fine-tuned model support
- [ ] Multi-modal inputs
- [ ] Token usage tracking
- [ ] Response caching