#!/usr/bin/env bash
# Scenario 14 teardown - clean up workspace directory

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 14 Teardown ===${NC}"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  rm -rf "${WORKSPACE_DIR}"
  printf "%b\n" "${GREEN}✓ Workspace removed${NC}"
else
  printf "No workspace directory found at %s\n" "${WORKSPACE_DIR}"
fi
