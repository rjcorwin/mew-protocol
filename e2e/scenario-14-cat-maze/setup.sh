#!/usr/bin/env bash
# Scenario 14 setup - prepare workspace for cat maze solver

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
REPO_ROOT=${REPO_ROOT:-"$(cd "${SCENARIO_DIR}/../.." && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"
SERVER_PATH="${REPO_ROOT}/templates/cat-maze/agents/cat-maze-server.cjs"
NARRATOR_PATH="${REPO_ROOT}/templates/cat-maze/agents/cat-maze-narrator.cjs"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 14 Setup ===${NC}"
printf "%b\n" "${BLUE}Workspace: ${WORKSPACE_DIR}${NC}"
printf "%b\n" "${BLUE}Server: ${SERVER_PATH}${NC}"

if [[ ! -f "${SERVER_PATH}" ]]; then
  printf "%b\n" "${YELLOW}Cat maze server not found at ${SERVER_PATH}${NC}" >&2
  exit 1
fi

rm -rf "${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}/logs"

cat > "${ENV_FILE}" <<ENV
SCENARIO_DIR=${SCENARIO_DIR}
REPO_ROOT=${REPO_ROOT}
WORKSPACE_DIR=${WORKSPACE_DIR}
SERVER_PATH=${SERVER_PATH}
SOLVER_LOG=${WORKSPACE_DIR}/logs/solver.log
NARRATOR_PATH=${NARRATOR_PATH}
NARRATOR_LOG=${WORKSPACE_DIR}/logs/narrator.log
ENV

printf "%b\n" "${GREEN}✓ Setup complete${NC}"
printf "Solver log: %s\n" "${WORKSPACE_DIR}/logs/solver.log"
