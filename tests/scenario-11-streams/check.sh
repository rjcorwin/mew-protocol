#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

DRIVER_LOG=${STREAM_DRIVER_LOG:-$TEST_DIR/logs/stream-driver.log}
AGENT_LOG=${STREAM_AGENT_LOG:-$TEST_DIR/logs/streaming-agent.log}

for file in "$DRIVER_LOG" "$AGENT_LOG"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Missing log file: $file${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Checking streaming sequence ===${NC}"

FAILURES=0

expect_order() {
  local log="$1"
  local pattern="$2"
  if grep -n "$pattern" "$log" >/dev/null; then
    echo -e "${GREEN}✓${NC} $(basename "$log") contains sequence";
  else
    echo -e "${RED}✗${NC} $(basename "$log") missing sequence";
    FAILURES=$((FAILURES + 1));
  fi
}

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

expect_line "$AGENT_LOG" 'WELCOME'
expect_line "$AGENT_LOG" 'EMIT start'
expect_line "$AGENT_LOG" 'EMIT thought1'
expect_line "$AGENT_LOG" 'EMIT thought2'
expect_line "$AGENT_LOG" 'EMIT conclusion'

expect_line "$DRIVER_LOG" 'WELCOME'
expect_line "$DRIVER_LOG" 'reasoning/start'
expect_line "$DRIVER_LOG" 'reasoning/thought Thinking step 1'
expect_line "$DRIVER_LOG" 'reasoning/thought Thinking step 2'
expect_line "$DRIVER_LOG" 'reasoning/conclusion'
expect_line "$DRIVER_LOG" 'OK streaming-sequence'
expect_line "$DRIVER_LOG" 'DONE'

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
