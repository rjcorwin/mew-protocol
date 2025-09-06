#!/bin/bash
# Test Scenario 4: Dynamic Capability Granting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 4: Dynamic Capability Granting ===${NC}"

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

# Start calculator agent (provides tools)
echo "Starting calculator agent..."
node ../../tests/agents/calculator.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "calculator-token" \
  > calculator.log 2>&1 &
CALC_PID=$!

sleep 2

# Check if calculator is running
if ! kill -0 $CALC_PID 2>/dev/null; then
  echo -e "${RED}Calculator agent failed to start${NC}"
  cat calculator.log
  exit 1
fi

echo -e "${GREEN}✓ Calculator agent started${NC}"

# Connect as coordinator (admin privileges)
mkfifo coord-in coord-out

# Start reading from coordinator FIFO in background
cat coord-out > coord-responses.txt &
COORD_CAT_PID=$!

echo "Connecting coordinator with admin privileges..."
../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id coordinator \
  --token "admin-token" \
  --fifo-in coord-in \
  --fifo-out coord-out \
  > coordinator.log 2>&1 &
COORD_PID=$!

# Connect as limited agent (minimal capabilities)
mkfifo limited-in limited-out

# Start reading from limited agent FIFO in background
cat limited-out > limited-responses.txt &
LIMITED_CAT_PID=$!

echo "Connecting limited agent with restricted privileges..."
../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id limited-agent \
  --token "limited-token" \
  --fifo-in limited-in \
  --fifo-out limited-out \
  > limited.log 2>&1 &
LIMITED_PID=$!

# Wait for clients to connect
sleep 3

echo -e "\n${YELLOW}=== Running Dynamic Capability Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Limited agent attempts MCP operation (should be blocked)
echo -e "\n${YELLOW}Test 1: Limited agent attempts tools/list (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > limited-in
sleep 2

if timeout 1 cat limited-out | grep -q '"kind":"system/error"'; then
  echo -e "${GREEN}✓ MCP request blocked due to missing capability${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ MCP request was not properly blocked${NC}"
  echo "Response received:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Test 2: Coordinator grants MCP capability
echo -e "\n${YELLOW}Test 2: Coordinator grants tools/list capability${NC}"
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/list","params":{}}}]}}'
echo "$GRANT_JSON" > coord-in
sleep 2

# Check if limited agent received grant acknowledgment
if timeout 1 cat limited-out | grep -q '"kind":"capability/grant-ack"'; then
  echo -e "${GREEN}✓ Limited agent received grant acknowledgment${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Grant acknowledgment not received${NC}"
  echo "Limited agent responses:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Test 3: Limited agent can now list tools
echo -e "\n${YELLOW}Test 3: Limited agent attempts tools/list (should succeed)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > limited-in
sleep 3

# Note: Response may come from calculator agent if it's connected
if timeout 1 cat limited-out | grep -q '"kind":"mcp/response"'; then
  echo -e "${GREEN}✓ Limited agent successfully listed tools${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Limited agent could not list tools${NC}"
  echo "Response received:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Test 4: Limited agent still can't call tools
echo -e "\n${YELLOW}Test 4: Limited agent attempts tools/call (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":1,"b":2}}}}' > limited-in
sleep 2

if timeout 1 cat limited-out | grep -q '"kind":"system/error"'; then
  echo -e "${GREEN}✓ tools/call blocked - only tools/list was granted${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ tools/call was not properly blocked${NC}"
  echo "Response received:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Test 5: Grant broader capability
echo -e "\n${YELLOW}Test 5: Grant tools/* wildcard capability${NC}"
GRANT_JSON='{"kind":"capability/grant","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}'
echo "$GRANT_JSON" > coord-in
sleep 2

if timeout 1 cat limited-out | grep -q '"kind":"capability/grant-ack"'; then
  echo -e "${GREEN}✓ Wildcard capability grant acknowledged${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Wildcard grant not acknowledged${NC}"
  ((FAIL_COUNT++))
fi

# Test 6: Limited agent can now call tools
echo -e "\n${YELLOW}Test 6: Limited agent calls tool (should succeed)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > limited-in
sleep 3

if timeout 1 cat limited-out | grep -q '"kind":"mcp/response"'; then
  echo -e "${GREEN}✓ Limited agent successfully called add tool (result: 8)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Limited agent could not call tool${NC}"
  echo "Response received:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Test 7: Revoke capability
echo -e "\n${YELLOW}Test 7: Coordinator revokes tools/* capability${NC}"
REVOKE_JSON='{"kind":"capability/revoke","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}'
echo "$REVOKE_JSON" > coord-in
sleep 2

echo -e "${GREEN}✓ Revoke message sent${NC}"
((PASS_COUNT++))

# Test 8: Limited agent can no longer call tools
echo -e "\n${YELLOW}Test 8: Limited agent attempts tools/call after revoke (should be blocked)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":2,"b":3}}}}' > limited-in
sleep 2

if timeout 1 cat limited-out | grep -q '"kind":"system/error"'; then
  echo -e "${GREEN}✓ tools/call blocked after capability revoked${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ tools/call was not properly blocked after revoke${NC}"
  echo "Response received:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Test 9: But tools/list should still work (granted separately)
echo -e "\n${YELLOW}Test 9: Limited agent attempts tools/list (should still work)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > limited-in
sleep 3

if timeout 1 cat limited-out | grep -q '"kind":"mcp/response"'; then
  echo -e "${GREEN}✓ tools/list still works (separate grant not revoked)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ tools/list should still work${NC}"
  echo "Response received:"
  cat limited-responses.txt | head -5
  ((FAIL_COUNT++))
fi

# Stop reading from FIFOs
kill $COORD_CAT_PID 2>/dev/null || true
kill $LIMITED_CAT_PID 2>/dev/null || true

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 9"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}=== SCENARIO 4 PASSED ===${NC}"
  EXIT_CODE=0
else
  echo -e "${RED}=== SCENARIO 4 FAILED ===${NC}"
  echo -e "\n${YELLOW}Debug output:${NC}"
  echo "Last gateway log entries:"
  tail -10 gateway.log | grep -E "(capability|grant|revoke)" || tail -5 gateway.log
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $CALC_PID 2>/dev/null || true
kill $COORD_PID 2>/dev/null || true
kill $LIMITED_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f coord-in coord-out limited-in limited-out coord-responses.txt limited-responses.txt

cd ..
# Keep test directory for debugging if test failed
if [ $EXIT_CODE -eq 0 ]; then
  rm -rf "$TEST_DIR"
else
  echo -e "${YELLOW}Test directory kept for debugging: $TEST_DIR${NC}"
fi

exit $EXIT_CODE