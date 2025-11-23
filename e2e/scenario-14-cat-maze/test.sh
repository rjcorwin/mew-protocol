#!/usr/bin/env bash
# Scenario 14 orchestrator - cat maze MCP server end-to-end run

set -euo pipefail

SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SCENARIO_DIR
export REPO_ROOT="$(cd "${SCENARIO_DIR}/../.." && pwd)"
export WORKSPACE_DIR="${WORKSPACE_DIR:-${SCENARIO_DIR}/.workspace}"

cleanup() {
  local exit_code=$?
  "${SCENARIO_DIR}/teardown.sh" || true
  exit $exit_code
}
trap cleanup EXIT

"${SCENARIO_DIR}/setup.sh"
"${SCENARIO_DIR}/check.sh"
