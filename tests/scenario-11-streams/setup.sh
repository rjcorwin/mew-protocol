#!/bin/bash
# Setup script for Scenario 11 - Stream Handshake

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

echo -e "${YELLOW}=== Setting up Stream Handshake Scenario ===${NC}"
echo -e "${BLUE}Directory: $TEST_DIR${NC}"

../../cli/bin/mew.js space clean --all --force 2>/dev/null || true

mkdir -p ./logs

echo "Starting space..."
../../cli/bin/mew.js space up > ./logs/space-up.log 2>&1 || {
  echo -e "${RED}✗ Failed to start space${NC}"
  cat ./logs/space-up.log
  exit 1
}

echo "Waiting for streamer to announce stream..."
# Give the auto-start streamer time to connect and complete the handshake
sleep 5

echo -e "${GREEN}✓ Setup complete${NC}"
