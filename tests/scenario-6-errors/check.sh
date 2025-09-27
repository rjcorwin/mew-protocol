#!/usr/bin/env bash
# Scenario 6 assertions - validate gateway error handling and resilience

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
  echo "Expected client log ${OUTPUT_LOG} not found" >&2
  exit 1
fi

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 6 Checks ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Gateway port: ${TEST_PORT}${NC}"

sleep 2

: > "${OUTPUT_LOG}"

TMP_DIR=$(mktemp -d "${WORKSPACE_DIR}/check-tmp.XXXXXX")
cleanup_tmp() {
  rm -rf "${TMP_DIR}"
}
trap cleanup_tmp EXIT

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

gateway_alive() {
  curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1
}

send_http_message() {
  local payload="$1"
  local participant="${2:-test-client}"
  local token="${3:-test-token}"
  local outfile="${TMP_DIR}/last-response.json"
  curl -s -o "${outfile}" -w '%{http_code}' \
    -X POST "http://localhost:${TEST_PORT}/participants/${participant}/messages" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    --data "${payload}"
}

run_check "Gateway health endpoint" gateway_alive
run_check "Output log exists" test -f "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test 1: Invalid JSON payload${NC}"
status_invalid=$(curl -s -o "${TMP_DIR}/invalid-response" -w '%{http_code}' \
  -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  --data 'This is not valid JSON' || true)
if [[ "${status_invalid}" == 4* ]]; then
  record_pass "Invalid JSON rejected with ${status_invalid}"
else
  record_fail "Invalid JSON rejected with ${status_invalid}"
fi

if gateway_alive; then
  record_pass "Gateway alive after invalid JSON"
else
  record_fail "Gateway alive after invalid JSON"
fi

printf "\n%b\n" "${YELLOW}Test 2: Missing kind field${NC}"
status_missing=$(send_http_message '{"payload":{"text":"Missing kind field"}}')
if [[ "${status_missing}" == 4* ]]; then
  record_pass "Missing kind rejected with ${status_missing}"
else
  record_fail "Missing kind rejected with ${status_missing}"
fi

if gateway_alive; then
  record_pass "Gateway alive after missing kind"
else
  record_fail "Gateway alive after missing kind"
fi

printf "\n%b\n" "${YELLOW}Test 3: Non-existent participant${NC}"
status_nonexistent=$(send_http_message '{"kind":"chat","payload":{"text":"hello"}}' 'ghost' 'test-token')
if [[ "${status_nonexistent}" == 4* || "${status_nonexistent}" == 5* ]]; then
  record_pass "Ghost participant rejected with ${status_nonexistent}"
else
  record_fail "Ghost participant rejected with ${status_nonexistent}"
fi

if gateway_alive; then
  record_pass "Gateway alive after ghost participant"
else
  record_fail "Gateway alive after ghost participant"
fi

printf "\n%b\n" "${YELLOW}Test 4: Large message acceptance${NC}"
large_payload=$(python - <<'PY'
import json
print(json.dumps({"kind": "chat", "payload": {"text": "A" * 10000}}))
PY
)
status_large=$(send_http_message "${large_payload}")
if [[ "${status_large}" == 2* ]]; then
  record_pass "Large message accepted with ${status_large}"
else
  record_fail "Large message accepted with ${status_large}"
fi

if gateway_alive; then
  record_pass "Gateway alive after large message"
else
  record_fail "Gateway alive after large message"
fi

printf "\n%b\n" "${YELLOW}Test 5: Rapid message burst${NC}"
rapid_success=0
for i in {1..20}; do
  status=$(send_http_message "{\"kind\":\"chat\",\"payload\":{\"text\":\"Message ${i}\"}}")
  if [[ "${status}" == 2* ]]; then
    rapid_success=$((rapid_success + 1))
  fi
  sleep 0.1
done
if [[ ${rapid_success} -eq 20 ]]; then
  record_pass "All rapid messages accepted"
else
  record_fail "All rapid messages accepted"
fi

if gateway_alive; then
  record_pass "Gateway alive after rapid burst"
else
  record_fail "Gateway alive after rapid burst"
fi

printf "\n%b\n" "${YELLOW}Test 6: Empty message body${NC}"
status_empty=$(send_http_message '{}')
if [[ "${status_empty}" == 4* ]]; then
  record_pass "Empty message rejected with ${status_empty}"
else
  record_fail "Empty message rejected with ${status_empty}"
fi

if gateway_alive; then
  record_pass "Gateway alive after empty message"
else
  record_fail "Gateway alive after empty message"
fi

printf "\n%b\n" "${YELLOW}Test 7: Malformed JSON${NC}"
status_malformed=$(curl -s -o "${TMP_DIR}/malformed-response" -w '%{http_code}' \
  -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  --data '{"kind":"chat"' || true)
if [[ "${status_malformed}" == 4* ]]; then
  record_pass "Malformed JSON rejected with ${status_malformed}"
else
  record_fail "Malformed JSON rejected with ${status_malformed}"
fi

if gateway_alive; then
  record_pass "Gateway alive after malformed JSON"
else
  record_fail "Gateway alive after malformed JSON"
fi

printf "\n%b\n" "${YELLOW}Test 8: Special characters${NC}"
special_payload=$(python - <<'PY'
import json
print(json.dumps({"kind": "chat", "payload": {"text": "Symbols: © ™ 漢字 😊"}}))
PY
)
status_special=$(send_http_message "${special_payload}")
if [[ "${status_special}" == 2* ]]; then
  record_pass "Special characters accepted with ${status_special}"
else
  record_fail "Special characters accepted with ${status_special}"
fi

if gateway_alive; then
  record_pass "Gateway alive after special characters"
else
  record_fail "Gateway alive after special characters"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 6 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
