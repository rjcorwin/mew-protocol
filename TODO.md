# TODO

## 🎯 Current Focus: Test Infrastructure Refactoring

### Goals
- Simplify test setup by making each test space self-contained
- Implement `meup space up/down` commands for automated space management
- Reduce redundancy in test scripts and documentation
- Create a cleaner separation between different test scenarios
- **Keep everything within the current directory** - no /tmp usage or external paths
  - Test artifacts stay in test directories
  - Logs go to `./logs/` within each test space
  - PID files in `./.meup/` within the space directory
  - FIFOs in `./fifos/` within the space directory

### Phase 1: Test Space Reorganization
- [ ] Create `test-spaces/` directory structure:
  - [ ] `test-spaces/scenario-1-basic/` - Basic message flow test
    - [ ] `space.yaml` - Only echo agent and test client
    - [ ] `agents/` - Just echo.js
    - [ ] `test.sh` - Test script for this scenario
  - [ ] `test-spaces/scenario-2-mcp/` - MCP tool execution
    - [ ] `space.yaml` - Calculator agent and test client
    - [ ] `agents/` - Just calculator.js
    - [ ] `test.sh` - Test script
  - [ ] `test-spaces/scenario-3-proposals/` - Proposal flow
    - [ ] `space.yaml` - Calculator, fulfiller, proposer
    - [ ] `agents/` - calculator.js, fulfiller.js
    - [ ] `test.sh` - Test script
  - [ ] `test-spaces/scenario-4-capabilities/` - Dynamic capabilities
    - [ ] `space.yaml` - Coordinator, limited-agent, calculator
    - [ ] `agents/` - calculator.js
    - [ ] `test.sh` - Test script
  - [ ] `test-spaces/scenario-5-reasoning/` - Reasoning messages
    - [ ] `space.yaml` - Research agent, calculator
    - [ ] `agents/` - calculator.js
    - [ ] `test.sh` - Test script
  - [ ] `test-spaces/scenario-6-errors/` - Error recovery
    - [ ] `space.yaml` - Test client only
    - [ ] `test.sh` - Test script
  - [ ] `test-spaces/shared-agents/` - Shared agent implementations
    - [ ] All agent .js files that can be symlinked/copied

### Phase 2: Implement `meup space` Commands
- [ ] Add FIFO configuration support to space.yaml:
  - [ ] Add optional `fifo: true/false` field per participant
  - [ ] Or `fifo: { enabled: true, path: "./custom/path" }` for custom paths
  - [ ] Default to no FIFO unless explicitly configured

- [ ] `meup space up` command:
  - [ ] Read space.yaml in current directory (or --space-dir)
  - [ ] Start gateway with space configuration
  - [ ] Auto-start agents with auto_start: true
  - [ ] For participants with `fifo: true` in space.yaml:
    - [ ] Create FIFOs in `./fifos/` (or custom path):
      - [ ] `{participant-id}-in`
      - [ ] `{participant-id}-out`
    - [ ] Auto-connect participant using FIFO mode
  - [ ] Save PID file for cleanup (`.meup/pids.json`)
  - [ ] Display connection info and status

- [ ] `meup space down` command:
  - [ ] Read PID file from `.meup/pids.json`
  - [ ] Gracefully shutdown gateway
  - [ ] Terminate all agent processes
  - [ ] Clean up FIFOs
  - [ ] Remove PID file

- [ ] `meup space status` command:
  - [ ] Show running spaces
  - [ ] List connected participants
  - [ ] Display gateway health
  - [ ] Show FIFO paths

### Phase 3: Test Script Simplification
- [ ] Create `test-spaces/scenario-0-manual/`:
  - [ ] Manual startup test (current approach)
  - [ ] Verify each component can be started individually
  - [ ] Document as "debugging/development" scenario

- [ ] Update remaining test scripts to use `meup space up/down`:
  - [ ] Remove redundant gateway startup code
  - [ ] Remove FIFO creation (handled by `meup space up`)
  - [ ] Simplify to just:
    ```bash
    meup space up
    # Run test logic
    meup space down
    ```

- [ ] Create master test runner:
  - [ ] `run-all-tests.sh` that iterates through test-spaces/scenario-*
  - [ ] Each test is self-contained in its directory
  - [ ] No assembly required - just cd and run
  - [ ] Test output logs stay in each scenario directory (not /tmp)
  - [ ] Summary report written to `./test-results.log`

### Phase 4: Documentation Updates
- [ ] Update TEST_PLAN.md:
  - [ ] Remove redundant setup instructions
  - [ ] Document new test-spaces structure
  - [ ] Explain `meup space up/down` usage
  - [ ] Keep focus on test scenarios, not implementation details

- [ ] Create test-spaces/README.md:
  - [ ] Overview of test organization
  - [ ] How to run individual tests
  - [ ] How to create new test scenarios

### Phase 5: Cleanup and Polish
- [ ] Remove old test-scenario*.sh files from tests/
- [ ] Remove test-space/ directory (replaced by test-spaces/*)
- [ ] Update .gitignore for test artifacts
- [ ] Ensure all tests pass with new structure

## 🚀 Future Enhancements (After Refactoring)

### Enhanced Space Management
- [ ] `meup space logs` - Tail logs from all participants
- [ ] `meup space restart` - Restart failed agents
- [ ] `meup space scale` - Add/remove agent instances
- [ ] Support for multiple spaces running simultaneously

### Interactive Connection
- [ ] `meup space connect` - Interactive terminal UI
- [ ] Parse participant from space.yaml
- [ ] Handle authentication/token prompt
- [ ] Process slash commands (/help, /participants, etc.)

### Production Features
- [ ] Configuration management (~/.meup/config.yaml)
- [ ] Environment variable support
- [ ] TLS/SSL support
- [ ] Rate limiting
- [ ] Token generation and validation

## 📊 Success Metrics
- All 6 test scenarios pass with new structure
- Test setup time reduced from minutes to seconds
- Single command to run entire test suite
- Each test scenario is self-documenting
- No manual assembly of test environments

---

## Archived: Completed Work

### ✅ MEUP v0.2 Protocol Implementation
- All core protocol features implemented
- Gateway with WebSocket support
- Capability-based access control
- Dynamic capability granting/revoking
- MCP tool execution and proposals
- Reasoning messages with context field
- Error recovery and validation

### ✅ Test Scenarios (Current Implementation)
- Scenario 1: Basic Message Flow ✅
- Scenario 2: MCP Tool Execution ✅
- Scenario 3: Proposals with capabilities ✅
- Scenario 4: Dynamic capability granting ✅ (8/9 tests)
- Scenario 5: Reasoning with context ✅
- Scenario 6: Error recovery ✅ (5/6 tests)