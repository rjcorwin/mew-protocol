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

echo -e "${YELLOW}=== Scenario 8b: STDIO TypeScript Agent ===${NC}"

echo -e "${BLUE}Step 1: Setup${NC}"
./setup.sh

export TS_AGENT_LOG="$TEST_DIR/logs/typescript-agent.log"
export TS_DRIVER_LOG="$TEST_DIR/logs/ts-driver.log"

echo -e "${BLUE}Step 2: Checks${NC}"
if ./check.sh; then
  echo -e "${GREEN}✓ Scenario 8b PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Scenario 8b FAILED${NC}"
  exit 1
fi
