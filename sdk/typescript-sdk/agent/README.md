# @mcpx-protocol/agent

Agent layer for MCPx - provides MCP server/client abstractions for building agents.

## Installation

```bash
npm install @mcpx-protocol/agent
```

## Usage

```typescript
import { MCPxAgent, Tool, ToolExecutionContext, ToolExecutionResult } from '@mcpx-protocol/agent';

class MyAgent extends MCPxAgent {
  async onStart() {
    console.log('Agent started');
  }

  async onStop() {
    console.log('Agent stopped');
  }

  // Expose tools (MCP server)
  async listTools(): Promise<Tool[]> {
    return [{
      name: 'calculate',
      description: 'Perform calculations',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        }
      }
    }];
  }

  async executeTool(name: string, params: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    if (name === 'calculate') {
      // Implement tool logic
      return {
        content: [{
          type: 'text',
          text: `Result: ${eval(params.expression)}`
        }]
      };
    }
    throw new Error(`Tool ${name} not found`);
  }

  // Handle chat messages
  protected onChatMessage(text: string, from: string) {
    console.log(`${from}: ${text}`);
    // Respond to chat
    this.sendChat(`Hello ${from}!`);
  }
}

// Create and start agent
const agent = new MyAgent(
  { name: 'MyAgent', version: '1.0.0' },
  { gateway: 'ws://localhost:8080', topic: 'my-topic', token: 'my-token' }
);

await agent.start();

// Call another peer's tool (MCP client)
const result = await agent.callTool('other-agent', 'their-tool', { param: 'value' });

// Stop agent
await agent.stop();
```

## Features

- Abstract base class for building MCPx agents
- MCP server functionality (expose tools, resources, prompts)
- MCP client functionality (call peer tools)
- Automatic MCP handshake management
- Context storage for task state
- Agent status management (idle/busy/error)
- Progress notifications and cancellation support
- TypeScript support with full type definitions

## API

See the [TypeScript definitions](src/types.ts) for complete API documentation.

## License

MIT