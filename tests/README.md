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
- `space.yaml` - Space configuration defining participants, capabilities, and tokens
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
- **scenario-3-proposals** - Proposal system with capability blocking
- **scenario-4-capabilities** - Dynamic capability granting
- **scenario-5-reasoning** - Reasoning with context field
- **scenario-6-errors** - Error recovery and edge cases
- **scenario-7-mcp-bridge** - MCP server integration via bridge
- **scenario-8-grant** - Capability grant workflow (proposal → grant → direct request)

## Test Agents

The `/agents/` directory contains reusable test agents used across scenarios:
- `calculator-participant.js` - Simple calculator agent for MCP testing using MEWParticipant
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
3. Use `./setup.sh` in any scenario for interactive debugging

## Architecture

Tests use PM2 for process management and the MEW CLI to start spaces. Each test:
1. Sets up a space with a gateway and participants
2. Runs test agents that interact via MEW messages
3. Verifies expected outcomes
4. Cleans up all processes and artifacts

For protocol details, see the main MEUP documentation.