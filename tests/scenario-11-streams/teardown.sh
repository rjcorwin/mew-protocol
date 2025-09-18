#!/bin/bash
# Teardown script for Scenario 11 - Stream Handshake

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Cleaning up Stream Handshake Scenario ===${NC}"

../../cli/bin/mew.js space down 2>/dev/null || true

if [ -f ".mew/pids.json" ]; then
  PIDS=$(grep -o '"pid":[0-9]*' .mew/pids.json 2>/dev/null | cut -d: -f2 || true)
  for pid in $PIDS; do
    if kill -0 $pid 2>/dev/null; then
      kill -TERM $pid 2>/dev/null || true
    fi
  done
fi

if [ "${PRESERVE_LOGS:-false}" = "false" ]; then
  ../../cli/bin/mew.js space clean --all --force 2>/dev/null || {
    rm -rf logs fifos .mew 2>/dev/null || true
  }
else
  ../../cli/bin/mew.js space clean --fifos --force 2>/dev/null || true
fi

echo -e "${GREEN}✓ Cleanup complete${NC}"
