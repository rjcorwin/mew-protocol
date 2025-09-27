#!/bin/bash
# Main test runner for Scenario 12 - Stream Lifecycle Controls

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}=== Scenario 12: Stream Lifecycle Controls ===${NC}"

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

export TEST_PORT=$((8700 + RANDOM % 100))

echo -e "${BLUE}Using port:${NC} $TEST_PORT"

echo -e "${YELLOW}Step 1: Setup${NC}"
./setup.sh

echo -e "${YELLOW}Step 2: Execute checks${NC}"
./check.sh
RESULT=$?

echo -e "${YELLOW}Step 3: Teardown${NC}"
./teardown.sh || true

exit $RESULT
