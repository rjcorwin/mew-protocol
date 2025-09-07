#!/bin/bash
# Teardown script for Scenario 5: Reasoning with Context Field

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Cleaning up Test Space ===${NC}"
echo -e "${BLUE}Directory: $(pwd)${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Stop the space
echo "Stopping space..."
../../../cli/bin/meup.js space down > /dev/null 2>&1

# Give processes time to exit
sleep 2

# Force kill any remaining processes
pkill -f "meup.*gateway" 2>/dev/null || true
pkill -f "calculator.js" 2>/dev/null || true

# Clean up FIFOs (important to prevent blocking)
if [ -d fifos ]; then
  echo "✓ Cleaned up FIFOs"
  rm -rf fifos/*
fi

# Clean up PID file
if [ -f .meup/pids.json ]; then
  rm -f .meup/pids.json
  echo "✓ Removed PID file"
fi

echo -e "\n✓ Space stopped successfully!"