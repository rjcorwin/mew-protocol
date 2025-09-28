#!/usr/bin/env bash
# Scenario 3 assertions - validate proposal flow and fulfilment

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

ensure_proposal_delivery() {
  local envelope_id="$1"

  wait_for_envelope "${envelope_id}" && \
    wait_for_delivery "${envelope_id}" "fulfiller" && \
    wait_for_capability_grant "proposer" "mcp/proposal"
}

PROPOSER_LOG=${PROPOSER_LOG:-"${WORKSPACE_DIR}/logs/proposer-output.log"}
FULFILLER_LOG=${FULFILLER_LOG:-"${WORKSPACE_DIR}/logs/fulfiller.log"}
TEST_PORT=${TEST_PORT:-8080}

if [[ ! -f "${PROPOSER_LOG}" ]]; then
  echo "Expected proposer log ${PROPOSER_LOG} was not created" >&2
  exit 1
fi

if [[ ! -f "${FULFILLER_LOG}" ]]; then
  fallback_log="${WORKSPACE_DIR}/logs/fulfiller.log"
  if [[ -f "${fallback_log}" ]]; then
    FULFILLER_LOG="${fallback_log}"
  else
    echo "Expected fulfiller log ${FULFILLER_LOG} was not created" >&2
    exit 1
  fi
fi

if [[ ! -s "${FULFILLER_LOG}" ]]; then
  fallback_log="${WORKSPACE_DIR}/logs/fulfiller.log"
  if [[ "${FULFILLER_LOG}" != "${fallback_log}" && -f "${fallback_log}" ]]; then
    FULFILLER_LOG="${fallback_log}"
  fi
fi

: > "${PROPOSER_LOG}"
: > "${FULFILLER_LOG}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 3 Checks ===${NC}"
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

post_message() {
  local payload="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/proposer/messages" \
    -H "Authorization: Bearer proposer-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" > /dev/null
}

run_check "Gateway health endpoint" curl -sf "http://localhost:${TEST_PORT}/health"
run_check "Proposer log exists" test -f "${PROPOSER_LOG}"
run_check "Fulfiller log exists" test -f "${FULFILLER_LOG}"

printf "\n%b\n" "${YELLOW}Test: Fulfil simple proposal (10 + 5)${NC}"
proposal_simple_id="proposal-simple-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${proposal_simple_id}","kind":"mcp/proposal","payload":{"method":"tools/call","params":{"name":"add","arguments":{"a":10,"b":5}}}}
JSON
)"; then
  if ensure_proposal_delivery "${proposal_simple_id}" && \
     wait_for_pattern "${FULFILLER_LOG}" "Fulfilling proposal ${proposal_simple_id}"; then
    if wait_for_pattern "${PROPOSER_LOG}" '"kind":"chat"' && \
       wait_for_pattern "${PROPOSER_LOG}" '"text":"15"'; then
      record_pass "Proposal 1 fulfilled with result 15"
    else
      record_fail "Proposal 1 fulfilled with result 15"
    fi
  else
    record_fail "Fulfiller saw proposal ${proposal_simple_id}"
  fi
else
  record_fail "POST proposal 1"
fi

printf "\n%b\n" "${YELLOW}Test: Fulfil multiply proposal (7 × 8)${NC}"
proposal_multiply_id="proposal-multiply-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${proposal_multiply_id}","kind":"mcp/proposal","payload":{"method":"tools/call","params":{"name":"multiply","arguments":{"a":7,"b":8}}}}
JSON
)"; then
  if ensure_proposal_delivery "${proposal_multiply_id}" && \
     wait_for_pattern "${FULFILLER_LOG}" "Fulfilling proposal ${proposal_multiply_id}"; then
    if wait_for_pattern "${PROPOSER_LOG}" '"kind":"chat"' && \
       wait_for_pattern "${PROPOSER_LOG}" '"text":"56"'; then
      record_pass "Proposal 2 fulfilled with result 56"
    else
      record_fail "Proposal 2 fulfilled with result 56"
    fi
  else
    record_fail "Fulfiller saw proposal ${proposal_multiply_id}"
  fi
else
  record_fail "POST proposal 2"
fi

printf "\n%b\n" "${YELLOW}Test: Handle invalid tool proposal${NC}"
proposal_invalid_id="proposal-invalid-$RANDOM-$RANDOM"
if post_message "$(cat <<JSON
{"id":"${proposal_invalid_id}","kind":"mcp/proposal","payload":{"method":"tools/call","params":{"name":"not-a-tool","arguments":{}}}}
JSON
)"; then
if ensure_proposal_delivery "${proposal_invalid_id}" && \
   wait_for_pattern "${FULFILLER_LOG}" "Calculator returned error for proposal ${proposal_invalid_id}"; then
    if wait_for_pattern "${PROPOSER_LOG}" 'Error fulfilling proposal'; then
      record_pass "Invalid proposal error surfaced"
    else
      record_fail "Invalid proposal error surfaced"
    fi
  else
    record_fail "Fulfiller logged failure for ${proposal_invalid_id}"
  fi
else
  record_fail "POST invalid proposal"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 3 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
