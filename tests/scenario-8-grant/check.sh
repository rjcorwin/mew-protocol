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
AGENT_LOG=${GRANT_AGENT_LOG:-$LOG_DIR/grant-agent.log}
FILE_LOG=${FILE_SERVER_LOG:-$LOG_DIR/file-server.log}
COORD_LOG=${COORDINATOR_LOG:-$LOG_DIR/grant-coordinator.log}

for file in "$AGENT_LOG" "$FILE_LOG" "$COORD_LOG"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Missing log file: $file${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Checking capability grant workflow ===${NC}"

FAILURES=0

check_file() {
  local path="$1"
  local expected="$2"
  if [ -f "$TEST_DIR/$path" ]; then
    local content
    content=$(cat "$TEST_DIR/$path")
    if [ "$content" = "$expected" ]; then
      echo -e "${GREEN}✓${NC} $path contains $expected"
      return
    fi
    echo -e "${RED}✗ $path content '$content' (expected '$expected')${NC}"
  else
    echo -e "${RED}✗ $path missing${NC}"
  fi
  FAILURES=$((FAILURES + 1))
}

check_log_for() {
  local log="$1"
  local needle="$2"
  if grep -q "$needle" "$log"; then
    echo -e "${GREEN}✓${NC} Found '$needle' in $(basename "$log")"
  else
    echo -e "${RED}✗ Missing '$needle' in $(basename "$log")${NC}"
    FAILURES=$((FAILURES + 1))
  fi
}

check_file foo.txt foo
check_file bar.txt bar

check_log_for "$AGENT_LOG" 'SEND proposal'
check_log_for "$AGENT_LOG" 'RECEIVED grant'
check_log_for "$AGENT_LOG" 'OK direct-request'

check_log_for "$FILE_LOG" 'WRITE'
check_log_for "$COORD_LOG" 'GRANT capability'

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
