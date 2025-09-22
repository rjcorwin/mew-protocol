#!/bin/bash
set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Setting up STDIO streaming scenario ===${NC}";

rm -rf logs
mkdir -p logs

if ! ../../cli/bin/mew.js space up > ./logs/space-up.log 2>&1; then
  echo -e "${RED}Failed to start space${NC}"
  cat ./logs/space-up.log
  exit 1
fi

sleep 2

STATE_FILE="$TEST_DIR/.mew/run/state.json"
if [ ! -f "$STATE_FILE" ]; then
  echo -e "${RED}State file not found after startup${NC}"
  cat ./logs/space-up.log
  exit 1
fi

../../cli/bin/mew.js space status

touch ./logs/streaming-agent.log ./logs/stream-driver.log

echo -e "${GREEN}✓ Setup complete${NC}";
