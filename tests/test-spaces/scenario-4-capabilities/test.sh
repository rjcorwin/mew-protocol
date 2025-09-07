#!/bin/bash
# Main test runner for Scenario 4: Dynamic Capability Granting

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Scenario 4: Dynamic Capability Granting Test ===${NC}"
echo -e "${BLUE}Testing dynamic capability granting and revoking${NC}"

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
  TEST_PORT=$(ls fifos/ 2>/dev/null | head -1 | grep -o '[0-9]\+' || echo "8540")
fi

# Export the paths that check.sh needs
export COORD_FIFO="$TEST_DIR/fifos/coordinator-in"
export LIMITED_FIFO="$TEST_DIR/fifos/limited-agent-in"
export COORD_LOG="$TEST_DIR/logs/coordinator-output.log"
export LIMITED_LOG="$TEST_DIR/logs/limited-agent-output.log"

# Run checks
echo -e "\n${YELLOW}Step 2: Running test checks...${NC}"
./check.sh
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ Scenario 4 PASSED${NC}"
else
  echo -e "\n${RED}✗ Scenario 4 FAILED${NC}"
fi

# Cleanup
echo -e "\nCleaning up..."
./teardown.sh

exit $TEST_RESULT