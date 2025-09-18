#!/bin/bash
# Setup script for Scenario 12 - SDK Streams

set -e

YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

echo -e "${YELLOW}=== Setting up SDK Stream Scenario ===${NC}"

../../cli/bin/mew.js space clean --all --force 2>/dev/null || true

mkdir -p ./logs

echo "Starting space..."
if ! ../../cli/bin/mew.js space up > ./logs/space-up.log 2>&1; then
  echo -e "${RED}✗ Failed to start space${NC}"
  cat ./logs/space-up.log
  exit 1
fi

echo "Waiting for SDK agents to initialize..."
sleep 6

echo -e "${GREEN}✓ Setup complete${NC}"
