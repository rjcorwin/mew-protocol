# MEW Protocol Tests

This directory contains the test suite for the MEW (Multi-Entity Workspace) Protocol v0.3 implementation.

## Running Tests

### Run all tests
```bash
./run-all-tests.sh
```

### Run individual test scenarios
```bash
cd scenario-1-basic
./test.sh
```

## Test Scenarios

All test scenarios are located in this directory. Each scenario is self-contained with:

### Required Files
- `space.yaml` - Space configuration defining participants and capabilities
- `test.sh` - Main test orchestrator that runs setup → test logic → check → teardown

### Supporting Scripts  
- `setup.sh` - Sets up the test space (can run standalone for manual debugging)
- `check.sh` - Verifies test results/assertions
- `teardown.sh` - Cleans up test artifacts (can run standalone for manual cleanup)

### Usage Patterns

**Automated testing:**
```bash
./test.sh  # Runs complete test cycle
```

**Manual debugging:**
```bash
./setup.sh     # Set up space for manual testing
# ... manually interact with the space ...
./teardown.sh  # Clean up when done
```

### Available Scenarios

- **scenario-1-basic** - Basic message flow between agents
- **scenario-2-mcp** - MCP tool execution and responses
- **scenario-3-proposals** - Proposal system fulfilled via STDIO agents
- **scenario-4-capabilities** - Simulated capability grant/revoke signaling
- **scenario-5-reasoning** - Reasoning sequence with context preservation
- **scenario-6-errors** - Error handling and recovery behaviors
- **scenario-7-mcp-bridge** - MCP bridge simulation over STDIO
- **scenario-8-grant** - Capability grant workflow with CLI-managed adapters
- **scenario-8-typescript-agent** - STDIO TypeScript agent exercising MCP tools
- **scenario-9-typescript-proposals** - Proposal-only TypeScript agent fulfilled via STDIO driver
- **scenario-10-multi-agent** - Coordinator/worker/driver collaboration over STDIO
- **scenario-11-streams** - Streaming reasoning events delivered via framed STDIO
- **scenario-12-sdk-streams** - Batched data streaming between STDIO participants
- **scenario-8-grant** - Capability grant workflow (proposal → grant → direct request)

## Test Agents

The `/agents/` directory contains reusable STDIO agents used across scenarios:
- `calculator-participant.js` - FIFO/STDIO calculator that responds to MCP tool calls
- `basic-driver.js`, `mcp-driver.js`, `proposal-driver.js`, etc. - Scenario-specific drivers that validate behavior
- `fulfiller-participant.js` - STDIO fulfiller that reacts to proposals and forwards results
- `bridge-agent.js` - Stubbed MCP bridge responder for scenario 7

## Adding New Tests

1. Create a new directory: `scenario-N-description/`
2. Add required files:
   - `space.yaml` - Define participants and capabilities
   - `test.sh` - Main test logic
   - `setup.sh` - Create test prerequisites
   - `check.sh` - Verify test results
   - `teardown.sh` - Clean up test artifacts
3. Add the test to `run-all-tests.sh`

## Debugging

To debug a failing test:
1. Run the test individually to see output
2. Check logs in `scenario-*/logs/`
3. Use `./setup.sh` in any scenario for interactive debugging

## Architecture

Tests use the MEW CLI's STDIO transport to start the gateway and connect lightweight agents. Each test:
1. Sets up a space with FIFO-backed participants managed directly by the CLI
2. Runs test agents that communicate via framed STDIO messages
3. Verifies expected outcomes from agent log output
4. Cleans up all processes and artifacts

For protocol details, see the main MEUP documentation.
