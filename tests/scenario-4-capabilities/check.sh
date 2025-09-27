#!/usr/bin/env bash
# Scenario 4 assertions - observe capability flows and MCP access

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

COORD_LOG=${COORD_LOG:-"${WORKSPACE_DIR}/logs/coordinator-output.log"}
LIMITED_LOG=${LIMITED_LOG:-"${WORKSPACE_DIR}/logs/limited-agent-output.log"}
TEST_PORT=${TEST_PORT:-8080}

if [[ ! -f "${COORD_LOG}" ]]; then
  echo "Expected coordinator log ${COORD_LOG} was not created" >&2
  exit 1
fi

if [[ ! -f "${LIMITED_LOG}" ]]; then
  echo "Expected limited agent log ${LIMITED_LOG} was not created" >&2
  exit 1
fi

: > "${COORD_LOG}"
: > "${LIMITED_LOG}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 4 Checks ===${NC}"
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

wait_for_pattern() {
  local file="$1"
  local pattern="$2"
  local attempts=${3:-30}
  for ((i = 0; i < attempts; i += 1)); do
    if grep -E "${pattern}" "${file}" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

post_limited() {
  local payload="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/limited-agent/messages" \
    -H "Authorization: Bearer limited-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" > /dev/null
}

post_coordinator() {
  local payload="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/coordinator/messages" \
    -H "Authorization: Bearer admin-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" > /dev/null
}

run_check "Gateway health endpoint" curl -sf "http://localhost:${TEST_PORT}/health"
run_check "Coordinator log exists" test -f "${COORD_LOG}"
run_check "Limited agent log exists" test -f "${LIMITED_LOG}"

printf "\n%b\n" "${YELLOW}Test: Gateway rejects participant system/register${NC}"
SYSREG_ID="sysreg-$(date +%s)"
SYSREG_RESPONSE=$(mktemp)
HTTP_STATUS=$(curl -s -o "${SYSREG_RESPONSE}" -w '%{http_code}' \
  -X POST "http://localhost:${TEST_PORT}/participants/limited-agent/messages" \
  -H "Authorization: Bearer limited-token" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"${SYSREG_ID}\",\"kind\":\"system/register\",\"payload\":{\"capabilities\":[]}}" || true)

if [[ "${HTTP_STATUS}" == "400" ]] && grep -Fq 'system/register is reserved for the gateway' "${SYSREG_RESPONSE}"; then
  record_pass "HTTP rejection of system/register"
else
  record_fail "HTTP rejection of system/register"
fi

rm -f "${SYSREG_RESPONSE}"

if wait_for_pattern "${LIMITED_LOG}" '"kind":"system/error"' 20; then
  record_pass "system/register triggers system/error"
else
  record_fail "system/register triggers system/error"
fi

if wait_for_pattern "${LIMITED_LOG}" 'system/register is reserved for the gateway' 20; then
  record_pass "system/register rejection message"
else
  record_fail "system/register rejection message"
fi

printf "\n%b\n" "${YELLOW}Test: Limited agent can list calculator tools${NC}"
if post_limited "$(cat <<JSON
{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/list","params":{}}}
JSON
)"; then
  if wait_for_pattern "${LIMITED_LOG}" '"kind":"mcp/response"' && \
     wait_for_pattern "${LIMITED_LOG}" '"tools"'; then
    record_pass "tools/list response captured"
  else
    record_fail "tools/list response captured"
  fi
else
  record_fail "POST tools/list"
fi

printf "\n%b\n" "${YELLOW}Test: Limited agent can call add tool${NC}"
if post_limited "$(cat <<JSON
{"kind":"mcp/request","to":["calculator-agent"],"payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":5,"b":3}}}}
JSON
)"; then
  if wait_for_pattern "${LIMITED_LOG}" '"kind":"mcp/response"' && \
     wait_for_pattern "${LIMITED_LOG}" '"result":8|"text":"8"'; then
    record_pass "tools/call add succeeded"
  else
    record_fail "tools/call add succeeded"
  fi
else
  record_fail "POST tools/call add"
fi

printf "\n%b\n" "${YELLOW}Test: Capability grant enforcement${NC}"
printf "Grant enforcement: %b\n" "${YELLOW}SKIPPED (capability granting not implemented)${NC}"

printf "\n%b\n" "${YELLOW}Test: Coordinator revokes capability${NC}"
if post_coordinator "$(cat <<JSON
{"kind":"capability/revoke","payload":{"recipient":"limited-agent","capabilities":[{"kind":"mcp/request","payload":{"method":"tools/*"}}]}}
JSON
)"; then
  if wait_for_pattern "${LIMITED_LOG}" '"kind":"capability/revoke"'; then
    record_pass "revoke notification delivered"
  else
    record_fail "revoke notification delivered"
  fi
else
  record_fail "POST capability revoke"
fi

printf "\n%b\n" "${YELLOW}Test: Capability revocation enforcement${NC}"
printf "Revocation enforcement: %b\n" "${YELLOW}SKIPPED (capability enforcement not implemented)${NC}"

printf "\n%b\n" "${YELLOW}=== Scenario 4 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
