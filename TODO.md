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

### 🔥 Immediate Priority: Fix Reasoning Messages (Enables Scenario 5)
- [ ] Remove context/push and context/pop (not in MEUP v0.2 spec)
- [ ] Support reasoning/start, reasoning/thought, reasoning/conclusion
- [ ] Use context field for grouping related messages
- [ ] Preserve correlation_id arrays properly
- [ ] Allow messages with context field to pass through

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
- [x] Scenario 3: Proposals with capability blocking → **READY TO TEST** (capability system complete)
- [x] Scenario 4: Dynamic capability granting → **READY TO TEST** (capability system complete)
- [ ] Scenario 5: Reasoning with context field → **Needs reasoning message support**
- [ ] Scenario 6: Error recovery → **Needs better validation**

## Implementation Order

1. ✅ **Gateway hooks** - Enable capability resolution 
2. ✅ **Space config loader** - Read space.yaml
3. ✅ **Capability matcher** - Check permissions
4. ✅ **Token mapping** - Connect tokens to participants
5. **Run tests 3-4** - Test proposal and capability grant/revoke
6. **Reasoning messages** - Support reasoning/start, reasoning/thought, reasoning/conclusion
7. **Run test 5** - Test reasoning with context field
8. **Enhanced validation** - Better error messages and protocol checking
9. **Run test 6** - Test error recovery

## Next Steps

1. **Test Scenarios 3-4**: Create proper test agents and verify proposal/capability flows work
2. **Reasoning Messages**: Add support for reasoning message kinds with context field
3. **Fix FIFO Test Handling**: Improve test scripts to properly read FIFO outputs
4. **Enhanced Validation**: Add strict protocol version and payload validation
5. **Documentation**: Update README with capability system usage

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