#!/usr/bin/env bash
# Scenario 16 teardown - cleanup workspace

set -euo pipefail

SCENARIO_DIR=${SCENARIO_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}
WORKSPACE_DIR=${WORKSPACE_DIR:-"${SCENARIO_DIR}/.workspace"}

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

printf "%b\n" "${YELLOW}=== Scenario 16 Teardown ===${NC}"

if [[ -d "${WORKSPACE_DIR}" ]]; then
  pushd "${WORKSPACE_DIR}" >/dev/null

  # Kill test participant processes
  if [[ -d "pids" ]]; then
    for pid_file in pids/*.pid; do
      if [[ -f "${pid_file}" ]]; then
        pid=$(cat "${pid_file}")
        if kill -0 "${pid}" 2>/dev/null; then
          kill "${pid}" 2>/dev/null || true
          printf "%b\n" "${GREEN}✓ Killed participant process ${pid}${NC}"
        fi
        rm -f "${pid_file}"
      fi
    done
  fi

  mew space down || true
  popd >/dev/null
  printf "%b\n" "${GREEN}✓ Space stopped${NC}"
else
  printf "%b\n" "${YELLOW}No workspace found, skipping teardown${NC}"
fi
