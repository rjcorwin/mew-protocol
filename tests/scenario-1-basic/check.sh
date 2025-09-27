#!/usr/bin/env bash
# Scenario 1 assertions - validate basic message flow

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

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 1 Checks ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Gateway port: ${TEST_PORT}${NC}"

# Give the auto-connected test client a moment to subscribe before sending traffic
sleep 2

tests_passed=0
tests_failed=0

run_check() {
  local name="$1"
  shift
  local command=("$@")

  if "${command[@]}" > /dev/null 2>&1; then
    printf "%s %b\n" "${name}:" "${GREEN}✓${NC}"
    tests_passed=$((tests_passed + 1))
  else
    printf "%s %b\n" "${name}:" "${RED}✗${NC}"
    tests_failed=$((tests_failed + 1))
  fi
}

run_check "Gateway health endpoint" curl -sf "http://localhost:${TEST_PORT}/health"
run_check "Client output log exists" test -f "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Simple chat message${NC}"
curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind":"chat","payload":{"text":"Hello, echo!"}}' > /dev/null
sleep 2
if grep -q '"text":"Echo: Hello, echo!"' "${OUTPUT_LOG}"; then
  printf "Echo response: %b\n" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
else
  printf "Echo response: %b\n" "${RED}✗${NC}"
  tests_failed=$((tests_failed + 1))
fi

printf "\n%b\n" "${YELLOW}Test: Message with correlation ID${NC}"
curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"id":"msg-123","kind":"chat","payload":{"text":"Test with ID"}}' > /dev/null
sleep 2
if grep -q 'correlation_id.*msg-123' "${OUTPUT_LOG}"; then
  printf "Correlation ID preserved: %b\n" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
else
  printf "Correlation ID preserved: %b\n" "${RED}✗${NC}"
  tests_failed=$((tests_failed + 1))
fi

printf "\n%b\n" "${YELLOW}Test: Multiple messages${NC}"
for text in "Message 1" "Message 2" "Message 3"; do
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "{\"kind\":\"chat\",\"payload\":{\"text\":\"${text}\"}}" > /dev/null
  sleep 0.5
done
sleep 2
msg_count=$(grep -c '"text":"Echo: Message' "${OUTPUT_LOG}" || true)
if [[ "${msg_count}" -eq 3 ]]; then
  printf "All 3 messages received: %b\n" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
else
  printf "Multiple messages: %b (only %s/3 received)\n" "${RED}✗${NC}" "${msg_count}"
  tests_failed=$((tests_failed + 1))
fi

printf "\n%b\n" "${YELLOW}Test: Large message handling${NC}"
large_text=$(printf 'A%.0s' {1..1000})
curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d "{\"kind\":\"chat\",\"payload\":{\"text\":\"${large_text}\"}}" > /dev/null
sleep 2
if grep -q "Echo: ${large_text}" "${OUTPUT_LOG}"; then
  printf "Large message handled: %b\n" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
else
  printf "Large message handled: %b\n" "${RED}✗${NC}"
  tests_failed=$((tests_failed + 1))
fi

printf "\n%b\n" "${YELLOW}Test: Rapid message handling${NC}"
for i in {1..5}; do
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "{\"kind\":\"chat\",\"payload\":{\"text\":\"Rapid ${i}\"}}" > /dev/null
  sleep 0.1
done
sleep 2
rapid_count=$(grep -c '"text":"Echo: Rapid' "${OUTPUT_LOG}" || true)
if [[ "${rapid_count}" -eq 5 ]]; then
  printf "All 5 rapid messages processed: %b\n" "${GREEN}✓${NC}"
  tests_passed=$((tests_passed + 1))
else
  printf "Rapid messages: %b (only %s/5 received)\n" "${RED}✗${NC}" "${rapid_count}"
  tests_failed=$((tests_failed + 1))
fi

printf "\n%b\n" "${YELLOW}=== Scenario 1 Summary ===${NC}"
printf "Tests passed: %s\n" "${tests_passed}"
printf "Tests failed: %s\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  printf "%b\n" "${GREEN}✓ All Scenario 1 checks passed${NC}"
  exit 0
else
  printf "%b\n" "${RED}✗ Scenario 1 checks failed${NC}"
  exit 1
fi
