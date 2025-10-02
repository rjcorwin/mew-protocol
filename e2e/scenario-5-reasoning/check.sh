#!/usr/bin/env bash
# Scenario 5 assertions - validate reasoning flow and MCP context

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

: "${GATEWAY_LOG_DIR:=${WORKSPACE_DIR}/.mew/logs}"

OUTPUT_LOG=${OUTPUT_LOG:-"${WORKSPACE_DIR}/logs/research-agent-output.log"}
RESPONSE_CAPTURE=${RESPONSE_CAPTURE:-"${WORKSPACE_DIR}/logs/reasoning-capture.log"}
TEST_PORT=${TEST_PORT:-8080}

if [[ ! -f "${OUTPUT_LOG}" ]]; then
  echo "Expected research agent log ${OUTPUT_LOG} not found" >&2
  exit 1
fi

: > "${OUTPUT_LOG}"
: > "${RESPONSE_CAPTURE}"

tail -n 0 -F "${OUTPUT_LOG}" > "${RESPONSE_CAPTURE}" &
tail_pid=$!
cleanup_tail() {
  kill "${tail_pid}" 2>/dev/null || true
}
trap cleanup_tail EXIT

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 5 Checks ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Gateway port: ${TEST_PORT}${NC}"

sleep 2

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

run_check() {
  local name="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    record_pass "${name}"
  else
    record_fail "${name}"
  fi
}

wait_for_pattern() {
  local file="$1"
  local pattern="$2"
  local attempts=${3:-30}
  for ((i = 0; i < attempts; i += 1)); do
    if grep -Fq -- "${pattern}" "${file}"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

post_message() {
  local payload="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/research-agent/messages" \
    -H "Authorization: Bearer research-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" > /dev/null
}

run_check "Gateway health endpoint" curl -sf "http://localhost:${TEST_PORT}/health"
run_check "Research agent log exists" test -f "${OUTPUT_LOG}"

request_id=$(generate_envelope_id)
reason_start_id=$(generate_envelope_id)
thought_one_id=$(generate_envelope_id)
calc_req_one=$(generate_envelope_id)
thought_two_id=$(generate_envelope_id)
calc_req_two=$(generate_envelope_id)
thought_three_id=$(generate_envelope_id)
calc_req_three=$(generate_envelope_id)
conclusion_id=$(generate_envelope_id)
final_response_id=$(generate_envelope_id)

printf "\n%b\n" "${YELLOW}Driving reasoning message flow${NC}"

post_message "$(cat <<JSON
{"id":"${request_id}","kind":"chat","payload":{"text":"Calculate the total cost of 5 items at \$12 each, including 8% tax"}}
JSON
)"
wait_for_envelope "${request_id}"
wait_for_capability_grant "research-agent" "chat" "${request_id}"

sleep 1

post_message "$(cat <<JSON
{"id":"${reason_start_id}","kind":"reasoning/start","correlation_id":["${request_id}"],"payload":{"message":"Calculating total with tax for 5 items at \$12 each"}}
JSON
)"
wait_for_envelope "${reason_start_id}"
wait_for_capability_grant "research-agent" "reasoning/start" "${reason_start_id}"

sleep 1

post_message "$(cat <<JSON
{"id":"${thought_one_id}","kind":"reasoning/thought","context":"${reason_start_id}","payload":{"message":"First calculate base cost: 5 × 12"}}
JSON
)"
wait_for_envelope "${thought_one_id}"
wait_for_capability_grant "research-agent" "reasoning/thought" "${thought_one_id}"

sleep 1

post_message "$(cat <<JSON
{"id":"${calc_req_one}","kind":"mcp/request","to":["calculator-agent"],"context":"${reason_start_id}","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":5,"b":12}}}}
JSON
)"
wait_for_envelope "${calc_req_one}"
wait_for_delivery "${calc_req_one}" "calculator-agent"
wait_for_capability_grant "research-agent" "mcp/request" "${calc_req_one}"

sleep 2

post_message "$(cat <<JSON
{"id":"${thought_two_id}","kind":"reasoning/thought","context":"${reason_start_id}","payload":{"message":"Base cost is \$60, calculating 8% tax"}}
JSON
)"
wait_for_envelope "${thought_two_id}"
wait_for_capability_grant "research-agent" "reasoning/thought" "${thought_two_id}"

sleep 1

post_message "$(cat <<JSON
{"id":"${calc_req_two}","kind":"mcp/request","to":["calculator-agent"],"context":"${reason_start_id}","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":60,"b":0.08}}}}
JSON
)"
wait_for_envelope "${calc_req_two}"
wait_for_delivery "${calc_req_two}" "calculator-agent"
wait_for_capability_grant "research-agent" "mcp/request" "${calc_req_two}"

sleep 2

post_message "$(cat <<JSON
{"id":"${thought_three_id}","kind":"reasoning/thought","context":"${reason_start_id}","payload":{"message":"Tax is \$4.80, now compute total"}}
JSON
)"
wait_for_envelope "${thought_three_id}"
wait_for_capability_grant "research-agent" "reasoning/thought" "${thought_three_id}"

sleep 1

post_message "$(cat <<JSON
{"id":"${calc_req_three}","kind":"mcp/request","to":["calculator-agent"],"context":"${reason_start_id}","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":60,"b":4.8}}}}
JSON
)"
wait_for_envelope "${calc_req_three}"
wait_for_delivery "${calc_req_three}" "calculator-agent"
wait_for_capability_grant "research-agent" "mcp/request" "${calc_req_three}"

sleep 2

post_message "$(cat <<JSON
{"id":"${conclusion_id}","kind":"reasoning/conclusion","context":"${reason_start_id}","payload":{"message":"Total cost is \$64.80"}}
JSON
)"
wait_for_envelope "${conclusion_id}"
wait_for_capability_grant "research-agent" "reasoning/conclusion" "${conclusion_id}"

sleep 1

post_message "$(cat <<JSON
{"id":"${final_response_id}","kind":"chat","correlation_id":["${request_id}"],"payload":{"text":"The total cost is \$64.80 (5 × \$12 = \$60 plus 8% tax = \$4.80)"}}
JSON
)"
wait_for_envelope "${final_response_id}"
wait_for_capability_grant "research-agent" "chat" "${final_response_id}"

sleep 5

printf "\n%b\n" "${YELLOW}Verifying reasoning outputs${NC}"

if wait_for_pattern "${RESPONSE_CAPTURE}" "\"context\":\"${reason_start_id}\""; then
  record_pass "Context preserved across messages"
else
  record_fail "Context preserved across messages"
fi

if wait_for_pattern "${RESPONSE_CAPTURE}" "\"kind\":\"reasoning/start\""; then
  record_pass "Reasoning start recorded"
else
  record_fail "Reasoning start recorded"
fi

if wait_for_pattern "${RESPONSE_CAPTURE}" "\"kind\":\"reasoning/thought\""; then
  record_pass "Reasoning thoughts recorded"
else
  record_fail "Reasoning thoughts recorded"
fi

if wait_for_pattern "${RESPONSE_CAPTURE}" "\"kind\":\"reasoning/conclusion\""; then
  record_pass "Reasoning conclusion recorded"
else
  record_fail "Reasoning conclusion recorded"
fi

if wait_for_pattern "${RESPONSE_CAPTURE}" "Total cost is \$64.80"; then
  record_pass "Final explanation emitted"
else
  record_fail "Final explanation emitted"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 5 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
