#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

TS_DRIVER_LOG=${TS_DRIVER_LOG:-$TEST_DIR/logs/ts-driver.log}
TS_AGENT_LOG=${TS_AGENT_LOG:-$TEST_DIR/logs/typescript-agent.log}

for file in "$TS_DRIVER_LOG" "$TS_AGENT_LOG"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Missing log file: $file${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Checking TypeScript agent workflow ===${NC}"

FAILURES=0

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

expect "$TS_DRIVER_LOG" 'OK tools-list'
expect "$TS_DRIVER_LOG" 'OK calc-add'
expect "$TS_DRIVER_LOG" 'OK calc-multiply'
expect "$TS_DRIVER_LOG" 'OK echo'
expect "$TS_DRIVER_LOG" 'OK chat-response'
expect "$TS_DRIVER_LOG" 'DONE'

expect "$TS_AGENT_LOG" 'WELCOME'
expect "$TS_AGENT_LOG" 'LIST tools'
expect "$TS_AGENT_LOG" 'CALC 5 add 3 = 8'
expect "$TS_AGENT_LOG" 'CALC 7 multiply 6 = 42'
expect "$TS_AGENT_LOG" 'ECHO Hello from driver'
expect "$TS_AGENT_LOG" 'CHAT How are you?'

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
