#!/usr/bin/env bash
# Scenario 10 assertions - validate coordinator/worker delegation behaviour

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

# shellcheck disable=SC1091
source "${SCENARIO_DIR}/../lib/gateway-logs.sh"

OUTPUT_LOG=${OUTPUT_LOG:-"${WORKSPACE_DIR}/logs/test-client-output.log"}
COORDINATOR_LOG=${COORDINATOR_LOG:-"${WORKSPACE_DIR}/logs/coordinator.log"}
WORKER_LOG=${WORKER_LOG:-"${WORKSPACE_DIR}/logs/worker.log"}
TEST_PORT=${TEST_PORT:-8080}

: "${GATEWAY_LOG_DIR:=${WORKSPACE_DIR}/.mew/logs}"

if [[ ! -f "${OUTPUT_LOG}" ]]; then
  echo "Expected output log ${OUTPUT_LOG} was not created" >&2
  exit 1
fi

if [[ ! -f "${COORDINATOR_LOG}" ]]; then
  echo "Expected coordinator log ${COORDINATOR_LOG} was not created" >&2
  exit 1
fi

if [[ ! -f "${WORKER_LOG}" ]]; then
  echo "Expected worker log ${WORKER_LOG} was not created" >&2
  exit 1
fi

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 10 Checks ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Gateway port: ${TEST_PORT}${NC}"

sleep 3

tests_passed=0
tests_failed=0

record_pass() {
  printf "%s: %b\n" "$1" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
}

record_fail() {
  printf "%s: %b\n" "$1" "${RED}✗${NC}"
  tests_failed=$((tests_failed + 1))
}

wait_for_pattern() {
  local file="$1"
  local pattern="$2"
  local attempts=${3:-40}
  for ((i = 0; i < attempts; i += 1)); do
    if grep -Fq -- "$pattern" "$file"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

post_test_client() {
  local json="$1"
  printf '%s' "${json}" | curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    --data-binary @- > /dev/null
}

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  record_pass "Gateway health endpoint"
else
  record_fail "Gateway health endpoint"
fi

: > "${OUTPUT_LOG}"

if wait_for_pattern "${COORDINATOR_LOG}" 'connected' 40; then
  record_pass "Coordinator connected"
else
  record_fail "Coordinator connected"
fi

if wait_for_pattern "${WORKER_LOG}" 'connected' 40; then
  record_pass "Worker connected"
else
  record_fail "Worker connected"
fi

printf "\n%b\n" "${YELLOW}Test: Coordinator delegates addition via worker${NC}"
chat_envelope_id=$(generate_envelope_id)
request_payload=$(cat <<JSON
{"id":"${chat_envelope_id}","kind":"chat","to":["coordinator-agent"],"payload":{"text":"Please add 4 and 6","format":"plain"}}
JSON
)
if post_test_client "${request_payload}"; then
  if wait_for_envelope "${chat_envelope_id}" && \
     wait_for_envelope_receipt "${chat_envelope_id}" "test-client" && \
     wait_for_capability_grant "test-client" "chat" "${chat_envelope_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '4 + 6 = 10' 40; then
    record_pass "Chat response includes result"
  else
    record_fail "Chat response includes result"
  fi
else
  record_fail "Send delegation chat"
fi

if wait_for_pattern "${COORDINATOR_LOG}" 'delegating' 40; then
  record_pass "Coordinator logged delegation"
else
  record_fail "Coordinator logged delegation"
fi

if wait_for_pattern "${WORKER_LOG}" 'sent' 40 && wait_for_pattern "${WORKER_LOG}" 'forward' 40; then
  record_pass "Worker forwarded request"
else
  record_fail "Worker forwarded request"
fi

printf "\n%b\n" "${YELLOW}Test: Coordinator can request tools list via worker${NC}"
: > "${OUTPUT_LOG}"
tools_list_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${tools_list_id}","kind":"mcp/request","to":["worker-agent"],"payload":{"jsonrpc":"2.0","id":512,"method":"tools/list","params":{}}}
JSON
)"; then
  if wait_for_envelope "${tools_list_id}" && \
     wait_for_envelope_receipt "${tools_list_id}" "test-client" && \
     wait_for_capability_grant "test-client" "mcp/request" "${tools_list_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '"tools"' 40; then
    record_pass "tools/list proxied"
  else
    record_fail "tools/list proxied"
  fi
else
  record_fail "Send tools/list via worker"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 10 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
