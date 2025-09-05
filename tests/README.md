# MEUP Test Suite

Comprehensive testing for the MEUP protocol implementation.

## Test Structure

Each test run creates a dedicated folder with the convention `test-YYMMDD-HHMM` containing:

```
test-YYMMDD-HHMM/
├── scripts/      # Test scripts generated during the run
├── configs/      # Space configuration files (space.yaml)
├── logs/         # Gateway and agent output logs
├── results/      # Test results in JSON format
└── fifos/        # Named pipes for FIFO communication
```

The main test plan is documented in [TEST_PLAN.md](./TEST_PLAN.md), which provides:
- Step-by-step test scenarios
- CLI commands for running tests
- Expected outputs and validation steps
- Test automation using FIFO mode

## Test Agents

The CLI provides built-in test agents for testing:

### 1. Echo Agent
- **Type**: `echo`
- **Purpose**: Test basic message flow
- **Behavior**: Echoes received chat messages with "Echo: " prefix
- **Usage**: `meup agent start --type echo`

### 2. Calculator Agent
- **Type**: `calculator`
- **Purpose**: Test MCP tool provision and calling
- **Tools Provided**:
  - `add(a, b)` - Addition
  - `multiply(a, b)` - Multiplication
  - `evaluate(expression)` - Expression evaluation
- **Usage**: `meup agent start --type calculator`

### 3. Fulfiller Agent
- **Type**: `fulfiller`
- **Purpose**: Test proposal execution
- **Behavior**: Automatically fulfills any `mcp/proposal` it observes
- **Usage**: `meup agent start --type fulfiller`

## Test Scenarios

The TEST_PLAN.md includes 6 test scenarios:

1. **Basic Message Flow**: Echo agent responds to chat messages
2. **MCP Tool Execution**: Calculator agent provides and executes tools
3. **Proposal Pattern**: Untrusted proposer with trusted fulfiller
4. **Dynamic Capabilities**: Granting and revoking capabilities
5. **Context Management**: Push/pop context stacks
6. **Error Recovery**: Handling invalid messages and errors

## Running Tests

### Quick Start

```bash
# Create test run directory
TEST_RUN_DIR="./test-$(date +%y%m%d-%H%M)"
mkdir -p "$TEST_RUN_DIR"
cd "$TEST_RUN_DIR"

# Start gateway
meup gateway start --port 8080 --log-level debug > logs/gateway.log 2>&1 &

# Start test agents
meup agent start --type echo --gateway ws://localhost:8080 --space test-space &
meup agent start --type calculator --gateway ws://localhost:8080 --space test-space &
meup agent start --type fulfiller --gateway ws://localhost:8080 --space test-space &

# Connect test client with FIFOs
mkfifo cli-in cli-out
meup client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --fifo-in cli-in \
  --fifo-out cli-out &

# Send test messages
echo '{"kind":"chat","payload":{"text":"hello"}}' > cli-in

# Read responses
cat cli-out
```

## Test Validation

Each test scenario in TEST_PLAN.md includes:

1. **Setup**: Commands to start gateway and agents
2. **Execution**: Step-by-step test operations
3. **Validation**: Expected outputs and assertions
4. **Cleanup**: Resource teardown

## Current Status

See [TEST_PLAN.md](./TEST_PLAN.md) for detailed test scenarios and execution steps.

- ✅ Scenarios 1-2: Basic flow and MCP tools (passing)
- ⏳ Scenarios 3-6: Require capability system implementation