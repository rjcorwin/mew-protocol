#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

LOG_DIR="$TEST_DIR/logs"
DRIVER_LOG=${DRIVER_LOG:-$LOG_DIR/multi-driver.log}
COORD_LOG=${COORDINATOR_LOG:-$LOG_DIR/coordinator.log}
WORKER_LOG=${WORKER_LOG:-$LOG_DIR/worker.log}

for file in "$DRIVER_LOG" "$COORD_LOG" "$WORKER_LOG"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Missing log file: $file${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Checking multi-agent coordination ===${NC}"

FAILURES=0

expect() {
  local log="$1"
  local needle="$2"
  if grep -q "$needle" "$log"; then
    echo -e "${GREEN}✓${NC} $(basename "$log") contains '$needle'"
  else
    echo -e "${RED}✗${NC} $(basename "$log") missing '$needle'"
    FAILURES=$((FAILURES + 1))
  fi
}

expect "$DRIVER_LOG" 'WELCOME'
expect "$DRIVER_LOG" 'REQUEST coordination'
expect "$DRIVER_LOG" 'OK coordination'
expect "$DRIVER_LOG" 'DONE'

expect "$COORD_LOG" 'REQUEST worker'
expect "$COORD_LOG" 'FORWARD result'

expect "$WORKER_LOG" 'WELCOME'
expect "$WORKER_LOG" 'RESULT'

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
