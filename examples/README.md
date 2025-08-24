# MCPx Examples

This directory contains example agents demonstrating the MCPx multi-agent coordination protocol.

## 📚 Complete Tutorial

**New to MCPx?** Start with the [TUTORIAL.md](../TUTORIAL.md) in the root directory for a comprehensive step-by-step guide through all these examples.

## 📁 Directory Structure

### Example Agents

Each subdirectory contains a complete example agent with its own README:

| Directory | Description | Key Features |
|-----------|-------------|--------------|
| **echo-bot/** | Simple message echo agent | Basic connectivity, message handling |
| **calculator-agent/** | Mathematical operations agent | MCP tool exposure, arithmetic functions |
| **coordinator-agent/** | Multi-agent orchestration example | Agent discovery, tool calling, workflow coordination |
| **documents-agent/** | Filesystem bridge using MCP server | Bridges `@modelcontextprotocol/server-filesystem`, file operations |
| **openai-agent/** | AI-powered assistant agent | Natural language understanding, tool orchestration |
| **chat-agent/** | Basic chat participant | Simple MCPx client implementation |

### Running the Examples

All examples can be run from the root `mcpx-protocol` directory:

```bash
# Start the gateway (required)
npm run dev:gateway

# Start individual agents
npm run example:echo
npm run example:calculator
npm run example:coordinator
npm run example:documents
npm run example:openai      # Requires OpenAI API key

# Or start multiple agents at once
npm run example:all

# Connect with the CLI
npm run cli:test
```

## 🏗️ Architecture

Each example follows a similar structure:

```
example-name/
├── README.md           # Agent-specific documentation
├── package.json        # Dependencies and scripts
├── src/
│   └── index.ts       # Agent implementation
└── tsconfig.json      # TypeScript configuration
```

### Special Cases

- **documents-agent**: Includes a `documents/` folder with sample files and uses the MCPx Bridge to expose filesystem operations
- **openai-agent**: Requires `.env` file with OpenAI API key (see its README for setup)

## 🔧 Building Your Own Agent

To create a new agent:

1. Copy one of the existing examples as a template
2. Modify the agent name and capabilities in `src/index.ts`
3. Update `package.json` with your agent details
4. Add any specific MCP tools your agent needs
5. Add an npm script to the root `package.json`:
   ```json
   "example:your-agent": "cd examples/your-agent && npm start"
   ```

## 📖 Learning Path

1. **Start Simple**: Begin with `echo-bot` to understand basic connectivity
2. **Add Tools**: Explore `calculator-agent` for MCP tool implementation
3. **Coordinate**: See `coordinator-agent` for multi-agent workflows
4. **Bridge Services**: Study `documents-agent` for integrating external MCP servers
5. **Go Advanced**: Examine `openai-agent` for AI-powered orchestration

## 🚀 Quick Test

Want to see everything in action quickly?

```bash
# Terminal 1
npm run dev:gateway

# Terminal 2
npm run example:all

# Terminal 3
npm run cli:test

# In the CLI, try:
/list                                          # See all connected agents
/tools calculator-agent                        # View available tools
/call calculator-agent add {"a": 5, "b": 3}   # Use a tool
calculate 10 * 20                              # Trigger coordinator
```

## 📚 Further Reading

- [TUTORIAL.md](../TUTORIAL.md) - Complete step-by-step guide
- [MCPx Protocol Specification](../protocol-spec/v0/SPEC.md)
- [Implementation Patterns](../protocol-spec/v0/PATTERNS.md)
- [Bridge Documentation](../packages/bridge/README.md)

## 🤝 Contributing

When adding a new example:
1. Follow the existing directory structure
2. Include a comprehensive README
3. Add appropriate npm scripts
4. Update this README with your example
5. Consider adding it to the TUTORIAL if it demonstrates new concepts