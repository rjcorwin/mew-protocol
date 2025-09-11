#!/bin/bash
# Teardown script - Cleans up the test space
#
# Can be run standalone or called by test.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# If TEST_DIR not set, we're running standalone
if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

echo -e "${YELLOW}=== Cleaning up Test Space ===${NC}"
echo -e "${BLUE}Scenario: TypeScript Agent Proposals Only${NC}"
echo ""

cd "$TEST_DIR"

# Stop the space
echo "Stopping space..."
../../cli/bin/mew.js space down 2>/dev/null || true

# Wait for processes to terminate
sleep 2

# Clean up space artifacts
echo "Cleaning up space artifacts..."
../../cli/bin/mew.js space clean --all --force 2>/dev/null || true

# Clean up local test artifacts
echo "Cleaning up test artifacts..."
rm -rf ./logs/*.log 2>/dev/null || true
rm -rf ./fifos/* 2>/dev/null || true

# Remove directories if empty
rmdir ./logs 2>/dev/null || true
rmdir ./fifos 2>/dev/null || true

echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Unset the flag
unset SPACE_RUNNING