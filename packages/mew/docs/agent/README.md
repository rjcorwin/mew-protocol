# MEW Protocol TypeScript Agent

A TypeScript implementation of a MEW Protocol agent that extends `MEWParticipant` from the SDK.

## Features

- Extends `MEWParticipant` class for full protocol support
- ReAct (Reasoning + Acting) loop implementation
- Transparent thinking/reasoning messages
- Built-in tool support (time, echo, calculator)
- MCP request/response handling
- Proposal fulfillment capabilities
- Configuration via YAML/JSON files
- Environment variable support

## Installation

```bash
cd sdk/typescript-sdk/agent
npm install
npm run build
```

## Usage

### Basic Usage

```bash
# Run with defaults
npm start

# Or use the binary directly
node dist/index.js
```

### Command Line Options

```bash
node dist/index.js [options]

Options:
  -g, --gateway <url>     Gateway WebSocket URL (default: ws://localhost:8080)
  -s, --space <name>      Space name to join (default: playground)
  -t, --token <token>     Authentication token (default: agent-token)
  -i, --id <id>          Participant ID (default: typescript-agent)
  -c, --config <file>    Configuration file (YAML or JSON)
  -d, --debug            Enable debug logging
  -h, --help            Show help message
```

### Configuration File

Create a configuration file based on `config.example.yaml`:

```yaml
participant_id: my-assistant
name: My Assistant

gateway: ws://localhost:8080
space: dev
token: my-token

systemPrompt: |
  You are a helpful assistant that can...

thinkingEnabled: true
autoRespond: true
maxIterations: 5
logLevel: info
```

Then run:

```bash
node dist/index.js --config my-config.yaml
```

### Environment Variables

```bash
export MEW_GATEWAY=ws://localhost:8080
export MEW_SPACE=production
export MEW_TOKEN=secret-token
export MEW_PARTICIPANT_ID=prod-agent

npm start
```

## Architecture

The agent is built on top of the MEW Protocol SDK:

```typescript
import { MEWParticipant } from '@mew-protocol/mew/participant';

export class MEWAgent extends MEWParticipant {
  // Custom agent logic
}
```

### Key Components

1. **MEWAgent Class**: Extends `MEWParticipant` with agent-specific behavior
2. **ReAct Loop**: Implements thinking and acting cycles
3. **Tool Registry**: Manages available tools
4. **Message Handlers**: Process different message types
5. **Reasoning Support**: Transparent thinking messages

### Message Flow

1. Agent receives message (chat, MCP request, proposal)
2. Starts reasoning sequence (if enabled)
3. Runs ReAct loop to determine response
4. Executes actions (tools, fulfillments)
5. Sends response back

## Development

### Building

```bash
npm run build       # Build once
npm run dev        # Watch mode
```

### Adding Custom Tools

```typescript
const customTool: Tool = {
  name: 'my_tool',
  description: 'Does something useful',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string' }
    }
  },
  handler: async (input) => {
    // Tool implementation
    return {
      content: [{
        type: 'text',
        text: `Result: ${input.param}`
      }]
    };
  }
};

agent.addTool(customTool);
```

### Extending the Agent

```typescript
import { MEWAgent } from './MEWAgent';

class MyCustomAgent extends MEWAgent {
  protected async think(input: string, previousThoughts: ThoughtStep[]): Promise<ThoughtStep> {
    // Custom thinking logic
    // Could integrate with LLMs here
  }
  
  protected async act(action: string, input: any): Promise<string> {
    // Custom action execution
  }
}
```

## Example Sessions

### Basic Chat

```
User: Hello agent!
Agent: [thinking] Understanding greeting...
Agent: Hello! I am an AI assistant ready to help. What can I do for you?
```

### Tool Execution

```
User: What time is it?
Agent: [thinking] User wants to know the time...
Agent: [executes get_time tool]
Agent: The current time is 2025-09-11T10:30:00Z
```

### Proposal Handling

```
Untrusted Agent: [proposes] Write to important.txt
TypeScript Agent: [evaluates safety]
TypeScript Agent: [fulfills if safe]
```

## Integration with LLMs

The agent is designed to integrate with LLMs. Override the `think()` method:

```typescript
protected async think(input: string, previousThoughts: ThoughtStep[]): Promise<ThoughtStep> {
  const response = await callLLM({
    model: this.config.model,
    messages: [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: input }
    ]
  });
  
  return parseThought(response);
}
```

## License

MIT