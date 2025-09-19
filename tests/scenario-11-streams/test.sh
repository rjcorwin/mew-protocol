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

echo -e "${YELLOW}=== Scenario 11: STDIO Streams ===${NC}"

echo -e "${BLUE}Step 1: Setup${NC}"
./setup.sh

export STREAM_AGENT_LOG="$TEST_DIR/logs/streaming-agent.log"
export STREAM_DRIVER_LOG="$TEST_DIR/logs/stream-driver.log"

echo -e "${BLUE}Step 2: Allow streaming events${NC}"
sleep 2

echo -e "${BLUE}Step 3: Checks${NC}"
if ./check.sh; then
  echo -e "${GREEN}✓ Scenario 11 PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Scenario 11 FAILED${NC}"
  exit 1
fi
