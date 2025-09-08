#!/bin/bash
# Setup script - Initializes the test space
#
# Can be run standalone for manual testing or called by test.sh

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

echo -e "${YELLOW}=== Setting up Test Space ===${NC}"
echo -e "${BLUE}Scenario: Proposals with Capability Blocking${NC}"
echo -e "${BLUE}Directory: $TEST_DIR${NC}"
echo ""

cd "$TEST_DIR"

# Clean up any previous runs
echo "Cleaning up previous test artifacts..."
../../cli/bin/meup.js space clean --all --force 2>/dev/null || true

# Use random port to avoid conflicts
if [ -z "$TEST_PORT" ]; then
  export TEST_PORT=$((8000 + RANDOM % 1000))
fi

echo "Starting space on port $TEST_PORT..."

# Ensure logs directory exists
mkdir -p ./logs

# Start the space using meup space up
../../cli/bin/meup.js space up --port "$TEST_PORT" > ./logs/space-up.log 2>&1

# Check if space started successfully
if ../../cli/bin/meup.js space status | grep -q "Gateway: ws://localhost:$TEST_PORT"; then
  echo -e "${GREEN}✓ Space started successfully${NC}"
else
  echo -e "${RED}✗ Space failed to start${NC}"
  cat ./logs/space-up.log
  exit 1
fi

# Wait for all components to be ready
echo "Waiting for components to initialize..."
sleep 3

# Export paths for check.sh to use
export FIFO_IN="$TEST_DIR/fifos/proposer-in"
export OUTPUT_LOG="$TEST_DIR/logs/proposer-output.log"

# Verify input FIFO exists (output log will be created when client writes to it)
if [ ! -p "$FIFO_IN" ]; then
  echo -e "${RED}✗ Input FIFO not created${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Setup complete${NC}"
echo ""
echo "Gateway running on: ws://localhost:$TEST_PORT"
echo "Proposer client I/O:"
echo "  Input FIFO: $FIFO_IN"
echo "  Output Log: $OUTPUT_LOG"
echo ""
echo "You can now:"
echo "  - Run tests with: ./check.sh"
echo "  - Send proposals: echo '{\"kind\":\"mcp/proposal\",\"payload\":{...}}' > $FIFO_IN"
echo "  - Read responses: tail -f $OUTPUT_LOG"

# Set flag for check.sh
export SPACE_RUNNING=true