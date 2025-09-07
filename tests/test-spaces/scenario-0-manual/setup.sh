#!/bin/bash
# Setup script - Can be run standalone for manual testing or sourced by test.sh
#
# Sets up the MEUP space and exports environment variables for use by check.sh
# 
# Usage:
#   ./setup.sh        # Manual setup for debugging
#   . ./setup.sh      # Source from test.sh for automated testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Use random port to avoid conflicts
export TEST_PORT=${TEST_PORT:-$((8000 + RANDOM % 1000))}
export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${YELLOW}=== Setting up Test Space ===${NC}"
echo -e "${BLUE}Directory: $TEST_DIR${NC}"
echo -e "${BLUE}Port: $TEST_PORT${NC}"
echo ""

# Clean up any existing test artifacts
if [ -d "$TEST_DIR/logs" ]; then
  rm -rf "$TEST_DIR/logs"
fi
if [ -d "$TEST_DIR/fifos" ]; then
  rm -rf "$TEST_DIR/fifos"
fi
if [ -d "$TEST_DIR/.meup" ]; then
  rm -rf "$TEST_DIR/.meup"
fi

# Create necessary directories
mkdir -p "$TEST_DIR/logs" "$TEST_DIR/fifos" "$TEST_DIR/.meup"

# Start the space using meup space up
echo -e "${YELLOW}Starting space with meup space up...${NC}"
cd "$TEST_DIR"
../../../cli/bin/meup.js space up --port "$TEST_PORT" > "$TEST_DIR/logs/space-up.log" 2>&1

# Check if space started successfully
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Space started successfully${NC}"
else
  echo -e "${RED}✗ Failed to start space${NC}"
  echo "Check logs/space-up.log for details:"
  tail -20 "$TEST_DIR/logs/space-up.log"
  exit 1
fi

# Export variables for check.sh to use
export SPACE_RUNNING=true
export FIFO_IN="$TEST_DIR/fifos/test-client-in"
export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "${BLUE}For manual testing:${NC}"
echo "  1. Send messages: echo '{\"kind\":\"chat\",\"payload\":{\"text\":\"Hello\"}}' > $FIFO_IN"
echo "  2. Read responses: tail -f $OUTPUT_LOG"
echo "  3. Check logs: tail -f $TEST_DIR/logs/*.log"
echo "  4. Run checks: ./check.sh"
echo "  5. Clean up: ./teardown.sh"
echo ""

# If not sourced (running standalone), keep the script running
if [ "$0" = "${BASH_SOURCE[0]}" ]; then
  echo -e "${YELLOW}Press Ctrl+C to stop the space${NC}"
  
  # Trap Ctrl+C and run teardown
  trap 'echo ""; ./teardown.sh; exit 0' INT
  
  # Keep script running
  while true; do
    sleep 1
  done
fi