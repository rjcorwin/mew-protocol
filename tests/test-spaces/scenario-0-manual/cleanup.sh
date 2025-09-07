#!/bin/bash
# Manual cleanup script for debugging setup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Cleaning up manual test environment...${NC}"

# Kill any running meup processes in this directory
echo "Stopping meup processes..."
pkill -f "meup.*manual-debug-space" 2>/dev/null || true
pkill -f "echo.js.*manual-debug-space" 2>/dev/null || true

# Remove FIFOs
echo "Removing FIFOs..."
rm -f ./fifos/test-client-in ./fifos/test-client-out 2>/dev/null || true

# Optional: Clear logs (comment out if you want to keep logs)
# echo "Clearing logs..."
# rm -f ./logs/*.log ./logs/*.txt 2>/dev/null || true

echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""
echo "Log files have been preserved in ./logs/"
echo "To clear logs, run: rm -rf ./logs/*"