# MEUP v0.2 Test Plan

## Testing Strategy

### Objectives
1. Validate protocol implementation correctness
2. Ensure SDK interoperability
3. Test security boundaries (capability enforcement)
4. Verify real-world scenarios

### Test Levels

#### 1. Unit Tests (SDK-level)
- Test individual components in isolation
- Mock dependencies
- Focus on logic correctness

#### 2. Integration Tests (End-to-end)
- Test component interactions with real gateway, agents, and clients
- Protocol compliance verification
- Complete scenarios with multiple agents
- Real-world use cases

## Test Scenarios

### Scenario 1: Basic Message Flow
**Agents**: Echo Agent
**Steps**:
1. Echo agent connects to space
2. Client sends chat message
3. Echo agent responds
4. Verify message format and routing

**Verifies**:
- Basic connectivity
- Message envelope structure
- Bidirectional communication

### Scenario 2: MCP Tool Execution
**Agents**: Calculator Agent, CLI Client
**Steps**:
1. Calculator agent joins space
2. Client discovers tools via `tools/list`
3. Client calls `add(5, 3)`
4. Calculator executes and returns result
5. Client calls `evaluate("2 * (3 + 4)")`

**Verifies**:
- MCP protocol implementation
- Tool discovery
- Tool execution
- Error handling

### Scenario 3: Untrusted Agent with Proposals
**Agents**: Proposer Agent (untrusted), Fulfiller Agent (trusted)
**Steps**:
1. Both agents join space
2. Proposer tries direct tool call (blocked)
3. Proposer creates proposal for tool call
4. Fulfiller reviews proposal
5. Fulfiller accepts and executes
6. Result returned to proposer

**Verifies**:
- Capability enforcement
- Proposal creation
- Proposal review process
- Execution on behalf of another

### Scenario 4: Capability Granting
**Agents**: Proposer (untrusted), Coordinator (trusted)
**Steps**:
1. Proposer starts with limited capabilities (chat only)
2. Proposer requests to perform an MCP operation (blocked)
3. Coordinator grants specific MCP capability to proposer
4. Proposer can now execute that specific operation directly
5. Proposer attempts different operation (still blocked)
6. Coordinator revokes the granted capability
7. Original operation now blocked again

**Verifies**:
- Dynamic capability granting
- Capability revocation
- Fine-grained access control

### Scenario 5: Context Management
**Agents**: Research Agent, Calculator Agent
**Steps**:
1. Research Agent receives: "What's the total cost if we buy 5 items at $12 each with 8% tax?"
2. Research Agent pushes context with topic "calculate-base-cost"
3. Research Agent asks Calculator: "multiply 5 by 12"
4. Calculator responds: "60"
5. Research Agent pops context
6. Research Agent pushes new context with topic "calculate-tax"
7. Research Agent asks Calculator: "multiply 60 by 0.08"
8. Calculator responds: "4.8"
9. Research Agent pops context
10. Research Agent pushes context with topic "calculate-total"
11. Research Agent asks Calculator: "add 60 and 4.8"
12. Calculator responds: "64.8"
13. Research Agent pops context
14. Research Agent responds to original request: "The total cost is $64.80"

**Verifies**:
- Context push creates isolated conversation scope
- Context pop returns to parent scope
- Each context maintains separate correlation
- Messages within context are tagged appropriately

### Scenario 6: Multi-Agent Collaboration
**Agents**: Researcher, Calculator, Writer, Coordinator
**Steps**:
1. Coordinator receives complex request
2. Delegates research to Researcher
3. Researcher uses Calculator for analysis
4. Writer summarizes findings
5. Coordinator assembles final response

**Verifies**:
- Multi-agent coordination
- Capability-based delegation
- Complex workflows

## Test Matrix

| Test Case | Echo | Calc | Proposer | Fulfiller | Coordinator | Context |
|-----------|------|------|----------|-----------|-------------|---------|
| Basic connectivity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chat messages | ✓ | | ✓ | ✓ | ✓ | ✓ |
| MCP tools/list | | ✓ | | ✓ | ✓ | ✓ |
| MCP tools/call | | ✓ | | ✓ | ✓ | ✓ |
| Create proposal | | | ✓ | | | |
| Review proposal | | | | ✓ | ✓ | |
| Execute proposal | | | | ✓ | ✓ | |
| Context push | | | | | | ✓ |
| Context pop | | | | | | ✓ |
| Capability check | | | ✓ | ✓ | ✓ | |


## Test Execution Plan

### Phase 1: Test Agent Implementation
- [ ] Echo agent
- [ ] Calculator agent
- [ ] Proposer agent
- [ ] Fulfiller agent
- [ ] Coordinator agent
- [ ] Context-aware agent

### Phase 2: Integration Tests
- [ ] Basic message flow with echo agent
- [ ] MCP operations with calculator
- [ ] Proposal pattern with proposer/fulfiller
- [ ] Capability granting and revocation
- [ ] Context management
- [ ] Multi-agent collaboration scenario
- [ ] Error recovery and edge cases

## Test Environment

### Local Development
```yaml
gateway:
  port: 8080
  logLevel: debug
  enableMetrics: true

agents:
  - echo-agent
  - calculator-agent
  - proposer-agent
  - fulfiller-agent
```

### CI/CD Pipeline
```yaml
test:
  - npm run test:unit
  - npm run test:integration
  - npm run test:e2e
```

## Success Metrics

### Coverage
- All 6 test agents implemented
- All integration test scenarios pass
- 100% of defined scenarios tested

### Quality
- Protocol compliance verified
- Capability enforcement working
- Proposal pattern functioning correctly
- Context management operational

## Risk Mitigation

### Identified Risks
1. **WebSocket connection stability**: Implement reconnection logic
2. **Capability bypass**: Thorough testing of pattern matching
3. **Context leaks**: Verify isolation between contexts
4. **Proposal spam**: Rate limiting implementation

### Mitigation Strategies
- Comprehensive error handling
- Timeout mechanisms
- Circuit breakers
- Graceful degradation

## Tools and Frameworks

### Testing Tools
- **Vitest**: Unit testing
- **WebSocket Client**: Integration testing
- **Docker Compose**: Test environment

### Monitoring
- Gateway metrics endpoint
- Agent status reporting
- Message flow tracing

## Deliverables

1. **Test Agents**: 6 fully implemented test agents
2. **Test Suite**: Comprehensive automated tests
3. **Test Report**: Results showing all tests pass
4. **Bug Report**: Issues found and resolutions