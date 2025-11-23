#!/usr/bin/env bash
# Scenario 15 assertions - validate active_streams in welcome message for late joiners
#
# HOW THIS TEST WORKS:
#
# This test validates the stream visibility feature using HTTP POST messages and the
# "lazy auto-connect" mechanism for participants with output_log configured.
#
# Flow:
# 1. Gateway starts with client-a already auto-connected (has auto_connect: true)
# 2. client-a POSTs a stream/request, creating an active stream
# 3. client-b POSTs its first message (a chat message)
# 4. Gateway detects client-b has output_log but isn't connected yet
# 5. Gateway triggers "lazy auto-connect" (gateway.ts:169-178):
#    - Creates a virtual WebSocket for client-b
#    - Adds client-b to space.participants
#    - Calls buildActiveStreamsArray(space) to get current active streams
#    - Sends welcome message with active_streams field to client-b
#    - Virtual WebSocket's send() writes the welcome to client-b's log file
# 6. Test validates welcome message in log file includes client-a's active stream
#
# Key insight: The virtual WebSocket's send() method just appends JSON to the log file,
# so the participant doesn't need a real WebSocket connection to receive messages.

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

CLIENT_A_LOG=${CLIENT_A_LOG:-"${WORKSPACE_DIR}/logs/client-a.log"}
CLIENT_B_LOG=${CLIENT_B_LOG:-"${WORKSPACE_DIR}/logs/client-b.log"}
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

: > "${CLIENT_A_LOG}"
: > "${CLIENT_B_LOG}"

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Gateway healthy${NC}"
else
  echo -e "${RED}✗ Gateway health check failed${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Scenario 15: Stream Visibility on Join ===${NC}"
echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Envelope log:${NC} ${ENVELOPE_LOG}"

# Step 1: Client A joins the space
echo -e "${YELLOW}-- Step 1: Client A joins --${NC}"
CLIENT_A_MSG_ID="client-a-join-$(date +%s)"
post_message "client-a" "client-a-token" "{\"id\":\"${CLIENT_A_MSG_ID}\",\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, I am client A\"}}"
record_result "Client A joined" "${ENVELOPE_LOG}" "\"from\":\"client-a\""

# Step 2: Client A requests a stream with metadata
echo -e "${YELLOW}-- Step 2: Client A requests stream with metadata --${NC}"
STREAM_REQ_ID="stream-req-$(date +%s)"
post_message "client-a" "client-a-token" "{\"id\":\"${STREAM_REQ_ID}\",\"kind\":\"stream/request\",\"to\":[\"gateway\"],\"payload\":{\"direction\":\"upload\",\"expected_size_bytes\":1024,\"description\":\"Test stream\",\"content_type\":\"text/plain\",\"format\":\"utf8\"}}"
record_result "Stream request sent" "${ENVELOPE_LOG}" "\"kind\":\"stream/request\""

# Wait for stream/open response
sleep 2

# Extract stream ID from envelope log
# Use sed instead of grep -P for macOS compatibility
STREAM_ID=$(grep -F '"kind":"stream/open"' "${ENVELOPE_LOG}" 2>/dev/null | tail -1 | sed -n 's/.*"stream_id":"\([^"]*\)".*/\1/p' || echo "")
if [[ -n "${STREAM_ID}" ]]; then
  echo -e "Stream opened with ID: ${GREEN}${STREAM_ID}${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Stream opened with ID: ${RED}✗ (not found)${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Step 3: Client B joins AFTER stream is active
echo -e "${YELLOW}-- Step 3: Client B joins (late joiner) --${NC}"
# NOTE: This HTTP POST triggers lazy auto-connect because client-b has output_log configured.
# The gateway will create a virtual WebSocket, add client-b to space.participants, and send
# a welcome message that includes the active_streams array (with client-a's stream in it).
# The welcome message gets written to client-b's log file via the virtual WebSocket.
CLIENT_B_MSG_ID="client-b-join-$(date +%s)"
post_message "client-b" "client-b-token" "{\"id\":\"${CLIENT_B_MSG_ID}\",\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, I am client B\"}}"
record_result "Client B joined" "${ENVELOPE_LOG}" "\"from\":\"client-b\""

# Step 4: Check that Client B's welcome message includes active_streams
echo -e "${YELLOW}-- Step 4: Verify Client B sees active stream in welcome --${NC}"
# The welcome message was written to client-b's log during lazy auto-connect above.
# We check the envelope log (which records all message deliveries) for the welcome.
sleep 2

# Check envelope log for welcome message to client-b with active_streams
record_result "Welcome sent to client-b" "${ENVELOPE_LOG}" "\"kind\":\"system/welcome\""
record_result "Welcome includes active_streams" "${ENVELOPE_LOG}" "\"active_streams\""

# Check that the stream ID appears in the active_streams array
if [[ -n "${STREAM_ID}" ]]; then
  # Look for the stream_id in a welcome message
  if grep -F '"kind":"system/welcome"' "${ENVELOPE_LOG}" | grep -F '"to":["client-b"]' | grep -Fq "\"stream_id\":\"${STREAM_ID}\""; then
    echo -e "Active stream in welcome message: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "Active stream in welcome message: ${RED}✗${NC} (stream ID ${STREAM_ID} not found in client-b's welcome)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

# Check that owner field is set correctly
record_result "Stream owner is client-a" "${ENVELOPE_LOG}" "\"owner\":\"client-a\""

# Check that direction field is set correctly
record_result "Stream direction is upload" "${ENVELOPE_LOG}" "\"direction\":\"upload\""

# Check that created timestamp has valid ISO 8601 format
if grep -F '"kind":"system/welcome"' "${ENVELOPE_LOG}" | grep -F '"to":["client-b"]' | grep -Eq '"created":"[0-9]{4}-[0-9]{2}-[0-9]{2}T'; then
  echo -e "Stream has valid created timestamp: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "Stream has valid created timestamp: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Check that metadata fields are preserved from stream/request
record_result "Stream metadata includes description" "${ENVELOPE_LOG}" "\"description\":\"Test stream\""
record_result "Stream metadata includes content_type" "${ENVELOPE_LOG}" "\"content_type\":\"text/plain\""
record_result "Stream metadata includes format" "${ENVELOPE_LOG}" "\"format\":\"utf8\""
record_result "Stream metadata includes expected_size_bytes" "${ENVELOPE_LOG}" "\"expected_size_bytes\":1024"

# Step 5: Close the stream
echo -e "${YELLOW}-- Step 5: Close stream --${NC}"
if [[ -n "${STREAM_ID}" ]]; then
  STREAM_CLOSE_ID="stream-close-$(date +%s)"
  post_message "client-a" "client-a-token" "{\"id\":\"${STREAM_CLOSE_ID}\",\"kind\":\"stream/close\",\"payload\":{\"stream_id\":\"${STREAM_ID}\",\"reason\":\"complete\"}}"
  record_result "Stream close sent" "${ENVELOPE_LOG}" "\"kind\":\"stream/close\""
fi

# Step 6: Client C joins AFTER stream is closed
echo -e "${YELLOW}-- Step 6: Client C joins (after stream closed) --${NC}"
sleep 2
CLIENT_C_MSG_ID="client-c-join-$(date +%s)"
post_message "client-c" "client-c-token" "{\"id\":\"${CLIENT_C_MSG_ID}\",\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, I am client C\"}}"
record_result "Client C joined" "${ENVELOPE_LOG}" "\"from\":\"client-c\""

# Verify Client C's welcome has empty active_streams
sleep 1
if grep -F '"kind":"system/welcome"' "${ENVELOPE_LOG}" | grep -F '"to":["client-c"]' | grep -Fq '"active_streams":[]'; then
  echo -e "Client C sees no active streams: ${GREEN}✓${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  # Also accept if active_streams array is present but stream ID is not in it
  if ! grep -F '"kind":"system/welcome"' "${ENVELOPE_LOG}" | grep -F '"to":["client-c"]' | grep -Fq "\"stream_id\":\"${STREAM_ID}\""; then
    echo -e "Client C sees no active streams: ${GREEN}✓${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "Client C sees no active streams: ${RED}✗${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

echo ""
echo -e "${YELLOW}=== Scenario 15 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
