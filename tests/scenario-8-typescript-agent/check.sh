#!/usr/bin/env bash
# Scenario 8 (TypeScript agent) assertions - validate MCP tools and chat behaviour

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
TEST_PORT=${TEST_PORT:-8080}

: "${GATEWAY_LOG_DIR:=${WORKSPACE_DIR}/.mew/logs}"

if [[ ! -f "${OUTPUT_LOG}" ]]; then
  echo "Expected output log ${OUTPUT_LOG} was not created" >&2
  exit 1
fi

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 8 (TypeScript Agent) Checks ===${NC}"
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
  local attempts=${3:-30}
  for ((i = 0; i < attempts; i += 1)); do
    if grep -Fq -- "$pattern" "$file"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

assert_log_contains() {
  local name="$1"
  local pattern="$2"
  local attempts=${3:-30}
  if wait_for_pattern "${OUTPUT_LOG}" "${pattern}" "${attempts}"; then
    record_pass "${name}"
  else
    record_fail "${name}"
  fi
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

if wait_for_pattern "${OUTPUT_LOG}" '"id":"typescript-agent"' 120; then
  record_pass "TypeScript agent connected"
else
  record_fail "TypeScript agent connected"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: List tools from TypeScript agent${NC}"
tools_list_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${tools_list_id}","kind":"mcp/request","to":["typescript-agent"],"payload":{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}}
JSON
)"; then
  if wait_for_envelope "${tools_list_id}" && \
     wait_for_envelope_receipt "${tools_list_id}" "test-client" && \
     wait_for_capability_grant "test-client" "mcp/request" "${tools_list_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '"tools"' 30 && \
     wait_for_pattern "${OUTPUT_LOG}" '"calculate"' 30; then
    record_pass "Tools list includes calculate"
  else
    record_fail "Tools list includes calculate"
  fi
else
  record_fail "POST tools/list"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Calculate add tool (5 + 3)${NC}"
calc_add_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${calc_add_id}","kind":"mcp/request","to":["typescript-agent"],"payload":{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"calculate","arguments":{"operation":"add","a":5,"b":3}}}}
JSON
)"; then
  if wait_for_envelope "${calc_add_id}" && \
     wait_for_envelope_receipt "${calc_add_id}" "test-client" && \
     wait_for_capability_grant "test-client" "mcp/request" "${calc_add_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '5 add 3 = 8' 30; then
    record_pass "Addition result returned"
  else
    record_fail "Addition result returned"
  fi
else
  record_fail "POST calculate add"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Calculate multiply tool (7 * 6)${NC}"
calc_multiply_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${calc_multiply_id}","kind":"mcp/request","to":["typescript-agent"],"payload":{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculate","arguments":{"operation":"multiply","a":7,"b":6}}}}
JSON
)"; then
  if wait_for_envelope "${calc_multiply_id}" && \
     wait_for_envelope_receipt "${calc_multiply_id}" "test-client" && \
     wait_for_capability_grant "test-client" "mcp/request" "${calc_multiply_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '7 multiply 6 = 42' 30; then
    record_pass "Multiplication result returned"
  else
    record_fail "Multiplication result returned"
  fi
else
  record_fail "POST calculate multiply"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Echo tool response${NC}"
echo_request_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${echo_request_id}","kind":"mcp/request","to":["typescript-agent"],"payload":{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello from TypeScript agent test!"}}}}
JSON
)"; then
  if wait_for_envelope "${echo_request_id}" && \
     wait_for_envelope_receipt "${echo_request_id}" "test-client" && \
     wait_for_capability_grant "test-client" "mcp/request" "${echo_request_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" 'Echo: Hello from TypeScript agent test!' 30; then
    record_pass "Echo tool returned message"
  else
    record_fail "Echo tool returned message"
  fi
else
  record_fail "POST echo tool"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Chat interaction${NC}"
chat_envelope_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${chat_envelope_id}","kind":"chat","to":["typescript-agent"],"payload":{"text":"Hello TypeScript agent, can you help me?","format":"plain"}}
JSON
)"; then
  if wait_for_envelope "${chat_envelope_id}" && \
     wait_for_envelope_receipt "${chat_envelope_id}" "test-client" && \
     wait_for_capability_grant "test-client" "chat" "${chat_envelope_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '"kind":"chat"' 30; then
    record_pass "Agent responded to chat"
  else
    record_fail "Agent responded to chat"
  fi
else
  record_fail "POST chat message"
fi

if grep -q '"kind":"reasoning/' "${OUTPUT_LOG}"; then
  record_pass "Reasoning messages observed"
else
  printf "%b\n" "${YELLOW}Reasoning messages not observed${NC}"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 8 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
