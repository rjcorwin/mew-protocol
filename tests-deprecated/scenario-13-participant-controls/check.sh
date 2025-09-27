#!/bin/bash
# Check script for Scenario 13 - Participant Lifecycle Controls

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

OUTPUT_LOG="${OUTPUT_LOG:-./logs/test-client-output.log}"

wait_for_pattern() {
  local pattern="$1"
  local timeout="${2:-15}"
  local waited=0

  while [ $waited -lt $timeout ]; do
    if grep -Fq "$pattern" "$OUTPUT_LOG"; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

assert_in_log() {
  local name="$1"
  local pattern="$2"
  if wait_for_pattern "$pattern" 20; then
    echo -e "$name: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "$name: ${RED}✗${NC}" "(pattern not found: $pattern)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

send_message() {
  local body="$1"
  curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null
}

echo -e "${YELLOW}=== Scenario 13: Participant Lifecycle Checks ===${NC}"

echo -e "${BLUE}Gateway port:${NC} $TEST_PORT"
echo -e "${BLUE}Log file:${NC} $OUTPUT_LOG"

echo -e "${YELLOW}-- Participant clear --${NC}"
CLEAR_ID="clear-$(date +%s)"
send_message "{\"id\":\"$CLEAR_ID\",\"kind\":\"participant/clear\",\"to\":[\"control-agent\"],\"payload\":{\"reason\":\"test_clear\"}}"
assert_in_log "participant clear status" "\"status\":\"cleared:test_clear\""
assert_in_log "participant clear correlation" "\"correlation_id\":[\"$CLEAR_ID\"]"


echo -e "${YELLOW}-- Participant restart --${NC}"
RESTART_ID="restart-$(date +%s)"
send_message "{\"id\":\"$RESTART_ID\",\"kind\":\"participant/restart\",\"to\":[\"control-agent\"],\"payload\":{}}"
assert_in_log "participant restart status" "\"status\":\"restarted\""
assert_in_log "participant restart correlation" "\"correlation_id\":[\"$RESTART_ID\"]"


echo -e "${YELLOW}-- Participant shutdown --${NC}"
SHUTDOWN_ID="shutdown-$(date +%s)"
send_message "{\"id\":\"$SHUTDOWN_ID\",\"kind\":\"participant/shutdown\",\"to\":[\"control-agent\"],\"payload\":{\"reason\":\"test_shutdown\"}}"
assert_in_log "participant shutdown status" "\"status\":\"shutting_down:test_shutdown\""
assert_in_log "participant shutdown correlation" "\"correlation_id\":[\"$SHUTDOWN_ID\"]"


echo ""
echo -e "${YELLOW}=== Scenario 13 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
