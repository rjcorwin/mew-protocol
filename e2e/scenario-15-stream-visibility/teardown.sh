#!/usr/bin/env bash
# Scenario 15 teardown - cleanup workspace

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 15 Teardown ===${NC}"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  pushd "${WORKSPACE_DIR}" >/dev/null
  mew space down || true
  popd >/dev/null
  printf "%b\n" "${GREEN}✓ Space stopped${NC}"
else
  printf "%b\n" "${YELLOW}No workspace found, skipping teardown${NC}"
fi
