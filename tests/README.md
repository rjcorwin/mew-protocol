# MEUP Test Suite

Comprehensive testing for the MEUP protocol implementation including test agents, integration tests, and multi-agent scenarios.

## Directory Structure

```
tests/
├── agents/              # Test agent implementations
│   ├── echo-agent.ts       # Simple echo responses
│   ├── calculator-agent.ts # MCP tool provider
│   ├── proposer-agent.ts   # Untrusted agent making proposals
│   ├── fulfiller-agent.ts  # Trusted agent executing proposals
│   ├── coordinator-agent.ts # Reviews and routes proposals
│   └── context-agent.ts    # Tests sub-context management
├── integration/         # Integration test scripts
│   ├── basic-flow.test.ts
│   ├── mcp-tools.test.ts
│   ├── proposals.test.ts
│   ├── capabilities.test.ts
│   └── context.test.ts
├── scenarios/          # Multi-agent test scenarios
│   ├── collaboration.ts
│   ├── progressive-automation.ts
│   └── untrusted-execution.ts
└── utils/              # Test utilities
    ├── test-harness.ts
    └── assertions.ts
```

## Test Agents

### 1. Echo Agent (`echo-agent.ts`)
- **Purpose**: Test basic message flow
- **Capabilities**: `chat`
- **Behavior**: Echoes received chat messages
- **Tests**: Message routing, presence, basic connectivity

### 2. Calculator Agent (`calculator-agent.ts`)
- **Purpose**: Test MCP tool provision and calling
- **Capabilities**: `mcp/*`
- **Tools Provided**:
  - `add(a, b)` - Addition
  - `multiply(a, b)` - Multiplication
  - `evaluate(expression)` - Expression evaluation
- **Tests**: Tool discovery, tool execution, error handling

### 3. Proposer Agent (`proposer-agent.ts`)
- **Purpose**: Test proposal creation by untrusted agents
- **Role**: `untrusted`
- **Capabilities**: `chat`, `meup/proposal`
- **Behavior**: Proposes tool calls and requests it can't execute directly
- **Tests**: Proposal creation, capability limitations

### 4. Fulfiller Agent (`fulfiller-agent.ts`)
- **Purpose**: Test proposal execution
- **Role**: `trusted`
- **Capabilities**: `*`
- **Behavior**: Reviews and executes approved proposals
- **Tests**: Proposal review, execution, rejection

### 5. Coordinator Agent (`coordinator-agent.ts`)
- **Purpose**: Test complex proposal routing and review
- **Role**: `coordinator`
- **Capabilities**: `*`
- **Behavior**: 
  - Reviews proposals based on rules
  - Routes to appropriate fulfillers
  - Maintains audit log
- **Tests**: Complex routing, multi-step approval

### 6. Context Agent (`context-agent.ts`)
- **Purpose**: Test sub-context protocol
- **Capabilities**: `mcp/*`, `meup/context`
- **Behavior**: 
  - Pushes context for sub-tasks
  - Maintains context-specific state
  - Tests pop/resume operations
- **Tests**: Context stack management, scoped conversations

## Integration Test Plan

### Phase 1: Basic Connectivity
1. Start gateway
2. Connect echo agent
3. Send messages
4. Verify responses
5. Test disconnect/reconnect

### Phase 2: MCP Operations
1. Start calculator agent
2. Discover tools via `tools/list`
3. Call tools with valid inputs
4. Test error cases
5. Verify response correlation

### Phase 3: Proposal-Execute Pattern
1. Start proposer (untrusted) and fulfiller (trusted)
2. Proposer attempts direct tool call (should fail)
3. Proposer creates proposal
4. Fulfiller reviews and accepts
5. Verify execution and response

### Phase 4: Capability Enforcement
1. Test operations with different capability sets
2. Verify blocked operations
3. Test capability granting/revoking
4. Verify dynamic capability updates

### Phase 5: Context Management
1. Test context push for sub-task
2. Verify message scoping
3. Test context pop
4. Test context resume
5. Verify context stack state

### Phase 6: Multi-Agent Scenarios
1. **Collaboration**: Multiple agents working together
2. **Progressive Automation**: Learning from human decisions
3. **Untrusted Execution**: Safe execution of untrusted code

## Running Tests

### Using CLI (when implemented)

```bash
# Start gateway
meup gateway start

# Run individual test agent
meup agent run tests/agents/echo-agent.ts

# Run integration test suite
meup test integration

# Run specific scenario
meup test scenario collaboration
```

### Manual Testing

```bash
# Terminal 1: Start gateway
cd sdk/typescript-sdk/gateway
npm run start:dev

# Terminal 2: Run echo agent
cd tests/agents
npx tsx echo-agent.ts

# Terminal 3: Run test client
cd tests/integration
npx tsx basic-flow.test.ts
```

## Test Utilities

### Test Harness (`test-harness.ts`)
- Gateway lifecycle management
- Agent spawning and management
- Message capture and verification
- Timing and synchronization

### Assertions (`assertions.ts`)
- Custom assertions for MEUP messages
- Capability matching helpers
- Context state verification
- Proposal lifecycle tracking

## Success Criteria

Each test phase must verify:

1. **Protocol Compliance**: All messages follow MEUP v0.2 spec
2. **Capability Enforcement**: Access control works correctly
3. **Message Routing**: Messages reach intended recipients
4. **State Management**: Context and presence tracked correctly
5. **Error Handling**: Graceful failure and error messages
6. **Performance**: Acceptable latency and throughput

## Coverage Goals

- **Unit Tests**: 80% coverage of SDK code
- **Integration Tests**: All major flows tested
- **Scenario Tests**: Real-world use cases validated
- **Edge Cases**: Error conditions and boundaries tested
- **Load Tests**: Performance under stress verified