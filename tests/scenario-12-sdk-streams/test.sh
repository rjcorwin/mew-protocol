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

echo -e "${YELLOW}=== Scenario 12: STDIO Batch Streaming ===${NC}"

echo -e "${BLUE}Step 1: Setup${NC}"
./setup.sh

export BATCH_AGENT_LOG="$TEST_DIR/logs/batch-agent.log"
export BATCH_DRIVER_LOG="$TEST_DIR/logs/batch-driver.log"

echo -e "${BLUE}Step 2: Allow batch response${NC}"
sleep 2

echo -e "${BLUE}Step 3: Checks${NC}"
if ./check.sh; then
  echo -e "${GREEN}✓ Scenario 12 PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Scenario 12 FAILED${NC}"
  exit 1
fi
