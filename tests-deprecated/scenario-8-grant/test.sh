#!/bin/bash
set -e

# Main test orchestrator for scenario-8-grant
# Tests capability grant workflow:
# 1. Agent proposes to write foo.txt
# 2. Human fulfills with grant
# 3. Agent directly writes bar.txt

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==========================================="
echo "Scenario 8: Capability Grant Workflow Test"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Run setup
echo -e "${BLUE}Running setup...${NC}"
./setup.sh

# Simulate human interaction
echo -e "\n${YELLOW}Simulating human approval with grant...${NC}"

# Create a background process to handle the approval
(
    # Connect as human and automatically approve with grant
    sleep 5  # Wait for proposal to arrive

    # Send approval with grant through FIFO
    echo "3" > fifos/human-input  # Option 3: Grant and fulfill

    # Keep connection alive briefly to ensure grant is sent
    sleep 3
    echo "exit" > fifos/human-input
) &

# Connect as human in the foreground (reading from FIFO)
echo -e "${GREEN}Connecting as human participant...${NC}"
../../cli/bin/mew.js client connect \
    --participant human \
    --non-interactive < fifos/human-input > fifos/human-output 2>&1 &
HUMAN_PID=$!

# Wait for test to complete
echo -e "\n${BLUE}Waiting for test sequence to complete...${NC}"
sleep 15

# Kill human client if still running
kill $HUMAN_PID 2>/dev/null || true

# Run checks
echo -e "\n${BLUE}Running checks...${NC}"
./check.sh
CHECK_RESULT=$?

# Run teardown
echo -e "\n${BLUE}Running teardown...${NC}"
./teardown.sh

# Report final result
echo ""
if [ $CHECK_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ TEST PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ TEST FAILED!${NC}"

    # Show logs for debugging
    echo -e "\n${YELLOW}Agent log:${NC}"
    tail -20 logs/agent.log 2>/dev/null || echo "No agent log found"

    echo -e "\n${YELLOW}File server log:${NC}"
    tail -20 logs/file-server.log 2>/dev/null || echo "No file server log found"

    exit 1
fi