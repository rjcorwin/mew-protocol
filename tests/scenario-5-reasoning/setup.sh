#!/usr/bin/env bash
# Scenario 5 setup - prepares disposable workspace for reasoning context test

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
REPO_ROOT=${REPO_ROOT:-"$(cd "${SCENARIO_DIR}/../.." && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
TEMPLATE_NAME=${TEMPLATE_NAME:-"scenario-5-reasoning"}
SPACE_NAME=${SPACE_NAME:-"scenario-5-reasoning"}
TEST_PORT=${TEST_PORT:-$((8000 + RANDOM % 1000))}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"
CLI_BIN="${REPO_ROOT}/cli/bin/mew.js"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 5 Setup ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Using port ${TEST_PORT}${NC}"

rm -rf "${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}/templates"

template_dest="${WORKSPACE_DIR}/templates/${TEMPLATE_NAME}"
cp -R "${SCENARIO_DIR}/template" "${template_dest}"

pushd "${WORKSPACE_DIR}" >/dev/null
node "${CLI_BIN}" init "${TEMPLATE_NAME}" --force --name "${SPACE_NAME}" --description "Scenario 5 - Reasoning" > init.log 2>&1

mkdir -p logs
: > logs/research-agent-output.log
: > logs/calculator.log

MEW_REPO_ROOT="${REPO_ROOT}" node "${CLI_BIN}" space up --space-dir . --port "${TEST_PORT}" --detach > logs/space-up.log 2>&1 || {
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

printf "%b\n" "${GREEN}✓ Gateway is ready on port ${TEST_PORT}${NC}"

cat > "${ENV_FILE}" <<ENV
SCENARIO_DIR=${SCENARIO_DIR}
REPO_ROOT=${REPO_ROOT}
WORKSPACE_DIR=${WORKSPACE_DIR}
TEMPLATE_NAME=${TEMPLATE_NAME}
SPACE_NAME=${SPACE_NAME}
TEST_PORT=${TEST_PORT}
OUTPUT_LOG=${WORKSPACE_DIR}/logs/research-agent-output.log
RESPONSE_CAPTURE=${WORKSPACE_DIR}/logs/reasoning-capture.log
ENV

printf "%b\n" "${GREEN}✓ Setup complete${NC}"
printf "Workspace log directory: %s\n" "${WORKSPACE_DIR}/logs"
printf "Gateway health: %s\n" "${health_url}"
printf "Research agent log: %s\n" "${WORKSPACE_DIR}/logs/research-agent-output.log"

popd >/dev/null
