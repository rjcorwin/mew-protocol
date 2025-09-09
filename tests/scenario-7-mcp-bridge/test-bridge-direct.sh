#!/bin/bash
set -e

echo "Testing MCP Bridge directly..."

# Clean up
rm -rf /tmp/mcp-test-files logs
mkdir -p /tmp/mcp-test-files logs
echo "Test file" > /tmp/mcp-test-files/test.txt

# Start gateway first
echo "Starting gateway..."
../../cli/bin/meup.js gateway start \
  --port 9900 \
  --space-config ./space.yaml \
  --log-level debug \
  > logs/gateway-direct.log 2>&1 &
GATEWAY_PID=$!

sleep 3

# Start bridge directly with debug
echo "Starting bridge with debug..."
DEBUG=meup:* ../../bridge/bin/meup-bridge.js \
  --gateway ws://localhost:9900 \
  --space scenario-7 \
  --participant-id filesystem \
  --token fs-token \
  --mcp-command npx \
  --mcp-args "-y,@modelcontextprotocol/server-filesystem,/tmp/mcp-test-files" \
  --log-level debug \
  > logs/bridge-direct.log 2>&1 &
BRIDGE_PID=$!

# Wait a bit
sleep 5

# Check if bridge is running
if ps -p $BRIDGE_PID > /dev/null; then
  echo "✓ Bridge is running"
else
  echo "✗ Bridge crashed"
fi

# Check logs
echo ""
echo "=== Bridge output ==="
tail -20 logs/bridge-direct.log

echo ""
echo "=== Gateway output ==="
grep "filesystem" logs/gateway-direct.log | tail -10

# Cleanup
kill $BRIDGE_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true

echo ""
echo "Test complete"