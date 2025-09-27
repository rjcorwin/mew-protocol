#!/bin/bash
# Check script for Scenario 12 - Stream Lifecycle Controls

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

echo -e "${YELLOW}=== Scenario 12: Stream Lifecycle Checks ===${NC}"

echo -e "${BLUE}Gateway port:${NC} $TEST_PORT"
echo -e "${BLUE}Log file:${NC} $OUTPUT_LOG"

echo -e "${YELLOW}-- Stream negotiation flow --${NC}"
STREAM_TRIGGER="chat-stream-$(date +%s)"
send_message "{\"id\":\"$STREAM_TRIGGER\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"open_stream\"}}"
assert_in_log "stream request emitted" "\"kind\":\"stream/request\""
assert_in_log "stream request id" "\"id\":\"stream-request-1\""

STREAM_OPEN_ID="stream-open-$(date +%s)"
send_message "{\"id\":\"$STREAM_OPEN_ID\",\"kind\":\"stream/open\",\"to\":[\"control-agent\"],\"correlation_id\":[\"stream-request-1\"],\"payload\":{\"stream_id\":\"stream-123\",\"encoding\":\"text\"}}"
assert_in_log "stream open acknowledgement" "Stream opened: stream-123"
assert_in_log "stream open correlated" "\"correlation_id\":[\"$STREAM_OPEN_ID\"]"

STREAM_CLOSE_ID="stream-close-$(date +%s)"
send_message "{\"id\":\"$STREAM_CLOSE_ID\",\"kind\":\"stream/close\",\"to\":[\"control-agent\"],\"correlation_id\":[\"$STREAM_OPEN_ID\"],\"payload\":{\"reason\":\"complete\"}}"
assert_in_log "stream close acknowledgement" "Stream closed: stream-123 (complete)"
assert_in_log "stream close correlated" "\"correlation_id\":[\"$STREAM_CLOSE_ID\"]"


echo ""
echo -e "${YELLOW}=== Scenario 12 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  exit 0
else
  exit 1
fi
