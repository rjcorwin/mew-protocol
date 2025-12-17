#!/usr/bin/env bash
# Scenario 18 setup - prepares workspace for targeted stream delivery tests [t5d]

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
REPO_ROOT=${REPO_ROOT:-"$(cd "${SCENARIO_DIR}/../.." && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
TEMPLATE_NAME=${TEMPLATE_NAME:-"scenario-18-targeted-streams"}
SPACE_NAME=${SPACE_NAME:-"scenario-18-targeted-streams"}
TEST_PORT=${TEST_PORT:-$((8000 + RANDOM % 1000))}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 18 Setup: Targeted Stream Delivery [t5d] ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Using port ${TEST_PORT}${NC}"

rm -rf "${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}/templates"

cp -R "${SCENARIO_DIR}/template" "${WORKSPACE_DIR}/templates/${TEMPLATE_NAME}"

pushd "${WORKSPACE_DIR}" >/dev/null

mew init "${TEMPLATE_NAME}" --force --name "${SPACE_NAME}" --description "Scenario 18 - Targeted Streams" > init.log 2>&1

mkdir -p logs pids
: > logs/publisher.log
: > logs/aggregator.log
: > logs/observer.log

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

node "${SCENARIO_DIR}/test-participant.js" publisher publisher-token "${TEST_PORT}" > logs/publisher-participant.log 2>&1 &
PUBLISHER_PID=$!
echo ${PUBLISHER_PID} > pids/publisher.pid

node "${SCENARIO_DIR}/test-participant.js" aggregator aggregator-token "${TEST_PORT}" > logs/aggregator-participant.log 2>&1 &
AGGREGATOR_PID=$!
echo ${AGGREGATOR_PID} > pids/aggregator.pid

node "${SCENARIO_DIR}/test-participant.js" observer observer-token "${TEST_PORT}" > logs/observer-participant.log 2>&1 &
OBSERVER_PID=$!
echo ${OBSERVER_PID} > pids/observer.pid

# Wait for participants to connect by checking for "Welcome received" in logs
printf "%b\n" "${BLUE}Waiting for participants to connect...${NC}"
for attempt in {1..20}; do
  if grep -q "Welcome received" logs/publisher-participant.log 2>/dev/null && \
     grep -q "Welcome received" logs/aggregator-participant.log 2>/dev/null && \
     grep -q "Welcome received" logs/observer-participant.log 2>/dev/null; then
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
printf "  publisher: PID ${PUBLISHER_PID}\n"
printf "  aggregator: PID ${AGGREGATOR_PID}\n"
printf "  observer: PID ${OBSERVER_PID}\n"

cat > "${ENV_FILE}" <<ENV
SCENARIO_DIR=${SCENARIO_DIR}
REPO_ROOT=${REPO_ROOT}
WORKSPACE_DIR=${WORKSPACE_DIR}
TEMPLATE_NAME=${TEMPLATE_NAME}
SPACE_NAME=${SPACE_NAME}
TEST_PORT=${TEST_PORT}
PUBLISHER_LOG=${WORKSPACE_DIR}/logs/publisher.log
AGGREGATOR_LOG=${WORKSPACE_DIR}/logs/aggregator.log
OBSERVER_LOG=${WORKSPACE_DIR}/logs/observer.log
ENV

printf "%b\n" "${GREEN}✓ Setup complete${NC}"
printf "Workspace log directory: %s\n" "${WORKSPACE_DIR}/logs"
printf "Gateway health: %s\n" "${health_url}"

popd >/dev/null
