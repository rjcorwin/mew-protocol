# MEW Protocol Test Scenarios

This directory contains comprehensive test scenarios that validate the MEW Protocol implementation, CLI functionality, and SDK behaviors. Each scenario creates a disposable MEW space at runtime and tests specific protocol features.

## Overview

The test suite exercises the protocol through **executable scenarios** rather than unit tests. Each scenario:
- Lives in its own `scenario-*` directory
- Creates a disposable MEW space during setup
- Tests specific protocol interactions and behaviors
- Uses gateway envelope logging for comprehensive validation
- Cleans up all runtime artifacts after execution

## Test Architecture

- **Gateway Envelope Logging**: All scenarios leverage dual-log architecture (`.mew/logs/envelope-history.jsonl` and `.mew/logs/capability-decisions.jsonl`) for protocol-level validation
- **Participant Logs**: Application-level validation through participant output logs
- **Hybrid Monitoring**: Combines gateway logs (envelope flow/capability decisions) with participant logs (business logic validation)
- **Mock Implementations**: Uses local mock agents and MCP participants instead of external LLM APIs

## Mock LLM Usage

Several scenarios use **mock LLM implementations** to enable predictable, deterministic testing:

### TypeScript Agent Mock Configuration
- **Scenarios 8-9** (TypeScript agent scenarios) use: `MEW_AGENT_CONFIG: '{"mockLLM":true,"autoRespond":true}'`
- **Mock Behavior**: Instead of calling external LLM APIs, the agent generates deterministic responses based on input patterns
- **Benefits**: Tests run without API keys, are faster, more reliable, and produce consistent results
- **Use Case**: Validates agent framework, reasoning flows, and MCP tool integration without LLM variability

### Calculator Agent Mock Tools
- **Most scenarios** use local JavaScript calculator agents that provide deterministic MCP tools (add, multiply, evaluate)
- **Purpose**: Tests MCP protocol mechanics, tool calling workflows, and envelope routing without external dependencies

## Scenario Descriptions

### Core Protocol Tests

#### Scenario 1: Basic Message Flow
**File**: `scenario-1-basic/`
**Purpose**: Validates fundamental envelope routing and delivery
**Tests**:
- Simple chat message delivery with echo responses
- Message correlation ID preservation across envelope flow
- Multiple message handling and rapid message burst processing
- Large message handling (1000+ characters)
- Basic gateway envelope logging validation

#### Scenario 2: MCP Tool Execution
**File**: `scenario-2-mcp/`
**Purpose**: Validates Model Context Protocol (MCP) tool execution workflow
**Tests**:
- `tools/list` request/response flow for discovering available tools
- `tools/call` execution for basic arithmetic operations (add, multiply, evaluate)
- Error handling for division by zero and invalid tool names
- MCP request capability validation and envelope correlation

#### Scenario 3: Proposal Workflow
**File**: `scenario-3-proposals/`
**Purpose**: Validates MCP proposal creation and fulfillment
**Tests**:
- Proposal submission for mathematical operations (addition, multiplication)
- Proposal fulfillment by dedicated fulfiller agent
- Error handling for invalid tool proposals
- Correlation between proposals and fulfillment responses

#### Scenario 4: Capability Management
**File**: `scenario-4-capabilities/`
**Purpose**: Validates capability grants, restrictions, and enforcement
**Tests**:
- Gateway rejection of reserved `system/register` messages from participants
- MCP request capability validation for tool access
- Capability grant/revoke envelope delivery (enforcement not yet implemented)
- System error message generation for capability violations

#### Scenario 5: Reasoning Flow
**File**: `scenario-5-reasoning/`
**Purpose**: Validates structured reasoning message flow and context preservation
**Tests**:
- Multi-step reasoning workflow with `reasoning/start`, `reasoning/thought`, `reasoning/conclusion`
- Context ID preservation across reasoning chain
- MCP tool integration within reasoning flow
- Complex calculation with tax computation example

### Advanced Features

#### Scenario 6: Error Handling & Resilience
**File**: `scenario-6-errors/`
**Purpose**: Validates gateway robustness against malformed inputs
**Tests**:
- Invalid JSON payload rejection (4xx status codes)
- Missing required fields (kind) handling
- Non-existent participant message routing
- Large message acceptance (10k+ characters)
- Rapid message burst handling (20 messages)
- Special Unicode character support
- Gateway stability after error conditions

#### Scenario 7: MCP Bridge Integration
**File**: `scenario-7-mcp-bridge/`
**Purpose**: Validates MCP-MEW bridge for external MCP server integration
**Tests**:
- Filesystem MCP server tool discovery (`read_file`, `list_directory`)
- File reading through MCP bridge with real filesystem operations
- Directory listing with expected file validation
- Bridge envelope routing and MCP protocol translation

#### Scenario 8: Capability Grant Workflow
**File**: `scenario-8-grant/`
**Purpose**: Validates dynamic capability granting between participants
**Tests**:
- Agent-initiated proposal submission for file operations
- Human capability grant approval workflow via WebSocket
- Proposal fulfillment after capability grant
- Grant acknowledgment from recipient back to granter
- Direct MCP request execution after capability grant
- File creation verification via MCP tools

#### Scenario 8-TypeScript: TypeScript Agent Tools
**File**: `scenario-8-typescript-agent/`
**Purpose**: Validates TypeScript SDK agent implementation with **mock LLM**
**Tests**:
- TypeScript agent connection and registration
- Mock LLM tool discovery (`calculate`, `echo`)
- Tool execution with deterministic responses (5+3=8, 7×6=42)
- Chat interaction handling with mock responses
- **Mock LLM Configuration**: `{"mockLLM":true,"autoRespond":true}` enables predictable behavior

#### Scenario 9: TypeScript Proposal Workflow
**File**: `scenario-9-typescript-proposals/`
**Purpose**: Validates proposal generation by TypeScript agent with **mock LLM**
**Tests**:
- Chat request triggering automatic proposal generation (7+9=16)
- TypeScript agent proposal emission with MCP tool calls
- Proposal fulfillment by separate fulfiller agent
- Direct tool listing capability
- **Mock LLM Behavior**: Agent generates proposals based on chat patterns without external API calls

### Control & Management

#### Scenario 10: Multi-Agent Coordination
**File**: `scenario-10-multi-agent/`
**Purpose**: Validates coordinator/worker delegation patterns
**Tests**:
- Coordinator agent delegating tasks to worker agents
- Worker agent forwarding requests to calculator tools
- Response routing back through delegation chain
- Multi-participant coordination logging

#### Scenario 11: Chat & Reasoning Controls
**File**: `scenario-11-chat-controls/`
**Purpose**: Validates chat acknowledgment and reasoning cancellation flows
**Tests**:
- Chat acknowledgment emission (`chat/acknowledge`)
- Chat cancellation workflow (`chat/cancel`)
- Reasoning start/cancel lifecycle (`reasoning/start`, `reasoning/cancel`)
- Correlation ID preservation across control messages

#### Scenario 12: Stream Lifecycle
**File**: `scenario-12-stream-controls/`
**Purpose**: Validates streaming data lifecycle management
**Tests**:
- Stream request negotiation (`stream/request`)
- Stream opening acknowledgment (`stream/open`)
- Stream closing with completion status (`stream/close`)
- Stream ID management and correlation

#### Scenario 13: Participant Lifecycle
**File**: `scenario-13-participant-controls/`
**Purpose**: Validates participant state management and control operations
**Tests**:
- Participant clearing with reason tracking (`participant/clear`)
- Participant restart operations (`participant/restart`)
- Memory compaction with token limits (`participant/compact`)
- Pause/resume with timeout handling (`participant/pause`, `participant/resume`)
- Graceful shutdown with reason logging (`participant/shutdown`)

## Running Tests

### Individual Scenarios
```bash
cd e2e/scenario-1-basic
./setup.sh      # Creates .workspace with MEW space
./check.sh      # Runs scenario tests
./teardown.sh   # Cleans up .workspace
```

### All Scenarios
```bash
./e2e/run-all-tests.sh
```

### Test Environment
- Each scenario runs in isolated `.workspace/` directory (gitignored)
- Local package linking ensures tests run against current monorepo code
- PM2 manages participant processes during test execution
- All runtime artifacts cleaned up after test completion

## Mock vs Real LLM Testing

### Mock LLM Scenarios (Recommended for CI/CD)
- **Scenarios 8-9**: Use `MEW_AGENT_CONFIG: '{"mockLLM":true,"autoRespond":true}'`
- **Benefits**: No API keys required, deterministic results, faster execution
- **Use Case**: Protocol validation, envelope flow testing, integration testing

### Real LLM Integration
- Currently **no scenarios** require actual LLM API keys
- All test agents use local mock implementations
- Future scenarios could integrate real LLM APIs for end-to-end validation

## Gateway Logging Integration

All scenarios leverage the **dual-log architecture** introduced in CLI v0.5.0:

### Envelope History (`envelope-history.jsonl`)
- Tracks envelope receipt, delivery, and failure events
- Includes processing timing and retry information
- Used for protocol-level delivery validation

### Capability Decisions (`capability-decisions.jsonl`)
- Records capability grant/deny decisions
- Logs routing decisions and participant filtering
- Used for access control validation

### Test Helper Functions
```bash
# Shared utilities in e2e/lib/gateway-logs.sh
wait_for_envelope()           # Wait for envelope to appear in logs
wait_for_delivery()           # Wait for delivery to specific participant
wait_for_capability_grant()   # Wait for capability decision
assert_envelope_delivered()   # Assert successful delivery
assert_capability_granted()   # Assert capability was granted
```

## Best Practices

1. **Protocol Testing**: Use gateway logs for envelope flow validation
2. **Application Testing**: Use participant logs for business logic validation
3. **Mock LLM**: Prefer mock implementations for deterministic testing
4. **Error Scenarios**: Test both success paths and error conditions
5. **Resource Cleanup**: Always use teardown.sh to clean workspace artifacts
6. **Isolation**: Each scenario should be independently executable

## Adding New Scenarios

1. Create `scenario-N-name/` directory
2. Add template files mimicking CLI template structure
3. Implement `setup.sh`, `check.sh`, `teardown.sh` scripts
4. Use gateway log helpers for envelope validation
5. Consider mock implementations for deterministic testing
6. Update this README with scenario description

For more details on the testing architecture, see [e2e/spec/draft/SPEC.md](spec/draft/SPEC.md).