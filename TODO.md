# TODO

## Current Focus: Enable TEST_PLAN.md Scenarios 3-6

Implementation priorities to get tests passing:

### 🔥 Immediate Priority: Minimal Capability System (Unblocks Scenarios 3-4)

#### Step 1: Gateway Hooks (gateway-enhanced.js)
- [ ] Add setCapabilityResolver() hook to gateway
- [ ] Add onParticipantJoined() callback to gateway  
- [ ] Add setAuthorizationHook() for message validation
- [ ] Gateway calls resolver on every message

#### Step 2: Space Config Loader (commands/gateway.js)
- [ ] Load space.yaml on gateway start with --space-config flag
- [ ] Parse participants and capabilities using js-yaml
- [ ] Implement capability resolver that uses space.yaml data
- [ ] Wire resolver to gateway hooks

#### Step 3: Capability Matching (use capability-matcher)
- [ ] Integrate @meup/capability-matcher from SDK
- [ ] Implement hasCapability() check using patterns from space.yaml
- [ ] Support wildcards (mcp/*) and simple strings (chat)
- [ ] Return capability subsets based on message kind

#### Step 4: Token → Participant Mapping
- [ ] Map tokens to participants from space.yaml
- [ ] Look up capabilities by token
- [ ] Handle unknown tokens with defaults
- [ ] Store participant ID on connection

### 🚀 Priority 2: Process Management (Nice to have, not blocking tests)
- [ ] Auto-start agents with auto_start: true
- [ ] Spawn processes with command/args/env
- [ ] Implement restart policies
- [ ] Track spawned process PIDs

### 🚀 Priority 3: Context Management (Enables Scenario 5)
- [ ] Add context stack to gateway per participant
- [ ] Implement context/push handler
- [ ] Implement context/pop handler
- [ ] Preserve correlation_id arrays through context operations
- [ ] Track context hierarchy in message routing

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
- [ ] Scenario 3: Proposals with capability blocking → **Blocked on capability system**
- [ ] Scenario 4: Dynamic capability granting → **Blocked on capability system**
- [ ] Scenario 5: Context management → **Blocked on context implementation**
- [ ] Scenario 6: Error recovery → **Needs better validation**

## Implementation Order

1. **Gateway hooks** - Enable capability resolution
2. **Space config loader** - Read space.yaml
3. **Capability matcher** - Check permissions
4. **Token mapping** - Connect tokens to participants
5. Run tests 3-4 ✅
6. **Context management** - Add push/pop
7. Run test 5 ✅
8. **Validation** - Better errors
9. Run test 6 ✅

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