#!/bin/bash
# Test Scenario 2: MCP Tool Execution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 2: MCP Tool Execution ===${NC}"

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

# Create FIFOs for test client
mkdir -p ./fifos
mkfifo ./fifos/test-client-in ./fifos/test-client-out

# Connect test client
echo "Connecting test client..."
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id test-client \
  --token "test-token" \
  --fifo-in ./fifos/test-client-in \
  --fifo-out ./fifos/test-client-out \
  > ./logs/test-client.log 2>&1 &
CLIENT_PID=$!

# Start reading from FIFO
cat ./fifos/test-client-out > ./logs/responses.txt &
CAT_PID=$!

# Wait for connection
sleep 3

echo -e "\n${YELLOW}=== Running MCP Tool Tests ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: List tools
echo -e "\n${YELLOW}Test 1: List available tools${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}' > ./fifos/test-client-in
sleep 2

if grep -q '"kind":"mcp/response"' ./logs/responses.txt && grep -q '"tools":\[' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Tools list received${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Tools list not received${NC}"
  ((FAIL_COUNT++))
fi

# Test 2: Call add tool
echo -e "\n${YELLOW}Test 2: Call add tool (5 + 3)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}' > ./fifos/test-client-in
sleep 2

if grep -q '"text":"8"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Add tool returned correct result (8)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Add tool result not found${NC}"
  ((FAIL_COUNT++))
fi

# Test 3: Call multiply tool
echo -e "\n${YELLOW}Test 3: Call multiply tool (7 × 9)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":7,"b":9}}}}' > ./fifos/test-client-in
sleep 2

if grep -q '"text":"63"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Multiply tool returned correct result (63)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Multiply tool result not found${NC}"
  ((FAIL_COUNT++))
fi

# Test 4: Call divide tool
echo -e "\n${YELLOW}Test 4: Call divide tool (20 ÷ 4)${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"divide","arguments":{"a":20,"b":4}}}}' > ./fifos/test-client-in
sleep 2

if grep -q '"text":"5"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Divide tool returned correct result (5)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Divide tool result not found${NC}"
  ((FAIL_COUNT++))
fi

# Test 5: Handle division by zero
echo -e "\n${YELLOW}Test 5: Handle division by zero${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"divide","arguments":{"a":10,"b":0}}}}' > ./fifos/test-client-in
sleep 2

if grep -q 'Cannot divide by zero' ./logs/responses.txt || grep -q '"kind":"mcp/error"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Division by zero handled properly${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Division by zero not handled${NC}"
  ((FAIL_COUNT++))
fi

# Test 6: Invalid tool name
echo -e "\n${YELLOW}Test 6: Call non-existent tool${NC}"
echo '{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"invalid","arguments":{}}}}' > ./fifos/test-client-in
sleep 2

if grep -q 'Tool not found: invalid' ./logs/responses.txt || grep -q '"kind":"mcp/error"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Invalid tool handled properly${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Invalid tool not handled${NC}"
  ((FAIL_COUNT++))
fi

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 6"

if [ $PASS_COUNT -ge 5 ]; then
  echo -e "\n${GREEN}=== SCENARIO 2 PASSED (${PASS_COUNT}/6 tests) ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 2 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $CAT_PID 2>/dev/null || true
kill $CLIENT_PID 2>/dev/null || true
kill $CALC_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f ./fifos/test-client-in ./fifos/test-client-out

exit $EXIT_CODE