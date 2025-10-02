#!/usr/bin/env bash
# Scenario 12 teardown - stop space and clean workspace

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
REPO_ROOT=${REPO_ROOT:-"$(cd "${SCENARIO_DIR}/../.." && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
ENV_FILE="${WORKSPACE_DIR}/workspace.env"

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 12 Teardown ===${NC}"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
  fi

  # Use global mew command (installed by test runner)
  mew space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true

  rm -rf "${WORKSPACE_DIR}"
  printf "%b\n" "${GREEN}✓ Workspace removed${NC}"
else
  printf "No workspace directory found at %s\n" "${WORKSPACE_DIR}"
fi
