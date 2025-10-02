#!/usr/bin/env bash
# Scenario 9 assertions - validate proposal fulfilment flow for TypeScript agent

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
SPACE_NAME=${SPACE_NAME:-scenario-9-typescript-proposals}

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

printf "%b\n" "${YELLOW}=== Scenario 9 Checks ===${NC}"
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

if wait_for_pattern "${OUTPUT_LOG}" '"id":"typescript-agent"' 120; then
  record_pass "TypeScript agent connected"
else
  record_fail "TypeScript agent connected"
fi

if wait_for_pattern "${OUTPUT_LOG}" '"id":"fulfiller-agent"' 120; then
  record_pass "Fulfiller agent connected"
else
  record_fail "Fulfiller agent connected"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Agent produces proposal for requested calculation${NC}"
chat_request_id=$(generate_envelope_id)
chat_payload=$(cat <<JSON
{"id":"${chat_request_id}","kind":"chat","to":["typescript-agent"],"payload":{"text":"Can you add 7 and 9 for me?","format":"plain"}}
JSON
)
if post_test_client "${chat_payload}"; then
  if wait_for_envelope "${chat_request_id}" && \
     wait_for_envelope_receipt "${chat_request_id}" "test-client" && \
     wait_for_capability_grant "test-client" "chat" "${chat_request_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '"kind":"mcp/proposal"' 40 && \
     wait_for_pattern "${OUTPUT_LOG}" '"name":"add"' 40; then
    record_pass "Proposal emitted for add tool"
  else
    record_fail "Proposal emitted for add tool"
  fi
else
  record_fail "Send chat request"
fi

PROPOSAL_ID=""
PROPOSAL_TARGETS="fulfiller-agent"
PROPOSAL_PATH="result.txt"
PROPOSAL_CONTENT="16"
FULFILL_TARGET="fulfiller-agent"

if proposal_data=$(OUTPUT_LOG="${OUTPUT_LOG}" python - <<'PY'
import json
import os

path = os.environ.get('OUTPUT_LOG')
if not path:
    raise SystemExit(1)

proposal = None
with open(path, 'r', encoding='utf-8') as handle:
    for raw in handle:
        raw = raw.strip()
        if not raw:
            continue
        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if message.get('kind') == 'mcp/proposal':
            proposal = message

if not proposal:
    raise SystemExit(1)

targets = proposal.get('to') or []
params = proposal.get('payload', {}).get('params', {})
arguments = params.get('arguments', {})

print(proposal.get('id', ''))
print(','.join(targets))
print(arguments.get('path', ''))
print(arguments.get('content', ''))
PY
); then
  IFS=$'\n' read -r PROPOSAL_ID PROPOSAL_TARGETS PROPOSAL_PATH PROPOSAL_CONTENT <<<"${proposal_data}"
  PROPOSAL_TARGETS=${PROPOSAL_TARGETS:-fulfiller-agent}
  PROPOSAL_PATH=${PROPOSAL_PATH:-result.txt}
  PROPOSAL_CONTENT=${PROPOSAL_CONTENT:-16}
  FULFILL_TARGET=${PROPOSAL_TARGETS%%,*}
  FULFILL_TARGET=${FULFILL_TARGET:-fulfiller-agent}
  record_pass "Captured proposal metadata"
else
  record_fail "Captured proposal metadata"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Fulfil proposal via fulfiller agent${NC}"
if [[ -n "${PROPOSAL_ID}" ]]; then
  fulfill_envelope_id=$(generate_envelope_id)
  fulfill_payload=$(PROPOSAL_ID="${PROPOSAL_ID}" PROPOSAL_TARGETS="${PROPOSAL_TARGETS}" FULFILL_ID="${fulfill_envelope_id}" python - <<'PY'
import json
import os

proposal_id = os.environ['PROPOSAL_ID']
targets = os.environ.get('PROPOSAL_TARGETS', '')
envelope_id = os.environ['FULFILL_ID']

message = {
    "id": envelope_id,
    "kind": "mcp/request",
    "correlation_id": [proposal_id],
    "payload": {
        "jsonrpc": "2.0",
        "id": 410,
        "method": "tools/call",
        "params": {
            "name": "add",
            "arguments": {"a": 7, "b": 9}
        }
    }
}

recipient_list = [entry for entry in targets.split(',') if entry]
if recipient_list:
    message["to"] = recipient_list

print(json.dumps(message))
PY
  )
  if post_test_client "${fulfill_payload}"; then
    if wait_for_envelope "${fulfill_envelope_id}" && \
       wait_for_envelope_receipt "${fulfill_envelope_id}" "test-client" && \
       wait_for_capability_grant "test-client" "mcp/request" "${fulfill_envelope_id}" && \
       wait_for_pattern "${OUTPUT_LOG}" '"result"' 40 && \
       wait_for_pattern "${OUTPUT_LOG}" '16' 40; then
      record_pass "Fulfilled proposal result observed"
    else
      record_fail "Fulfilled proposal result observed"
    fi
  else
    record_fail "POST fulfil request"
  fi
else
  record_fail "POST fulfil request"
fi

: > "${OUTPUT_LOG}"

printf "\n%b\n" "${YELLOW}Test: Agent responds to direct tools/list${NC}"
direct_list_id=$(generate_envelope_id)
if post_test_client "$(cat <<JSON
{"id":"${direct_list_id}","kind":"mcp/request","to":["typescript-agent"],"payload":{"jsonrpc":"2.0","id":920,"method":"tools/list","params":{}}}
JSON
)"; then
  if wait_for_envelope "${direct_list_id}" && \
     wait_for_envelope_receipt "${direct_list_id}" "test-client" && \
     wait_for_capability_grant "test-client" "mcp/request" "${direct_list_id}" && \
     wait_for_pattern "${OUTPUT_LOG}" '"tools"' 40; then
    record_pass "Direct tools/list handled"
  else
    record_fail "Direct tools/list handled"
  fi
else
  record_fail "POST direct tools/list"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 9 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
