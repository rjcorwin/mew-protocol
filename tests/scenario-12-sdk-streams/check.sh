#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

DRIVER_LOG=${BATCH_DRIVER_LOG:-$TEST_DIR/logs/batch-driver.log}
AGENT_LOG=${BATCH_AGENT_LOG:-$TEST_DIR/logs/batch-agent.log}

for file in "$DRIVER_LOG" "$AGENT_LOG"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Missing log file: $file${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Checking batch streaming ===${NC}"

FAILURES=0

expect_line() {
  local log="$1"
  local needle="$2"
  if grep -q "$needle" "$log"; then
    echo -e "${GREEN}✓${NC} $(basename "$log") contains '$needle'"
  else
    echo -e "${RED}✗${NC} $(basename "$log") missing '$needle'"
    FAILURES=$((FAILURES + 1))
  fi
}

expect_line "$AGENT_LOG" 'EMIT chunk-1'
expect_line "$AGENT_LOG" 'EMIT chunk-2'
expect_line "$AGENT_LOG" 'EMIT chunk-3'
expect_line "$AGENT_LOG" 'EMIT COMPLETE'

expect_line "$DRIVER_LOG" 'WELCOME'
expect_line "$DRIVER_LOG" 'RECV DATA chunk-1'
expect_line "$DRIVER_LOG" 'RECV DATA chunk-2'
expect_line "$DRIVER_LOG" 'RECV DATA chunk-3'
expect_line "$DRIVER_LOG" 'OK batch-sequence'
expect_line "$DRIVER_LOG" 'DONE'

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
