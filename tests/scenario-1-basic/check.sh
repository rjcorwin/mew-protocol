#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

DRIVER_LOG=${DRIVER_LOG:-$TEST_DIR/logs/basic-driver.log}

if [ ! -f "$DRIVER_LOG" ]; then
  echo -e "${RED}Driver log not found: $DRIVER_LOG${NC}"
  exit 1
fi

echo -e "${YELLOW}=== Checking STDIO message flow ===${NC}"

timeout=20
while [ $timeout -gt 0 ]; do
  if grep -q 'DONE' "$DRIVER_LOG"; then
    break
  fi
  sleep 1
  timeout=$((timeout - 1))
done

if ! grep -q 'DONE' "$DRIVER_LOG"; then
  echo -e "${RED}Driver did not finish within timeout${NC}"
  tail -n 20 "$DRIVER_LOG"
  exit 1
fi

declare -a EXPECTED=(
  "WELCOME"
  "OK simple"
  "OK correlation"
  "OK multiple"
  "OK large"
  "OK rapid"
  "DONE"
)

FAILURES=0
for token in "${EXPECTED[@]}"; do
  if grep -q "$token" "$DRIVER_LOG"; then
    echo -e "${GREEN}✓${NC} $token"
  else
    echo -e "${RED}✗ Missing $token${NC}"
    FAILURES=$((FAILURES + 1))
  fi
done

if [ $FAILURES -ne 0 ]; then
  echo -e "${RED}Scenario failed${NC}"
  tail -n 20 "$DRIVER_LOG"
  exit 1
fi

echo -e "${GREEN}✓ Scenario passed${NC}"
