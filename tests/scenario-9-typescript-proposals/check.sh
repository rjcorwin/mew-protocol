#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

TS_PROPOSAL_LOG=${TS_PROPOSAL_LOG:-$TEST_DIR/logs/typescript-proposal-agent.log}
TS_DRIVER_LOG=${TS_DRIVER_LOG:-$TEST_DIR/logs/ts-proposal-driver.log}

for file in "$TS_PROPOSAL_LOG" "$TS_DRIVER_LOG"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Missing log file: $file${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Checking TypeScript proposal workflow ===${NC}"

FAILURES=0

ATTEMPTS=10
while [ $ATTEMPTS -gt 0 ]; do
  if grep -q 'DONE' "$TS_DRIVER_LOG"; then
    break
  fi
  sleep 1
  ATTEMPTS=$((ATTEMPTS - 1))
done

expect() {
  local log="$1"
  local needle="$2"
  if grep -q "$needle" "$log"; then
    echo -e "${GREEN}✓${NC} Found '$needle' in $(basename "$log")"
  else
    echo -e "${RED}✗ Missing '$needle' in $(basename "$log")${NC}"
    FAILURES=$((FAILURES + 1))
  fi
}

expect "$TS_PROPOSAL_LOG" 'WELCOME'
expect "$TS_PROPOSAL_LOG" 'PROPOSE add 7 9'
expect "$TS_DRIVER_LOG" 'RECEIVED proposal'
expect "$TS_DRIVER_LOG" 'FULFILL add 7 9 -> 16'
expect "$TS_DRIVER_LOG" 'OK chat-result'
expect "$TS_DRIVER_LOG" 'DONE'

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
