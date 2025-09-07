#!/bin/bash
# Main test runner for Scenario 6: Error Recovery and Edge Cases

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Scenario 6: Error Recovery and Edge Cases Test ===${NC}"
echo -e "${BLUE}Testing error handling and edge cases${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Run setup
echo -e "\n${YELLOW}Step 1: Setting up space...${NC}"
./setup.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Setup failed${NC}"
  exit 1
fi

# Export the port that check.sh needs
export TEST_PORT=$(grep "Gateway running on" logs/space-startup.log 2>/dev/null | grep -o '[0-9]\+' | tail -1)
if [ -z "$TEST_PORT" ]; then
  TEST_PORT=$(ls fifos/ 2>/dev/null | head -1 | grep -o '[0-9]\+' || echo "8760")
fi

# Export the paths that check.sh needs
export TEST_FIFO="$TEST_DIR/fifos/test-client-in"
export TEST_LOG="$TEST_DIR/logs/test-client-output.log"

# Run checks
echo -e "\n${YELLOW}Step 2: Running test checks...${NC}"
./check.sh
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ Scenario 6 PASSED${NC}"
else
  echo -e "\n${RED}✗ Scenario 6 FAILED${NC}"
fi

# Cleanup
echo -e "\nCleaning up..."
./teardown.sh

exit $TEST_RESULT