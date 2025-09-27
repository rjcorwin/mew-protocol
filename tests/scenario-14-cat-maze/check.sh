#!/usr/bin/env bash
# Scenario 14 checks - drive the cat maze MCP server through all levels

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

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 14 Checks ===${NC}"
printf "%b\n" "${BLUE}Using cat maze server: ${SERVER_PATH}${NC}"

if [[ -z "${SOLVER_LOG:-}" ]]; then
  echo "SOLVER_LOG not set" >&2
  exit 1
fi

printf "%b\n" "${BLUE}Verifying CLI template discovery...${NC}"
if node "${REPO_ROOT}/cli/bin/mew.js" init --list-templates | grep -q "cat-maze"; then
  printf "%b\n" "${GREEN}✓ cat-maze template advertised by mew init${NC}"
else
  printf "%b\n" "${RED}✗ cat-maze template missing from mew init --list-templates${NC}"
  exit 1
fi

: > "${SOLVER_LOG}"

if node "${SCENARIO_DIR}/solver.js" --server "${SERVER_PATH}" --log "${SOLVER_LOG}"; then
  printf "%b\n" "${GREEN}✓ Cat maze run completed successfully${NC}"
else
  printf "%b\n" "${RED}✗ Cat maze run failed${NC}"
  cat "${SOLVER_LOG}" >&2 || true
  exit 1
fi
