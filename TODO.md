# TODO

## Current Focus: Enable TEST_PLAN.md Scenarios 3-6

Implementation priorities to get tests passing:

### ✅ Completed: Minimal Capability System (Unblocks Scenarios 3-4)

#### Step 1: Gateway Hooks ✅
- [x] Add setCapabilityResolver() hook to gateway
- [x] Add onParticipantJoined() callback to gateway  
- [x] Add setAuthorizationHook() for message validation
- [x] Gateway calls resolver on every message

#### Step 2: Space Config Loader ✅
- [x] Load space.yaml on gateway start with --space-config flag
- [x] Parse participants and capabilities using js-yaml
- [x] Implement capability resolver that uses space.yaml data
- [x] Wire resolver to gateway hooks

#### Step 3: Capability Matching ✅
- [x] Implemented matchesCapability() with JSON pattern matching
- [x] Implement hasCapabilityForMessage() check using patterns from space.yaml
- [x] Support wildcards (mcp/*) and simple strings (chat)
- [x] Return capability subsets based on message kind

#### Step 4: Token → Participant Mapping ✅
- [x] Map tokens to participants from space.yaml
- [x] Look up capabilities by token
- [x] Handle unknown tokens with defaults
- [x] Store participant ID on connection

### 🚀 Priority 2: Process Management (Partially Complete)
- [x] Auto-start agents with auto_start: true
- [x] Spawn processes with command/args/env
- [x] Implement restart policies
- [x] Track spawned process PIDs

### ✅ Completed: Reasoning Messages Support
- [x] Support reasoning/start, reasoning/thought, reasoning/conclusion (via wildcard patterns)
- [x] Context field for grouping related messages (passes through gateway)
- [x] Preserve correlation_id arrays properly
- [x] Messages with context field pass through correctly
- [x] Test scenario 5 passing with full reasoning flow

### 🚀 Priority 4: Enhanced Validation (Improves Scenario 6)
- [ ] Add protocol version checking (reject non-v0.2)
- [ ] Add strict payload validation for each message kind
- [ ] Improve error messages with specific failure reasons
- [ ] Add message schema validation

### 📋 Priority 5: Interactive Connection (meup space connect)
- [ ] Implement terminal UI mode (default)
- [ ] Parse space.yaml for participant settings
- [ ] Handle authentication/token prompt
- [ ] Process slash commands (/help, /participants, etc.)
- [ ] Support other UI modes later (web, electron, game)

### 📋 Test Scenarios Status
- [x] Scenario 1: Basic Message Flow ✅ PASSED
- [x] Scenario 2: MCP Tool Execution ✅ PASSED
- [x] Scenario 3: Proposals with capability blocking ✅ PASSED
- [ ] Scenario 4: Dynamic capability granting → **Blocked: Needs capability/grant and capability/revoke implementation**
- [x] Scenario 5: Reasoning with context field ✅ PASSED
- [x] Scenario 6: Error recovery ✅ PASSED (5/6 tests pass)

## Implementation Order

1. ✅ **Gateway hooks** - Enable capability resolution 
2. ✅ **Space config loader** - Read space.yaml
3. ✅ **Capability matcher** - Check permissions
4. ✅ **Token mapping** - Connect tokens to participants
5. ✅ **Test scenarios 1-3** - Basic flow, MCP tools, proposals
6. ✅ **Test scenario 5** - Reasoning with context field
7. ✅ **Test scenario 6** - Error recovery (5/6 tests pass)
8. ✅ **Test infrastructure** - All test scripts and agents working
9. ⏳ **Dynamic capabilities** - Implement capability/grant and capability/revoke
10. ⏳ **Test scenario 4** - Test dynamic capability grant/revoke

## Next Steps

### 🎯 Immediate (Complete TEST_PLAN.md)
1. **Implement Dynamic Capabilities**:
   - Add capability/grant message handler in gateway
   - Add capability/revoke message handler in gateway  
   - Store runtime capability modifications per participant
   - Merge runtime capabilities with space.yaml capabilities
2. **Test Scenario 4**: Implement and test dynamic capability granting
3. **Documentation**: Update README with test suite usage

### 🚀 Short Term (Production Readiness)
1. **Interactive Connection** (`meup space connect`):
   - Implement terminal UI mode
   - Parse space.yaml for participant settings
   - Handle authentication/token prompt
   - Process slash commands (/help, /participants, etc.)
2. **Enhanced Validation**:
   - Protocol version checking
   - Strict payload validation
   - Better error messages
3. **Process Management Improvements**:
   - Better error handling for spawned processes
   - Process health monitoring
   - Automatic restart on failure

### 📦 Medium Term (v0.1.0 Release)
1. **Configuration Management**:
   - Environment variable support
   - Config file loading (~/.meup/config.yaml)
   - Multi-space management
2. **Security Enhancements**:
   - Token generation and validation
   - TLS/SSL support
   - Rate limiting
3. **Documentation**:
   - Complete API documentation
   - Tutorial videos
   - Example projects

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
- **Capability system with space.yaml configuration**
- **Gateway hooks for external resolvers**
- **JSON pattern matching for capabilities**
- **Process management for auto-starting agents**

### Test Infrastructure ✅
- Test scripts created for scenarios 1-3, 5-6 (5 of 6 complete)
- FIFO automation working (fixed with background writer process)
- Individual scenario runners created
- Test agents implemented (echo, calculator, fulfiller)
- Proposal flow with auto-fulfillment working
- Reasoning message flow with context field working
- Error recovery tests implemented
- run-all-tests.sh script for full test suite execution

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