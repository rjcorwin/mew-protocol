#!/usr/bin/env bash
# Scenario 7 setup - prepares disposable workspace for MCP bridge testing

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
REPO_ROOT=${REPO_ROOT:-"$(cd "${SCENARIO_DIR}/../.." && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
TEMPLATE_NAME=${TEMPLATE_NAME:-"scenario-7-mcp-bridge"}
SPACE_NAME=${SPACE_NAME:-"scenario-7-mcp-bridge"}
TEST_PORT=${TEST_PORT:-$((8000 + RANDOM % 1000))}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 7 Setup ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Using port ${TEST_PORT}${NC}"

rm -rf "${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}/templates"

template_dest="${WORKSPACE_DIR}/templates/${TEMPLATE_NAME}"
cp -R "${SCENARIO_DIR}/template" "${template_dest}"

pushd "${WORKSPACE_DIR}" >/dev/null
mew init "${TEMPLATE_NAME}" --force --name "${SPACE_NAME}" --description "Scenario 7 - MCP Bridge" > init.log 2>&1

mkdir -p logs
BRIDGE_DIST=${REPO_ROOT}/dist/bridge/index.js
if [[ ! -f "${BRIDGE_DIST}" ]]; then
  printf "%b\n" "${YELLOW}Building @mew-protocol/mew (bridge component)${NC}"
  if ! (cd "${REPO_ROOT}" && npm run build > "${WORKSPACE_DIR}/logs/bridge-build.log" 2>&1); then
    printf "%b\n" "${YELLOW}Bridge build failed, printing log:${NC}"
    cat "${WORKSPACE_DIR}/logs/bridge-build.log"
    exit 1
  fi
fi
: > logs/test-client-output.log
: > logs/bridge.log

TEST_FILES_DIR="${WORKSPACE_DIR}/test-files"
mkdir -p "${TEST_FILES_DIR}/subdir"
cat > "${TEST_FILES_DIR}/test.txt" <<'FILE'
Test content
FILE
cat > "${TEST_FILES_DIR}/hello.txt" <<'FILE'
Hello MCP
FILE
cat > "${TEST_FILES_DIR}/subdir/nested.txt" <<'FILE'
Nested file
FILE

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

sleep 5
printf "%b\n" "${GREEN}✓ Gateway is ready on port ${TEST_PORT}${NC}"

cat > "${ENV_FILE}" <<ENV
SCENARIO_DIR=${SCENARIO_DIR}
REPO_ROOT=${REPO_ROOT}
WORKSPACE_DIR=${WORKSPACE_DIR}
TEMPLATE_NAME=${TEMPLATE_NAME}
SPACE_NAME=${SPACE_NAME}
TEST_PORT=${TEST_PORT}
OUTPUT_LOG=${WORKSPACE_DIR}/logs/test-client-output.log
TEST_FILES_DIR=${TEST_FILES_DIR}
RESPONSE_CAPTURE=${WORKSPACE_DIR}/logs/mcp-bridge-capture.log
ENV

printf "%b\n" "${GREEN}✓ Setup complete${NC}"
printf "Workspace log directory: %s\n" "${WORKSPACE_DIR}/logs"
printf "Gateway health: %s\n" "${health_url}"
printf "Test files directory: %s\n" "${TEST_FILES_DIR}"

popd >/dev/null
