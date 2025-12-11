#!/usr/bin/env bash
# Scenario 17 assertions - validate space/invite workflow

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

ADMIN_LOG=${ADMIN_LOG:-"${WORKSPACE_DIR}/logs/admin-output.log"}
OBSERVER_LOG=${OBSERVER_LOG:-"${WORKSPACE_DIR}/logs/observer-output.log"}
TEST_PORT=${TEST_PORT:-8080}
SPACE_NAME=${SPACE_NAME:-scenario-17-space-invite}

: "${GATEWAY_LOG_DIR:=${WORKSPACE_DIR}/.mew/logs}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 17 Checks ===${NC}"
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

wait_for_pattern() {
  local file="$1"
  local pattern="$2"
  local attempts=${3:-40}
  for ((i = 0; i < attempts; i += 1)); do
    if grep -Fq -- "$pattern" "$file" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Test 1: Gateway is healthy
if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  record_pass "Gateway health endpoint"
else
  record_fail "Gateway health endpoint"
fi

# Test 2: Send space/invite from admin to invite a new participant
printf "\n%b\n" "${YELLOW}Sending space/invite to create new-agent${NC}"

INVITE_ID="invite-$(date +%s)-${RANDOM}"
INVITE_RESPONSE=$(curl -sf -X POST "http://localhost:${TEST_PORT}/participants/admin/messages?space=${SPACE_NAME}" \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"${INVITE_ID}\",
    \"kind\": \"space/invite\",
    \"payload\": {
      \"participant_id\": \"new-agent\",
      \"initial_capabilities\": [
        {\"kind\": \"chat\"},
        {\"kind\": \"mcp/proposal\"},
        {\"kind\": \"mcp/response\"}
      ],
      \"reason\": \"Adding new agent for testing\"
    }
  }" 2>&1) || INVITE_RESPONSE=""

if [[ -n "${INVITE_RESPONSE}" ]]; then
  record_pass "space/invite request sent"
else
  record_fail "space/invite request sent"
fi

# Test 3: Verify response contains token
if echo "${INVITE_RESPONSE}" | grep -q '"token"'; then
  record_pass "Response contains token"
  NEW_TOKEN=$(echo "${INVITE_RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
else
  record_fail "Response contains token"
  NEW_TOKEN=""
fi

# Test 4: Verify response contains status: created
if echo "${INVITE_RESPONSE}" | grep -q '"status":"created"'; then
  record_pass "Response status is 'created'"
else
  record_fail "Response status is 'created'"
fi

# Test 5: Verify admin received space/invite-ack via WebSocket
sleep 2
if wait_for_pattern "${ADMIN_LOG}" '"kind":"space/invite-ack"' 10; then
  record_pass "Admin received space/invite-ack"
else
  record_fail "Admin received space/invite-ack"
fi

# Test 6: Verify admin's invite-ack contains token
if grep -q '"kind":"space/invite-ack"' "${ADMIN_LOG}" 2>/dev/null && \
   grep '"kind":"space/invite-ack"' "${ADMIN_LOG}" | grep -q '"token"'; then
  record_pass "Admin's invite-ack contains token"
else
  record_fail "Admin's invite-ack contains token"
fi

# Test 7: Verify observer received presence notification (not invite-ack)
if wait_for_pattern "${OBSERVER_LOG}" '"event":"invited"' 10; then
  record_pass "Observer received presence notification"
else
  record_fail "Observer received presence notification"
fi

# Test 8: Verify observer did NOT receive token
if grep -q '"token"' "${OBSERVER_LOG}" 2>/dev/null; then
  record_fail "Observer did NOT receive token (security check)"
else
  record_pass "Observer did NOT receive token (security check)"
fi

# Test 9: Verify observer did NOT receive space/invite-ack
if grep -q '"kind":"space/invite-ack"' "${OBSERVER_LOG}" 2>/dev/null; then
  record_fail "Observer did NOT receive invite-ack (security check)"
else
  record_pass "Observer did NOT receive invite-ack (security check)"
fi

# Test 10: Connect as the invited participant using the new token
printf "\n%b\n" "${YELLOW}Connecting as new-agent with invited credentials${NC}"

if [[ -n "${NEW_TOKEN}" ]]; then
  # Send a chat message as the new participant to verify connection works
  NEW_AGENT_RESPONSE=$(curl -sf -X POST "http://localhost:${TEST_PORT}/participants/new-agent/messages?space=${SPACE_NAME}" \
    -H "Authorization: Bearer ${NEW_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "kind": "chat",
      "payload": {
        "text": "Hello from newly invited agent!",
        "format": "plain"
      }
    }' 2>&1) || NEW_AGENT_RESPONSE=""

  if [[ -n "${NEW_AGENT_RESPONSE}" ]] && echo "${NEW_AGENT_RESPONSE}" | grep -q '"status":"accepted"'; then
    record_pass "New agent connected with invited token"
  else
    record_fail "New agent connected with invited token"
  fi
else
  record_fail "New agent connected with invited token (no token available)"
fi

# Test 11: Verify the new agent has the capabilities from the invite
# Try sending an mcp/proposal (should succeed based on initial_capabilities)
if [[ -n "${NEW_TOKEN}" ]]; then
  PROPOSAL_RESPONSE=$(curl -sf -X POST "http://localhost:${TEST_PORT}/participants/new-agent/messages?space=${SPACE_NAME}" \
    -H "Authorization: Bearer ${NEW_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "kind": "mcp/proposal",
      "to": ["admin"],
      "payload": {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
          "name": "test_tool",
          "arguments": {}
        }
      }
    }' 2>&1) || PROPOSAL_RESPONSE=""

  if [[ -n "${PROPOSAL_RESPONSE}" ]] && echo "${PROPOSAL_RESPONSE}" | grep -q '"status":"accepted"'; then
    record_pass "New agent has mcp/proposal capability from invite"
  else
    record_fail "New agent has mcp/proposal capability from invite"
  fi
else
  record_fail "New agent has mcp/proposal capability from invite (no token)"
fi

# Test 12: Verify inviting an existing participant returns already_exists
printf "\n%b\n" "${YELLOW}Testing duplicate invite${NC}"

# Don't use -f flag here because 409 is expected for duplicates
DUPE_RESPONSE=$(curl -s -X POST "http://localhost:${TEST_PORT}/participants/admin/messages?space=${SPACE_NAME}" \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "space/invite",
    "payload": {
      "participant_id": "new-agent",
      "initial_capabilities": [{"kind": "chat"}],
      "reason": "Duplicate invite test"
    }
  }' 2>&1) || DUPE_RESPONSE=""

if echo "${DUPE_RESPONSE}" | grep -q '"already_exists"'; then
  record_pass "Duplicate invite returns already_exists"
else
  record_fail "Duplicate invite returns already_exists"
fi

# Summary
printf "\n%b\n" "${YELLOW}=== Scenario 17 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
