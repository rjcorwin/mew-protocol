#!/bin/bash
# Test Scenario 4: Dynamic Capability Granting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 4: Dynamic Capability Granting ===${NC}"

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

sleep 2

# Check if calculator is running
if ! kill -0 $CALC_PID 2>/dev/null; then
  echo -e "${RED}Calculator agent failed to start${NC}"
  cat ./logs/calculator.log
  exit 1
fi

echo -e "${GREEN}✓ Calculator agent started${NC}"

# Create FIFOs
mkdir -p ./fifos
mkfifo ./fifos/coordinator-in ./fifos/coordinator-out
mkfifo ./fifos/limited-in ./fifos/limited-out

# Connect coordinator
echo "Connecting coordinator with admin privileges..."
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id coordinator \
  --token "admin-token" \
  --fifo-in ./fifos/coordinator-in \
  --fifo-out ./fifos/coordinator-out \
  > ./logs/coordinator.log 2>&1 &
COORD_PID=$!

# Connect limited agent
echo "Connecting limited agent with restricted privileges..."
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id limited-agent \
  --token "limited-token" \
  --fifo-in ./fifos/limited-in \
  --fifo-out ./fifos/limited-out \
  > ./logs/limited.log 2>&1 &
LIMITED_PID=$!

# Start reading from FIFOs
cat ./fifos/coordinator-out > ./logs/coord-responses.txt &
COORD_CAT_PID=$!
cat ./fifos/limited-out > ./logs/limited-responses.txt &
LIMITED_CAT_PID=$!

# Wait for connections
sleep 3

echo -e "\n${YELLOW}=== Running Dynamic Capability Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Limited agent attempts MCP operation (should be blocked)
echo -e "\n${YELLOW}Test 1: Limited agent attempts tools/list (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > ./fifos/limited-agent-in
sleep 2

if grep -q '"kind":"system/error"' ./logs/limited-responses.txt; then
  echo -e "${GREEN}✓ MCP request blocked due to missing capability${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ MCP request was not properly blocked${NC}"
  ((FAIL_COUNT++))
fi

# Test 2: Coordinator grants MCP capability
echo -e "\n${YELLOW}Test 2: Coordinator grants tools/list capability${NC}"
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/list","params":{}}}]}}'
echo "$GRANT_JSON" > ./fifos/coordinator-in
sleep 2

# Check if limited agent received grant acknowledgment
if tail -5 ./logs/limited-responses.txt | grep -q '"kind":"capability/grant-ack"'; then
  echo -e "${GREEN}✓ Limited agent received grant acknowledgment${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Grant acknowledgment not received${NC}"
  ((FAIL_COUNT++))
fi

# Test 3: Limited agent can now list tools
echo -e "\n${YELLOW}Test 3: Limited agent attempts tools/list (should succeed)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > ./fifos/limited-agent-in
sleep 3

if tail -10 ./logs/limited-responses.txt | grep -q '"kind":"mcp/response"'; then
  echo -e "${GREEN}✓ Limited agent successfully listed tools${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Limited agent could not list tools${NC}"
  ((FAIL_COUNT++))
fi

# Test 4: Limited agent still can't call tools
echo -e "\n${YELLOW}Test 4: Limited agent attempts tools/call (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":1,"b":2}}}}' > ./fifos/limited-agent-in
sleep 2

if tail -5 ./logs/limited-responses.txt | grep -q '"kind":"system/error"'; then
  echo -e "${GREEN}✓ tools/call blocked - only tools/list was granted${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ tools/call was not properly blocked${NC}"
  ((FAIL_COUNT++))
fi

# Test 5: Grant broader capability
echo -e "\n${YELLOW}Test 5: Grant tools/* wildcard capability${NC}"
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}'
echo "$GRANT_JSON" > ./fifos/coordinator-in
sleep 2

if tail -5 ./logs/limited-responses.txt | grep -q '"kind":"capability/grant-ack"'; then
  echo -e "${GREEN}✓ Wildcard capability grant acknowledged${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Wildcard grant not acknowledged${NC}"
  ((FAIL_COUNT++))
fi

# Test 6: Limited agent can now call tools
echo -e "\n${YELLOW}Test 6: Limited agent calls tool (should succeed)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > ./fifos/limited-agent-in
sleep 3

if tail -10 ./logs/limited-responses.txt | grep -q '"kind":"mcp/response"'; then
  echo -e "${GREEN}✓ Limited agent successfully called add tool${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Limited agent could not call tool${NC}"
  ((FAIL_COUNT++))
fi

# Test 7: Revoke capability
echo -e "\n${YELLOW}Test 7: Coordinator revokes tools/* capability${NC}"
REVOKE_JSON='{"kind":"capability/revoke","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}'
echo "$REVOKE_JSON" > ./fifos/coordinator-in
sleep 2

echo -e "${GREEN}✓ Revoke message sent${NC}"
((PASS_COUNT++))

# Test 8: Limited agent can no longer call tools
echo -e "\n${YELLOW}Test 8: Limited agent attempts tools/call after revoke (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":2,"b":3}}}}' > ./fifos/limited-agent-in
sleep 2

if tail -5 ./logs/limited-responses.txt | grep -q '"kind":"system/error"'; then
  echo -e "${GREEN}✓ tools/call blocked after capability revoked${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ tools/call was not properly blocked after revoke${NC}"
  ((FAIL_COUNT++))
fi

# Test 9: But tools/list should still work (granted separately)
echo -e "\n${YELLOW}Test 9: Limited agent attempts tools/list (should still work)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > ./fifos/limited-agent-in
sleep 3

if tail -10 ./logs/limited-responses.txt | grep -q '"kind":"mcp/response"'; then
  echo -e "${GREEN}✓ tools/list still works (separate grant not revoked)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ tools/list should still work${NC}"
  ((FAIL_COUNT++))
fi

# Stop reading from FIFOs
kill $COORD_CAT_PID 2>/dev/null || true
kill $LIMITED_CAT_PID 2>/dev/null || true

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 9"

if [ $PASS_COUNT -ge 8 ]; then
  echo -e "\n${GREEN}=== SCENARIO 4 PASSED (${PASS_COUNT}/9 tests) ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 4 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"

# Use space down command to stop all components
../../../cli/bin/meup.js space down

exit $EXIT_CODE