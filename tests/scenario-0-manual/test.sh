#!/bin/bash
# Automated test script - Combines setup, check, and teardown
#
# This is the entry point for automated testing (e.g., from run-all-tests.sh)
# For manual/debugging, use setup.sh, check.sh, and teardown.sh separately

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get test directory
export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${YELLOW}=== Scenario 0: Basic Message Flow Test ===${NC}"
echo -e "${BLUE}Testing basic echo functionality with rapid message handling${NC}"
echo ""

# Ensure cleanup happens on exit
cleanup() {
  echo ""
  echo "Cleaning up..."
  ./teardown.sh
}
trap cleanup EXIT

# Step 1: Setup the space
echo -e "${YELLOW}Step 1: Setting up space...${NC}"
. ./setup.sh

# Step 2: Run checks
echo ""
echo -e "${YELLOW}Step 2: Running test checks...${NC}"
./check.sh
TEST_RESULT=$?

# Step 3: Report results
echo ""
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ Scenario 0 PASSED${NC}"
  exit 0
else
  echo -e "${RED}✗ Scenario 0 FAILED${NC}"
  exit 1
fi