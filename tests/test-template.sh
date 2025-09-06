#!/bin/bash
# Test Template - Shows the new simplified structure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Template ===${NC}"

# Create test directory and copy test-space
TEST_DIR="./test-run-$(date +%s)"
mkdir -p "$TEST_DIR"

# Copy entire test-space directory
cp -r test-space/* "$TEST_DIR/"
cd "$TEST_DIR"

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Start gateway with the space configuration
echo "Starting gateway on port $PORT..."
../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level info \
  --space-config ./space.yaml \
  > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  cat gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started${NC}"
echo -e "${GREEN}✓ Test space ready at: $TEST_DIR${NC}"

# Your test code goes here...
echo "Running tests..."

# Example: Start an agent from the test-space
node ./agents/echo.js \
  --gateway "ws://localhost:$PORT" \
  --space test-space \
  --token "echo-token" \
  > echo.log 2>&1 &
ECHO_PID=$!

sleep 2

# Run your test logic...
echo -e "${GREEN}✓ Test complete${NC}"

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
kill $ECHO_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true

cd ..
rm -rf "$TEST_DIR"

echo -e "${GREEN}Done!${NC}"