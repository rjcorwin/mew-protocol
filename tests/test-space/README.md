# Test Space

This directory contains everything needed to run MEUP v0.2 tests:

## Contents

- `space.yaml` - Space configuration defining participants and capabilities
- `agents/` - Test agent implementations:
  - `echo.js` - Echoes chat messages
  - `calculator.js` - Provides MCP math tools
  - `fulfiller.js` - Auto-fulfills proposals

## Quick Start

To run tests, simply run from the tests directory:

```bash
# Run all tests
./run-all-tests.sh

# Or run individual test scenarios
./test-scenario1.sh  # Basic message flow
./test-scenario2.sh  # MCP tool execution
./test-scenario3.sh  # Proposals with capability blocking
./test-scenario4.sh  # Dynamic capability granting
./test-scenario5.sh  # Reasoning with context
./test-scenario6.sh  # Error recovery
```

Each test script will:
1. Create a temporary test directory
2. Copy this test-space content
3. Start the gateway with space.yaml
4. Run the test scenario
5. Clean up afterward

## Space Configuration

The `space.yaml` defines:
- **coordinator** - Admin with full capabilities (*)
- **limited-agent** - Minimal capabilities (chat only)
- **calculator-agent** - MCP tools provider
- **echo-agent** - Chat echo bot
- **fulfiller-agent** - Proposal auto-fulfiller
- **research-agent** - Has reasoning capabilities
- And more test participants...

All test scripts reference this configuration to ensure consistent testing.