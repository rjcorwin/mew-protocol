#!/bin/bash
# Setup script for Scenario 6: Error Recovery and Edge Cases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Setting up Test Space ===${NC}"
echo -e "${BLUE}Scenario: Error Recovery and Edge Cases${NC}"
echo -e "${BLUE}Directory: $(pwd)${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Create required directories
mkdir -p logs fifos

# Use provided port or generate random port
if [ -z "$TEST_PORT" ]; then
  export TEST_PORT=$((8640 + RANDOM % 100))
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
  
  # Clean .meup directory
  if [ -d .meup ]; then
    echo "Cleaning .meup directory..."
    rm -rf .meup
    echo "✓ Cleaned .meup directory"
  fi
  
  # Calculate size freed
  TOTAL_FILES=$((LOG_COUNT + FIFO_COUNT))
  SIZE_FREED=$(du -sh . 2>/dev/null | cut -f1)
  echo -e "\n✓ Cleanup complete! Freed $SIZE_FREED"
}

# Run cleanup
cleanup

# Start the space using meup CLI
echo "Starting space on port $TEST_PORT..."
PORT=$TEST_PORT ../../cli/bin/meup.js space up \
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
if [ -p fifos/test-client-in ] && [ -f logs/test-client-output.log ]; then
  echo -e "${GREEN}✓ Setup complete${NC}"
else
  echo -e "${RED}✗ Setup incomplete - missing FIFOs or logs${NC}"
  ls -la fifos/ logs/
  exit 1
fi

# Export paths for check.sh
export TEST_FIFO="$TEST_DIR/fifos/test-client-in"
export TEST_LOG="$TEST_DIR/logs/test-client-output.log"

echo -e "\nGateway running on: ws://localhost:$TEST_PORT"
echo "Test client I/O:"
echo "  Input FIFO: $TEST_FIFO"
echo "  Output Log: $TEST_LOG"

echo -e "\nYou can now:"
echo "  - Run tests with: ./check.sh"
echo "  - Send messages: echo '{\"kind\":\"chat\",...}' > $TEST_FIFO"
echo "  - Read responses: tail -f $TEST_LOG"