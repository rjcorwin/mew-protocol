#!/bin/bash
set -e

# Setup test files
rm -rf /tmp/mcp-test-files
mkdir -p /tmp/mcp-test-files
echo "Hello MCP!" > /tmp/mcp-test-files/hello.txt

# Clean up
rm -rf logs .meup
mkdir -p logs

# Start space
echo "Starting space..."
PORT=9850
../../cli/bin/meup.js space up \
  --config ./space.yaml \
  --port $PORT \
  --log-level debug \
  > logs/space-startup.log 2>&1 &

SPACE_PID=$!

# Wait for space to start
sleep 8

# Check if filesystem participant exists
echo "Checking participants..."
if grep -q "filesystem" logs/gateway.log; then
  echo "✓ Filesystem participant found in gateway"
else
  echo "✗ Filesystem participant not found"
fi

# Check if bridge is running
if pgrep -f "meup-bridge" > /dev/null; then
  echo "✓ MCP bridge process is running"
else
  echo "✗ MCP bridge process not found"
fi

# Check if bridge connected
if grep -q "Connected to MEUP gateway" logs/filesystem-bridge-error.log 2>/dev/null; then
  echo "✓ Bridge connected to gateway"
else
  echo "✗ Bridge failed to connect"
fi

# Clean up
../../cli/bin/meup.js space down
rm -rf /tmp/mcp-test-files

echo "Test complete"