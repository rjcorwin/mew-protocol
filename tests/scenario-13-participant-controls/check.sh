#!/usr/bin/env bash
# Scenario 13 assertions - validate participant lifecycle controls

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

echo -e "${YELLOW}=== Scenario 13: Participant Lifecycle Checks ===${NC}"

echo -e "${BLUE}Gateway port:${NC} ${TEST_PORT}"
echo -e "${BLUE}Log file:${NC} ${OUTPUT_LOG}"

if wait_for_pattern "${CONTROL_LOG}" 'connected' 20; then
  echo -e "control-agent ready: ${GREEN}✓${NC}"
else
  echo -e "control-agent ready: ${RED}✗${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo -e "${YELLOW}-- Participant clear --${NC}"
CLEAR_ID="clear-$(date +%s)"
post_message "{\"id\":\"$CLEAR_ID\",\"kind\":\"participant/clear\",\"to\":[\"control-agent\"],\"payload\":{\"reason\":\"test_clear\"}}"
record_result "participant clear status" "\"status\":\"cleared:test_clear\""
record_result "participant clear correlation" "\"correlation_id\":[\"$CLEAR_ID\"]"


echo -e "${YELLOW}-- Participant restart --${NC}"
RESTART_ID="restart-$(date +%s)"
post_message "{\"id\":\"$RESTART_ID\",\"kind\":\"participant/restart\",\"to\":[\"control-agent\"],\"payload\":{}}"
record_result "participant restart status" "\"status\":\"restarted\""
record_result "participant restart correlation" "\"correlation_id\":[\"$RESTART_ID\"]"


echo -e "${YELLOW}-- Participant compact --${NC}"
COMPACT_ID="compact-$(date +%s)"
post_message "{\"id\":\"$COMPACT_ID\",\"kind\":\"participant/compact\",\"to\":[\"control-agent\"],\"payload\":{\"reason\":\"test_compact\",\"target_tokens\":5120}}"
record_result "participant compact status start" "\"status\":\"compacting\""
record_result "participant compact done" "\"kind\":\"participant/compact-done\""
record_result "participant compact status end" "\"status\":\"compacted\""
record_result "participant compact correlation" "\"correlation_id\":[\"$COMPACT_ID\"]"


echo -e "${YELLOW}-- Participant pause / resume --${NC}"
PAUSE_ID="pause-$(date +%s)"
post_message "{\"id\":\"$PAUSE_ID\",\"kind\":\"participant/pause\",\"to\":[\"control-agent\"],\"payload\":{\"reason\":\"test_pause\",\"timeout_seconds\":2}}"
record_result "participant pause status" "\"status\":\"paused:test_pause\""
record_result "participant resume emitted" "\"kind\":\"participant/resume\""
record_result "participant resume status" "\"status\":\"active\""
record_result "participant pause correlation" "\"correlation_id\":[\"$PAUSE_ID\"]"


echo -e "${YELLOW}-- Participant shutdown --${NC}"
SHUTDOWN_ID="shutdown-$(date +%s)"
post_message "{\"id\":\"$SHUTDOWN_ID\",\"kind\":\"participant/shutdown\",\"to\":[\"control-agent\"],\"payload\":{\"reason\":\"test_shutdown\"}}"
record_result "participant shutdown status" "\"status\":\"shutting_down:test_shutdown\""
record_result "participant shutdown correlation" "\"correlation_id\":[\"$SHUTDOWN_ID\"]"


echo ""
echo -e "${YELLOW}=== Scenario 13 Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  exit 0
fi

exit 1
