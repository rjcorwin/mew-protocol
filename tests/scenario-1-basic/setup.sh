#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Setting up STDIO test space ===${NC}";

mkdir -p logs

# Clean previous artifacts
../../cli/bin/mew.js space clean >/dev/null 2>&1 || true
rm -rf .mew >/dev/null 2>&1 || true

# Start the space (processes spawn detached via CLI)
echo "Starting space using mew space up..."
if ! ../../cli/bin/mew.js space up > ./logs/space-up.log 2>&1; then
  echo -e "${RED}Failed to start space${NC}"
  cat ./logs/space-up.log
  exit 1
fi

echo "Waiting for processes to come online..."
sleep 3

STATE_FILE="$TEST_DIR/.mew/run/state.json"
if [ ! -f "$STATE_FILE" ]; then
  echo -e "${RED}State file not found after startup${NC}"
  cat ./logs/space-up.log
  exit 1
fi

../../cli/bin/mew.js space status

export DRIVER_LOG="$TEST_DIR/logs/basic-driver.log"
touch "$DRIVER_LOG"

echo -e "${GREEN}✓ Setup complete${NC}";
