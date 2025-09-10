# Built-in Test Agents

These agents are built into the CLI for testing and development. They can be launched with:

```bash
mew agent start --type <agent-type>
```

## Available Agents

### echo

Simple agent that echoes chat messages.

- Responds to: `chat` messages
- Returns: "Echo: " + original message

### calculator

Provides MCP tools for basic math operations.

- Tools: add, subtract, multiply, divide, evaluate
- Responds to: `mcp/request` with `method: "tools/*"`

### fulfiller

Automatically fulfills any proposal it observes.

- Watches: `mcp/proposal` messages
- Action: Sends corresponding `mcp/request` with correlation_id

## Implementation

These agents are implemented using the `@mew/agent` SDK and are embedded in the CLI package. They demonstrate proper MEW protocol implementation and serve as:

1. **Test fixtures** - For integration testing
2. **Examples** - Showing how to build agents
3. **Development tools** - For debugging protocol interactions

## Custom Agents

Users can also provide custom agent handlers:

```bash
mew agent start --type custom --handler ./my-agent.js
```

The handler file should export:

```javascript
module.exports = {
  async onMessage(envelope, context) {
    // Handle incoming message
    // Use context.send() to send responses
  },
};
```
