#!/usr/bin/env bash
# Scenario 16 assertions - validate stream ownership grant/revoke/transfer operations
#
# This test uses interactive test participants that respond to commands via chat.
# Commands are sent as chat messages prefixed with "cmd:", and participants
# respond with messages prefixed with "response:". This allows us to validate
# internal state that isn't visible in envelope logs alone.

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "workspace.env not found at ${ENV_FILE}. Run setup.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

ENVELOPE_LOG="${WORKSPACE_DIR}/.mew/logs/envelope-history.jsonl"
TEST_PORT=${TEST_PORT:-8080}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

wait_for_pattern() {
  local file="$1"
  local pattern="$2"
  local timeout="${3:-10}"
  local waited=0
  while [[ ${waited} -lt ${timeout} ]]; do
    if [[ -f "$file" ]] && grep -Fq -- "$pattern" "$file"; then
      return 0
    fi
    sleep 0.5
    waited=$((waited + 1))
  done
  return 1
}

pass() {
  local name="$1"
  echo -e "${name}: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  local name="$1"
  local reason="${2:-}"
  echo -e "${name}: ${RED}✗${NC} ${reason}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

send_command() {
  local to_participant="$1"
  local command_text="$2"

  local msg_id="cmd-$(date +%s%N)"
  local body="{\"id\":\"${msg_id}\",\"kind\":\"chat\",\"payload\":{\"text\":\"cmd:${to_participant}:${command_text}\"}}"

  # Send as test-controller to avoid conflict with WebSocket-connected participants
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-controller/messages" \
    -H "Authorization: Bearer test-controller-token" \
    -H "Content-Type: application/json" \
    -d "${body}" > /dev/null
}

wait_for_response() {
  local from_participant="$1"
  local response_type="$2"
  local timeout="${3:-10}"

  if wait_for_pattern "${ENVELOPE_LOG}" "\"from\":\"${from_participant}\"" "${timeout}" && \
     wait_for_pattern "${ENVELOPE_LOG}" "\"text\":\"response:${response_type}\"" "${timeout}"; then
    return 0
  fi
  return 1
}

extract_response_data() {
  local from_participant="$1"
  local response_type="$2"

  grep -F "\"from\":\"${from_participant}\"" "${ENVELOPE_LOG}" | \
    grep -F "\"text\":\"response:${response_type}\"" | \
    tail -1 | \
    sed -n 's/.*"data":\({[^}]*}\).*/\1/p' || echo "{}"
}

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  pass "Gateway healthy"
else
  fail "Gateway health check"
  exit 1
fi

echo -e "${YELLOW}=== Scenario 16: Stream Ownership Transfer (Interactive) ===${NC}"
echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Envelope log:${NC} ${ENVELOPE_LOG}"

# Wait longer for participants to be fully registered with gateway
echo -e "${BLUE}Waiting for participants to stabilize...${NC}"
sleep 5

# Step 1: Ask stream-owner to create a stream
echo -e "\n${YELLOW}-- Step 1: stream-owner creates stream --${NC}"
send_command "stream-owner" "create-stream:Character position stream"

if wait_for_pattern "${ENVELOPE_LOG}" "\"kind\":\"stream/open\"" 10; then
  pass "Stream creation requested"
else
  fail "Stream creation requested" "stream/open not found"
fi

sleep 2

# Extract stream ID from envelope log
STREAM_ID=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1 | sed -n 's/.*"stream_id":"\([^"]*\)".*/\1/p' || echo "")
if [[ -n "${STREAM_ID}" ]]; then
  echo -e "  Stream ID: ${GREEN}${STREAM_ID}${NC}"
  pass "Stream ID extracted"
else
  fail "Stream ID extracted" "Could not find stream_id"
  exit 1
fi

# Step 2: Ask stream-owner to report streams (should see itself as authorized)
echo -e "\n${YELLOW}-- Step 2: Verify stream-owner sees itself as authorized --${NC}"
send_command "stream-owner" "report-streams"

if wait_for_response "stream-owner" "report-streams" 10; then
  pass "stream-owner reported streams"

  # Check if owner sees itself in authorized_writers
  if grep -F "\"from\":\"stream-owner\"" "${ENVELOPE_LOG}" | grep -F "response:report-streams" | tail -1 | grep -Fq "\"stream-owner\""; then
    pass "stream-owner sees itself in authorized_writers"
  else
    fail "stream-owner sees itself in authorized_writers" "Not found in response"
  fi
else
  fail "stream-owner reported streams" "No response received"
fi

sleep 2

# Step 3: stream-owner publishes a frame (should succeed)
echo -e "\n${YELLOW}-- Step 3: stream-owner publishes frame (as owner) --${NC}"
send_command "stream-owner" "publish-frame:${STREAM_ID}:frame1-owner"

if wait_for_response "stream-owner" "publish-frame-result" 10; then
  # Check if publish was successful
  if grep -F "\"from\":\"stream-owner\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1 | grep -Fq "\"success\":true"; then
    pass "stream-owner published frame successfully"
  else
    fail "stream-owner published frame" "Publish was not successful"
  fi
else
  fail "stream-owner published frame" "No response received"
fi

sleep 2

# Step 4: stream-writer reports streams (should see stream-owner as only authorized writer)
echo -e "\n${YELLOW}-- Step 4: Verify stream-writer sees only stream-owner authorized --${NC}"
send_command "stream-writer" "report-streams"

if wait_for_response "stream-writer" "report-streams" 10; then
  pass "stream-writer reported streams"

  # Check authorized_writers contains only stream-owner (check just the payload data, not envelope metadata)
  WRITER_REPORT=$(grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:report-streams" | tail -1 | sed -n 's/.*"data":\({[^}]*streams[^}]*}\).*/\1/p')
  if echo "${WRITER_REPORT}" | grep -Fq "\"stream-owner\"" && ! echo "${WRITER_REPORT}" | grep -Fq "\"stream-writer\""; then
    pass "stream-writer sees only stream-owner in authorized_writers"
  else
    fail "stream-writer sees only stream-owner" "Unexpected authorized_writers"
  fi
else
  fail "stream-writer reported streams" "No response received"
fi

sleep 2

# Step 5: stream-writer attempts to publish (should fail - not authorized)
echo -e "\n${YELLOW}-- Step 5: stream-writer attempts unauthorized publish --${NC}"
send_command "stream-writer" "publish-frame:${STREAM_ID}:frame2-unauthorized"

if wait_for_response "stream-writer" "publish-frame-result" 10; then
  # Check if publish failed
  if grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1 | grep -Fq "\"success\":false"; then
    pass "Unauthorized write correctly rejected"
  else
    fail "Unauthorized write rejected" "Write should have failed"
  fi
else
  fail "Unauthorized write check" "No response received"
fi

sleep 2

# Step 6: stream-owner grants write access to stream-writer
echo -e "\n${YELLOW}-- Step 6: stream-owner grants write to stream-writer --${NC}"
send_command "stream-owner" "grant-write:${STREAM_ID}:stream-writer:Player takes control"

if wait_for_pattern "${ENVELOPE_LOG}" "\"kind\":\"stream/write-granted\"" 10; then
  pass "Grant-write message sent"

  # Verify acknowledgement includes both participants
  if grep -F '"kind":"stream/write-granted"' "${ENVELOPE_LOG}" | tail -1 | grep -Fq '"participant_id":"stream-writer"'; then
    pass "Write-granted ack includes stream-writer"
  else
    fail "Write-granted ack" "Missing participant_id"
  fi
else
  fail "Grant-write message" "stream/write-granted not found"
fi

sleep 2

# Step 7: stream-writer reports streams again (should now see itself authorized)
echo -e "\n${YELLOW}-- Step 7: Verify stream-writer now sees itself authorized --${NC}"
send_command "stream-writer" "report-streams"

if wait_for_response "stream-writer" "report-streams" 10; then
  pass "stream-writer reported streams (post-grant)"

  # Check if writer now sees itself in authorized_writers
  WRITER_REPORT2=$(grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:report-streams" | tail -1)
  if echo "${WRITER_REPORT2}" | grep -Fq "\"stream-owner\"" && echo "${WRITER_REPORT2}" | grep -Fq "\"stream-writer\""; then
    pass "stream-writer sees both participants in authorized_writers"
  else
    fail "stream-writer authorized_writers post-grant" "Missing expected participants"
  fi
else
  fail "stream-writer report (post-grant)" "No response received"
fi

sleep 2

# Step 8: stream-writer publishes frame (should now succeed)
echo -e "\n${YELLOW}-- Step 8: stream-writer publishes frame (authorized) --${NC}"
send_command "stream-writer" "publish-frame:${STREAM_ID}:frame3-authorized"

if wait_for_response "stream-writer" "publish-frame-result" 10; then
  # Check if publish was successful
  if grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1 | grep -Fq "\"success\":true"; then
    pass "Authorized stream-writer published frame successfully"
  else
    fail "Authorized write" "Publish failed"
  fi
else
  fail "Authorized write check" "No response received"
fi

sleep 2

# Step 9: verifier reports streams (should see both authorized)
echo -e "\n${YELLOW}-- Step 9: Verify verifier sees both participants authorized --${NC}"
send_command "verifier" "report-streams"

if wait_for_response "verifier" "report-streams" 10; then
  pass "verifier reported streams"

  # Check verifier sees both in authorized_writers
  VERIFIER_REPORT=$(grep -F "\"from\":\"verifier\"" "${ENVELOPE_LOG}" | grep -F "response:report-streams" | tail -1)
  if echo "${VERIFIER_REPORT}" | grep -Fq "\"stream-owner\"" && echo "${VERIFIER_REPORT}" | grep -Fq "\"stream-writer\""; then
    pass "verifier sees both participants in authorized_writers"
  else
    fail "verifier authorized_writers view" "Missing expected participants"
  fi
else
  fail "verifier report" "No response received"
fi

sleep 2

# Step 10: stream-owner revokes stream-writer's access
echo -e "\n${YELLOW}-- Step 10: stream-owner revokes stream-writer access --${NC}"
send_command "stream-owner" "revoke-write:${STREAM_ID}:stream-writer:Player disconnected"

if wait_for_pattern "${ENVELOPE_LOG}" "\"kind\":\"stream/write-revoked\"" 10; then
  pass "Revoke-write message sent"

  # Verify notification includes stream-writer
  if grep -F '"kind":"stream/write-revoked"' "${ENVELOPE_LOG}" | tail -1 | grep -Fq '"participant_id":"stream-writer"'; then
    pass "Write-revoked notification includes stream-writer"
  else
    fail "Write-revoked notification" "Missing participant_id"
  fi
else
  fail "Revoke-write message" "stream/write-revoked not found"
fi

sleep 2

# Step 11: stream-writer attempts to publish (should fail - access revoked)
echo -e "\n${YELLOW}-- Step 11: stream-writer attempts publish (revoked) --${NC}"
send_command "stream-writer" "publish-frame:${STREAM_ID}:frame4-revoked"

if wait_for_response "stream-writer" "publish-frame-result" 10; then
  # Check if publish failed
  if grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1 | grep -Fq "\"success\":false"; then
    pass "Revoked write correctly rejected"
  else
    fail "Revoked write rejection" "Write should have failed"
  fi
else
  fail "Revoked write check" "No response received"
fi

sleep 2

# Step 12: stream-owner transfers ownership to stream-writer
echo -e "\n${YELLOW}-- Step 12: stream-owner transfers ownership to stream-writer --${NC}"
send_command "stream-owner" "transfer-ownership:${STREAM_ID}:stream-writer:AI agent takes over"

if wait_for_pattern "${ENVELOPE_LOG}" "\"kind\":\"stream/ownership-transferred\"" 10; then
  pass "Transfer-ownership message sent"

  # Verify transfer event has correct owner fields
  TRANSFER_EVENT=$(grep -F '"kind":"stream/ownership-transferred"' "${ENVELOPE_LOG}" | tail -1)
  if echo "${TRANSFER_EVENT}" | grep -Fq '"new_owner":"stream-writer"' && echo "${TRANSFER_EVENT}" | grep -Fq '"previous_owner":"stream-owner"'; then
    pass "Ownership-transferred event has correct fields"
  else
    fail "Ownership-transferred event" "Incorrect owner fields"
  fi
else
  fail "Transfer-ownership message" "stream/ownership-transferred not found"
fi

sleep 2

# Step 13: stream-writer reports streams (should see itself as owner)
echo -e "\n${YELLOW}-- Step 13: Verify stream-writer is now owner --${NC}"
send_command "stream-writer" "report-streams"

if wait_for_response "stream-writer" "report-streams" 10; then
  pass "stream-writer reported streams (post-transfer)"

  # Check if owner field is now stream-writer
  WRITER_REPORT3=$(grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:report-streams" | tail -1)
  if echo "${WRITER_REPORT3}" | grep -Fq '"owner":"stream-writer"'; then
    pass "stream-writer sees itself as owner"
  else
    fail "stream-writer ownership" "Not listed as owner"
  fi
else
  fail "stream-writer report (post-transfer)" "No response received"
fi

sleep 2

# Step 14: stream-writer (new owner) publishes frame (should succeed)
echo -e "\n${YELLOW}-- Step 14: stream-writer publishes as new owner --${NC}"
send_command "stream-writer" "publish-frame:${STREAM_ID}:frame5-new-owner"

if wait_for_response "stream-writer" "publish-frame-result" 10; then
  # Check if publish was successful
  if grep -F "\"from\":\"stream-writer\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1 | grep -Fq "\"success\":true"; then
    pass "New owner published frame successfully"
  else
    fail "New owner write" "Publish failed"
  fi
else
  fail "New owner write check" "No response received"
fi

sleep 2

# Step 15: stream-owner attempts to publish (should fail - no longer owner, not in authorized_writers)
echo -e "\n${YELLOW}-- Step 15: stream-owner attempts publish (no longer owner) --${NC}"
send_command "stream-owner" "publish-frame:${STREAM_ID}:frame6-old-owner"

if wait_for_response "stream-owner" "publish-frame-result" 10; then
  # Check if publish failed
  if grep -F "\"from\":\"stream-owner\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1 | grep -Fq "\"success\":false"; then
    pass "Old owner write correctly rejected"
  else
    fail "Old owner write rejection" "Write should have failed"
  fi
else
  fail "Old owner write check" "No response received"
fi

sleep 2

echo ""
echo -e "${YELLOW}=== Scenario 16 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
