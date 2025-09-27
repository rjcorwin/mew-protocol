#!/bin/bash
# Check script for Scenario 11 - Chat & Reasoning Controls

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

echo -e "${YELLOW}=== Scenario 11: Chat & Reasoning Checks ===${NC}"

echo -e "${BLUE}Gateway port:${NC} $TEST_PORT"
echo -e "${BLUE}Log file:${NC} $OUTPUT_LOG"

echo -e "${YELLOW}-- Chat acknowledgement flow --${NC}"
ACK_ID="chat-ack-$(date +%s)"
send_message "{\"id\":\"$ACK_ID\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"ACK_TEST\"}}"
assert_in_log "chat acknowledgement emitted" "\"kind\":\"chat/acknowledge\""
assert_in_log "ack references original chat" "\"correlation_id\":[\"$ACK_ID\"]"

CANCEL_TRIGGER="chat-cancel-$(date +%s)"
send_message "{\"id\":\"$CANCEL_TRIGGER\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"cancel ack\"}}"
assert_in_log "chat cancellation emitted" "\"kind\":\"chat/cancel\""
assert_in_log "cancel references acknowledged chat" "\"correlation_id\":[\"$ACK_ID\"]"


echo -e "${YELLOW}-- Reasoning cancellation flow --${NC}"
REASON_CHAT="chat-reason-$(date +%s)"
send_message "{\"id\":\"$REASON_CHAT\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"start_reasoning\"}}"
assert_in_log "reasoning start emitted" "\"kind\":\"reasoning/start\""
assert_in_log "reasoning start correlated" "\"correlation_id\":[\"$REASON_CHAT\"]"
assert_in_log "reasoning start context id" "\"id\":\"reasoning-start-1\""

CANCEL_REASON="chat-stop-$(date +%s)"
send_message "{\"id\":\"$CANCEL_REASON\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"cancel_reasoning\"}}"
assert_in_log "reasoning cancel emitted" "\"kind\":\"reasoning/cancel\""
assert_in_log "reasoning cancel correlation" "\"correlation_id\":[\"$CANCEL_REASON\"]"
assert_in_log "reasoning cancel context" "\"context\":\"reasoning-start-1\""


echo ""
echo -e "${YELLOW}=== Scenario 11 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
