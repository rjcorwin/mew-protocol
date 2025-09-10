# MEW Agent

A configurable ReAct (Reason, Act, Reflect) agent for the MEW Protocol ecosystem. This agent can be specialized for different purposes through configuration files.

## Features

- **ReAct Architecture**: Implements the Reason-Act-Reflect pattern for structured decision making
- **Configurable Prompts**: Customize system prompts and reasoning patterns
- **Multiple Personas**: Pre-configured for different roles (coder, note-taker, philosopher, etc.)
- **MCP Integration**: Works with Model Context Protocol tools
- **MEW Protocol Native**: Built on the MEW SDK for seamless integration

## Installation

```bash
cd mew-agent
npm install
```

## OpenAI Setup (Optional but Recommended)

The agent can work with or without OpenAI, but it's much more capable with it:

1. **Get an OpenAI API Key**: Sign up at [platform.openai.com](https://platform.openai.com)

2. **Set the environment variable**:
   ```bash
   export OPENAI_API_KEY="sk-your-api-key-here"
   ```

3. **Or add to your shell profile** (`~/.bashrc`, `~/.zshrc`, etc.):
   ```bash
   echo 'export OPENAI_API_KEY="sk-your-api-key-here"' >> ~/.zshrc
   source ~/.zshrc
   ```

Without OpenAI, the agent will use basic placeholder logic for demonstrations.

## Usage

### Basic Usage

```bash
node src/index.js --gateway ws://localhost:8080 --space my-space --token agent-token
```

### With Configuration

```bash
# Use a pre-configured persona
node src/index.js --config config/coder.yaml --gateway ws://localhost:8080 --space dev-space

# Or with environment variable
MEW_AGENT_CONFIG='{"name":"my-agent","systemPrompt":"You are a helpful assistant"}' node src/index.js
```

### Command Line Options

- `--gateway, -g`: WebSocket gateway URL (default: ws://localhost:8080)
- `--space, -s`: Space ID to join (default: playground)
- `--token, -t`: Authentication token (default: agent-token)
- `--config, -c`: Configuration file path (YAML or JSON)
- `--debug, -d`: Enable debug logging

## Configuration

### Configuration Structure

```yaml
# Agent identity
name: my-agent
participantId: my-agent-id

# OpenAI settings (optional)
model: gpt-4-turbo-preview  # or gpt-3.5-turbo for faster/cheaper
temperature: 0.7
useOpenAI: true  # Set to false to disable even if API key is set

# Core prompts
systemPrompt: |
  Define the agent's role and behavior

prompts:
  reason: |
    Template for reasoning phase
    Input: {input}
    Context: {context}
    
  reflect: |
    Template for reflection phase
    Action: {action}
    Outcome: {outcome}

# Behavior settings
greeting: "Hello! How can I help?"
maxIterations: 5
logLevel: info

# Available tools
tools:
  - tool/name
  - another/tool
```

## Pre-configured Personas

### Coder (`config/coder.yaml`)
Expert software developer that helps write, review, and debug code. Has access to file system operations.

### Note Taker (`config/note-taker.yaml`)
Organizes and manages notes, extracts key points from conversations, creates structured documentation.

### Philosopher (`config/philosopher.yaml`)
Engages in deep philosophical discussions using the Socratic method to explore ideas.

## ReAct Pattern

The agent follows a three-phase process:

1. **Reason**: Analyzes input and determines the best action
2. **Act**: Executes the chosen action (respond, query, use tool)
3. **Reflect**: Evaluates the outcome and learns for future iterations

This cycle repeats up to `maxIterations` times to complete complex tasks.

## Integration with MEW Spaces

### In space.yaml

```yaml
participants:
  coder:
    type: local
    command: "node"
    args: ["/path/to/mew-agent/src/index.js", "--config", "/path/to/mew-agent/config/coder.yaml"]
    auto_start: true
    tokens:
      - coder-token
    capabilities:
      - kind: "chat"
      - kind: "mcp/request"
      - kind: "mcp/response"
```

## Development

### Project Structure

```
mew-agent/
├── src/
│   ├── index.js        # Main entry point
│   └── react-agent.js  # ReAct implementation
├── config/             # Pre-configured personas
│   ├── coder.yaml
│   ├── note-taker.yaml
│   └── philosopher.yaml
├── bin/
│   └── mew-agent.js    # CLI executable
└── package.json
```

### Creating Custom Personas

1. Create a new YAML configuration in `config/`
2. Define the system prompt for your agent's role
3. Customize the reasoning and reflection prompts
4. Specify available tools and capabilities
5. Set behavioral parameters (greeting, max iterations, etc.)

## Examples

### Simple Chatbot

```yaml
name: chatbot
systemPrompt: "You are a friendly chatbot"
greeting: "Hi there! Let's chat!"
maxIterations: 3
```

### Technical Assistant

```yaml
name: tech-support
systemPrompt: |
  You are a technical support specialist.
  You help users troubleshoot issues.
  You ask clarifying questions when needed.
prompts:
  reason: |
    Analyze the technical issue:
    Problem: {input}
    Determine if more information is needed or provide a solution.
tools:
  - diagnostic/run
  - knowledge/search
```

## Future Enhancements

- [ ] LLM integration for actual reasoning
- [ ] Tool execution with MCP servers
- [ ] Memory persistence across sessions
- [ ] Multi-agent collaboration
- [ ] Learning from interactions