#!/bin/bash
# Wrapper script that handles hanging test issues

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Run test with timeout
timeout 30 ./test.sh
TEST_EXIT=$?

# Clean up any hanging processes
../../../cli/bin/meup.js space down 2>/dev/null || true
pkill -f "scenario-7" 2>/dev/null || true

exit $TEST_EXIT