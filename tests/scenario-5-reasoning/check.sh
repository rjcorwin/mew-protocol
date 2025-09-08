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
RESEARCH_FIFO="${RESEARCH_FIFO:-./fifos/research-agent-in}"
RESEARCH_LOG="${RESEARCH_LOG:-./logs/research-agent-output.log}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to check test result
check_test() {
  local test_name="$1"
  local condition="$2"
  
  if eval "$condition"; then
    echo -e "$test_name: ${GREEN}✓${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "$test_name: ${RED}✗${NC}"
    ((TESTS_FAILED++))
  fi
}

# Basic connectivity tests
echo "Testing: Gateway is running ... \c"
# Check if gateway is listening on the port
if nc -z localhost ${TEST_PORT} 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

echo "Testing: Research agent FIFO exists ... \c"
check_test "" "[ -p '$RESEARCH_FIFO' ]"

echo "Testing: Output log exists ... \c"
check_test "" "[ -f '$RESEARCH_LOG' ]"

# Test reasoning flow with context field
echo -e "\n${YELLOW}Test: Complex reasoning flow with context${NC}"

# Generate unique IDs
REQUEST_ID="req-$(date +%s)"
REASON_ID="reason-$(date +%s)"

# Start monitoring output
tail -f "$RESEARCH_LOG" > /tmp/reasoning-response.txt &
TAIL_PID=$!

# Send reasoning flow sequence
(
  # Step 1: Initial chat request
  echo '{"id":"'$REQUEST_ID'","kind":"chat","payload":{"text":"Calculate the total cost of 5 items at $12 each, including 8% tax"}}'
  sleep 1
  
  # Step 2: Start reasoning (with correlation_id)
  echo '{"id":"'$REASON_ID'","kind":"reasoning/start","correlation_id":["'$REQUEST_ID'"],"payload":{"message":"Calculating total with tax for 5 items at $12 each"}}'
  sleep 1
  
  # Step 3: First reasoning thought (with context)
  echo '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"First, I need to calculate the base cost: 5 × 12"}}'
  sleep 1
  
  # Step 4: Call calculator for multiplication (with context)
  CALC_REQ_1="calc-req-1-$(date +%s)"
  echo '{"id":"'$CALC_REQ_1'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":5,"b":12}}}}'
  sleep 2
  
  # Step 5: Second reasoning thought
  echo '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"Base cost is $60, now calculating 8% tax"}}'
  sleep 1
  
  # Step 6: Calculate tax (8% of 60 = 4.8)
  CALC_REQ_2="calc-req-2-$(date +%s)"
  echo '{"id":"'$CALC_REQ_2'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":60,"b":0.08}}}}'
  sleep 2
  
  # Step 7: Third reasoning thought
  echo '{"kind":"reasoning/thought","context":"'$REASON_ID'","payload":{"message":"Tax is $4.80, now calculating total"}}'
  sleep 1
  
  # Step 8: Calculate total
  CALC_REQ_3="calc-req-3-$(date +%s)"
  echo '{"id":"'$CALC_REQ_3'","kind":"mcp/request","to":["calculator-agent"],"context":"'$REASON_ID'","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":60,"b":4.8}}}}'
  sleep 2
  
  # Step 9: Reasoning conclusion
  echo '{"kind":"reasoning/conclusion","context":"'$REASON_ID'","payload":{"message":"Total cost is $64.80 (base: $60, tax: $4.80)"}}'
  sleep 1
  
  # Step 10: Final response
  echo '{"kind":"chat","correlation_id":["'$REQUEST_ID'"],"payload":{"text":"The total cost is $64.80 (5 items × $12 = $60, plus 8% tax = $4.80)"}}'
) > "$RESEARCH_FIFO" &

# Wait for all messages to be processed
sleep 15
kill $TAIL_PID 2>/dev/null || true

# Verify test results
echo -e "\n${YELLOW}Verifying reasoning flow results:${NC}"

# Test 1: Check if reasoning/start was accepted
if grep -q '"kind":"reasoning/start"' /tmp/reasoning-response.txt; then
  echo -e "Reasoning start message: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Reasoning start message: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 2: Check if reasoning/thought messages were accepted
THOUGHT_COUNT=$(grep -c '"kind":"reasoning/thought"' /tmp/reasoning-response.txt 2>/dev/null || echo 0)
if [ $THOUGHT_COUNT -ge 2 ]; then
  echo -e "Reasoning thoughts ($THOUGHT_COUNT found): ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Reasoning thoughts (only $THOUGHT_COUNT): ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 3: Check if calculator responses were received
CALC_RESPONSES=$(grep -c '"kind":"mcp/response"' /tmp/reasoning-response.txt 2>/dev/null || echo 0)
if [ $CALC_RESPONSES -ge 3 ]; then
  echo -e "Calculator responses ($CALC_RESPONSES): ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Calculator responses (only $CALC_RESPONSES): ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 4: Check for correct calculation results
if grep -q '"text":"60"' /tmp/reasoning-response.txt; then
  echo -e "Base cost calculation (60): ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Base cost calculation: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

if grep -q '"text":"4.8"' /tmp/reasoning-response.txt; then
  echo -e "Tax calculation (4.8): ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Tax calculation: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

if grep -q '"text":"64.8"' /tmp/reasoning-response.txt; then
  echo -e "Total calculation (64.8): ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Total calculation: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 5: Check if reasoning/conclusion was accepted
if grep -q '"kind":"reasoning/conclusion"' /tmp/reasoning-response.txt; then
  echo -e "Reasoning conclusion: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Reasoning conclusion: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 6: Check if final chat response was sent
if grep -q '"kind":"chat"' /tmp/reasoning-response.txt && grep -q '64.80' /tmp/reasoning-response.txt; then
  echo -e "Final chat response: ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Final chat response: ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Test 7: Check if context field is properly preserved in messages
CONTEXT_MSGS=$(grep -c "\"context\":\"$REASON_ID\"" /tmp/reasoning-response.txt 2>/dev/null || echo 0)
if [ $CONTEXT_MSGS -ge 3 ]; then
  echo -e "Context field preserved ($CONTEXT_MSGS msgs): ${GREEN}✓${NC}"
  ((TESTS_PASSED++))
else
  echo -e "Context field preserved (only $CONTEXT_MSGS): ${RED}✗${NC}"
  ((TESTS_FAILED++))
fi

# Clean up temp file
rm -f /tmp/reasoning-response.txt

# Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ Some tests failed${NC}"
  exit 1
fi