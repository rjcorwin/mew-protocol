#!/bin/bash
# Test runner for Scenario 11 - Stream Handshake

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
trap './teardown.sh' EXIT

echo -e "${YELLOW}=== Scenario 11: Stream Handshake ===${NC}"

echo -e "${BLUE}→ Setting up space${NC}"
./setup.sh

echo -e "${BLUE}→ Verifying handshake${NC}"
./check.sh

echo -e "${GREEN}✓ Scenario 11 PASSED${NC}"
