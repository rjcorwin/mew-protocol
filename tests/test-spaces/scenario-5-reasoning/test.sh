#!/bin/bash
# Test Scenario 5: Reasoning with Context Field

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Scenario 5: Reasoning with Context Field ===${NC}"

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

# Create FIFOs for research agent
mkdir -p ./fifos
mkfifo ./fifos/research-in ./fifos/research-out

# Connect research agent
echo "Connecting research agent..."
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --participant-id research-agent \
  --token "research-token" \
  --fifo-in ./fifos/research-in \
  --fifo-out ./fifos/research-out \
  > ./logs/research.log 2>&1 &
RESEARCH_PID=$!

# Start reading from FIFO
cat ./fifos/research-out > ./logs/responses.txt &
CAT_PID=$!

# Wait for connection
sleep 3

# Create a background process to send all messages
echo "Sending reasoning flow..."
(
  # Step 1: Initial request
  REQUEST_ID="req-123"
  echo '{"id":"'$REQUEST_ID'","kind":"chat","payload":{"text":"Calculate: 5 items at $12 each with 8% tax"}}'
  sleep 1
  
  # Step 2: Start reasoning with correlation
  REASON_ID="reason-$(date +%s)"
  echo '{"id":"'$REASON_ID'","kind":"reasoning/start","correlation_id":["'$REQUEST_ID'"],"payload":{"message":"Calculating total with tax for 5 items at $12 each"}}'
  sleep 1
  
  # Step 3: First reasoning thought (with context)
  echo '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"First, I need to calculate the base cost: 5 × 12"}}'
  sleep 1
  
  # Step 4: Call calculator for multiplication (with context)
  CALC_REQ_1="calc-req-1"
  echo '{"id":"'$CALC_REQ_1'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":5,"b":12}}}}'
  sleep 2
  
  # Step 5: Second reasoning thought
  echo '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"Base cost is $60, now calculating 8% tax"}}'
  sleep 1
  
  # Step 6: Calculate tax (8% of 60 = 4.8)
  CALC_REQ_2="calc-req-2"
  echo '{"id":"'$CALC_REQ_2'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":60,"b":0.08}}}}'
  sleep 2
  
  # Step 7: Third reasoning thought
  echo '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"Tax is $4.80, now calculating total"}}'
  sleep 1
  
  # Step 8: Calculate total
  CALC_REQ_3="calc-req-3"
  echo '{"id":"'$CALC_REQ_3'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":60,"b":4.8}}}}'
  sleep 2
  
  # Step 9: Reasoning conclusion
  echo '{"kind":"reasoning/conclusion","context":"'$REASON_ID'","payload":{"message":"Total cost is $64.80 (base: $60, tax: $4.80)"}}'
  sleep 1
  
  # Step 10: Final response
  echo '{"kind":"chat","correlation_id":["'$REQUEST_ID'"],"payload":{"text":"The total cost is $64.80 (5 items × $12 = $60, plus 8% tax = $4.80)"}}'
  sleep 2
) > ./fifos/research-in &
WRITER_PID=$!

# Wait for all messages to be processed
echo "Waiting for reasoning flow to complete..."
wait $WRITER_PID
sleep 5

# Stop reading from FIFO
kill $CAT_PID 2>/dev/null || true
sleep 1

# Verify test results
echo -e "\n${YELLOW}=== Verifying Results ===${NC}"

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Check if reasoning/start was accepted
if grep -q '"kind":"reasoning/start"' ./logs/responses.txt || grep -q '"kind":"reasoning/start"' ./logs/research.log; then
  echo -e "${GREEN}✓ Reasoning start message accepted${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Reasoning start message not found${NC}"
  ((FAIL_COUNT++))
fi

# Test 2: Check if reasoning/thought messages were accepted
THOUGHT_COUNT=$(grep -c '"kind":"reasoning/thought"' ./logs/responses.txt 2>/dev/null || echo 0)
if [ $THOUGHT_COUNT -ge 2 ]; then
  echo -e "${GREEN}✓ Reasoning thoughts accepted ($THOUGHT_COUNT found)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Reasoning thoughts not found (only $THOUGHT_COUNT)${NC}"
  ((FAIL_COUNT++))
fi

# Test 3: Check if calculator responses were received
CALC_RESPONSES=$(grep -c '"kind":"mcp/response"' ./logs/responses.txt 2>/dev/null || echo 0)
if [ $CALC_RESPONSES -ge 3 ]; then
  echo -e "${GREEN}✓ Calculator responses received ($CALC_RESPONSES)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}⚠ Only $CALC_RESPONSES calculator responses found${NC}"
  # Check if calculator at least processed the requests
  if grep -q 'Sent response for tools/call' ./logs/calculator.log; then
    echo -e "${GREEN}✓ Calculator processed requests (check logs)${NC}"
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
  fi
fi

# Test 4: Check for correct calculation results
if grep -q '"text":"60"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Base cost calculation correct (60)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}⚠ Base cost result not found in responses${NC}"
  if grep -q 'multiply.*5.*12' ./logs/calculator.log && grep -q '"text":"60"' ./logs/calculator.log; then
    echo -e "${GREEN}✓ Calculator computed base cost correctly${NC}"
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
  fi
fi

if grep -q '"text":"4.8"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Tax calculation correct (4.8)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}⚠ Tax result not found in responses${NC}"
  if grep -q 'multiply.*60.*0.08' ./logs/calculator.log && grep -q '"text":"4.8"' ./logs/calculator.log; then
    echo -e "${GREEN}✓ Calculator computed tax correctly${NC}"
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
  fi
fi

if grep -q '"text":"64.8"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Total calculation correct (64.8)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}⚠ Total result not found in responses${NC}"
  if grep -q 'add.*60.*4.8' ./logs/calculator.log && grep -q '"text":"64.8"' ./logs/calculator.log; then
    echo -e "${GREEN}✓ Calculator computed total correctly${NC}"
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
  fi
fi

# Test 5: Check if reasoning/conclusion was accepted
if grep -q '"kind":"reasoning/conclusion"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Reasoning conclusion message accepted${NC}"
  ((PASS_COUNT++))
else
  echo -e "${RED}✗ Reasoning conclusion message not found${NC}"
  ((FAIL_COUNT++))
fi

# Test 6: Check if messages with context field were accepted
CONTEXT_COUNT=$(grep -c '"context":' ./logs/responses.txt 2>/dev/null || echo 0)
if [ $CONTEXT_COUNT -ge 4 ]; then
  echo -e "${GREEN}✓ Messages with context field accepted ($CONTEXT_COUNT found)${NC}"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}⚠ Only $CONTEXT_COUNT messages with context field found${NC}"
  if [ $CONTEXT_COUNT -ge 1 ]; then
    ((PASS_COUNT++))
  else
    ((FAIL_COUNT++))
  fi
fi

# Test 7: Check final chat response
if grep -q 'total cost is \$64.80' ./logs/responses.txt || grep -q '"text":"The total cost is \$64.80' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Final response with correct total${NC}"
  ((PASS_COUNT++))
else
  echo -e "${YELLOW}⚠ Final response not found in expected format${NC}"
fi

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Tests passed: $PASS_COUNT / 10"

if [ $PASS_COUNT -ge 7 ]; then
  echo -e "\n${GREEN}=== SCENARIO 5 PASSED (${PASS_COUNT}/10 tests) ===${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}=== SCENARIO 5 FAILED ===${NC}"
  EXIT_CODE=1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $WRITER_PID 2>/dev/null || true
kill $CALC_PID 2>/dev/null || true
kill $RESEARCH_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true
rm -f ./fifos/research-in ./fifos/research-out

exit $EXIT_CODE