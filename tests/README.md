# MEUP Protocol Tests

This directory contains the test suite for the MEUP (Multiplexed Extensible Unified Protocol) v0.2 implementation.

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
- `space.yaml` - Space configuration
- `test.sh` - Main test script
- `setup.sh` - Test setup
- `check.sh` - Result verification
- `teardown.sh` - Cleanup
- `run-test.sh` - Wrapper with timeout handling (if needed)

### Available Scenarios

- **scenario-0-manual** - Manual debugging environment
- **scenario-1-basic** - Basic message flow between agents
- **scenario-2-mcp** - MCP tool execution and responses
- **scenario-3-proposals** - Proposal system with capability blocking
- **scenario-4-capabilities** - Dynamic capability granting
- **scenario-5-reasoning** - Reasoning with context field
- **scenario-6-errors** - Error recovery and edge cases
- **scenario-7-mcp-bridge** - MCP server integration via bridge

## Test Agents

The `/agents/` directory contains reusable test agents used across scenarios:
- `calculator.js` - Simple calculator agent for MCP testing
- `fulfiller.js` - Agent that fulfills proposals
- `proposer.js` - Agent that creates proposals
- `requester.js` - Agent that makes various requests

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
3. Use scenario-0-manual for interactive debugging

## Architecture

Tests use PM2 for process management and the MEUP CLI to start spaces. Each test:
1. Sets up a space with a gateway and participants
2. Runs test agents that interact via MEUP messages
3. Verifies expected outcomes
4. Cleans up all processes and artifacts

For protocol details, see the main MEUP documentation.