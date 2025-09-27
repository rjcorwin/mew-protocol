#!/usr/bin/env bash
# Scenario 12 assertions - validate stream lifecycle envelopes

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

OUTPUT_LOG=${OUTPUT_LOG:-"${WORKSPACE_DIR}/logs/test-client-output.log"}
CONTROL_LOG=${CONTROL_LOG:-"${WORKSPACE_DIR}/logs/control-agent.log"}
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
    if grep -Fq -- "$pattern" "$file"; then
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
  local body="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "$body" > /dev/null
}

: > "${OUTPUT_LOG}"

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Gateway healthy${NC}"
else
  echo -e "${RED}✗ Gateway health check failed${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Scenario 12: Stream Lifecycle Checks ===${NC}"

echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Log file:${NC} ${OUTPUT_LOG}"

if wait_for_pattern "${CONTROL_LOG}" 'connected' 20; then
  echo -e "control-agent ready: ${GREEN}✓${NC}"
else
  echo -e "control-agent ready: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -e "${YELLOW}-- Stream negotiation flow --${NC}"
STREAM_TRIGGER="chat-stream-$(date +%s)"
post_message "{\"id\":\"$STREAM_TRIGGER\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"open_stream\"}}"
record_result "stream request emitted" "${OUTPUT_LOG}" "\"kind\":\"stream/request\""
record_result "stream request correlates" "${OUTPUT_LOG}" "\"correlation_id\":[\"$STREAM_TRIGGER\"]"

STREAM_OPEN_ID="stream-open-$(date +%s)"
post_message "{\"id\":\"$STREAM_OPEN_ID\",\"kind\":\"stream/open\",\"to\":[\"control-agent\"],\"correlation_id\":[\"$STREAM_TRIGGER\"],\"payload\":{\"stream_id\":\"stream-123\",\"encoding\":\"text\"}}"
record_result "stream open acknowledgement" "${OUTPUT_LOG}" "Stream opened: stream-123"
record_result "stream open correlated" "${OUTPUT_LOG}" "\"correlation_id\":[\"$STREAM_OPEN_ID\"]"

STREAM_CLOSE_ID="stream-close-$(date +%s)"
post_message "{\"id\":\"$STREAM_CLOSE_ID\",\"kind\":\"stream/close\",\"to\":[\"control-agent\"],\"correlation_id\":[\"$STREAM_OPEN_ID\"],\"payload\":{\"reason\":\"complete\"}}"
record_result "stream close acknowledgement" "${OUTPUT_LOG}" "Stream closed: stream-123 (complete)"
record_result "stream close correlated" "${OUTPUT_LOG}" "\"correlation_id\":[\"$STREAM_CLOSE_ID\"]"


echo ""
echo -e "${YELLOW}=== Scenario 12 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
