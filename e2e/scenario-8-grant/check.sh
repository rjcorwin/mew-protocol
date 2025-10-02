#!/usr/bin/env bash
# Scenario 8 assertions - validate capability grant workflow

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
AGENT_LOG=${AGENT_LOG:-"${WORKSPACE_DIR}/logs/test-agent.log"}
FILE_SERVER_LOG=${FILE_SERVER_LOG:-"${WORKSPACE_DIR}/logs/file-server.log"}
DATA_DIR=${DATA_DIR:-"${WORKSPACE_DIR}/workspace-files"}
TEST_PORT=${TEST_PORT:-8080}
SPACE_NAME=${SPACE_NAME:-scenario-8-grant}

: "${GATEWAY_LOG_DIR:=${WORKSPACE_DIR}/.mew/logs}"

if [[ ! -f "${OUTPUT_LOG}" ]]; then
  echo "Expected output log ${OUTPUT_LOG} was not created" >&2
  exit 1
fi

if [[ ! -f "${AGENT_LOG}" ]]; then
  echo "Expected agent log ${AGENT_LOG} was not created" >&2
  exit 1
fi

if [[ ! -f "${FILE_SERVER_LOG}" ]]; then
  echo "Expected file server log ${FILE_SERVER_LOG} was not created" >&2
  exit 1
fi

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 8 Checks ===${NC}"
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

wait_for_file() {
  local target="$1"
  local attempts=${2:-40}
  for ((i = 0; i < attempts; i += 1)); do
    if [[ -f "$target" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

post_test_client() {
  local payload="$1"
  curl -sf -X POST "http://localhost:${TEST_PORT}/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "${payload}" > /dev/null
}

if curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
  record_pass "Gateway health endpoint"
else
  record_fail "Gateway health endpoint"
fi

printf "\n%b\n" "${YELLOW}Waiting for agent proposal${NC}"
if wait_for_pattern "${OUTPUT_LOG}" '"kind":"mcp/proposal"' 40; then
  record_pass "Proposal delivered to test-client"
else
  record_fail "Proposal delivered to test-client"
fi

PROPOSAL_ID=""
PROPOSAL_TARGETS="file-server"
PROPOSAL_PATH="foo.txt"
PROPOSAL_CONTENT="foo"
grant_envelope_id=""
fulfill_envelope_id=""
grant_ack_id=""
direct_request_id=""

if proposal_data=$(OUTPUT_LOG="${OUTPUT_LOG}" python - <<'PY'
import json
import os
import sys

path = os.environ.get('OUTPUT_LOG')
if not path:
    sys.exit(1)

proposal = None
try:
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
except FileNotFoundError:
    sys.exit(1)

if not proposal:
    sys.exit(1)

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
  PROPOSAL_TARGETS=${PROPOSAL_TARGETS:-file-server}
  PROPOSAL_PATH=${PROPOSAL_PATH:-foo.txt}
  PROPOSAL_CONTENT=${PROPOSAL_CONTENT:-foo}
  record_pass "Extract proposal details"
else
  record_fail "Extract proposal details"
fi

if [[ -n "${PROPOSAL_ID}" ]]; then
  grant_envelope_id=$(generate_envelope_id)
  fulfill_envelope_id=$(generate_envelope_id)

  grant_payload=$(GRANT_ID="${grant_envelope_id}" python - <<'PY'
import json
import os

grant_id = os.environ['GRANT_ID']

print(json.dumps({
    "id": grant_id,
    "kind": "capability/grant",
    "to": ["test-agent"],
    "payload": {
        "recipient": "test-agent",
        "capabilities": [{
            "kind": "mcp/request",
            "to": ["file-server"],
            "payload": {
                "method": "tools/call",
                "params": {
                    "name": "write_file"
                }
            }
        }],
        "reason": "Scenario 8 capability grant"
    }
}))
PY
  )

  fulfill_payload=$(PROPOSAL_ID="${PROPOSAL_ID}" PROPOSAL_TARGETS="${PROPOSAL_TARGETS}" PROPOSAL_PATH="${PROPOSAL_PATH}" PROPOSAL_CONTENT="${PROPOSAL_CONTENT}" FULFILL_ID="${fulfill_envelope_id}" python - <<'PY'
import json
import os

proposal_id = os.environ['PROPOSAL_ID']
targets = os.environ.get('PROPOSAL_TARGETS', '')
path_value = os.environ.get('PROPOSAL_PATH', 'foo.txt')
content_value = os.environ.get('PROPOSAL_CONTENT', 'foo')
fulfill_id = os.environ['FULFILL_ID']

message = {
    "id": fulfill_id,
    "kind": "mcp/request",
    "correlation_id": [proposal_id],
    "payload": {
        "jsonrpc": "2.0",
        "id": 200,
        "method": "tools/call",
        "params": {
            "name": "write_file",
            "arguments": {
                "path": path_value,
                "content": content_value
            }
        }
    }
}

participants = [entry for entry in targets.split(',') if entry]
if participants:
    message["to"] = participants

print(json.dumps(message))
PY
  )

  if node "${SCENARIO_DIR}/send_ws_messages.cjs" \
    "ws://localhost:${TEST_PORT}/ws?space=${SPACE_NAME}" \
    "test-token" \
    "test-client" \
    "${grant_payload}" \
    "${fulfill_payload}"; then
    record_pass "Capability grant sent"
    record_pass "Fulfill proposal via tools/call"

    if wait_for_envelope "${grant_envelope_id}" && \
       wait_for_delivery "${grant_envelope_id}" "test-agent" && \
       wait_for_capability_grant "test-client" "capability/grant" "${grant_envelope_id}"; then
      record_pass "Gateway logged capability grant"
    else
      record_fail "Gateway logged capability grant"
    fi

    if wait_for_envelope "${fulfill_envelope_id}" && \
       wait_for_delivery "${fulfill_envelope_id}" "file-server" && \
       wait_for_capability_grant "test-client" "mcp/request" "${fulfill_envelope_id}"; then
      record_pass "Fulfilment routed to file-server"
    else
      record_fail "Fulfilment routed to file-server"
    fi
  else
    record_fail "Capability grant sent"
    record_fail "Fulfill proposal via tools/call"
  fi
else
  record_fail "Capability grant sent"
  record_fail "Fulfill proposal via tools/call"
fi


foo_file="${DATA_DIR}/${PROPOSAL_PATH}"
if wait_for_file "${foo_file}" 40 && [[ "$(cat "${foo_file}" 2>/dev/null)" == "${PROPOSAL_CONTENT}" ]]; then
  record_pass "foo.txt created via fulfillment"
else
  record_fail "foo.txt created via fulfillment"
fi

bar_file="${DATA_DIR}/bar.txt"
if wait_for_file "${bar_file}" 40 && [[ "$(cat "${bar_file}" 2>/dev/null)" == "bar" ]]; then
  record_pass "bar.txt created via direct request"
else
  record_fail "bar.txt created via direct request"
fi

if wait_for_pattern "${AGENT_LOG}" 'Received capability grant' 40; then
  record_pass "Agent observed capability grant"
else
  record_fail "Agent observed capability grant"
fi

if wait_for_pattern "${AGENT_LOG}" 'Sending direct request to write file' 40; then
  record_pass "Agent issued direct request"
else
  record_fail "Agent issued direct request"
fi

if direct_request_id=$(AGENT_LOG_PATH="${AGENT_LOG}" python - <<'PY'
import json
import os

log_path = os.environ.get('AGENT_LOG_PATH')
if not log_path:
    raise SystemExit(1)

try:
    with open(log_path, 'r', encoding='utf-8') as handle:
        direct_id = ''
        for raw in handle:
            raw = raw.strip()
            if not raw:
                continue
            try:
                entry = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if entry.get('message') != 'Sent envelope':
                continue
            extra = entry.get('extra', {})
            if extra.get('kind') == 'mcp/request' and 'file-server' in (extra.get('to') or []):
                direct_id = extra.get('id', '')
        if direct_id:
            print(direct_id)
            raise SystemExit(0)
except FileNotFoundError:
    pass

raise SystemExit(1)
PY
); then
  if wait_for_envelope "${direct_request_id}" && \
     wait_for_delivery "${direct_request_id}" "file-server" && \
     wait_for_capability_grant "test-agent" "mcp/request" "${direct_request_id}"; then
    record_pass "Gateway logged direct request envelope"
  else
    record_fail "Gateway logged direct request envelope"
  fi
else
  record_fail "Gateway logged direct request envelope"
fi

if wait_for_pattern "${FILE_SERVER_LOG}" 'Wrote file' 40; then
  record_pass "File server handled write requests"
else
  record_fail "File server handled write requests"
fi

if wait_for_pattern "${AGENT_LOG}" '"message":"Sent envelope","extra":{"kind":"capability/grant-ack"' 40; then
  record_pass "Grant acknowledgment originates from recipient"

  if grant_ack_id=$(AGENT_LOG_PATH="${AGENT_LOG}" python - <<'PY'
import json
import os

log_path = os.environ.get('AGENT_LOG_PATH')
if not log_path:
    raise SystemExit(1)

try:
    with open(log_path, 'r', encoding='utf-8') as handle:
        ack_id = ''
        for raw in handle:
            raw = raw.strip()
            if not raw:
                continue
            try:
                entry = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if entry.get('message') != 'Sent envelope':
                continue
            extra = entry.get('extra', {})
            if extra.get('kind') == 'capability/grant-ack':
                ack_id = extra.get('id', '')
        if ack_id:
            print(ack_id)
            raise SystemExit(0)
except FileNotFoundError:
    pass

raise SystemExit(1)
PY
); then
    if wait_for_envelope "${grant_ack_id}" && \
       wait_for_envelope_receipt "${grant_ack_id}" "test-agent"; then
      record_pass "Gateway recorded grant acknowledgment"
    else
      record_fail "Gateway recorded grant acknowledgment"
    fi
  else
    record_fail "Gateway recorded grant acknowledgment"
  fi
else
  record_fail "Grant acknowledgment originates from recipient"
fi

if grep -F '"kind":"capability/grant-ack","from":"system:gateway"' "${OUTPUT_LOG}" >/dev/null 2>&1; then
  record_fail "Gateway did not forge grant acknowledgment"
else
  record_pass "Gateway did not forge grant acknowledgment"
fi

printf "\n%b\n" "${YELLOW}=== Scenario 8 Summary ===${NC}"
printf "Passed: %d\n" "${tests_passed}"
printf "Failed: %d\n" "${tests_failed}"

if [[ ${tests_failed} -eq 0 ]]; then
  exit 0
fi

exit 1
