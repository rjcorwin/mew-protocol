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

# Use random port to avoid conflicts
export TEST_PORT=$((8000 + RANDOM % 1000))

echo -e "${YELLOW}=== Scenario 3: Proposals with Capability Blocking Test ===${NC}"
echo -e "${BLUE}Testing proposal flow with capability restrictions${NC}"
echo ""

# Cleanup function (no trap, will call explicitly)
cleanup() {
  echo ""
  echo "Cleaning up..."
  ./teardown.sh
}

# Step 1: Setup the space
echo -e "${YELLOW}Step 1: Setting up space...${NC}"
# Run setup in subprocess but capture the environment it sets
./setup.sh

# Export the paths that check.sh needs
export OUTPUT_LOG="$TEST_DIR/logs/proposer-output.log"

# Step 2: Run checks
echo ""
echo -e "${YELLOW}Step 2: Running test checks...${NC}"
./check.sh
TEST_RESULT=$?

# Step 3: Report results
echo ""
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ Scenario 3 PASSED${NC}"
else
  echo -e "${RED}✗ Scenario 3 FAILED${NC}"
fi

# Always cleanup before exiting
cleanup

# Exit with the test result
exit $TEST_RESULT