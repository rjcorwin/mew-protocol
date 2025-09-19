#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

DRIVER_LOG=${DRIVER_LOG:-$TEST_DIR/logs/error-driver.log}

if [ ! -f "$DRIVER_LOG" ]; then
  echo -e "${RED}Driver log not found: $DRIVER_LOG${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Checking error handling flow ===${NC}"

timeout=30
while [ $timeout -gt 0 ]; do
  if grep -q 'DONE' "$DRIVER_LOG"; then
    break
  fi
  if grep -q 'FAIL' "$DRIVER_LOG"; then
    echo -e "${RED}Driver reported failure${NC}"
    tail -n 20 "$DRIVER_LOG"
    exit 1
  fi
  sleep 1
  timeout=$((timeout - 1))
done

if ! grep -q 'DONE' "$DRIVER_LOG"; then
  echo -e "${RED}Driver did not finish within timeout${NC}"
  tail -n 20 "$DRIVER_LOG"
  exit 1
fi

expected=(
  "WELCOME"
  "OK invalid-tool"
  "OK large-message"
  "OK rapid-fire"
  "DONE"
)

failures=0
for token in "${expected[@]}"; do
  if grep -q "$token" "$DRIVER_LOG"; then
    echo -e "${GREEN}✓${NC} $token"
  else
    echo -e "${RED}✗ Missing $token${NC}"
    failures=$((failures + 1))
  fi
done

if [ $failures -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  tail -n 20 "$DRIVER_LOG"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
