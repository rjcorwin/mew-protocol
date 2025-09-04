# @meup/agent

TypeScript Agent SDK for MEUP (Multi-Entity Unified-context Protocol) v0.2.

Build intelligent agents that participate in MEUP spaces with built-in support for:
- Capability-based access control
- Proposal-execute pattern for untrusted agents
- MCP tool/resource serving and consumption
- Context management with sub-contexts
- Progressive automation through learning

## Installation

```bash
npm install @meup/agent
```

## Quick Start

```typescript
import { MEUPAgent, AgentConfig } from '@meup/agent';

// Create a trusted agent
class MyAgent extends MEUPAgent {
  async onStart() {
    console.log('Agent started!');
    
    // Announce presence
    await this.sendChat('Hello! I am ready to help.');
  }
  
  async onStop() {
    console.log('Agent stopping...');
  }
  
  // Provide tools to other participants
  protected async getTools() {
    return [
      {
        name: 'calculate',
        description: 'Perform calculations',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          },
          required: ['expression']
        }
      }
    ];
  }
}

// Configure and start agent
const agent = new MyAgent(
  {
    gateway: 'wss://gateway.example.com',
    space: 'my-space',
    token: 'auth-token'
  },
  {
    name: 'calculator-agent',
    version: '1.0.0',
    role: 'trusted',
    capabilities: [
      {
        id: 'tools-execute',
        kind: 'mcp/request',
        payload: { method: 'tools/*' }
      }
    ]
  }
);

await agent.start();
```

## Agent Roles

### Trusted Agent
Has full capabilities and can execute operations directly:

```typescript
const config: AgentConfig = {
  name: 'trusted-agent',
  version: '1.0.0',
  role: 'trusted',
  capabilities: [
    { id: 'all', kind: '*' }
  ]
};
```

### Untrusted Agent
Must use proposals for operations it lacks capabilities for:

```typescript
const config: AgentConfig = {
  name: 'untrusted-agent',
  version: '1.0.0',
  role: 'untrusted',
  capabilities: [
    { id: 'chat', kind: 'chat' }
  ]
};

// In the agent, requests automatically become proposals
class UntrustedAgent extends MEUPAgent {
  async performAction() {
    // This will create a proposal since we're untrusted
    const result = await this.callTool('coordinator', 'search', {
      query: 'MEUP protocol'
    });
  }
}
```

### Coordinator Agent
Reviews and executes proposals from untrusted agents:

```typescript
const config: AgentConfig = {
  name: 'coordinator',
  version: '1.0.0',
  role: 'coordinator',
  autoAcceptProposals: false,
  proposalFilter: (proposal) => {
    // Custom logic to review proposals
    return proposal.capability !== 'dangerous-operation';
  }
};

// With custom proposal handler
const handlers = {
  onProposal: async (proposal, from) => {
    console.log(`Reviewing proposal from ${from}`);
    
    // Analyze the proposal
    if (isSafe(proposal)) {
      return { accept: true };
    } else {
      return { 
        accept: false, 
        reason: 'Operation not permitted' 
      };
    }
  }
};
```

## Providing MCP Services

Agents can serve tools, resources, and prompts to other participants:

```typescript
class ServiceAgent extends MEUPAgent {
  protected async getServerCapabilities() {
    return {
      tools: { list: true },
      resources: { list: true, subscribe: true },
      prompts: { list: true }
    };
  }
  
  protected async getTools() {
    return [
      {
        name: 'web_search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        }
      }
    ];
  }
  
  protected async getResources() {
    return [
      {
        uri: 'file:///data/knowledge.txt',
        name: 'Knowledge Base',
        mimeType: 'text/plain'
      }
    ];
  }
}

// Handle tool calls
const handlers = {
  onToolCall: async (context) => {
    if (context.tool === 'web_search') {
      const results = await searchWeb(context.params.query);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results)
        }]
      };
    }
    throw new Error('Unknown tool');
  },
  
  onResourceRequest: async (uri, from) => {
    if (uri === 'file:///data/knowledge.txt') {
      return {
        type: 'text',
        text: await readKnowledgeBase()
      };
    }
    throw new Error('Resource not found');
  }
};
```

## Context Management

Manage conversation scope with sub-contexts:

```typescript
class ContextAwareAgent extends MEUPAgent {
  async performComplexTask() {
    // Start a sub-context for a specific task
    await this.client.pushContext('research-task');
    
    await this.sendChat('Starting research on the topic...');
    const results = await this.callTool('search-agent', 'search', {
      query: 'MEUP applications'
    });
    
    await this.sendChat('Research complete. Here are the findings...');
    
    // Return to main context
    await this.client.popContext();
  }
}

// Handle context changes
const handlers = {
  onContextPush: async (topic, correlationId) => {
    console.log(`Entering context: ${topic}`);
    // Adjust agent behavior for new context
  },
  
  onContextPop: async (correlationId) => {
    console.log('Returning to parent context');
    // Restore previous behavior
  },
  
  onContextResume: async (correlationId, topic) => {
    console.log(`Resuming context: ${topic || correlationId}`);
    // Resume previous context state
  }
};
```

## Event Handlers

Configure custom handlers for various events:

```typescript
const handlers: AgentEventHandlers = {
  // Review proposals (for trusted/coordinator agents)
  onProposal: async (proposal, from) => {
    // Analyze and decide
    return { accept: true };
  },
  
  // Handle tool calls from other participants
  onToolCall: async (context) => {
    const { tool, params, from, requestId } = context;
    // Execute tool and return result
    return {
      content: [{ type: 'text', text: 'Result' }]
    };
  },
  
  // Handle resource requests
  onResourceRequest: async (uri, from) => {
    // Return resource content
    return { type: 'text', text: 'Resource data' };
  },
  
  // Handle prompt requests
  onPromptRequest: async (name, args, from) => {
    // Generate and return prompt
    return 'Generated prompt text';
  },
  
  // Context management
  onContextPush: async (topic, correlationId) => {
    // Handle context push
  },
  
  onContextPop: async (correlationId) => {
    // Handle context pop
  },
  
  onContextResume: async (correlationId, topic) => {
    // Handle context resume
  }
};

const agent = new MyAgent(connectionOptions, config, handlers);
```

## Helper Methods

The base MEUPAgent class provides many helper methods:

```typescript
class MyAgent extends MEUPAgent {
  async doWork() {
    // Send chat messages
    await this.sendChat('Working on the task...');
    
    // Make MCP requests (proposals if untrusted)
    const tools = await this.request('tools/list', undefined, 'other-agent');
    
    // Call specific tools
    const result = await this.callTool('search-agent', 'search', {
      query: 'example'
    });
    
    // Read resources
    const data = await this.readResource('data-agent', 'file:///data.json');
    
    // Get agent status
    const status = this.getStatus();
    
    // Set agent status
    this.setStatus('busy');
    
    // Get context stack
    const contexts = this.getContextStack();
    
    // Get participant states
    const participants = this.getParticipantStates();
  }
}
```

## Complete Example

Here's a complete example of a research assistant agent:

```typescript
import { MEUPAgent, AgentConfig, AgentEventHandlers } from '@meup/agent';

class ResearchAssistant extends MEUPAgent {
  private knowledgeBase: Map<string, string> = new Map();
  
  async onStart() {
    await this.sendChat('Research assistant ready! I can help you search and analyze information.');
  }
  
  async onStop() {
    await this.sendChat('Research assistant signing off.');
  }
  
  protected async getTools() {
    return [
      {
        name: 'analyze',
        description: 'Analyze a piece of text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      },
      {
        name: 'summarize',
        description: 'Summarize research findings',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string' }
          },
          required: ['topic']
        }
      }
    ];
  }
  
  protected handleChatMessage(message: ChatPayload, from: string) {
    // Respond to questions in chat
    if (message.text.includes('help')) {
      this.sendChat('I can help you research topics. Just ask me to analyze or summarize!');
    }
  }
}

// Configure handlers
const handlers: AgentEventHandlers = {
  onToolCall: async (context) => {
    switch (context.tool) {
      case 'analyze':
        // Perform analysis
        return {
          content: [{
            type: 'text',
            text: `Analysis of: ${context.params.text.substring(0, 50)}...`
          }]
        };
        
      case 'summarize':
        // Generate summary
        return {
          content: [{
            type: 'text',
            text: `Summary for topic: ${context.params.topic}`
          }]
        };
        
      default:
        throw new Error(`Unknown tool: ${context.tool}`);
    }
  }
};

// Create and start agent
const agent = new ResearchAssistant(
  {
    gateway: 'wss://gateway.example.com',
    space: 'research-space',
    token: process.env.AUTH_TOKEN!
  },
  {
    name: 'research-assistant',
    version: '1.0.0',
    description: 'AI research assistant',
    role: 'trusted',
    capabilities: [
      { id: 'all', kind: '*' }
    ]
  },
  handlers
);

await agent.start();
```

## Protocol Version

This SDK implements MEUP v0.2. See the [specification](https://github.com/rjcorwin/mcpx-protocol/blob/main/spec/v0.2/SPEC.md) for protocol details.

## License

MIT