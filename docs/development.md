# Development Guide

This guide covers setting up the MEW Protocol development environment, building the project, and common development workflows.

## Prerequisites

- **Node.js**: v18.0.0 or higher (required)
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For cloning the repository

## Project Structure

MEW Protocol is a single-package repository with the following structure:

```
mew-protocol/
├── src/                    # Source code
│   ├── cli/               # Command-line interface
│   ├── gateway/           # Gateway server
│   ├── client/            # WebSocket client
│   ├── participant/       # MCP participant base class
│   ├── agent/             # Autonomous agent implementation
│   ├── bridge/            # MCP-MEW Protocol bridge
│   ├── capability-matcher/# Capability pattern matching
│   ├── mcp-servers/       # Built-in MCP servers (cat-maze, filesystem)
│   └── types/             # TypeScript type definitions
├── dist/                   # Compiled JavaScript output
├── templates/              # Space templates (cat-maze, coder-agent, note-taker)
├── e2e/                    # End-to-end test scenarios
├── spec/                   # Protocol specifications
└── docs/                   # Documentation
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/rjcorwin/mew-protocol.git
cd mew-protocol
```

### 2. Install Dependencies and Build

```bash
# Install all dependencies
npm install

# Build the project
npm run build
```

The build process compiles TypeScript to JavaScript and creates the `dist/` directory.

### 3. Link Globally for Development

For local development, link the CLI globally so you can use the `mew` command:

```bash
npm link
```

Verify the installation:

```bash
which mew
mew --version
```

## Development Workflow

### Building the Project

```bash
# Full build
npm run build

# Clean build artifacts
npm run clean

# Watch mode for development (rebuild on file changes)
npm run build:watch
```

### Running Tests

```bash
# Run all end-to-end test scenarios
./e2e/run-all-tests.sh

# Run a specific test scenario
cd e2e/scenario-1-basic
./setup.sh      # Create test workspace
./check.sh      # Run tests
./teardown.sh   # Clean up
```

### Code Quality

```bash
# Run ESLint
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format
```

### Using the CLI During Development

After running `npm link`, use the global `mew` command which will use your local build:

```bash
# Create a test space
mkdir my-test-space
cd my-test-space
mew init coder-agent

# Start the space
mew space up

# Connect as human
mew space connect

# Stop the space
mew space down
```

**Important**: Always rebuild after code changes:
```bash
npm run build
```

The global `mew` command will immediately use the updated code after rebuilding.

### Exercising the CLI Control Plane

The CLI exposes an automated control plane that mirrors the interactive Ink UI over HTTP. After starting a space with `--control-port`, you can drive the interface programmatically and capture terminal snapshots. A minimal workflow:

```bash
# Launch an interactive session with the control plane listening on port 7777
mew space up --space-dir /tmp/control-plane-demo --port 18080 --interactive --control-port 7777

# Check health and read the current screen with preserved line breaks
curl -s http://localhost:7777/control/health | jq
curl -s http://localhost:7777/control/screen | jq -r '.mode, .plain'

# Inject /help and press enter via the control server
curl -s -X POST http://localhost:7777/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"text":"/help"}'
curl -s -X POST http://localhost:7777/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"key":"enter"}'
```

Calling `/control/screen` again shows the live help overlay exactly as it appears in the terminal, and `/control/state` records the corresponding `system/help` payload. Refer to `CONTROL_PLANE_USAGE.md` for a complete set of scenarios, including history replay and scripted chat messages.

### Verifying CLI UI Changes

When developing CLI UI features, you may need to verify the output programmatically, especially when working with only one terminal or as a coding agent. Here are two approaches:

#### Option 1: Using Screen Utility (No Control Plane Required)

The `screen` utility can run MEW in a detached session and capture its output:

```bash
# IMPORTANT: Must run from an initialized space directory (contains space.yaml)
cd spaces/my-test
screen -dmS verify-ui bash -c "mew space up --interactive"

# Wait for space to initialize
sleep 6

# Capture the screen buffer (includes scrollback)
screen -S verify-ui -X hardcopy ./tmp/screen-output.txt

# View the captured output
cat ./tmp/screen-output.txt

# Send input to the session
screen -S verify-ui -X stuff "hello\n"

# Capture again to see the result
screen -S verify-ui -X hardcopy ./tmp/screen-output2.txt

# Clean up
screen -S verify-ui -X quit
mew space down
```

**Benefits:**
- No additional ports or HTTP setup needed
- Captures the complete terminal buffer including scrollback
- Can inject input with `screen -X stuff`
- Works with only one terminal available

**Limitations:**
- macOS ships with screen v4.0.3 (2006) which has a hardcopy bug requiring manual attach
- To fix: `brew install screen` (installs v5.0+), then restart your shell to update PATH
- Verify with `screen -v` - should show v5.0.1 or higher for automated capture

#### Option 2: Using Control Plane (Recommended for Automation)

The control plane provides more structured access to the UI state:

```bash
# Start with control plane enabled
mew space up --interactive --control-port 9999

# In another terminal or automated script:

# Get current screen snapshot
curl -s http://localhost:9999/control/screen | jq -r '.plain'

# Get structured message state
curl -s http://localhost:9999/control/state | jq '.messages'

# Send input programmatically
curl -s -X POST http://localhost:9999/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"text":"hello"}' && \
curl -s -X POST http://localhost:9999/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"key":"enter"}'

# Verify the result
curl -s http://localhost:9999/control/screen | jq -r '.plain'
```

**Benefits:**
- Structured JSON output
- Real-time state access via HTTP
- Better for automated testing and CI/CD
- Can query specific message fields

**Use Cases:**
- **Screen**: Quick verification when you only have one terminal (coding agents: ensure screen v5.0+)
- **Control Plane**: Automated testing, CI/CD pipelines (provides structured JSON output)

## Common Development Tasks

### Creating a New Space Template

1. Create template directory:
```bash
mkdir templates/my-template
```

2. Add template files (see existing templates for reference):
   - `space.yaml` - Participant configuration
   - `README.md` - Template documentation
   - Any template-specific agents or scripts

3. Test your template:
```bash
mkdir test-my-template
cd test-my-template
mew init my-template
mew space up
```

### Adding a New MCP Server

1. Create server file in `src/mcp-servers/`:
```typescript
// src/mcp-servers/my-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export function createMyServer() {
  const server = new Server(
    {
      name: 'my-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'my-tool',
        description: 'Does something useful',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ]
  }));

  // Add tool execution handlers...

  return server;
}
```

2. Register in `src/cli/commands/mcp.ts`:
```typescript
case 'my-server':
  return createMyServer();
```

3. Test your MCP server:
```bash
npm run build
mew mcp my-server
```

### Modifying the Gateway

The gateway source is in `src/gateway/`:
- `gateway.ts` - Main gateway implementation
- `capability-manager.ts` - Capability enforcement
- `envelope-logger.ts` - Envelope history logging

After modifying gateway code:
```bash
npm run build
# Test with a space
cd test-space
mew space up
```

### Working with Types

Core protocol types are in `src/types/protocol.ts`. When modifying types:

1. Update the type definitions
2. Rebuild: `npm run build`
3. Check for TypeScript errors in dependent code
4. Update tests if needed

## Quick Testing Guide

### Create and Test a Space

```bash
# Create test space
mkdir test-feature
cd test-feature

# Initialize with template
mew init coder-agent

# Start space
mew space up
```

### Send Test Messages

Get the human token:
```bash
cat .mew/tokens/human.token
```

Send a message via HTTP API:
```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=test-feature' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "test-1",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "Hello",
      "format": "plain"
    }
  }'
```

### Monitor Logs

```bash
# View PM2 process list
pm2 list

# View logs (non-blocking)
pm2 logs --nostream --lines 50

# View specific participant logs
pm2 logs test-feature-gateway --nostream
pm2 logs test-feature-mew --nostream

# View envelope history (protocol-level)
tail -f .mew/logs/envelope-history.jsonl

# View participant logs (application-level)
tail -f logs/gateway.log
tail -f logs/mew.log
```

### Clean Up

```bash
mew space down
pm2 list  # Verify processes stopped
```

## Debugging

### Enable Debug Logging

Use the `DEBUG` environment variable:

```bash
# All MEW debug output
DEBUG=mew:* mew space up

# Specific subsystems
DEBUG=mew:gateway mew space up
DEBUG=mew:client mew space connect
```

### Common Issues

**Build Errors After Pulling Changes:**
```bash
npm run clean
npm install
npm run build
```

**Global `mew` Command Not Found:**
```bash
npm link
which mew  # Should show path
```

**PM2 Processes Won't Start:**
```bash
# Check PM2 status
pm2 list

# View PM2 logs
pm2 logs --nostream

# Kill all PM2 processes and restart
pm2 kill
mew space up
```

**WebSocket Connection Issues:**
- Ensure gateway is running: `pm2 list | grep gateway`
- Check port isn't already in use: `lsof -i :8080`
- Verify WebSocket URL in logs

## Development Best Practices

### 1. Read Existing Patterns First
Before implementing a feature, review existing code for similar patterns:
- Check `src/agent/` for agent patterns
- Check `e2e/scenario-*/` for test examples
- Check `spec/` for protocol requirements

### 2. Update Types First
When adding protocol features:
1. Update `src/types/protocol.ts`
2. Rebuild: `npm run build`
3. Implement in relevant components
4. Add tests

### 3. Test Locally
Always test changes before committing:
```bash
npm run build
npm run lint
./e2e/run-all-tests.sh
```

### 4. Use Watch Mode
For rapid iteration:
```bash
# Terminal 1: Watch and rebuild
npm run build:watch

# Terminal 2: Test your changes
cd test-space
mew space up
```

### 5. Check Envelope Logs
The envelope history is your best debugging tool:
```bash
tail -f .mew/logs/envelope-history.jsonl | jq .
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests and linting:
   ```bash
   npm run build
   npm run lint
   ./e2e/run-all-tests.sh
   ```
5. Commit your changes
6. Push to your fork
7. Submit a pull request

### Code Style

- Use Prettier for formatting: `npm run format`
- Run ESLint: `npm run lint`
- Fix linting issues: `npm run lint:fix`
- Follow existing code patterns

## Additional Resources

- [MEW Protocol Specification](../spec/protocol/v0.4/SPEC.md)
- [Testing Guide](testing.md)
- [Templates Guide](templates.md)
- [End-to-End Test Scenarios](../e2e/README.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

## Getting Help

- Check existing issues: https://github.com/rjcorwin/mew-protocol/issues
- Review test scenarios for examples: `e2e/scenario-*/`
- Read the protocol specification: `spec/protocol/v0.4/SPEC.md`

## Important Notes

- **Don't modify `dist/` directly** - It's generated from TypeScript source
- **Don't use global `mew` from npm** during development - Use `npm link` for local version
- **Always rebuild after changes**: `npm run build`
- **Follow TypeScript strict mode** - The project uses strict type checking
- **Update specs when changing protocol** - Keep documentation in sync with code
