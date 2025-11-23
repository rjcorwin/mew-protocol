#!/usr/bin/env bash
# Scenario 16 setup - prepares workspace for stream ownership transfer tests

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
REPO_ROOT=${REPO_ROOT:-"$(cd "${SCENARIO_DIR}/../.." && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
TEMPLATE_NAME=${TEMPLATE_NAME:-"scenario-16-stream-ownership"}
SPACE_NAME=${SPACE_NAME:-"scenario-16-stream-ownership"}
TEST_PORT=${TEST_PORT:-$((8000 + RANDOM % 1000))}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 16 Setup: Stream Ownership Transfer ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Using port ${TEST_PORT}${NC}"

rm -rf "${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}/templates"

cp -R "${SCENARIO_DIR}/template" "${WORKSPACE_DIR}/templates/${TEMPLATE_NAME}"

pushd "${WORKSPACE_DIR}" >/dev/null

mew init "${TEMPLATE_NAME}" --force --name "${SPACE_NAME}" --description "Scenario 16 - Stream Ownership" > init.log 2>&1

mkdir -p logs pids
: > logs/stream-owner.log
: > logs/stream-writer.log
: > logs/verifier.log

mew space up --space-dir . --port "${TEST_PORT}" --detach > logs/space-up.log 2>&1 || {
  printf "%b\n" "${YELLOW}space up failed, printing log:${NC}"
  cat logs/space-up.log
  exit 1
}

health_url="http://localhost:${TEST_PORT}/health"
for attempt in {1..20}; do
  if curl -sf "${health_url}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ ${attempt} -eq 20 ]]; then
    printf "%b\n" "${YELLOW}Gateway failed to start within timeout${NC}"
    cat logs/gateway.log 2>/dev/null || true
    exit 1
  fi
done

sleep 2
printf "%b\n" "${GREEN}✓ Gateway is ready on port ${TEST_PORT}${NC}"

# Spawn interactive test participants
printf "%b\n" "${BLUE}Starting interactive test participants...${NC}"

node "${SCENARIO_DIR}/test-participant.js" stream-owner stream-owner-token "${TEST_PORT}" > logs/stream-owner-participant.log 2>&1 &
OWNER_PID=$!
echo ${OWNER_PID} > pids/stream-owner.pid

node "${SCENARIO_DIR}/test-participant.js" stream-writer stream-writer-token "${TEST_PORT}" > logs/stream-writer-participant.log 2>&1 &
WRITER_PID=$!
echo ${WRITER_PID} > pids/stream-writer.pid

node "${SCENARIO_DIR}/test-participant.js" verifier verifier-token "${TEST_PORT}" > logs/verifier-participant.log 2>&1 &
VERIFIER_PID=$!
echo ${VERIFIER_PID} > pids/verifier.pid

# Wait for participants to connect by checking for "Welcome received" in logs
printf "%b\n" "${BLUE}Waiting for participants to connect...${NC}"
for attempt in {1..20}; do
  if grep -q "Welcome received" logs/stream-owner-participant.log 2>/dev/null && \
     grep -q "Welcome received" logs/stream-writer-participant.log 2>/dev/null && \
     grep -q "Welcome received" logs/verifier-participant.log 2>/dev/null; then
    break
  fi
  sleep 0.5
  if [[ ${attempt} -eq 20 ]]; then
    printf "%b\n" "${YELLOW}Warning: Participants did not all connect within timeout${NC}"
    cat logs/*-participant.log 2>/dev/null || true
  fi
done

sleep 1

printf "%b\n" "${GREEN}✓ Test participants started and connected${NC}"
printf "  stream-owner: PID ${OWNER_PID}\n"
printf "  stream-writer: PID ${WRITER_PID}\n"
printf "  verifier: PID ${VERIFIER_PID}\n"

cat > "${ENV_FILE}" <<ENV
SCENARIO_DIR=${SCENARIO_DIR}
REPO_ROOT=${REPO_ROOT}
WORKSPACE_DIR=${WORKSPACE_DIR}
TEMPLATE_NAME=${TEMPLATE_NAME}
SPACE_NAME=${SPACE_NAME}
TEST_PORT=${TEST_PORT}
OWNER_LOG=${WORKSPACE_DIR}/logs/stream-owner.log
WRITER_LOG=${WORKSPACE_DIR}/logs/stream-writer.log
VERIFIER_LOG=${WORKSPACE_DIR}/logs/verifier.log
ENV

printf "%b\n" "${GREEN}✓ Setup complete${NC}"
printf "Workspace log directory: %s\n" "${WORKSPACE_DIR}/logs"
printf "Gateway health: %s\n" "${health_url}"

popd >/dev/null
