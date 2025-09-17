# Development Guide

This guide covers setting up the MEW Protocol development environment, building the project, and running tests.

## Prerequisites

- **Node.js**: v18.0.0 or higher (required)
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For cloning the repository

## Project Structure

MEW Protocol is a monorepo using npm workspaces. The main packages are:

```
mew-protocol/
├── sdk/typescript-sdk/     # Core SDK packages
│   ├── types/             # TypeScript type definitions
│   ├── capability-matcher/ # Capability pattern matching
│   ├── client/            # WebSocket client
│   ├── participant/       # MCP participant base class
│   ├── agent/             # Autonomous agent implementation
│   └── gateway/           # Gateway server
├── bridge/                # MCP-MEW Protocol bridge
├── cli/                   # Command-line interface
├── tests/                 # Test scenarios
└── spaces/                # Example spaces
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/rjcorwin/mew-protocol.git
cd mew-protocol
```

### 2. Install Dependencies and Build

The project uses npm workspaces, so a single install command handles all packages. However, due to the build dependencies between packages, you need to build them in a specific order on first setup:

```bash
# Install all dependencies
npm install

# Build TypeScript packages in dependency order
npm run build:sdk
```

If `npm install` fails on first run (which can happen due to workspace interdependencies), run this setup script:

```bash
# Alternative: Manual build sequence
cd sdk/typescript-sdk/types && npm install && npm run build && cd ../../..
cd sdk/typescript-sdk/capability-matcher && npm install && npm run build && cd ../../..
cd sdk/typescript-sdk/client && npm install && npm run build && cd ../../..
cd sdk/typescript-sdk/participant && npm install && npm run build && cd ../../..
cd sdk/typescript-sdk/agent && npm install && npm run build && cd ../../..
cd sdk/typescript-sdk/gateway && npm install && npm run build && cd ../../..
cd bridge && npm install && npm run build && cd ..
cd cli && npm install && cd ..

# Now run npm install from root to link everything
npm install
```

### 3. Verify Installation

```bash
# Check that the CLI is available
npx mew --version

# Run tests to verify everything works
npm test
```

## Development Workflow

### Building Packages

Most packages use either TypeScript compiler (`tsc`) or `tsup` for building:

```bash
# Build all packages
npm run build --workspaces

# Build a specific package
npm run build --workspace=@mew-protocol/participant

# Watch mode for development (where available)
npm run dev --workspace=@mew-protocol/gateway
```

### Running Tests

```bash
# Run all tests (without LLM)
npm test

# Run tests with LLM integration
npm run test:llm

# Run specific test scenario
cd tests/01-basic-connectivity && npm test
```

### Using the CLI

The CLI is the primary tool for development and testing:

```bash
# Start a development gateway
npx mew gateway

# Start an agent in FIFO mode (for testing)
npx mew agent fifo --space test

# Start a participant
npx mew participant --space test --token my-token
```

### Development Tips

1. **Use FIFO mode for testing**: When developing, use `npx mew agent fifo` to interact with agents via named pipes instead of requiring LLM API keys.

2. **Watch logs**: Enable debug logging with the `DEBUG` environment variable:
   ```bash
   DEBUG=mew:* npx mew gateway
   ```

3. **Test locally**: Always test changes locally before committing:
   ```bash
   npm test
   npm run lint --workspaces
   npm run typecheck --workspaces
   ```

## Common Development Tasks

### Adding a New Tool to an Agent

1. Create your tool in the agent or participant:
```javascript
participant.registerTool({
  name: 'my-tool',
  description: 'Does something useful',
  inputSchema: { /* JSON Schema */ },
  execute: async (args) => {
    // Tool implementation
    return result;
  }
});
```

### Creating a New Test Scenario

1. Copy an existing test directory:
```bash
cp -r tests/01-basic-connectivity tests/my-new-test
```

2. Update the test configuration and scripts
3. Add to the test suite in `tests/run-all-tests.sh`

### Working with the Bridge

The bridge connects MCP servers to MEW Protocol:

```bash
# Start a bridge to an MCP server
npx mew-bridge --gateway ws://localhost:8080 \
  --space test \
  --mcp-command "node" \
  --mcp-args "./my-mcp-server.js"
```

## Troubleshooting

### Build Errors on Fresh Clone

**Problem**: `npm install` fails with TypeScript compilation errors, particularly in the bridge package.

**Solution**: The packages need to be built in dependency order first:
```bash
# Build SDK packages first
cd sdk/typescript-sdk/types && npm run build && cd ../../..
cd sdk/typescript-sdk/capability-matcher && npm run build && cd ../../..
cd sdk/typescript-sdk/client && npm run build && cd ../../..
cd sdk/typescript-sdk/participant && npm run build && cd ../../..

# Then run npm install from root
npm install
```

### React Peer Dependency Warnings

**Problem**: Warnings about React peer dependencies when installing.

**Solution**: These warnings are from the `ink` package (used for CLI terminal UI) and can be safely ignored. They don't affect functionality.

### WebSocket Connection Issues

**Problem**: Clients can't connect to the gateway.

**Solution**:
- Ensure the gateway is running: `npx mew gateway`
- Check the port isn't already in use
- Verify the WebSocket URL (default: `ws://localhost:8080`)

### Missing Types

**Problem**: TypeScript complains about missing type declarations.

**Solution**: Ensure all packages are built:
```bash
npm run build --workspaces
```

## Package-Specific Notes

### TypeScript SDK Packages

- **types**: Core type definitions, built with `tsup`
- **client**: WebSocket client, built with `tsup`
- **participant**: MCP participant implementation, built with `tsc`
- **agent**: Autonomous agent, built with `tsc`
- **gateway**: Gateway server, built with `tsup`

### CLI Package

The CLI is written in JavaScript (not TypeScript) and doesn't require a build step. It uses:
- `commander` for command parsing
- `ink` and `react` for terminal UI
- `ws` for WebSocket connections

### Bridge Package

Bridges MCP servers to MEW Protocol. Requires the participant package to be built first.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Style

- Use Prettier for formatting: `npm run format --workspaces`
- Run ESLint: `npm run lint --workspaces`
- Check types: `npm run typecheck --workspaces`

## Additional Resources

- [MEW Protocol Specification](spec/v0.3/SPEC.md)
- [TypeScript SDK Documentation](sdk/typescript-sdk/README.md)
- [Test Scenarios](tests/README.md)
- [Architecture Decision Records](decisions/)

## Getting Help

- Check existing issues: https://github.com/rjcorwin/mew-protocol/issues
- Read the documentation in each package's README
- Review test scenarios for examples
