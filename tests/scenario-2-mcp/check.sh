#!/usr/bin/env bash
# Scenario 2 assertions - validate MCP tool execution workflow

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
TEST_PORT=${TEST_PORT:-8080}

if [[ ! -f "${OUTPUT_LOG}" ]]; then
  echo "Expected output log ${OUTPUT_LOG} was not created" >&2
  exit 1
fi

: > "${OUTPUT_LOG}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 2 Checks ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Gateway port: ${TEST_PORT}${NC}"

sleep 2

tests_passed=0
tests_failed=0

record_pass() {
  local name="$1"
  printf "%s: %b\n" "${name}" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
}

record_fail() {
  local name="$1"
  printf "%s: %b\n" "${name}" "${RED}✗${NC}"
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

correlation_found() {
  local id="$1"
  if grep -E '"correlation_id":\[[^]]*"'"${id}"'"' "${OUTPUT_LOG}" > /dev/null 2>&1; then
    return 0
  fi
  if grep -F '"correlation_id":"'"${id}"'"' "${OUTPUT_LOG}" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

wait_for_correlation() {
  local id="$1"
  local attempts=${2:-20}
  for ((i = 0; i < attempts; i += 1)); do
    if correlation_found "${id}"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

response_matches() {
  local id="$1"
  local pattern="$2"
  if grep -F '"kind":"mcp/response"' "${OUTPUT_LOG}" | \
    grep -E '"correlation_id":\[[^]]*"'"${id}"'"|"correlation_id":"'"${id}"'"' | \
    grep -E "${pattern}" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

post_message() {
  local payload="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" > /dev/null
}

run_check "Gateway health endpoint" curl -sf "http://localhost:${TEST_PORT}/health"
run_check "Client output log exists" test -f "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: List available tools${NC}"
tools_list_id="tools-list-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${tools_list_id}","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}
JSON
)"; then
  if wait_for_correlation "${tools_list_id}"; then
    if response_matches "${tools_list_id}" '"name":"add"' && \
      response_matches "${tools_list_id}" '"name":"multiply"' && \
      response_matches "${tools_list_id}" '"name":"evaluate"'; then
      record_pass "Tools list contains calculator tools"
    else
      record_fail "Tools list contains calculator tools"
    fi
  else
    record_fail "Tools list response received"
  fi
else
  record_fail "POST tools/list request"
fi

printf "\n%b\n" "${YELLOW}Test: Call add tool (5 + 3)${NC}"
add_id="tools-call-add-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${add_id}","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}
JSON
)"; then
  if wait_for_correlation "${add_id}"; then
    if response_matches "${add_id}" '"result":8'; then
      record_pass "Add tool returns 8"
    else
      record_fail "Add tool returns 8"
    fi
  else
    record_fail "Add tool response received"
  fi
else
  record_fail "POST tools/call add"
fi

printf "\n%b\n" "${YELLOW}Test: Call multiply tool (7 × 9)${NC}"
multiply_id="tools-call-multiply-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${multiply_id}","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":7,"b":9}}}}
JSON
)"; then
  if wait_for_correlation "${multiply_id}"; then
    if response_matches "${multiply_id}" '"result":63'; then
      record_pass "Multiply tool returns 63"
    else
      record_fail "Multiply tool returns 63"
    fi
  else
    record_fail "Multiply tool response received"
  fi
else
  record_fail "POST tools/call multiply"
fi

printf "\n%b\n" "${YELLOW}Test: Call evaluate tool (20 ÷ 4)${NC}"
evaluate_id="tools-call-evaluate-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${evaluate_id}","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"20 / 4"}}}}
JSON
)"; then
  if wait_for_correlation "${evaluate_id}"; then
    if response_matches "${evaluate_id}" '"result":5'; then
      record_pass "Evaluate tool returns 5"
    else
      record_fail "Evaluate tool returns 5"
    fi
  else
    record_fail "Evaluate tool response received"
  fi
else
  record_fail "POST tools/call evaluate"
fi

printf "\n%b\n" "${YELLOW}Test: Handle division by zero${NC}"
div_zero_id="tools-call-divzero-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${div_zero_id}","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"evaluate","arguments":{"expression":"10 / 0"}}}}
JSON
)"; then
  if wait_for_correlation "${div_zero_id}"; then
    if response_matches "${div_zero_id}" '"result":"Infinity"|"result":null|division by zero|"code":"EVALUATION_ERROR"'; then
      record_pass "Division by zero handled"
    else
      record_fail "Division by zero handled"
    fi
  else
    record_fail "Division by zero response received"
  fi
else
  record_fail "POST tools/call division by zero"
fi

printf "\n%b\n" "${YELLOW}Test: Invalid tool name${NC}"
invalid_id="tools-call-invalid-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${invalid_id}","kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"invalid","arguments":{}}}}
JSON
)"; then
  if wait_for_correlation "${invalid_id}"; then
    if response_matches "${invalid_id}" 'Tool not found|"error":'; then
      record_pass "Invalid tool returns error"
    else
      record_fail "Invalid tool returns error"
    fi
  else
    record_fail "Invalid tool response received"
  fi
else
  record_fail "POST tools/call invalid"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 2 Summary ===${NC}"
printf "Tests passed: %s\n" "${tests_passed}"
printf "Tests failed: %s\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  printf "%b\n" "${GREEN}✓ All Scenario 2 checks passed${NC}"
  exit 0
else
  printf "%b\n" "${RED}✗ Scenario 2 checks failed${NC}"
  exit 1
fi
