# TODO

## 🎯 Current Focus: Update All Test Scenarios to New Pattern

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

### Phase 1: Test Space Reorganization ✅
- [x] Create `test-spaces/` directory structure:
  - [x] `test-spaces/scenario-1-basic/` - Basic message flow test
    - [x] `space.yaml` - Only echo agent and test client
    - [x] `agents/` - Just echo.js
    - [x] `test.sh` - Test script for this scenario
  - [x] `test-spaces/scenario-2-mcp/` - MCP tool execution
    - [x] `space.yaml` - Calculator agent and test client
    - [x] `agents/` - Just calculator.js
    - [x] `test.sh` - Test script
  - [x] `test-spaces/scenario-3-proposals/` - Proposal flow
    - [x] `space.yaml` - Calculator, fulfiller, proposer
    - [x] `agents/` - calculator.js, fulfiller.js
    - [x] `test.sh` - Test script
  - [x] `test-spaces/scenario-4-capabilities/` - Dynamic capabilities
    - [x] `space.yaml` - Coordinator, limited-agent, calculator
    - [x] `agents/` - calculator.js
    - [x] `test.sh` - Test script
  - [x] `test-spaces/scenario-5-reasoning/` - Reasoning messages
    - [x] `space.yaml` - Research agent, calculator
    - [x] `agents/` - calculator.js
    - [x] `test.sh` - Test script
  - [x] `test-spaces/scenario-6-errors/` - Error recovery
    - [x] `space.yaml` - Test client only
    - [x] `test.sh` - Test script
  - [x] `test-spaces/shared-agents/` - Shared agent implementations
    - [x] All agent .js files that can be symlinked/copied
  - [x] `test-spaces/run-all-tests.sh` - Master test runner created

### Phase 2: Implement `meup space` Commands ✅
- [x] Add FIFO configuration support to space.yaml:
  - [x] Add optional `fifo: true/false` field per participant
  - [x] Default to no FIFO unless explicitly configured

- [x] `meup space up` command:
  - [x] Read space.yaml in current directory (or --space-dir)
  - [x] Start gateway with space configuration
  - [x] Auto-start agents with auto_start: true
  - [x] For participants with `fifo: true` in space.yaml:
    - [x] Create FIFOs in `./fifos/`:
      - [x] `{participant-id}-in`
      - [x] `{participant-id}-out`
  - [x] Save PID file for cleanup (`.meup/pids.json`)
  - [x] Display connection info and status

- [x] `meup space down` command:
  - [x] Read PID file from `.meup/pids.json`
  - [x] Gracefully shutdown gateway
  - [x] Terminate all agent processes
  - [x] Clean up FIFOs
  - [x] Remove PID file

- [x] `meup space status` command:
  - [x] Show running spaces
  - [x] List connected participants
  - [x] Display gateway health
  - [x] Show FIFO paths

### Phase 2.5: Fix Space Command Issues ✅
- [x] **Background process management**: Improve handling of detached processes to prevent orphaning
- [x] **PID validation**: Validate that stored PIDs are still running and belong to expected commands
- [x] **FIFO creation error handling**: Check if `mkfifo` command is available before using it
- [x] **Port conflict checking**: Check if port is already in use before starting gateway
- [x] **Implement auto-connect**: Add auto_connect support for FIFO participants in space.yaml
- [x] **Fix runningSpaces persistence**: Store running spaces in ~/.meup/running-spaces.json so status works across CLI sessions
- [x] **Add gateway health check**: Replace fixed sleep with actual health check when starting gateway

### Phase 3: Update All Test Scenarios to Use New Pattern

**Context**: We've successfully implemented:
- ✅ PM2-based process management (solved gateway lifecycle issue)
- ✅ `meup space up/down/status` commands working reliably
- ✅ `meup space clean` command for artifact cleanup
- ✅ scenario-0-manual created with modular test pattern (setup.sh, check.sh, teardown.sh)

**Pattern from scenario-0-manual**:
- `setup.sh` - Initializes the space (uses `meup space up`)
- `check.sh` - Runs test assertions (can be run independently)
- `teardown.sh` - Cleans up the space (uses `meup space down` and `meup space clean`)
- `test.sh` - Combines all three for automated testing

**What needs to be done**:

- [x] Update scenario-1-basic to use new pattern: ✅
  - [x] Create setup.sh, check.sh, teardown.sh scripts
  - [x] Update test.sh to use the modular scripts
  - [x] Add echo agent to space.yaml with auto_start
  - [x] Test that all checks pass
  - [x] Fix FIFO blocking issues with output_log configuration
  - [x] Fix test.sh hanging issues

- [ ] Update scenario-2-mcp to use new pattern:
  - [ ] Create setup.sh, check.sh, teardown.sh scripts
  - [ ] Update test.sh to use the modular scripts
  - [ ] Add calculator agent to space.yaml with auto_start
  - [ ] Test MCP tool execution works

- [ ] Update scenario-3-proposals to use new pattern:
  - [ ] Create setup.sh, check.sh, teardown.sh scripts
  - [ ] Update test.sh to use the modular scripts
  - [ ] Add all agents to space.yaml with auto_start
  - [ ] Test proposal flow works

- [ ] Update scenario-4-capabilities to use new pattern:
  - [ ] Create setup.sh, check.sh, teardown.sh scripts
  - [ ] Update test.sh to use the modular scripts
  - [ ] Add agents to space.yaml with auto_start
  - [ ] Test capability management works

- [ ] Update scenario-5-reasoning to use new pattern:
  - [ ] Create setup.sh, check.sh, teardown.sh scripts
  - [ ] Update test.sh to use the modular scripts
  - [ ] Add agents to space.yaml with auto_start
  - [ ] Test reasoning messages work

- [ ] Update scenario-6-errors to use new pattern:
  - [ ] Create setup.sh, check.sh, teardown.sh scripts
  - [ ] Update test.sh to use the modular scripts
  - [ ] Update space.yaml configuration
  - [ ] Test error handling works

- [x] Create master test runner:
  - [x] `run-all-tests.sh` that iterates through test-spaces/scenario-*
  - [x] Each test is self-contained in its directory
  - [x] No assembly required - just cd and run
  - [x] Test output logs stay in each scenario directory (not /tmp)
  - [x] Summary report written to `./test-results.log`

### Phase 4: Verify All Tests Pass
- [ ] Run `test-spaces/run-all-tests.sh`
- [ ] Ensure all 6 scenarios pass
- [ ] Fix any failures or race conditions
- [ ] Document any known issues

### Phase 5: Documentation Updates
- [ ] Update TEST_PLAN.md to reflect new test structure
- [ ] Update test-spaces/README.md with:
  - [ ] How to run tests
  - [ ] How to debug failing tests
  - [ ] How to create new test scenarios
- [ ] Document the modular test pattern for future contributors

## 🔧 Future Improvements for Space Commands

### Robustness Enhancements
- [ ] **Race condition in FIFO creation**: Add file locking or sequential creation when multiple participants create FIFOs simultaneously
- [ ] **WebSocket health check**: Extend health check to verify WebSocket server, not just HTTP endpoint
- [ ] **Space.yaml validation**: Validate that space.yaml hasn't changed between `space up` and `space down`
- [ ] **Token validation**: Improve token handling to validate against actual space configuration
- [ ] **Configurable health check timeout**: Make the 30-second health check timeout configurable

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

### ✅ Gateway Process Lifecycle Issue (RESOLVED)
- **Solution**: Implemented PM2 as embedded process manager
- **ADR**: Created ADR-001-pmg-process-manager.md
- **Status**: Gateway now stays alive reliably when spawned by `meup space up`

### ✅ Space Cleanup Command
- **Implementation**: Created `meup space clean` command
- **ADR**: Created ADR-002-cln-space-cleanup-command.md
- **Features**: Dry-run, selective cleaning, safety checks
- **Status**: Fully integrated into test scripts

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