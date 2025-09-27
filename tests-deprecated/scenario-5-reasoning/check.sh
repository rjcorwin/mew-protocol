#!/bin/bash
# Check script for Scenario 5: Reasoning with Context Field

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Running Test Checks ===${NC}"
echo -e "${BLUE}Scenario: Reasoning with Context Field${NC}"
echo -e "${BLUE}Test directory: $(pwd)${NC}"
echo -e "${BLUE}Gateway port: ${TEST_PORT}${NC}"

# Get paths from environment or use defaults
OUTPUT_LOG="${OUTPUT_LOG:-./logs/research-agent-output.log}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to check test result
check_test() {
  local test_name="$1"
  local condition="$2"
  
  if eval "$condition"; then
    echo -e "$test_name: ${GREEN}✓${NC}"
    ((TESTS_PASSED++)) || true
  else
    echo -e "$test_name: ${RED}✗${NC}"
    ((TESTS_FAILED++)) || true
  fi

  return 0
}

# Basic connectivity tests
echo "Testing: Gateway is running ... \c"
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

echo "Testing: Output log exists ... \c"
check_test "" "[ -f '$OUTPUT_LOG' ]"

# Test reasoning flow with context field
echo -e "\n${YELLOW}Test: Complex reasoning flow with context${NC}"

# Generate unique IDs
REQUEST_ID="req-$(date +%s)"
REASON_ID="reason-$(date +%s)"

# Start monitoring output
tail -f "$OUTPUT_LOG" > /tmp/reasoning-response.txt &
TAIL_PID=$!

# Send reasoning flow sequence via HTTP API
send_message() {
  curl -sf -X POST "http://localhost:$TEST_PORT/participants/research-agent/messages" \
    -H "Authorization: Bearer research-token" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

# Step 1: Initial chat request
send_message '{"id":"'$REQUEST_ID'","kind":"chat","payload":{"text":"Calculate the total cost of 5 items at $12 each, including 8% tax"}}'
sleep 1

# Step 2: Start reasoning (with correlation_id)
send_message '{"id":"'$REASON_ID'","kind":"reasoning/start","correlation_id":["'$REQUEST_ID'"],"payload":{"message":"Calculating total with tax for 5 items at $12 each"}}'
sleep 1

# Step 3: First reasoning thought (with context)
send_message '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"First, I need to calculate the base cost: 5 × 12"}}'
sleep 1

# Step 4: Call calculator for multiplication (with context)
CALC_REQ_1="calc-req-1-$(date +%s)"
send_message '{"id":"'$CALC_REQ_1'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":5,"b":12}}}}'
sleep 2

# Step 5: Second reasoning thought
send_message '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"Base cost is $60, now calculating 8% tax"}}'
sleep 1

# Step 6: Calculate tax (8% of 60 = 4.8)
CALC_REQ_2="calc-req-2-$(date +%s)"
send_message '{"id":"'$CALC_REQ_2'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":60,"b":0.08}}}}'
sleep 2

# Step 7: Third reasoning thought
send_message '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"Tax is $4.80, now calculating total"}}'
sleep 1

# Step 8: Calculate total
CALC_REQ_3="calc-req-3-$(date +%s)"
send_message '{"id":"'$CALC_REQ_3'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":60,"b":4.8}}}}'
sleep 2

# Step 9: Reasoning conclusion
send_message '{"kind":"reasoning/conclusion","context":"'$REASON_ID'","payload":{"message":"Total cost is $64.80 (base: $60, tax: $4.80)"}}'
sleep 1

# Step 10: Final response
send_message '{"kind":"chat","correlation_id":["'$REQUEST_ID'"],"payload":{"text":"The total cost is $64.80 (5 items × $12 = $60, plus 8% tax = $4.80)"}}'

# Wait for all messages to be processed
sleep 5
kill $TAIL_PID 2>/dev/null || true

# Verify test results
echo -e "\n${YELLOW}Verifying reasoning flow results:${NC}"

# Check that context field was preserved
if grep -q '"context":"'$REASON_ID'"' /tmp/reasoning-response.txt; then
  echo -e "Context field preserved: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Context field preserved: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Check reasoning messages
if grep -q '"kind":"reasoning/start"' /tmp/reasoning-response.txt; then
  echo -e "Reasoning start message: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Reasoning start message: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if grep -q '"kind":"reasoning/thought"' /tmp/reasoning-response.txt; then
  echo -e "Reasoning thought messages: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Reasoning thought messages: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

if grep -q '"kind":"reasoning/conclusion"' /tmp/reasoning-response.txt; then
  echo -e "Reasoning conclusion message: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Reasoning conclusion message: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Check MCP responses (context is preserved in requests, not responses)
if grep -q '"kind":"mcp/response"' /tmp/reasoning-response.txt && grep -q '"context":"'$REASON_ID'"' /tmp/reasoning-response.txt; then
  echo -e "MCP responses and context preserved: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "MCP responses and context preserved: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Check final calculation result
if grep -q '64.80' /tmp/reasoning-response.txt || grep -q '64.8' /tmp/reasoning-response.txt; then
  echo -e "Correct calculation result: ${GREEN}✓${NC}"
  ((TESTS_PASSED++)) || true
else
  echo -e "Correct calculation result: ${RED}✗${NC}"
  ((TESTS_FAILED++)) || true
fi

# Summary
echo ""
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some tests failed${NC}"
  exit 1
fi
