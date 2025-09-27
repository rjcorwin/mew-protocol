#!/bin/bash
# Setup script - Initializes the participant lifecycle test space

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Setting up Scenario 13: Participant Lifecycle Controls ===${NC}"
echo -e "${BLUE}Directory: $TEST_DIR${NC}"

echo "Cleaning up previous runs..."
../../cli/bin/mew.js space clean --all --force 2>/dev/null || true

if [ -z "$TEST_PORT" ]; then
  export TEST_PORT=$((8600 + RANDOM % 100))
fi

echo "Using gateway port $TEST_PORT"

mkdir -p ./logs
: > ./logs/test-client-output.log
: > ./logs/control-agent.log

../../cli/bin/mew.js space up --port "$TEST_PORT" > ./logs/space-up.log 2>&1 || {
  cat ./logs/space-up.log
  exit 1
}

if ../../cli/bin/mew.js space status | grep -q "Gateway: ws://localhost:$TEST_PORT"; then
  echo -e "${GREEN}✓ Space started${NC}"
else
  echo -e "${RED}✗ Space failed to start${NC}"
  cat ./logs/space-up.log
  exit 1
fi

echo "Waiting for participants to initialize..."
sleep 4

export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"
export CONTROL_LOG="$TEST_DIR/logs/control-agent.log"

echo -e "${GREEN}✓ Setup complete${NC}"
