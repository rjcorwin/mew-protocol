#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  ./teardown.sh
}
trap cleanup EXIT

echo -e "${YELLOW}=== Scenario 8: STDIO Capability Grant ===${NC}"

echo -e "${BLUE}Step 1: Setup${NC}"
./setup.sh

export GRANT_AGENT_LOG="$TEST_DIR/logs/grant-agent.log"
export FILE_SERVER_LOG="$TEST_DIR/logs/file-server.log"
export COORDINATOR_LOG="$TEST_DIR/logs/grant-coordinator.log"

echo -e "${BLUE}Step 2: Checks${NC}"
if ./check.sh; then
  echo -e "${GREEN}✓ Scenario 8 PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Scenario 8 FAILED${NC}"
  exit 1
fi
