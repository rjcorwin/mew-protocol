#!/usr/bin/env bash
# Scenario 3 teardown - stop space and clean workspace

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}
LIB_DIR="${SCENARIO_DIR}/../lib"
ENV_FILE="${WORKSPACE_DIR}/workspace.env"

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 3 Teardown ===${NC}"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  if [[ -f "${LIB_DIR}/mew-cli.sh" ]]; then
    # shellcheck disable=SC1091
    source "${LIB_DIR}/mew-cli.sh"
    ensure_mew_cli || true
  fi

  if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
  fi

  if command -v mew >/dev/null 2>&1; then
    mew space down --space-dir "${WORKSPACE_DIR}" >/dev/null 2>&1 || true
  fi

  rm -rf "${WORKSPACE_DIR}"
  printf "%b\n" "${GREEN}✓ Workspace removed${NC}"
else
  printf "No workspace directory found at %s\n" "${WORKSPACE_DIR}"
fi
