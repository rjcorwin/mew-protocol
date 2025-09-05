# MEUP v0.2 Test Plan - Coding Agent Executable

## Testing Strategy

### Execution Method
All tests will be executed by the coding agent using the MEUP CLI in FIFO mode. The CLI interface specification is documented in [CLI_INTERFACE.md](./CLI_INTERFACE.md).

**Important Testing Approach:**
- Some participants are real autonomous agents (`meup agent start`):
  - **Echo agent**: Automatically echoes any chat message it receives
  - **Calculator agent**: Provides MCP tools (add, multiply, evaluate)
  - **Fulfiller agent**: Automatically fulfills any proposal it observes
- Other participants are CLI connections (`meup client connect`) puppeted by the coding agent:
  - **Proposer**: Coding agent manually sends proposals via CLI
  - **Coordinator**: Coding agent controls capability grants/revokes
  - **Test clients**: For sending test messages and observing responses
- The gateway assigns capabilities based on tokens/configuration
- This hybrid approach tests both agent integration and gateway enforcement

The coding agent will:
1. Start the gateway using the CLI
2. Connect multiple CLI clients with different tokens (simulating different agents)
3. Puppet these connections by sending/receiving messages through FIFO pipes
4. Manually generate appropriate responses to simulate agent behaviors
5. Capture and verify outputs using jq
6. Clean up all resources after each test

### Prerequisites

Before running tests, the coding agent will verify:
```bash
# Check if meup CLI is available
which meup || echo "ERROR: meup CLI not found in PATH"

# Check for required tools
which jq || echo "ERROR: jq not found (required for JSON parsing)"
which mkfifo || echo "ERROR: mkfifo not found (required for FIFO creation)"
which timeout || echo "ERROR: timeout not found (required for read timeouts)"

# Create test directory
TEST_DIR="/tmp/meup-tests-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create log directory
mkdir -p logs
```

### Test Environment Setup

```bash
#!/bin/bash
# Setup script that coding agent will execute

# Configuration
export GATEWAY_PORT=8080
export GATEWAY_URL="ws://localhost:${GATEWAY_PORT}"
export TEST_SPACE="test-space-$(date +%s)"
export LOG_DIR="./logs"

# Start gateway
echo "Starting gateway on port $GATEWAY_PORT..."
meup gateway start \
  --port "$GATEWAY_PORT" \
  --log-level debug \
  > "$LOG_DIR/gateway.log" 2>&1 &
GATEWAY_PID=$!

# Wait for gateway to be ready (max 30 seconds)
RETRIES=30
while [ $RETRIES -gt 0 ]; do
  if curl -s "http://localhost:${GATEWAY_PORT}/health" > /dev/null; then
    echo "Gateway is ready"
    break
  fi
  RETRIES=$((RETRIES - 1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "ERROR: Gateway failed to start"
  exit 1
fi

# Verify gateway health
curl -s "http://localhost:${GATEWAY_PORT}/health" | jq '.'
```

### Test Teardown

```bash
#!/bin/bash
# Teardown script that coding agent will execute after each test scenario

# Function to cleanup all resources
cleanup() {
  echo "=== Starting cleanup ==="
  
  # Kill all agent processes
  for pid_var in $(set | grep '_PID=' | cut -d'=' -f1); do
    pid=${!pid_var}
    if [ -n "$pid" ]; then
      echo "Killing process $pid_var ($pid)"
      kill $pid 2>/dev/null || true
    fi
  done
  
  # Kill gateway
  if [ -n "$GATEWAY_PID" ]; then
    echo "Stopping gateway (PID: $GATEWAY_PID)"
    kill $GATEWAY_PID 2>/dev/null || true
  fi
  
  # Remove all FIFOs
  echo "Removing FIFOs..."
  rm -f *-in *-out
  
  # Check for orphaned processes (only our user, more careful)
  ORPHANS=$(ps -u $USER | grep -E 'meup.*(gateway|agent|client)' | grep -v grep | grep -v "$$")
  if [ -n "$ORPHANS" ]; then
    echo "WARNING: Found potential orphaned MEUP processes:"
    echo "$ORPHANS"
    echo "Note: Only killing processes we explicitly started (tracked by PID)"
    # We only kill processes we tracked via their PIDs, not pattern matching
  fi
  
  echo "=== Cleanup complete ==="
}

# Set trap to cleanup on exit
trap cleanup EXIT
```

## Test Scenarios

### Scenario 1: Basic Message Flow with Echo Agent

**Setup Commands:**
```bash
# Terminal 2: Start echo agent (real autonomous agent)
meup agent start \
  --type echo \
  --gateway ws://localhost:8080 \
  --space test-space \
  --token "echo-token" &
ECHO_PID=$!

# Terminal 3: Connect test client with FIFO mode  
mkfifo cli-in cli-out
meup client connect \
  --space test-space \
  --participant-id test-client \
  --gateway ws://localhost:8080 \
  --fifo-in cli-in \
  --fifo-out cli-out &
CLI_PID=$!
```

**Test Steps (executed by coding agent):**
```bash
# Step 1: Wait for agents to connect (check gateway log)
tail -f gateway.log | grep -q "echo-agent connected"
tail -f gateway.log | grep -q "test-client connected"

# Step 2: Send chat message from CLI
echo '{"kind":"chat","payload":{"text":"Hello echo"}}' > cli-in

# Step 3: Read echo response from CLI output (echo agent auto-responds)
RESPONSE=$(timeout 5 cat cli-out | grep '"from":"echo-agent"' | head -1)
echo "$RESPONSE" | jq .

# Step 4: Verify response structure
echo "$RESPONSE" | jq -e '.protocol == "meup/v0.2"'
echo "$RESPONSE" | jq -e '.kind == "chat"'
echo "$RESPONSE" | jq -e '.from == "echo-agent"'
echo "$RESPONSE" | jq -e '.payload.text == "Echo: Hello echo"'

# Cleanup
kill $ECHO_PID $CLI_PID
rm cli-in cli-out
```

**Pass Criteria:**
- [ ] Gateway accepts connections
- [ ] Echo agent receives message
- [ ] Echo agent responds with proper envelope
- [ ] Response contains echoed text

### Scenario 2: MCP Tool Execution with Calculator Agent

**Setup Commands:**
```bash
# Start calculator agent (real autonomous agent)
meup agent start \
  --type calculator \
  --gateway ws://localhost:8080 \
  --space test-space \
  --token "calculator-token" &
CALC_PID=$!
# Note: Gateway grants MCP capabilities based on calculator-token

# Connect test client with FIFO mode
mkfifo cli-in cli-out  
meup client connect \
  --space test-space \
  --participant-id test-client \
  --gateway ws://localhost:8080 \
  --fifo-in cli-in \
  --fifo-out cli-out &
CLI_PID=$!
```

**Test Steps:**
```bash
# Step 1: List available tools
echo '{"kind":"mcp/request","payload":{"method":"tools/list","params":{}}}' > cli-in
TOOLS=$(timeout 5 cat cli-out | head -1)
echo "$TOOLS" | jq '.payload.result.tools'

# Verify calculator tools are present
echo "$TOOLS" | jq -e '.payload.result.tools[] | select(.name == "add")'
echo "$TOOLS" | jq -e '.payload.result.tools[] | select(.name == "multiply")'
echo "$TOOLS" | jq -e '.payload.result.tools[] | select(.name == "evaluate")'

# Step 2: Test add function
echo '{"kind":"mcp/request","to":["calc-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > cli-in
RESULT=$(timeout 5 cat cli-out | grep '"from":"calc-agent"' | grep '"kind":"mcp/response"' | head -1)
echo "$RESULT" | jq -e '.payload.result.content[0].text == "8"'

# Step 3: Test multiply function
echo '{"kind":"mcp/request","to":["calc-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":7,"b":6}}}}' > cli-in
RESULT=$(timeout 5 cat cli-out | grep '"from":"calc-agent"' | grep '"kind":"mcp/response"' | head -1)
echo "$RESULT" | jq -e '.payload.result.content[0].text == "42"'

# Step 4: Test evaluate expression
echo '{"kind":"mcp/request","to":["calc-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"2 * (3 + 4)"}}}}' > cli-in
RESULT=$(timeout 5 cat cli-out | grep '"from":"calc-agent"' | grep '"kind":"mcp/response"' | head -1)
echo "$RESULT" | jq -e '.payload.result.content[0].text == "14"'

# Step 5: Test error handling (invalid expression)
echo '{"kind":"mcp/request","to":["calc-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"2 * (3 +"}}}}' > cli-in
ERROR=$(timeout 5 cat cli-out | grep '"from":"calc-agent"' | grep '"kind":"mcp/response"' | grep '"error"' | head -1)
echo "$ERROR" | jq -e '.payload.error.message | contains("Invalid expression")'

# Cleanup
kill $CALC_PID $CLI_PID  
rm cli-in cli-out
```

**Pass Criteria:**
- [ ] Tool list returns calculator functions
- [ ] add(5, 3) returns 8
- [ ] multiply(7, 6) returns 42
- [ ] evaluate("2 * (3 + 4)") returns 14
- [ ] Invalid expressions return error

### Scenario 3: Untrusted Agent with Proposals

**Setup Commands:**
```bash
# Connect as proposer (untrusted, can only chat and propose)
mkfifo prop-in prop-out
meup client connect \
  --space test-space \
  --participant-id proposer-agent \
  --gateway ws://localhost:8080 \
  --token "proposer-token" \
  --fifo-in prop-in \
  --fifo-out prop-out &
PROP_PID=$!
# Note: Gateway determines capabilities based on token, not CLI flags

# Start fulfiller agent (real autonomous agent that auto-fulfills)
meup agent start \
  --type fulfiller \
  --gateway ws://localhost:8080 \
  --space test-space \
  --token "fulfiller-token" &
FULFILL_PID=$!
# Note: Gateway assigns trusted capabilities based on this token
```

**Test Steps:**
```bash
# Step 1: Proposer attempts direct tool call (should be blocked)
echo '{"kind":"mcp/request","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > prop-in
ERROR=$(timeout 5 cat prop-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("capability")'

# Step 2: Proposer creates proposal for tool call
PROPOSAL_JSON=$(cat <<EOF
{
  "kind": "mcp/proposal",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "add",
      "arguments": {"a": 5, "b": 3}
    }
  }
}
EOF
)
echo "$PROPOSAL_JSON" > prop-in

# Step 3: Wait for fulfiller to auto-execute the proposal
# The fulfiller agent automatically sees the proposal and executes it
sleep 2

# Note: We can observe the fulfillment request in the logs
# The fulfiller will send an mcp/request with correlation_id pointing to the proposal

# Step 5: Verify execution result (broadcast to all, proposer can observe)
RESULT=$(timeout 5 cat prop-out | grep '"kind":"mcp/response"' | grep "$PROPOSAL_ID" | head -1)
echo "$RESULT" | jq -e '.payload.result.content[0].text == "8"'

# Cleanup
kill $PROP_PID $FULFILL_PID
rm prop-in prop-out
```

**Pass Criteria:**
- [ ] Direct tool call by proposer is blocked
- [ ] Proposal creation succeeds
- [ ] Fulfiller receives proposal notification
- [ ] Fulfiller can accept and execute
- [ ] Result is returned to proposer

### Scenario 4: Dynamic Capability Granting

**Setup Commands:**
```bash
# Connect as coordinator (admin privileges via token)
mkfifo coord-in coord-out
meup client connect \
  --space test-space \
  --participant-id coordinator \
  --gateway ws://localhost:8080 \
  --token "admin-token" \
  --fifo-in coord-in \
  --fifo-out coord-out &
COORD_PID=$!

# Connect as limited agent (minimal capabilities)
mkfifo limited-in limited-out
meup client connect \
  --space test-space \
  --participant-id limited-agent \
  --gateway ws://localhost:8080 \
  --token "limited-token" \
  --fifo-in limited-in \
  --fifo-out limited-out &
LIMITED_PID=$!
```

**Test Steps:**
```bash
# Step 1: Limited agent attempts MCP operation (blocked)
echo '{"kind":"mcp/tools/list","payload":{}}' > limited-in
ERROR=$(timeout 5 cat limited-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("capability")'

# Step 2: Coordinator grants MCP capability
GRANT_JSON=$(cat <<EOF
{
  "kind": "capability/grant",
  "payload": {
    "to": "limited-agent",
    "capabilities": ["mcp/tools/list"]
  }
}
EOF
)
echo "$GRANT_JSON" > coord-in

# Step 3: Limited agent receives grant notification
GRANT=$(timeout 5 cat limited-out | grep '"kind":"capability/granted"' | head -1)
echo "$GRANT" | jq '.payload.capabilities'

# Step 4: Limited agent can now list tools
echo '{"kind":"mcp/tools/list","payload":{}}' > limited-in
TOOLS=$(timeout 5 cat limited-out | grep '"kind":"mcp/tools/response"' | head -1)
echo "$TOOLS" | jq -e '.payload.tools'

# Step 5: But still can't call tools
echo '{"kind":"mcp/tools/call","payload":{"tool":"add","params":{"a":1,"b":2}}}' > limited-in
ERROR=$(timeout 5 cat limited-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("capability")'

# Step 6: Coordinator revokes capability
REVOKE_JSON=$(cat <<EOF
{
  "kind": "capability/revoke",
  "payload": {
    "from": "limited-agent",
    "capabilities": ["mcp/tools/list"]
  }
}
EOF
)
echo "$REVOKE_JSON" > coord-in

# Step 7: Limited agent can no longer list tools
echo '{"kind":"mcp/tools/list","payload":{}}' > limited-in
ERROR=$(timeout 5 cat limited-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("capability")'

# Cleanup
kill $COORD_PID $LIMITED_PID
rm coord-in coord-out limited-in limited-out
```

**Pass Criteria:**
- [ ] Initial MCP access blocked
- [ ] Capability grant received
- [ ] Granted operation now works
- [ ] Non-granted operations still blocked
- [ ] Revoked capability is blocked again

### Scenario 5: Context Management

**Setup Commands:**
```bash
# Connect as research agent (we'll manage contexts)
mkfifo research-in research-out
meup client connect \
  --space test-space \
  --participant-id research-agent \
  --gateway ws://localhost:8080 \
  --token "research-token" \
  --fifo-in research-in \
  --fifo-out research-out &
RESEARCH_PID=$!

# Connect as calculator (responds to tool calls)
mkfifo calc-in calc-out
meup client connect \
  --space test-space \
  --participant-id calc-agent \
  --gateway ws://localhost:8080 \
  --token "calculator-token" \
  --fifo-in calc-in \
  --fifo-out calc-out &
CALC_PID=$!
```

**Test Steps:**
```bash
# Step 1: Send initial request
echo '{"kind":"chat","payload":{"text":"Calculate: 5 items at $12 each with 8% tax"}}' > research-in

# Step 2: Research agent pushes context for base cost calculation
CONTEXT_PUSH=$(timeout 5 cat research-out | grep '"kind":"context/push"' | head -1)
CONTEXT_ID_1=$(echo "$CONTEXT_PUSH" | jq -r '.correlation_id')
echo "$CONTEXT_PUSH" | jq -e '.payload.topic == "calculate-base-cost"'

# Step 3: Within context, ask calculator to multiply
echo '{"kind":"mcp/tools/call","to":["calc-agent"],"correlation_id":"'$CONTEXT_ID_1'","payload":{"tool":"multiply","params":{"a":5,"b":12}}}' > research-in

# Step 4: Verify calculator response has context correlation
CALC_RESPONSE=$(timeout 5 cat calc-out | grep "$CONTEXT_ID_1" | head -1)
echo "$CALC_RESPONSE" | jq -e '.correlation_id == "'$CONTEXT_ID_1'"'
echo "$CALC_RESPONSE" | jq -e '.payload.result == 60'

# Step 5: Pop context
echo '{"kind":"context/pop","correlation_id":"'$CONTEXT_ID_1'"}' > research-in

# Step 6: Push new context for tax calculation
CONTEXT_PUSH=$(timeout 5 cat research-out | grep '"kind":"context/push"' | tail -1)
CONTEXT_ID_2=$(echo "$CONTEXT_PUSH" | jq -r '.correlation_id')
echo "$CONTEXT_PUSH" | jq -e '.payload.topic == "calculate-tax"'

# Step 7: Calculate tax
echo '{"kind":"mcp/tools/call","to":["calc-agent"],"correlation_id":"'$CONTEXT_ID_2'","payload":{"tool":"multiply","params":{"a":60,"b":0.08}}}' > research-in
CALC_RESPONSE=$(timeout 5 cat calc-out | grep "$CONTEXT_ID_2" | head -1)
echo "$CALC_RESPONSE" | jq -e '.payload.result == 4.8'

# Step 8: Pop tax context
echo '{"kind":"context/pop","correlation_id":"'$CONTEXT_ID_2'"}' > research-in

# Step 9: Push context for total
CONTEXT_PUSH=$(timeout 5 cat research-out | grep '"kind":"context/push"' | tail -1)
CONTEXT_ID_3=$(echo "$CONTEXT_PUSH" | jq -r '.correlation_id')

# Step 10: Calculate total
echo '{"kind":"mcp/tools/call","to":["calc-agent"],"correlation_id":"'$CONTEXT_ID_3'","payload":{"tool":"add","params":{"a":60,"b":4.8}}}' > research-in
CALC_RESPONSE=$(timeout 5 cat calc-out | grep "$CONTEXT_ID_3" | head -1)
echo "$CALC_RESPONSE" | jq -e '.payload.result == 64.8'

# Step 11: Pop final context
echo '{"kind":"context/pop","correlation_id":"'$CONTEXT_ID_3'"}' > research-in

# Step 12: Verify final response
FINAL_RESPONSE=$(timeout 5 cat research-out | grep '"kind":"chat"' | grep "64.80" | head -1)
echo "$FINAL_RESPONSE" | jq -e '.payload.text | contains("$64.80")'

# Cleanup
kill $RESEARCH_PID $CALC_PID
rm research-in research-out calc-in calc-out
```

**Pass Criteria:**
- [ ] Context push creates new correlation ID
- [ ] Messages within context use that correlation ID
- [ ] Context pop returns to parent
- [ ] Each context maintains isolation
- [ ] Final result correctly aggregates all calculations

### Scenario 6: Error Recovery and Edge Cases

**Setup Commands:**
```bash
# Use existing gateway from previous tests
```

**Test Steps:**
```bash
# Test 1: Malformed JSON
mkfifo test-in test-out
meup cli connect --space test-space --participant-id test-client \
  --gateway ws://localhost:8080 --fifo-in test-in --fifo-out test-out &
TEST_PID=$!

echo '{"kind":"chat", invalid json}' > test-in
ERROR=$(timeout 5 cat test-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("JSON")'

# Test 2: Missing required fields
echo '{"kind":"chat"}' > test-in  # Missing payload
ERROR=$(timeout 5 cat test-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("payload")'

# Test 3: Invalid protocol version
echo '{"protocol":"meup/v0.1","kind":"chat","payload":{"text":"test"}}' > test-in
ERROR=$(timeout 5 cat test-out | grep '"kind":"system/error"' | head -1)
echo "$ERROR" | jq -e '.payload.error | contains("protocol")'

# Test 4: Disconnect and reconnect
kill $TEST_PID
sleep 2
meup cli connect --space test-space --participant-id test-client \
  --gateway ws://localhost:8080 --fifo-in test-in --fifo-out test-out &
TEST_PID=$!
echo '{"kind":"chat","payload":{"text":"reconnected"}}' > test-in
RESPONSE=$(timeout 5 cat test-out | grep '"kind":"chat"' | head -1)
echo "$RESPONSE" | jq -e '.payload.text'

# Cleanup
kill $TEST_PID
rm test-in test-out
```

**Pass Criteria:**
- [ ] Malformed JSON returns error
- [ ] Missing fields return error
- [ ] Invalid protocol rejected
- [ ] Reconnection works

## Final Cleanup

```bash
# Stop all processes
kill $GATEWAY_PID
rm *.log

# Verify all FIFOs cleaned up
ls *.in *.out 2>/dev/null || echo "All FIFOs cleaned"

# Check for orphaned processes
ps aux | grep meup | grep -v grep || echo "No orphaned processes"
```

## Test Execution Summary

The coding agent will execute these tests by:

1. **Starting services**: Use bash commands to start gateway and agents
2. **Creating FIFOs**: Make named pipes for bidirectional communication
3. **Sending messages**: Echo JSON messages into input FIFOs
4. **Reading responses**: Read from output FIFOs with timeout
5. **Verifying results**: Use jq to parse and validate JSON responses
6. **Cleanup**: Kill processes and remove FIFOs

Each test step includes:
- Exact command to run
- Expected output format
- Validation using jq queries
- Error conditions to check

## Success Criteria

All tests pass when:
1. Each jq validation returns 0 (success)
2. No unexpected errors in gateway.log
3. All processes start and stop cleanly
4. FIFOs are properly cleaned up
5. Expected message flows complete within timeout