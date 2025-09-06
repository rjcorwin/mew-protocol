#!/bin/bash
# Test Scenario 3: Untrusted Agent with Proposals

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 3: Proposals with Capability Blocking ===${NC}"

# Create test directory
TEST_DIR="./test-run-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Copy space configuration
cp ../../cli/space.yaml ./

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway with space configuration
echo "Starting gateway on port $PORT..."
../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"

# Start calculator agent (to execute the actual tool calls)
echo "Starting calculator agent..."
node ../../tests/agents/calculator.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "calculator-token" \
  > calculator.log 2>&1 &
CALC_PID=$!

sleep 2

# Start fulfiller agent (auto-fulfills proposals)
echo "Starting fulfiller agent..."
node ../../tests/agents/fulfiller.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "fulfiller-token" \
  > fulfiller.log 2>&1 &
FULFILL_PID=$!

sleep 2

# Check if agents are running
if ! kill -0 $CALC_PID 2>/dev/null; then
  echo -e "${RED}Calculator agent failed to start${NC}"
  cat calculator.log
  exit 1
fi

if ! kill -0 $FULFILL_PID 2>/dev/null; then
  echo -e "${RED}Fulfiller agent failed to start${NC}"
  cat fulfiller.log
  exit 1
fi

echo -e "${GREEN}✓ Calculator agent started${NC}"
echo -e "${GREEN}✓ Fulfiller agent started${NC}"

# Connect as proposer (untrusted, can only chat and propose)
mkfifo prop-in prop-out

# Start reading from FIFO in background
cat prop-out > responses.txt &
CAT_PID=$!

echo "Connecting proposer agent (limited capabilities)..."
../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id proposer-agent \
  --token "proposer-token" \
  --fifo-in prop-in \
  --fifo-out prop-out \
  > proposer.log 2>&1 &
PROP_PID=$!

# Wait for proposer to connect
sleep 3

# Create a background process to write to FIFO
(
  # Test 1: Proposer attempts direct tool call (should be blocked)
  echo '{"kind":"mcp/request","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}'
  sleep 2
  # Test 2: Send proposal (broadcast so fulfiller sees it)
  echo '{"id":"proposal-123","kind":"mcp/proposal","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}'
  sleep 5
) > prop-in &
WRITER_PID=$!

# Test 1: Check for blocked request
echo -e "\n${YELLOW}Test 1: Direct MCP request (should be blocked)${NC}"
sleep 3

if grep -q '"error":"capability_violation"' responses.txt || grep -q 'capability' responses.txt; then
  echo -e "${GREEN}✓ Direct tool call blocked as expected${NC}"
  ERROR_MSG=$(grep 'capability' responses.txt | head -1)
  echo "Error received: $(echo "$ERROR_MSG" | jq -c '.payload.error' 2>/dev/null || echo "$ERROR_MSG")"
else
  echo -e "${RED}✗ Expected capability error not received${NC}"
fi

# Test 2: Check proposal processing
echo -e "\n${YELLOW}Test 2: Creating proposal (should succeed)${NC}"
echo "Waiting for fulfiller to process proposal..."
sleep 5

# Check if proposer sent the proposal
if grep -q '"id":"proposal-123"' proposer.log; then
  echo -e "${GREEN}✓ Proposer sent proposal${NC}"
else
  echo -e "${RED}✗ Proposer did not send proposal${NC}"
fi

# Check if proposal was sent to gateway
if grep -q '"kind":"mcp/proposal"' gateway.log; then
  echo -e "${GREEN}✓ Proposal reached gateway${NC}"
else
  echo -e "${YELLOW}⚠ Could not verify proposal in gateway log${NC}"
fi

# Check if fulfiller saw and fulfilled the proposal
if grep -q 'Fulfilled proposal' fulfiller.log; then
  echo -e "${GREEN}✓ Fulfiller processed the proposal${NC}"
else
  echo -e "${YELLOW}⚠ Fulfiller may not have processed proposal${NC}"
fi

# Test 3: Check if we can see the result
echo -e "\n${YELLOW}Test 3: Checking for execution result${NC}"

# Wait a bit more for the full flow to complete
sleep 2

# Check if calculator received and processed the request
if grep -q 'Received MCP request: tools/call' calculator.log; then
  echo -e "${GREEN}✓ Calculator received the fulfillment request${NC}"
else
  echo -e "${RED}✗ Calculator did not receive request${NC}"
fi

# The fulfiller should have sent an mcp/request with correlation to the proposal
if grep -q '"correlation_id":\["proposal-123"\]' responses.txt || grep -q 'fulfill-' responses.txt; then
  echo -e "${GREEN}✓ Fulfillment request observed${NC}"
else
  echo -e "${YELLOW}⚠ Could not find fulfillment request${NC}"
fi

# Check if calculator responded with result
if grep -q '"text":"8"' responses.txt; then
  echo -e "${GREEN}✓ Calculator returned correct result (8)${NC}"
else
  echo -e "${YELLOW}⚠ Could not find calculator result in responses${NC}"
  # Check if the calculator at least sent a response
  if grep -q 'Sent response for tools/call' calculator.log; then
    echo -e "${GREEN}✓ Calculator sent response (check logs)${NC}"
  fi
fi

# Stop reading from FIFO
kill $CAT_PID 2>/dev/null || true

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
PASS_COUNT=0
FAIL_COUNT=0

# Check test results
if grep -q 'capability' responses.txt; then
  echo -e "${GREEN}✓ Capability blocking works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Capability blocking failed${NC}"
  ((FAIL_COUNT++))
fi

if grep -q 'Fulfilled proposal' fulfiller.log; then
  echo -e "${GREEN}✓ Proposal flow works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Proposal flow failed${NC}"
  ((FAIL_COUNT++))
fi

if grep -q 'Sent response for tools/call' calculator.log; then
  echo -e "${GREEN}✓ Execution through proposal works${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Execution through proposal failed${NC}"
  ((FAIL_COUNT++))
fi

echo ""
echo "Tests passed: $PASS_COUNT / 3"
echo ""
echo "Debug info:"
echo "- Proposer messages sent: $(grep -c 'Sent to gateway' proposer.log 2>/dev/null || echo 0)"
echo "- Fulfiller proposals seen: $(grep -c 'Saw proposal' fulfiller.log 2>/dev/null || echo 0)"
echo "- Calculator requests received: $(grep -c 'Received MCP request' calculator.log 2>/dev/null || echo 0)"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}=== SCENARIO 3 PASSED ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 3 FAILED ===${NC}"
  echo -e "\n${YELLOW}Debug output:${NC}"
  echo "Last gateway log entries:"
  tail -10 gateway.log | grep -E "(capability|proposal|Capability)" || tail -5 gateway.log
  echo ""
  echo "Fulfiller log:"
  cat fulfiller.log | grep -v "^$" | tail -5
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $WRITER_PID 2>/dev/null || true
kill $CALC_PID 2>/dev/null || true
kill $FULFILL_PID 2>/dev/null || true
kill $PROP_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f prop-in prop-out responses.txt

# Debug: Show what messages were actually sent
echo -e "\n${YELLOW}Debug: Last lines of proposer.log:${NC}"
tail -20 proposer.log

cd ..
# Keep test directory for debugging if test failed
if [ $EXIT_CODE -eq 0 ]; then
  rm -rf "$TEST_DIR"
else
  echo -e "${YELLOW}Test directory kept for debugging: $TEST_DIR${NC}"
fi

exit $EXIT_CODE