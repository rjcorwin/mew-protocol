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

# Start the space using meup space up
echo "Starting space on port $PORT..."
../../../cli/bin/meup.js space up --port "$PORT" > ./logs/space-up.log 2>&1

# Check if space started successfully
if ../../../cli/bin/meup.js space status | grep -q "Gateway: ws://localhost:$PORT"; then
  echo -e "${GREEN}✓ Space started successfully${NC}"
else
  echo -e "${RED}✗ Space failed to start${NC}"
  cat ./logs/space-up.log
  exit 1
fi

# Wait for all components to be ready
sleep 3

# Start reading from FIFO (FIFOs are created by space up)
cat ./fifos/proposer-out > ./logs/responses.txt &
CAT_PID=$!

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

# Use space down command to stop all components
../../../cli/bin/meup.js space down

exit $EXIT_CODE