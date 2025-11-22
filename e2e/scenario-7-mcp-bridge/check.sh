#!/usr/bin/env bash
# Scenario 7 assertions - validate MCP bridge filesystem interactions

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

OUTPUT_LOG=${OUTPUT_LOG:-"${WORKSPACE_DIR}/logs/test-client-output.log"}
RESPONSE_CAPTURE=${RESPONSE_CAPTURE:-"${WORKSPACE_DIR}/logs/mcp-bridge-capture.log"}
TEST_FILES_DIR=${TEST_FILES_DIR:-"${WORKSPACE_DIR}/test-files"}
TEST_PORT=${TEST_PORT:-8080}

export TEST_FILES_DIR

if [[ ! -f "${OUTPUT_LOG}" ]]; then
  echo "Expected test client log ${OUTPUT_LOG} not found" >&2
  exit 1
fi

: > "${OUTPUT_LOG}"
: > "${RESPONSE_CAPTURE}"

TMP_DIR=$(mktemp -d "${WORKSPACE_DIR}/check-tmp.XXXXXX")

tail -n 0 -F "${OUTPUT_LOG}" > "${RESPONSE_CAPTURE}" &
tail_pid=$!
cleanup() {
  kill "${tail_pid}" 2>/dev/null || true
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 7 Checks ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Gateway port: ${TEST_PORT}${NC}"
printf "%b\n" "${BLUE}Test files directory: ${TEST_FILES_DIR}${NC}"

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
  local attempts=${3:-40}
  for ((i = 0; i < attempts; i += 1)); do
    if grep -Fq -- "${pattern}" "${file}"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

send_request() {
  local payload="$1"
  local status
  status=$(curl -s -o "${TMP_DIR}/last-response.json" -w '%{http_code}' \
    -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" || true)
  [[ "${status}" == 2* ]]
}

run_check "Gateway health endpoint" curl -sf "http://localhost:${TEST_PORT}/health"
run_check "Output log exists" test -f "${OUTPUT_LOG}"
run_check "Test files directory populated" test -f "${TEST_FILES_DIR}/test.txt"

printf "\n%b\n" "${YELLOW}Test: List MCP tools${NC}"
list_envelope_id=$(generate_envelope_id)
: > "${RESPONSE_CAPTURE}"
if send_request "$(cat <<JSON
{"id":"${list_envelope_id}","kind":"mcp/request","to":["filesystem"],"payload":{"method":"tools/list","params":{}}}
JSON
)"; then
  if wait_for_envelope "${list_envelope_id}" && \
     wait_for_delivery "${list_envelope_id}" "filesystem" && \
     wait_for_capability_grant "test-client" "mcp/request" "${list_envelope_id}" && \
     wait_for_pattern "${RESPONSE_CAPTURE}" '"read_file"'; then
    record_pass "List tools returns filesystem methods"
  else
    record_fail "List tools returns filesystem methods"
    cat "${RESPONSE_CAPTURE}" >&2
  fi
else
  record_fail "List tools request accepted"
fi

printf "\n%b\n" "${YELLOW}Test: Read file via MCP${NC}"
read_envelope_id=$(generate_envelope_id)
: > "${RESPONSE_CAPTURE}"
read_request=$(python3 - "$read_envelope_id" <<'PY'
import json
import os
import sys
print(json.dumps({
  "id": sys.argv[1],
  "kind": "mcp/request",
  "to": ["filesystem"],
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {"path": os.environ["TEST_FILES_DIR"] + "/test.txt"}
    }
  }
}))
PY
)
if send_request "${read_request}"; then
  if wait_for_envelope "${read_envelope_id}" && \
     wait_for_delivery "${read_envelope_id}" "filesystem" && \
     wait_for_capability_grant "test-client" "mcp/request" "${read_envelope_id}" && \
     wait_for_pattern "${RESPONSE_CAPTURE}" "Test content"; then
    record_pass "Read file returns contents"
  else
    record_fail "Read file returns contents"
    cat "${RESPONSE_CAPTURE}" >&2
  fi
else
  record_fail "Read file request accepted"
fi

printf "\n%b\n" "${YELLOW}Test: List directory entries${NC}"
list_dir_envelope_id=$(generate_envelope_id)
: > "${RESPONSE_CAPTURE}"
list_request=$(python3 - "$list_dir_envelope_id" <<'PY'
import json
import os
import sys
print(json.dumps({
  "id": sys.argv[1],
  "kind": "mcp/request",
  "to": ["filesystem"],
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "list_directory",
      "arguments": {"path": os.environ["TEST_FILES_DIR"]}
    }
  }
}))
PY
)
if send_request "${list_request}"; then
  if wait_for_envelope "${list_dir_envelope_id}" && \
     wait_for_delivery "${list_dir_envelope_id}" "filesystem" && \
     wait_for_capability_grant "test-client" "mcp/request" "${list_dir_envelope_id}" && \
     wait_for_pattern "${RESPONSE_CAPTURE}" "hello.txt"; then
    record_pass "Directory listing includes expected files"
  else
    record_fail "Directory listing includes expected files"
    cat "${RESPONSE_CAPTURE}" >&2
  fi
else
  record_fail "List directory request accepted"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 7 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
