#!/usr/bin/env bash
# Scenario 2 orchestrator - run setup, checks, teardown

set -euo pipefail

SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SCENARIO_DIR
export REPO_ROOT="$(cd "${SCENARIO_DIR}/../.." && pwd)"
export WORKSPACE_DIR="${WORKSPACE_DIR:-${SCENARIO_DIR}/.workspace}"
export TEMPLATE_NAME="${TEMPLATE_NAME:-scenario-2-mcp}"
export SPACE_NAME="${SPACE_NAME:-scenario-2-mcp}"
export TEST_PORT="${TEST_PORT:-$((8000 + RANDOM % 1000))}"

cleanup() {
  local exit_code=$?
  "${SCENARIO_DIR}/teardown.sh" || true
  exit $exit_code
}
trap cleanup EXIT

"${SCENARIO_DIR}/setup.sh"
"${SCENARIO_DIR}/check.sh"
