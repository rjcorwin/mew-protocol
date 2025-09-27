#!/usr/bin/env bash
# Scenario 11 assertions - validate chat acknowledgements and reasoning controls

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
  local pattern="$2"
  if wait_for_pattern "${OUTPUT_LOG}" "${pattern}" 20; then
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

echo -e "${YELLOW}=== Scenario 11: Chat & Reasoning Controls ===${NC}"

echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Log file:${NC} ${OUTPUT_LOG}"

if wait_for_pattern "${CONTROL_LOG}" 'connected' 20; then
  echo -e "control-agent ready: ${GREEN}✓${NC}"
else
  echo -e "control-agent ready: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -e "${YELLOW}-- Chat acknowledgement flow --${NC}"
ACK_ID="chat-ack-$(date +%s)"
post_message "{\"id\":\"$ACK_ID\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"ack\"}}"
record_result "chat acknowledgement emitted" "\"kind\":\"chat/acknowledge\""
record_result "ack references original chat" "\"correlation_id\":[\"$ACK_ID\"]"

CANCEL_TRIGGER="chat-cancel-$(date +%s)"
post_message "{\"id\":\"$CANCEL_TRIGGER\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"cancel ack\"}}"
record_result "chat cancellation emitted" "\"kind\":\"chat/cancel\""
record_result "cancel references acknowledged chat" "\"correlation_id\":[\"$ACK_ID\"]"


echo -e "${YELLOW}-- Reasoning cancellation flow --${NC}"
REASON_CHAT="chat-reason-$(date +%s)"
post_message "{\"id\":\"$REASON_CHAT\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"start_reasoning\"}}"
record_result "reasoning start emitted" "\"kind\":\"reasoning/start\""
record_result "reasoning start correlated" "\"correlation_id\":[\"$REASON_CHAT\"]"
record_result "reasoning start context id" "\"context\":\"reasoning-start-1\""

CANCEL_REASON="chat-stop-$(date +%s)"
post_message "{\"id\":\"$CANCEL_REASON\",\"kind\":\"chat\",\"to\":[\"control-agent\"],\"payload\":{\"text\":\"cancel_reasoning\"}}"
record_result "reasoning cancel emitted" "\"kind\":\"reasoning/cancel\""
record_result "reasoning cancel correlation" "\"correlation_id\":[\"$CANCEL_REASON\"]"
record_result "reasoning cancel context" "\"context\":\"reasoning-start-1\""


echo ""
echo -e "${YELLOW}=== Scenario 11 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
