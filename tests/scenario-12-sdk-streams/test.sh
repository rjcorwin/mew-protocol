#!/bin/bash
# Test runner for Scenario 12 - SDK Streams

set -e

YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"

trap './teardown.sh' EXIT

echo -e "${YELLOW}=== Scenario 12: SDK Streams ===${NC}"

echo -e "${BLUE}→ Setting up space${NC}"
./setup.sh

echo -e "${BLUE}→ Verifying SDK stream telemetry${NC}"
./check.sh

echo -e "${GREEN}✓ Scenario 12 PASSED${NC}"
