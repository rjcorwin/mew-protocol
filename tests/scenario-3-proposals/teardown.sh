#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Tearing down proposal scenario ===${NC}"

../../cli/bin/mew.js space down >/dev/null 2>&1 || true
../../cli/bin/mew.js space clean >/dev/null 2>&1 || true

rm -rf .mew >/dev/null 2>&1 || true

echo -e "${GREEN}✓ Cleanup complete${NC}"
