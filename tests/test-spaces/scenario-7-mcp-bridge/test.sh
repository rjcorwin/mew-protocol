#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Scenario 7: MCP Bridge Test ==="

# Setup
./setup.sh

# Start space
PORT=$((9700 + RANDOM % 100))
echo "Starting space on port $PORT..."

../../../cli/bin/meup.js space up \
  --config ./space.yaml \
  --port $PORT \
  --log-level debug \
  &

# Wait for space to start
sleep 5

# Check results
./check.sh
CHECK_RESULT=$?

# Teardown
../../../cli/bin/meup.js space down
./teardown.sh

exit $CHECK_RESULT