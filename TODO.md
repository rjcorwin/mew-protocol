# TODO

## Current Focus: Complete TEST_PLAN.md Implementation

Based on test results, we need to implement missing features for Scenarios 3-6:

### 🚀 Priority 1: Capability System via space.yaml
- [ ] gateway-cap-1: Design gateway library with bidirectional hooks
  - [ ] Capability resolver hook (gateway → CLI)
  - [ ] Participant joined callback (gateway → CLI)
  - [ ] Authorization hook for message validation
- [ ] gateway-cap-2: Implement space.yaml parser and loader in CLI
  - [ ] Parse participant definitions with process management config
  - [ ] Support capability subsetting per request
  - [ ] Handle dynamic participant registration
- [ ] gateway-cap-3: Implement CLI process management from space.yaml
  - [ ] Spawn local agents with command/args/env
  - [ ] Handle auto_start and restart_policy
  - [ ] Execute space_commands on start/stop
- [ ] gateway-cap-4: Implement capability pattern matching
  - [ ] Simple string matching (kind: "chat")
  - [ ] Wildcard patterns (kind: "mcp/*")
  - [ ] Complex patterns with payload inspection
- [ ] gateway-cap-5: Add configuration loading options
  - [ ] --space-config flag
  - [ ] MEUP_SPACE_CONFIG environment variable
  - [ ] Default ./space.yaml location
- [ ] gateway-cap-6: Implement dynamic updates
  - [ ] Config reloading without restart
  - [ ] Auto-update space.yaml when new participants join
  - [ ] Capability grant/revoke updates config

### 🚀 Priority 2: Context Management (Enables Scenario 5)
- [ ] context-1: Add context stack to gateway per participant
- [ ] context-2: Implement context/push handler
- [ ] context-3: Implement context/pop handler
- [ ] context-4: Preserve correlation_id arrays through context operations
- [ ] context-5: Track context hierarchy in message routing

### 🚀 Priority 3: Enhanced Validation (Improves Scenario 6)
- [ ] validate-1: Add protocol version checking (reject non-v0.2)
- [ ] validate-2: Add strict payload validation for each message kind
- [ ] validate-3: Improve error messages with specific failure reasons
- [ ] validate-4: Add message schema validation

### 📋 Test Completion
- [x] test-scenario-1: Basic Message Flow ✅ PASSED
- [x] test-scenario-2: MCP Tool Execution ✅ PASSED
- [ ] test-scenario-3: Proposals with capability blocking (needs capability system)
- [ ] test-scenario-4: Dynamic capability granting (needs capability system)
- [ ] test-scenario-5: Context management (needs context implementation)
- [ ] test-scenario-6: Error recovery (needs better validation)

## Completed Tasks (Archived)

### MEUP v0.2 Protocol ✅
- All ADRs implemented and accepted
- Spec released 2025-01-03
- Core protocol complete

### CLI Minimal Implementation ✅
- Gateway with WebSocket server
- Client with FIFO mode (fixed with tail -F)
- Echo agent (autonomous)
- Calculator agent (MCP tools)
- Fulfiller agent (proposal handling)
- Token creation (basic)

### Test Infrastructure ✅
- Test scripts created for all scenarios
- FIFO automation working
- Individual scenario runners created

## Future Work (After TEST_PLAN.md Complete)

### CLI Production Features
- Space configuration from spec
- Authentication system
- Configuration files
- Environment variables
- Production documentation

### Additional Testing
- Integration test suite
- Performance benchmarks
- Multi-agent collaboration scenarios
- End-to-end workflows

### Community & Documentation
- Migration guide from v0.1
- Architecture diagrams
- Video tutorials
- Blog posts

### v0.3 Planning
- Message persistence
- Rate limiting
- Space federation
- Enhanced routing