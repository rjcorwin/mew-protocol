#!/bin/bash
# Teardown script - Cleans up the test space
#
# Can be run after manual testing or called by test.sh

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

echo -e "${YELLOW}=== Cleaning up Test Space ===${NC}"
echo -e "${BLUE}Directory: $TEST_DIR${NC}"
echo ""

cd "$TEST_DIR"

# Stop the space using meup space down
echo "Stopping space..."
../../cli/bin/meup.js space down 2>/dev/null || true

# Additional cleanup for any orphaned processes
if [ -f ".meup/pids.json" ]; then
  # Extract PIDs and kill them if still running
  PIDS=$(grep -o '"pid":[0-9]*' .meup/pids.json 2>/dev/null | cut -d: -f2 || true)
  for pid in $PIDS; do
    if kill -0 $pid 2>/dev/null; then
      echo "Killing orphaned process $pid"
      kill -TERM $pid 2>/dev/null || true
    fi
  done
fi

# Clean up test artifacts using meup space clean
if [ "${PRESERVE_LOGS:-false}" = "false" ]; then
  echo "Cleaning test artifacts..."
  
  # Use the new meup space clean command
  ../../cli/bin/meup.js space clean --all --force 2>/dev/null || {
    # Fallback to manual cleanup if clean command fails
    echo "Clean command failed, using manual cleanup..."
    rm -rf logs fifos .meup 2>/dev/null || true
  }
  
  echo -e "${GREEN}✓ Test artifacts removed${NC}"
else
  echo -e "${YELLOW}Preserving logs (PRESERVE_LOGS=true)${NC}"
  # Clean only fifos and .meup, preserve logs
  ../../cli/bin/meup.js space clean --fifos --force 2>/dev/null || true
fi

echo -e "${GREEN}✓ Cleanup complete${NC}"