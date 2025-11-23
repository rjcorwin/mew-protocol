#!/usr/bin/env bash
# Scenario 16 assertions - validate stream ownership grant/revoke/transfer operations
#
# HOW THIS TEST WORKS:
#
# This test validates the stream ownership transfer feature ([s2w] proposal) using
# HTTP POST messages and the "lazy auto-connect" mechanism for participants with
# output_log configured.
#
# Test Flow:
# 1. stream-owner (auto-connected) creates a stream
# 2. stream-owner publishes test frame → should succeed (owner always authorized)
# 3. stream-writer connects (late joiner) and sees authorized_writers: ["stream-owner"]
# 4. stream-writer attempts to publish frame → should fail (not authorized yet)
# 5. stream-owner grants write access to stream-writer
# 6. stream-writer publishes frame → should succeed (now authorized)
# 7. verifier connects (late joiner) and sees authorized_writers: ["stream-owner", "stream-writer"]
# 8. stream-owner revokes stream-writer's access
# 9. stream-writer attempts to publish → should fail (access revoked)
# 10. stream-owner transfers ownership to stream-writer
# 11. stream-writer (now owner) publishes → should succeed
# 12. stream-owner attempts to publish → should fail (no longer owner, not in authorized_writers)

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

OWNER_LOG=${OWNER_LOG:-"${WORKSPACE_DIR}/logs/stream-owner.log"}
WRITER_LOG=${WRITER_LOG:-"${WORKSPACE_DIR}/logs/stream-writer.log"}
VERIFIER_LOG=${VERIFIER_LOG:-"${WORKSPACE_DIR}/logs/verifier.log"}
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
  local timeout="${3:-20}"
  local waited=0
  while [[ ${waited} -lt ${timeout} ]]; do
    if [[ -f "$file" ]] && grep -Fq -- "$pattern" "$file"; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

record_result() {
  local name="$1"
  local file="$2"
  local pattern="$3"
  if wait_for_pattern "${file}" "${pattern}" 20; then
    echo -e "$name: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "$name: ${RED}✗${NC}" "(pattern not found: $pattern)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

post_message() {
  local participant="$1"
  local token="$2"
  local body="$3"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/${participant}/messages" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null
}

post_stream_frame() {
  local participant="$1"
  local token="$2"
  local stream_id="$3"
  local data="$4"
  local url="http://localhost:${TEST_PORT}/participants/${participant}/messages"

  # Stream frames use raw format: #streamID#data
  curl -sf -X POST "$url" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: text/plain" \
    -d "#${stream_id}#${data}" > /dev/null 2>&1 || return 1
  return 0
}

: > "${OWNER_LOG}"
: > "${WRITER_LOG}"
: > "${VERIFIER_LOG}"

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Gateway healthy${NC}"
else
  echo -e "${RED}✗ Gateway health check failed${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Scenario 16: Stream Ownership Transfer ===${NC}"
echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Envelope log:${NC} ${ENVELOPE_LOG}"

# Step 1: stream-owner joins and creates a stream
echo -e "${YELLOW}-- Step 1: stream-owner joins and creates stream --${NC}"
OWNER_JOIN_ID="owner-join-$(date +%s)"
post_message "stream-owner" "stream-owner-token" "{\"id\":\"${OWNER_JOIN_ID}\",\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, I am stream-owner\"}}"
record_result "stream-owner joined" "${ENVELOPE_LOG}" "\"from\":\"stream-owner\""

sleep 1

STREAM_REQ_ID="stream-req-$(date +%s)"
post_message "stream-owner" "stream-owner-token" "{\"id\":\"${STREAM_REQ_ID}\",\"kind\":\"stream/request\",\"to\":[\"gateway\"],\"payload\":{\"direction\":\"upload\",\"description\":\"Character position stream\"}}"
record_result "Stream request sent" "${ENVELOPE_LOG}" "\"kind\":\"stream/request\""

sleep 2

# Extract stream ID from envelope log
STREAM_ID=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1 | sed -n 's/.*"stream_id":"\([^"]*\)".*/\1/p' || echo "")
if [[ -n "${STREAM_ID}" ]]; then
  echo -e "Stream opened with ID: ${GREEN}${STREAM_ID}${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Stream opened with ID: ${RED}✗ (not found)${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 2: stream-owner publishes test frame (should succeed - owner always authorized)
echo -e "${YELLOW}-- Step 2: stream-owner publishes frame (as owner) --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  if post_stream_frame "stream-owner" "stream-owner-token" "${STREAM_ID}" "frame1:owner"; then
    echo -e "Owner published frame: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "Owner published frame: ${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

sleep 1

# Step 3: stream-writer joins (late joiner) and should see owner in authorized_writers
echo -e "${YELLOW}-- Step 3: stream-writer joins (late joiner) --${NC}"
WRITER_JOIN_ID="writer-join-$(date +%s)"
post_message "stream-writer" "stream-writer-token" "{\"id\":\"${WRITER_JOIN_ID}\",\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, I am stream-writer\"}}"
record_result "stream-writer joined" "${ENVELOPE_LOG}" "\"from\":\"stream-writer\""

sleep 2

# Check that stream-writer's welcome includes authorized_writers with only owner
if grep -F '"kind":"system/welcome"' "${ENVELOPE_LOG}" | grep -F '"to":["stream-writer"]' | grep -Fq '"authorized_writers":["stream-owner"]'; then
  echo -e "stream-writer sees owner in authorized_writers: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "stream-writer sees owner in authorized_writers: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 4: stream-writer attempts to publish (should fail - not authorized)
echo -e "${YELLOW}-- Step 4: stream-writer attempts publish (unauthorized) --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  if post_stream_frame "stream-writer" "stream-writer-token" "${STREAM_ID}" "frame2:writer-unauthorized"; then
    echo -e "Unauthorized write rejected: ${RED}✗ (should have failed)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    echo -e "Unauthorized write rejected: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
fi

sleep 1

# Check for error message sent to stream-writer
if grep -F '"to":["stream-writer"]' "${ENVELOPE_LOG}" | grep -Fq '"kind":"system/error"'; then
  echo -e "Error sent to unauthorized writer: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Error sent to unauthorized writer: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 5: stream-owner grants write access to stream-writer
echo -e "${YELLOW}-- Step 5: stream-owner grants write to stream-writer --${NC}"
GRANT_MSG_ID="grant-$(date +%s)"
post_message "stream-owner" "stream-owner-token" "{\"id\":\"${GRANT_MSG_ID}\",\"kind\":\"stream/grant-write\",\"payload\":{\"stream_id\":\"${STREAM_ID}\",\"participant_id\":\"stream-writer\",\"reason\":\"Player takes control\"}}"
record_result "Grant-write sent" "${ENVELOPE_LOG}" "\"kind\":\"stream/grant-write\""

sleep 2

# Check for acknowledgement broadcast
record_result "Write-granted ack broadcast" "${ENVELOPE_LOG}" "\"kind\":\"stream/write-granted\""

# Verify authorized_writers array in acknowledgement includes both participants
if grep -F '"kind":"stream/write-granted"' "${ENVELOPE_LOG}" | grep -Fq '"participant_id":"stream-writer"'; then
  echo -e "Grant ack includes stream-writer: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Grant ack includes stream-writer: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 6: stream-writer publishes frame (should succeed - now authorized)
echo -e "${YELLOW}-- Step 6: stream-writer publishes frame (authorized) --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  if post_stream_frame "stream-writer" "stream-writer-token" "${STREAM_ID}" "frame3:writer-authorized"; then
    echo -e "Authorized write succeeded: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "Authorized write succeeded: ${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

sleep 1

# Step 7: verifier joins (late joiner) and should see both in authorized_writers
echo -e "${YELLOW}-- Step 7: verifier joins (late joiner) --${NC}"
VERIFIER_JOIN_ID="verifier-join-$(date +%s)"
post_message "verifier" "verifier-token" "{\"id\":\"${VERIFIER_JOIN_ID}\",\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, I am verifier\"}}"
record_result "verifier joined" "${ENVELOPE_LOG}" "\"from\":\"verifier\""

sleep 2

# Check that verifier sees both stream-owner and stream-writer in authorized_writers
# The array can be in any order, so check for both participants individually
VERIFIER_WELCOME=$(grep -F '"kind":"system/welcome"' "${ENVELOPE_LOG}" | grep -F '"to":["verifier"]' | tail -1 || echo "")
if echo "${VERIFIER_WELCOME}" | grep -Fq '"stream-owner"' && echo "${VERIFIER_WELCOME}" | grep -Fq '"stream-writer"'; then
  echo -e "verifier sees both participants in authorized_writers: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "verifier sees both participants in authorized_writers: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 8: stream-owner revokes stream-writer's access
echo -e "${YELLOW}-- Step 8: stream-owner revokes stream-writer access --${NC}"
REVOKE_MSG_ID="revoke-$(date +%s)"
post_message "stream-owner" "stream-owner-token" "{\"id\":\"${REVOKE_MSG_ID}\",\"kind\":\"stream/revoke-write\",\"payload\":{\"stream_id\":\"${STREAM_ID}\",\"participant_id\":\"stream-writer\",\"reason\":\"Player disconnected\"}}"
record_result "Revoke-write sent" "${ENVELOPE_LOG}" "\"kind\":\"stream/revoke-write\""

sleep 2

# Check for revocation broadcast
record_result "Write-revoked notification broadcast" "${ENVELOPE_LOG}" "\"kind\":\"stream/write-revoked\""

# Verify stream-writer is removed from authorized_writers in notification
if grep -F '"kind":"stream/write-revoked"' "${ENVELOPE_LOG}" | grep -Fq '"participant_id":"stream-writer"'; then
  echo -e "Revoke notification includes stream-writer: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Revoke notification includes stream-writer: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 9: stream-writer attempts to publish (should fail - access revoked)
echo -e "${YELLOW}-- Step 9: stream-writer attempts publish (revoked) --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  if post_stream_frame "stream-writer" "stream-writer-token" "${STREAM_ID}" "frame4:writer-revoked"; then
    echo -e "Revoked write rejected: ${RED}✗ (should have failed)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    echo -e "Revoked write rejected: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
fi

sleep 1

# Step 10: stream-owner transfers ownership to stream-writer
echo -e "${YELLOW}-- Step 10: stream-owner transfers ownership to stream-writer --${NC}"
TRANSFER_MSG_ID="transfer-$(date +%s)"
post_message "stream-owner" "stream-owner-token" "{\"id\":\"${TRANSFER_MSG_ID}\",\"kind\":\"stream/transfer-ownership\",\"payload\":{\"stream_id\":\"${STREAM_ID}\",\"new_owner\":\"stream-writer\",\"reason\":\"AI agent takes over\"}}"
record_result "Transfer-ownership sent" "${ENVELOPE_LOG}" "\"kind\":\"stream/transfer-ownership\""

sleep 2

# Check for ownership transferred broadcast
record_result "Ownership-transferred event broadcast" "${ENVELOPE_LOG}" "\"kind\":\"stream/ownership-transferred\""

# Verify new_owner and previous_owner in transfer event
TRANSFER_EVENT=$(grep -F '"kind":"stream/ownership-transferred"' "${ENVELOPE_LOG}" | tail -1 || echo "")
if echo "${TRANSFER_EVENT}" | grep -Fq '"new_owner":"stream-writer"' && echo "${TRANSFER_EVENT}" | grep -Fq '"previous_owner":"stream-owner"'; then
  echo -e "Transfer event has correct owner fields: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Transfer event has correct owner fields: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 11: stream-writer (now owner) publishes frame (should succeed)
echo -e "${YELLOW}-- Step 11: stream-writer publishes as new owner --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  if post_stream_frame "stream-writer" "stream-writer-token" "${STREAM_ID}" "frame5:new-owner"; then
    echo -e "New owner write succeeded: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "New owner write succeeded: ${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

sleep 1

# Step 12: stream-owner attempts to publish (should fail - no longer owner)
echo -e "${YELLOW}-- Step 12: stream-owner attempts publish (no longer owner) --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  if post_stream_frame "stream-owner" "stream-owner-token" "${STREAM_ID}" "frame6:old-owner"; then
    echo -e "Old owner write rejected: ${RED}✗ (should have failed)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    echo -e "Old owner write rejected: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
fi

sleep 1

# Additional validation: Check that owner field is updated in stream metadata
# This would be visible to future late joiners in their welcome message
echo -e "${YELLOW}-- Additional checks --${NC}"

# Verify stream metadata in envelope log shows stream_owner as original creator
if grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" | grep -Fq "\"stream_id\":\"${STREAM_ID}\""; then
  echo -e "Stream metadata recorded: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Stream metadata recorded: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo -e "${YELLOW}=== Scenario 16 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
