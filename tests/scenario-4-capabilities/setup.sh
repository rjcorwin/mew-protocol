#!/bin/bash
# Setup script for Scenario 4: Dynamic Capability Granting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Setting up Test Space ===${NC}"
echo -e "${BLUE}Scenario: Dynamic Capability Granting${NC}"
echo -e "${BLUE}Directory: $(pwd)${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Create required directories
mkdir -p logs fifos

# Use provided port or generate random port
if [ -z "$TEST_PORT" ]; then
  export TEST_PORT=$((8440 + RANDOM % 100))
fi

# Clean up function
cleanup() {
  echo -e "\nCleaning up previous test artifacts..."
  
  # Clean logs
  if [ -d logs ]; then
    echo "Cleaning logs..."
    rm -f logs/*.log logs/*.txt 2>/dev/null || true
    LOG_COUNT=$(find logs -type f 2>/dev/null | wc -l | tr -d ' ')
    echo "✓ Cleaned $LOG_COUNT log files"
  fi
  
  # Clean FIFOs
  if [ -d fifos ]; then
    echo "Cleaning FIFOs..."
    rm -f fifos/* 2>/dev/null || true
    FIFO_COUNT=$(find fifos -type p 2>/dev/null | wc -l | tr -d ' ')
    echo "✓ Cleaned $FIFO_COUNT FIFO pipes"
  fi
  
  # Clean .mew directory
  if [ -d .mew ]; then
    echo "Cleaning .mew directory..."
    rm -rf .mew
    echo "✓ Cleaned .mew directory"
  fi
  
  # Calculate size freed
  TOTAL_FILES=$((LOG_COUNT + FIFO_COUNT))
  SIZE_FREED=$(du -sh . 2>/dev/null | cut -f1)
  echo -e "\n✓ Cleanup complete! Freed $SIZE_FREED"
}

# Run cleanup
cleanup

# Start the space using mew CLI
echo "Starting space on port $TEST_PORT..."
PORT=$TEST_PORT ../../cli/bin/mew.js space up \
  --config ./space.yaml \
  --port $TEST_PORT \
  --log-level debug \
  > logs/space-startup.log 2>&1

# Check if space started
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Space started successfully${NC}"
else
  echo -e "${RED}✗ Failed to start space${NC}"
  cat logs/space-startup.log
  exit 1
fi

# Wait for all components to initialize
echo "Waiting for components to initialize..."
sleep 5

# Verify FIFOs and logs are created
if [ -p fifos/coordinator-in ] && [ -p fifos/limited-agent-in ] && \
   [ -f logs/coordinator-output.log ] && [ -f logs/limited-agent-output.log ]; then
  echo -e "${GREEN}✓ Setup complete${NC}"
else
  echo -e "${RED}✗ Setup incomplete - missing FIFOs or logs${NC}"
  ls -la fifos/ logs/
  exit 1
fi

# Export paths for check.sh
export COORD_FIFO="$TEST_DIR/fifos/coordinator-in"
export LIMITED_FIFO="$TEST_DIR/fifos/limited-agent-in"
export COORD_LOG="$TEST_DIR/logs/coordinator-output.log"
export LIMITED_LOG="$TEST_DIR/logs/limited-agent-output.log"

echo -e "\nGateway running on: ws://localhost:$TEST_PORT"
echo "Coordinator client I/O:"
echo "  Input FIFO: $COORD_FIFO"
echo "  Output Log: $COORD_LOG"
echo "Limited agent I/O:"
echo "  Input FIFO: $LIMITED_FIFO"
echo "  Output Log: $LIMITED_LOG"

echo -e "\nYou can now:"
echo "  - Run tests with: ./check.sh"
echo "  - Grant capabilities: echo '{\"kind\":\"capability/grant\",...}' > $COORD_FIFO"
echo "  - Read logs: tail -f logs/*.log"