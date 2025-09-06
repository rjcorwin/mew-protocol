#!/bin/bash
# Test Scenario 3: Proposals with Capability Blocking

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 3: Proposals with Capability Blocking ===${NC}"

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway with space configuration
echo "Starting gateway on port $PORT..."
../../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > ./logs/gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat ./logs/gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"

# Start calculator agent
echo "Starting calculator agent..."
node ./agents/calculator.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "calculator-token" \
  > ./logs/calculator.log 2>&1 &
CALC_PID=$!

# Start fulfiller agent
echo "Starting fulfiller agent..."
node ./agents/fulfiller.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "fulfiller-token" \
  > ./logs/fulfiller.log 2>&1 &
FULFILLER_PID=$!

sleep 3

# Check if agents are running
if ! kill -0 $CALC_PID 2>/dev/null; then
  echo -e "${RED}Calculator agent failed to start${NC}"
  cat ./logs/calculator.log
  exit 1
fi

if ! kill -0 $FULFILLER_PID 2>/dev/null; then
  echo -e "${RED}Fulfiller agent failed to start${NC}"
  cat ./logs/fulfiller.log
  exit 1
fi

echo -e "${GREEN}✓ Agents started${NC}"

# Create FIFOs for proposer
mkdir -p ./fifos
mkfifo ./fifos/proposer-in ./fifos/proposer-out

# Connect proposer
echo "Connecting proposer..."
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id proposer \
  --token "proposer-token" \
  --fifo-in ./fifos/proposer-in \
  --fifo-out ./fifos/proposer-out \
  > ./logs/proposer.log 2>&1 &
PROPOSER_PID=$!

# Start reading from FIFO
cat ./fifos/proposer-out > ./logs/responses.txt &
CAT_PID=$!

# Wait for connection
sleep 3

echo -e "\n${YELLOW}=== Running Proposal Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Proposer cannot directly call MCP tools
echo -e "\n${YELLOW}Test 1: Proposer attempts direct MCP call (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":1,"b":2}}}}' > ./fifos/proposer-in
sleep 2

if grep -q '"kind":"system/error"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Direct MCP call blocked${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Direct MCP call was not blocked${NC}"
  ((FAIL_COUNT++))
fi

# Test 2: Send proposal to fulfiller
echo -e "\n${YELLOW}Test 2: Send valid proposal${NC}"
PROPOSAL_JSON='{
  "kind":"mcp/proposal",
  "to":["fulfiller"],
  "payload":{
    "description":"Calculate sum of 10 and 20",
    "tool":"add",
    "arguments":{"a":10,"b":20}
  }
}'
echo "$PROPOSAL_JSON" > ./fifos/proposer-in
sleep 3

# Check if fulfiller processed the proposal
if grep -q 'Processing proposal' ./logs/fulfiller.log && grep -q 'Result: 30' ./logs/fulfiller.log; then
  echo -e "${GREEN}✓ Proposal processed by fulfiller${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Proposal not processed${NC}"
  ((FAIL_COUNT++))
fi

# Test 3: Send another proposal
echo -e "\n${YELLOW}Test 3: Send multiplication proposal${NC}"
PROPOSAL_JSON='{
  "kind":"mcp/proposal",
  "to":["fulfiller"],
  "payload":{
    "description":"Calculate product of 6 and 7",
    "tool":"multiply",
    "arguments":{"a":6,"b":7}
  }
}'
echo "$PROPOSAL_JSON" > ./fifos/proposer-in
sleep 3

if grep -q 'Result: 42' ./logs/fulfiller.log; then
  echo -e "${GREEN}✓ Multiplication proposal executed (result: 42)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Multiplication proposal failed${NC}"
  ((FAIL_COUNT++))
fi

# Test 4: Proposal with invalid tool
echo -e "\n${YELLOW}Test 4: Proposal with invalid tool${NC}"
PROPOSAL_JSON='{
  "kind":"mcp/proposal",
  "to":["fulfiller"],
  "payload":{
    "description":"Calculate with invalid tool",
    "tool":"nonexistent",
    "arguments":{"a":1,"b":2}
  }
}'
echo "$PROPOSAL_JSON" > ./fifos/proposer-in
sleep 3

if grep -q 'Tool not found: nonexistent' ./logs/fulfiller.log || grep -q 'error' ./logs/fulfiller.log; then
  echo -e "${GREEN}✓ Invalid tool handled properly${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Invalid tool not handled${NC}"
  ((FAIL_COUNT++))
fi

# Test 5: Multiple proposals in sequence
echo -e "\n${YELLOW}Test 5: Multiple proposals in sequence${NC}"
echo '{"kind":"mcp/proposal","to":["fulfiller"],"payload":{"description":"Add 1+1","tool":"add","arguments":{"a":1,"b":1}}}' > ./fifos/proposer-in
sleep 1
echo '{"kind":"mcp/proposal","to":["fulfiller"],"payload":{"description":"Add 2+2","tool":"add","arguments":{"a":2,"b":2}}}' > ./fifos/proposer-in
sleep 1
echo '{"kind":"mcp/proposal","to":["fulfiller"],"payload":{"description":"Add 3+3","tool":"add","arguments":{"a":3,"b":3}}}' > ./fifos/proposer-in
sleep 3

PROPOSAL_COUNT=$(grep -c 'Processing proposal' ./logs/fulfiller.log 2>/dev/null || echo 0)
if [ $PROPOSAL_COUNT -ge 5 ]; then
  echo -e "${GREEN}✓ All proposals processed ($PROPOSAL_COUNT total)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Not all proposals processed ($PROPOSAL_COUNT processed)${NC}"
  ((FAIL_COUNT++))
fi

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 5"

if [ $PASS_COUNT -ge 4 ]; then
  echo -e "\n${GREEN}=== SCENARIO 3 PASSED (${PASS_COUNT}/5 tests) ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 3 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $CAT_PID 2>/dev/null || true
kill $PROPOSER_PID 2>/dev/null || true
kill $FULFILLER_PID 2>/dev/null || true
kill $CALC_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f ./fifos/proposer-in ./fifos/proposer-out

exit $EXIT_CODE