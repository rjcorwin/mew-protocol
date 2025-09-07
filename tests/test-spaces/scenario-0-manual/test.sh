#!/bin/bash
# Manual Test Setup for Debugging/Development
#
# This script demonstrates the manual approach to starting MEUP components
# for debugging and development purposes. Unlike the automated space commands,
# this gives you direct control over each component.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Manual Test Setup for Debugging ===${NC}"
echo -e "${BLUE}This script starts components manually for debugging purposes${NC}"
echo ""

# Use random port to avoid conflicts
PORT=$((8000 + RANDOM % 1000))

# Create necessary directories
mkdir -p ./logs ./fifos

echo -e "${YELLOW}Step 1: Starting Gateway${NC}"
echo -e "Command: ../../../cli/bin/meup.js gateway start --port $PORT --log-level debug --space-config ./space.yaml"
echo ""

# Start gateway with space configuration
../../../cli/bin/meup.js gateway start \
  --port "$PORT" \
  --log-level debug \
  --space-config ./space.yaml \
  > ./logs/gateway.log 2>&1 &
GATEWAY_PID=$!

echo -e "Gateway PID: $GATEWAY_PID"
echo -e "Log file: ./logs/gateway.log"
echo ""

# Wait for gateway
sleep 3

# Check if gateway is running
if ! kill -0 $GATEWAY_PID 2>/dev/null; then
  echo -e "${RED}Gateway failed to start${NC}"
  echo "Check the log file for errors:"
  tail -20 ./logs/gateway.log
  exit 1
fi

echo -e "${GREEN}✓ Gateway started on port $PORT${NC}"
echo ""

echo -e "${YELLOW}Step 2: Starting Echo Agent${NC}"
echo -e "Command: node ./agents/echo.js --gateway ws://localhost:$PORT --space manual-debug-space --token echo-token"
echo ""

# Start echo agent
node ./agents/echo.js \
  --gateway "ws://localhost:$PORT" \
  --space manual-debug-space \
  --token "echo-token" \
  > ./logs/echo.log 2>&1 &
ECHO_PID=$!

echo -e "Echo Agent PID: $ECHO_PID"
echo -e "Log file: ./logs/echo.log"
echo ""

sleep 2

# Check if echo agent is running
if ! kill -0 $ECHO_PID 2>/dev/null; then
  echo -e "${RED}Echo agent failed to start${NC}"
  echo "Check the log file for errors:"
  tail -20 ./logs/echo.log
  kill $GATEWAY_PID 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}✓ Echo agent started${NC}"
echo ""

echo -e "${YELLOW}Step 3: Creating FIFOs for Test Client${NC}"
echo -e "Commands:"
echo -e "  mkfifo ./fifos/test-client-in"
echo -e "  mkfifo ./fifos/test-client-out"
echo ""

# Create FIFOs for test client
mkfifo ./fifos/test-client-in ./fifos/test-client-out

echo -e "${GREEN}✓ FIFOs created${NC}"
echo ""

echo -e "${YELLOW}Step 4: Connecting Test Client${NC}"
echo -e "Command: ../../../cli/bin/meup.js client connect --gateway ws://localhost:$PORT --space manual-debug-space --participant-id test-client --token test-token --fifo-in ./fifos/test-client-in --fifo-out ./fifos/test-client-out"
echo ""

# Connect test client
../../../cli/bin/meup.js client connect \
  --gateway "ws://localhost:$PORT" \
  --space manual-debug-space \
  --participant-id test-client \
  --token "test-token" \
  --fifo-in ./fifos/test-client-in \
  --fifo-out ./fifos/test-client-out \
  > ./logs/test-client.log 2>&1 &
CLIENT_PID=$!

echo -e "Test Client PID: $CLIENT_PID"
echo -e "Log file: ./logs/test-client.log"
echo ""

# Start reading from FIFO
cat ./fifos/test-client-out > ./logs/responses.txt &
CAT_PID=$!

# Wait for connection
sleep 3

echo -e "${GREEN}✓ Test client connected${NC}"
echo ""

echo -e "${YELLOW}=== Manual Setup Complete ===${NC}"
echo ""
echo -e "${BLUE}Components Running:${NC}"
echo -e "  Gateway:     PID $GATEWAY_PID (port $PORT)"
echo -e "  Echo Agent:  PID $ECHO_PID"
echo -e "  Test Client: PID $CLIENT_PID"
echo ""
echo -e "${BLUE}Log Files:${NC}"
echo -e "  Gateway:     ./logs/gateway.log"
echo -e "  Echo Agent:  ./logs/echo.log"
echo -e "  Test Client: ./logs/test-client.log"
echo -e "  Responses:   ./logs/responses.txt"
echo ""
echo -e "${BLUE}FIFOs:${NC}"
echo -e "  Input:  ./fifos/test-client-in"
echo -e "  Output: ./fifos/test-client-out"
echo ""

echo -e "${YELLOW}=== Interactive Test Commands ===${NC}"
echo ""
echo "You can now send messages to the test client:"
echo -e "${GREEN}echo '{\"kind\":\"chat\",\"payload\":{\"text\":\"Hello, echo!\"}}' > ./fifos/test-client-in${NC}"
echo ""
echo "Watch responses in real-time:"
echo -e "${GREEN}tail -f ./logs/responses.txt${NC}"
echo ""
echo "Monitor gateway logs:"
echo -e "${GREEN}tail -f ./logs/gateway.log${NC}"
echo ""

echo -e "${YELLOW}=== Running Basic Tests ===${NC}"
echo ""

# Run a simple test to verify everything works
echo '{"kind":"chat","payload":{"text":"Test message"}}' > ./fifos/test-client-in
sleep 2

if grep -q '"text":"Echo: Test message"' ./logs/responses.txt; then
  echo -e "${GREEN}✓ Basic test passed - echo response received${NC}"
else
  echo -e "${RED}✗ Basic test failed - no echo response${NC}"
  echo "Check the logs for errors"
fi

echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all components, or run cleanup manually:${NC}"
echo -e "${BLUE}./cleanup.sh${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Cleaning up...${NC}"
  kill $CAT_PID 2>/dev/null || true
  kill $CLIENT_PID 2>/dev/null || true
  kill $ECHO_PID 2>/dev/null || true
  kill $GATEWAY_PID 2>/dev/null || true
  rm -f ./fifos/test-client-in ./fifos/test-client-out
  echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Set up trap for cleanup on Ctrl+C
trap cleanup INT

# Wait for user to press Ctrl+C
echo "Components are running. Press Ctrl+C to stop..."
wait