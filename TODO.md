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

### Phase 3: Test Script Simplification

**Context**: Now that we have `meup space up/down` commands working (Phase 2), we can dramatically simplify our test scripts. Currently, each test script (`test-spaces/scenario-*/test.sh`) manually:
- Starts the gateway
- Creates FIFOs
- Manages PIDs
- Handles cleanup

This can all be replaced with `meup space up` and `meup space down` commands.

**Current State**:
- Each scenario has a `test.sh` that does manual setup (see `test-spaces/scenario-1-basic/test.sh` for example)
- There's also a `test-with-space-cmd.sh` in scenario-1-basic that shows how to use space commands
- All scenarios have proper `space.yaml` files with `fifo: true` configured where needed

**What needs to be done**:

- [ ] Create `test-spaces/scenario-0-manual/`:
  - [ ] Copy the current manual approach from existing test.sh files
  - [ ] This preserves the ability to debug individual components
  - [ ] Add README explaining when to use manual vs automated startup
  - [ ] Document as "debugging/development" scenario

- [ ] Update all test scripts (`test-spaces/scenario-*/test.sh`) to use `meup space up/down`:
  - [ ] Remove gateway startup code (lines creating gateway process)
  - [ ] Remove FIFO creation code (now handled by `meup space up`)
  - [ ] Remove PID management code
  - [ ] Replace with simple pattern:
    ```bash
    # Start the space
    ../../../cli/bin/meup.js space up --port $PORT
    
    # Connect any manual agents if needed (ones without auto_start)
    # ... test logic here ...
    
    # Stop the space
    ../../../cli/bin/meup.js space down
    ```
  - [ ] Update each scenario:
    - [ ] scenario-1-basic/test.sh
    - [ ] scenario-2-mcp/test.sh
    - [ ] scenario-3-proposals/test.sh
    - [ ] scenario-4-capabilities/test.sh
    - [ ] scenario-5-reasoning/test.sh
    - [ ] scenario-6-errors/test.sh

- [x] Create master test runner:
  - [x] `run-all-tests.sh` that iterates through test-spaces/scenario-*
  - [x] Each test is self-contained in its directory
  - [x] No assembly required - just cd and run
  - [x] Test output logs stay in each scenario directory (not /tmp)
  - [x] Summary report written to `./test-results.log`

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