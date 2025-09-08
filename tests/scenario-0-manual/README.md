# Scenario 0: Basic Message Flow Test

This scenario tests basic message flow with echo functionality and provides both automated and manual testing options using a modular script pattern.

## Test Pattern

This scenario implements a reusable test pattern with separated concerns:

- **`setup.sh`** - Initializes the test space (can be run standalone for manual testing)
- **`check.sh`** - Runs test assertions (works with both manual and automated setup)
- **`teardown.sh`** - Cleans up the test space
- **`test.sh`** - Combines all three for automated testing
- **`test-manual.sh`** - Original manual setup script for debugging

## Running Tests

### Automated Testing (CI/CD)
```bash
# Run the complete test automatically
./test.sh

# This will:
# 1. Setup the space using `meup space up`
# 2. Run all test checks
# 3. Teardown the space
# 4. Report pass/fail status
```

### Manual Testing (Debugging)

#### Option 1: Using the modular pattern
```bash
# Start the space
./setup.sh

# In another terminal, run checks
./check.sh

# Send manual messages
echo '{"kind":"chat","payload":{"text":"Hello"}}' > ./fifos/test-client-in
cat < ./fifos/test-client-out

# When done, cleanup
./teardown.sh
```

#### Option 2: Using the original manual script
```bash
# For full manual control over each component
./test-manual.sh

# This gives you direct control over:
# - Gateway startup with custom flags
# - Individual agent processes
# - FIFO creation
# - PID management
```

## Test Checks

The `check.sh` script validates:

1. **Gateway Health** - Gateway is running and responding to health checks
2. **FIFO Existence** - Input and output FIFOs are created
3. **Agent Connection** - Echo agent is connected to the gateway
4. **Message Flow** - Messages are received and echoed back
5. **Rapid Message Handling** - Multiple messages sent quickly are all processed
6. **Clean Command** - Tests that `meup space clean --dry-run` works correctly

## Components

- **Gateway**: MEUP gateway server on a random port
- **Echo Agent**: Simple agent that echoes chat messages with "Echo: " prefix
- **Test Client**: Client connected via FIFOs for message I/O

## Directory Structure

```
scenario-0-manual/
├── agents/
│   └── echo.js           # Echo agent implementation
├── space.yaml            # Space configuration
├── setup.sh              # Setup script (space initialization)
├── check.sh              # Test assertions
├── teardown.sh           # Cleanup script
├── test.sh               # Automated test (combines all)
├── test-manual.sh        # Original manual setup for debugging
├── cleanup.sh            # Legacy cleanup script
└── README.md             # This file
```

## Environment Variables

Scripts use these environment variables for coordination:

- `TEST_PORT` - Gateway port (random if not set)
- `TEST_DIR` - Test directory path
- `FIFO_IN` - Input FIFO path
- `FIFO_OUT` - Output FIFO path
- `SPACE_RUNNING` - Boolean flag set by setup.sh
- `PRESERVE_LOGS` - If true, teardown.sh keeps logs

## Debugging

### Check Component Status
```bash
# See what's running
../../../cli/bin/meup.js space status

# Check logs
tail -f logs/space-up.log
tail -f logs/echo.log
```

### Test FIFO Communication
```bash
# Terminal 1: Listen for output
cat < fifos/test-client-out

# Terminal 2: Send input
echo '{"kind":"chat","payload":{"text":"Test"}}' > fifos/test-client-in
```

### Clean Space Artifacts
```bash
# Preview what will be cleaned
../../../cli/bin/meup.js space clean --dry-run

# Clean only logs (preserves running space)
../../../cli/bin/meup.js space clean --logs --force

# Complete cleanup after stopping space
../../../cli/bin/meup.js space down
../../../cli/bin/meup.js space clean --all --force
```

### Preserve Logs for Debugging
```bash
# Keep logs after teardown
PRESERVE_LOGS=true ./teardown.sh
```

## Extending This Pattern

To create a new test scenario using this pattern:

1. Copy the modular scripts (setup.sh, check.sh, teardown.sh, test.sh)
2. Modify `check.sh` to test your specific scenario
3. Update `space.yaml` with your agents and participants
4. Add your agent implementations to `agents/`

## Benefits of This Pattern

1. **Flexibility** - Run automated or manual as needed
2. **Modularity** - Each script has a single responsibility
3. **Debuggability** - Easy to run individual steps
4. **Reusability** - Pattern can be applied to all test scenarios
5. **CI/CD Ready** - test.sh provides clean exit codes for automation
6. **Developer Friendly** - Manual options for debugging and development