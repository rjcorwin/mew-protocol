#!/usr/bin/env bash
# Scenario 18 assertions - validate targeted stream delivery [t5d]
#
# This test validates:
# 1. Targeted streams deliver frames only to specified target participant
# 2. Non-target participants do NOT receive targeted stream frames
# 3. Broadcast streams (no target) still deliver to all participants
# 4. Stream metadata includes target field in stream/open and active_streams

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

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  pass "Gateway healthy"
else
  fail "Gateway health check"
  exit 1
fi

echo -e "${YELLOW}=== Scenario 18: Targeted Stream Delivery [t5d] ===${NC}"
echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Envelope log:${NC} ${ENVELOPE_LOG}"

# Wait for participants to stabilize
echo -e "${BLUE}Waiting for participants to stabilize...${NC}"
sleep 3

# Clear all participants' received frames to start fresh
echo -e "\n${YELLOW}-- Setup: Clear received frames on all participants --${NC}"
send_command "publisher" "clear-received-frames"
send_command "aggregator" "clear-received-frames"
send_command "observer" "clear-received-frames"
sleep 2

# Step 1: Publisher creates a targeted stream to aggregator
echo -e "\n${YELLOW}-- Step 1: publisher creates targeted stream to aggregator --${NC}"
send_command "publisher" "create-targeted-stream:aggregator:Position telemetry"

if wait_for_pattern "${ENVELOPE_LOG}" "\"kind\":\"stream/open\"" 10; then
  pass "Stream creation requested"
else
  fail "Stream creation requested" "stream/open not found"
fi

sleep 2

# Extract stream ID from envelope log
TARGETED_STREAM_ID=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1 | sed -n 's/.*"stream_id":"\([^"]*\)".*/\1/p' || echo "")
if [[ -n "${TARGETED_STREAM_ID}" ]]; then
  echo -e "  Targeted Stream ID: ${GREEN}${TARGETED_STREAM_ID}${NC}"
  pass "Targeted stream ID extracted"
else
  fail "Targeted stream ID extracted" "Could not find stream_id"
  exit 1
fi

# Step 2: Verify stream/open includes target field
echo -e "\n${YELLOW}-- Step 2: Verify stream/open includes target --${NC}"
STREAM_OPEN_LINE=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1)
if echo "${STREAM_OPEN_LINE}" | grep -Fq '"target":["aggregator"]'; then
  pass "stream/open includes target field"
else
  fail "stream/open includes target field" "Target field not found or incorrect"
  echo "  Debug: ${STREAM_OPEN_LINE}"
fi

sleep 2

# Step 3: Publisher publishes frames to targeted stream
echo -e "\n${YELLOW}-- Step 3: publisher publishes frames to targeted stream --${NC}"
send_command "publisher" "publish-frame:${TARGETED_STREAM_ID}:position-data-1"
sleep 1
send_command "publisher" "publish-frame:${TARGETED_STREAM_ID}:position-data-2"
sleep 1
send_command "publisher" "publish-frame:${TARGETED_STREAM_ID}:position-data-3"
sleep 2

if wait_for_response "publisher" "publish-frame-result" 5; then
  pass "Publisher sent frames"
else
  fail "Publisher sent frames" "No response received"
fi

# Step 4: Verify aggregator received ALL targeted frames
echo -e "\n${YELLOW}-- Step 4: Verify aggregator received targeted frames --${NC}"
send_command "aggregator" "report-received-frames"

if wait_for_response "aggregator" "report-received-frames" 5; then
  AGGREGATOR_FRAMES=$(grep -F "\"from\":\"aggregator\"" "${ENVELOPE_LOG}" | grep -F "response:report-received-frames" | tail -1)

  # Check aggregator received all 3 frames
  if echo "${AGGREGATOR_FRAMES}" | grep -Fq "position-data-1" && \
     echo "${AGGREGATOR_FRAMES}" | grep -Fq "position-data-2" && \
     echo "${AGGREGATOR_FRAMES}" | grep -Fq "position-data-3"; then
    pass "Aggregator received all 3 targeted frames"
  else
    fail "Aggregator received targeted frames" "Missing one or more frames"
    echo "  Debug: ${AGGREGATOR_FRAMES}"
  fi
else
  fail "Aggregator report received" "No response"
fi

# Step 5: Verify observer did NOT receive ANY targeted frames (THE KEY TEST)
echo -e "\n${YELLOW}-- Step 5: Verify observer did NOT receive targeted frames --${NC}"
send_command "observer" "report-received-frames"

if wait_for_response "observer" "report-received-frames" 5; then
  OBSERVER_FRAMES=$(grep -F "\"from\":\"observer\"" "${ENVELOPE_LOG}" | grep -F "response:report-received-frames" | tail -1)

  # Check observer received NONE of the targeted frames
  OBSERVER_LEAKED=0
  if echo "${OBSERVER_FRAMES}" | grep -Fq "position-data-1"; then OBSERVER_LEAKED=1; fi
  if echo "${OBSERVER_FRAMES}" | grep -Fq "position-data-2"; then OBSERVER_LEAKED=1; fi
  if echo "${OBSERVER_FRAMES}" | grep -Fq "position-data-3"; then OBSERVER_LEAKED=1; fi

  if [[ "${OBSERVER_LEAKED}" -eq 0 ]]; then
    pass "Observer correctly excluded from targeted stream (received 0 targeted frames)"
  else
    fail "Observer excluded from targeted stream" "LEAK: Observer received targeted frames that should have been private!"
    echo "  Debug: ${OBSERVER_FRAMES}"
  fi
else
  fail "Observer report received" "No response"
fi

sleep 2

# Step 6: Create a broadcast stream (no target)
echo -e "\n${YELLOW}-- Step 6: aggregator creates broadcast stream (no target) --${NC}"
send_command "aggregator" "create-broadcast-stream:World state updates"

sleep 2

# Extract broadcast stream ID
BROADCAST_STREAM_ID=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1 | sed -n 's/.*"stream_id":"\([^"]*\)".*/\1/p' || echo "")
if [[ -n "${BROADCAST_STREAM_ID}" && "${BROADCAST_STREAM_ID}" != "${TARGETED_STREAM_ID}" ]]; then
  echo -e "  Broadcast Stream ID: ${GREEN}${BROADCAST_STREAM_ID}${NC}"
  pass "Broadcast stream created"
else
  fail "Broadcast stream created" "Could not find new stream_id"
  exit 1
fi

# Verify broadcast stream does NOT have target field
BROADCAST_STREAM_OPEN=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1)
if echo "${BROADCAST_STREAM_OPEN}" | grep -Fq '"target"'; then
  fail "Broadcast stream has no target" "Target field found in broadcast stream"
else
  pass "Broadcast stream has no target"
fi

sleep 2

# Step 7: Clear received frames before broadcast test
echo -e "\n${YELLOW}-- Step 7: Clear frames for broadcast test --${NC}"
send_command "publisher" "clear-received-frames"
send_command "aggregator" "clear-received-frames"
send_command "observer" "clear-received-frames"
sleep 2

# Step 8: Aggregator publishes to broadcast stream
echo -e "\n${YELLOW}-- Step 8: aggregator publishes to broadcast stream --${NC}"
send_command "aggregator" "publish-frame:${BROADCAST_STREAM_ID}:world-state-1"
sleep 1
send_command "aggregator" "publish-frame:${BROADCAST_STREAM_ID}:world-state-2"
sleep 2

if wait_for_response "aggregator" "publish-frame-result" 5; then
  pass "Aggregator sent broadcast frames"
else
  fail "Aggregator sent broadcast frames" "No response received"
fi

# Step 9: Verify ALL participants received broadcast frames
echo -e "\n${YELLOW}-- Step 9: Verify all participants receive broadcast --${NC}"

# Check publisher received broadcast
send_command "publisher" "report-received-frames"
if wait_for_response "publisher" "report-received-frames" 5; then
  PUBLISHER_FRAMES=$(grep -F "\"from\":\"publisher\"" "${ENVELOPE_LOG}" | grep -F "response:report-received-frames" | tail -1)
  if echo "${PUBLISHER_FRAMES}" | grep -Fq "world-state-1"; then
    pass "Publisher received broadcast frames"
  else
    fail "Publisher received broadcast frames" "Broadcast frames not received"
  fi
fi

# Check observer received broadcast
send_command "observer" "report-received-frames"
if wait_for_response "observer" "report-received-frames" 5; then
  OBSERVER_FRAMES2=$(grep -F "\"from\":\"observer\"" "${ENVELOPE_LOG}" | grep -F "response:report-received-frames" | tail -1)
  if echo "${OBSERVER_FRAMES2}" | grep -Fq "world-state-1"; then
    pass "Observer received broadcast frames"
  else
    fail "Observer received broadcast frames" "Broadcast frames not received"
  fi
fi

# Check aggregator received its own broadcast
send_command "aggregator" "report-received-frames"
if wait_for_response "aggregator" "report-received-frames" 5; then
  AGGREGATOR_FRAMES2=$(grep -F "\"from\":\"aggregator\"" "${ENVELOPE_LOG}" | grep -F "response:report-received-frames" | tail -1)
  if echo "${AGGREGATOR_FRAMES2}" | grep -Fq "world-state-1"; then
    pass "Aggregator received own broadcast frames"
  else
    fail "Aggregator received own broadcast frames" "Broadcast frames not received"
  fi
fi

sleep 2

# Step 10: Verify streams are visible in active_streams (via report-streams)
echo -e "\n${YELLOW}-- Step 10: Verify streams metadata includes target --${NC}"
send_command "observer" "report-streams"

if wait_for_response "observer" "report-streams" 5; then
  STREAMS_REPORT=$(grep -F "\"from\":\"observer\"" "${ENVELOPE_LOG}" | grep -F "response:report-streams" | tail -1)

  # Check that targeted stream shows target field
  if echo "${STREAMS_REPORT}" | grep -Fq "\"target\""; then
    pass "Stream metadata includes target field"
  else
    fail "Stream metadata includes target field" "Target not found in streams report"
    echo "  Debug: ${STREAMS_REPORT}"
  fi
fi

sleep 2

# ============================================================================
# SECURITY TESTS: Verify payload override protection
# ============================================================================
echo -e "\n${YELLOW}-- SECURITY TEST: Payload override protection --${NC}"

# Step 11: Publisher creates a stream with malicious payload fields
# Attempts to inject authorizedWriters: ["observer", "attacker"]
echo -e "\n${YELLOW}-- Step 11: Create stream with malicious authorizedWriters in payload --${NC}"
send_command "publisher" "create-malicious-stream:observer:Malicious stream test"

sleep 2

# Extract the malicious stream ID
MALICIOUS_STREAM_ID=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1 | sed -n 's/.*"stream_id":"\([^"]*\)".*/\1/p' || echo "")
if [[ -n "${MALICIOUS_STREAM_ID}" && "${MALICIOUS_STREAM_ID}" != "${BROADCAST_STREAM_ID}" ]]; then
  echo -e "  Malicious test Stream ID: ${GREEN}${MALICIOUS_STREAM_ID}${NC}"
  pass "Stream created (malicious payload ignored)"
else
  fail "Stream created" "Could not find new stream_id"
fi

# Step 12: Verify owner is publisher (not "attacker" from malicious payload)
echo -e "\n${YELLOW}-- Step 12: Verify server set correct owner (not malicious payload) --${NC}"
MALICIOUS_STREAM_OPEN=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | grep -F "${MALICIOUS_STREAM_ID}" | tail -1)
if echo "${MALICIOUS_STREAM_OPEN}" | grep -Fq '"owner":"publisher"'; then
  pass "Server correctly set owner to publisher (ignored malicious participantId)"
else
  fail "Server set correct owner" "Owner may have been overridden by malicious payload"
  echo "  Debug: ${MALICIOUS_STREAM_OPEN}"
fi

# Step 13: Verify authorized_writers only contains publisher (not observer/attacker)
echo -e "\n${YELLOW}-- Step 13: Verify authorized_writers was not overridden --${NC}"
if echo "${MALICIOUS_STREAM_OPEN}" | grep -Fq '"authorized_writers":["publisher"]'; then
  pass "Server correctly set authorized_writers (ignored malicious payload)"
else
  # Check if it incorrectly contains observer or attacker
  if echo "${MALICIOUS_STREAM_OPEN}" | grep -Fq '"observer"' || echo "${MALICIOUS_STREAM_OPEN}" | grep -Fq '"attacker"'; then
    fail "authorized_writers protection" "SECURITY ISSUE: Malicious payload was able to inject authorized_writers!"
    echo "  Debug: ${MALICIOUS_STREAM_OPEN}"
  else
    pass "Server correctly set authorized_writers (ignored malicious payload)"
  fi
fi

# Step 14: Verify observer CANNOT write to the stream (despite being in malicious payload)
# The real test is whether the frame gets delivered to other participants
echo -e "\n${YELLOW}-- Step 14: Verify observer cannot write (malicious authorizedWriters rejected) --${NC}"

# First clear frames so we can check what arrives
send_command "publisher" "clear-received-frames"
send_command "aggregator" "clear-received-frames"
sleep 1

# Observer attempts to write unauthorized data
send_command "observer" "publish-frame:${MALICIOUS_STREAM_ID}:UNAUTHORIZED-SECURITY-TEST-DATA"

sleep 2

# The KEY test: did the unauthorized frame actually get delivered to other participants?
# If the security fix works, publisher should NOT have received "UNAUTHORIZED-SECURITY-TEST-DATA"
send_command "publisher" "report-received-frames"

if wait_for_response "publisher" "report-received-frames" 5; then
  SECURITY_CHECK=$(grep -F "\"from\":\"publisher\"" "${ENVELOPE_LOG}" | grep -F "response:report-received-frames" | tail -1)
  if echo "${SECURITY_CHECK}" | grep -Fq "UNAUTHORIZED-SECURITY-TEST-DATA"; then
    fail "Observer write rejection" "SECURITY ISSUE: Unauthorized frame was delivered to other participants!"
    echo "  Debug: ${SECURITY_CHECK}"
  else
    pass "Observer correctly rejected from writing (frame not delivered)"
  fi
else
  fail "Security check" "Could not verify frame delivery"
fi

# Step 15: Verify publisher CAN still write (they are the real owner)
echo -e "\n${YELLOW}-- Step 15: Verify publisher can write (is real owner) --${NC}"
send_command "publisher" "publish-frame:${MALICIOUS_STREAM_ID}:legitimate-owner-data"

if wait_for_response "publisher" "publish-frame-result" 5; then
  PUBLISHER_RESULT=$(grep -F "\"from\":\"publisher\"" "${ENVELOPE_LOG}" | grep -F "response:publish-frame-result" | tail -1)
  if echo "${PUBLISHER_RESULT}" | grep -Fq '"success":true'; then
    pass "Publisher can write to own stream (correct ownership)"
  else
    fail "Publisher write" "Publisher should be able to write to own stream"
  fi
fi

echo ""
echo -e "${YELLOW}=== Scenario 18 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
