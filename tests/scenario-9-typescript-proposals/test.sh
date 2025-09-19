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

echo -e "${YELLOW}=== Scenario 9: STDIO TypeScript Proposals ===${NC}"

echo -e "${BLUE}Step 1: Setup${NC}"
./setup.sh

echo -e "${BLUE}Waiting for proposal flow to complete...${NC}"
sleep 2

export TS_PROPOSAL_LOG="$TEST_DIR/logs/typescript-proposal-agent.log"
export TS_DRIVER_LOG="$TEST_DIR/logs/ts-proposal-driver.log"

echo -e "${BLUE}Step 2: Checks${NC}"
if ./check.sh; then
  echo -e "${GREEN}✓ Scenario 9 PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Scenario 9 FAILED${NC}"
  exit 1
fi
