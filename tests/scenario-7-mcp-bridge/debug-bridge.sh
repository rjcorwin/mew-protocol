#!/bin/bash
set -e

echo "=== Debug MCP Bridge Test ==="

# Clean up
../../cli/bin/meup.js space clean --all --force 2>/dev/null || true
rm -rf logs
mkdir -p logs

# Setup test files
mkdir -p /tmp/mcp-test-files
echo "Hello MCP" > /tmp/mcp-test-files/hello.txt

# Start space
PORT=$((9800 + RANDOM % 100))
echo "Starting space on port $PORT..."

# Start gateway in background
../../cli/bin/meup.js gateway start \
  --space-config ./space.yaml \
  --port $PORT \
  > logs/gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway
sleep 2

# Start bridge with more debug output
echo "Starting filesystem bridge with debug output..."
DEBUG=meup:* ../../bridge/bin/meup-bridge.js \
  --gateway ws://localhost:$PORT \
  --space scenario-7 \
  --participant-id filesystem \
  --token fs-token \
  --mcp-command npx \
  --mcp-args -y,@modelcontextprotocol/server-filesystem,/tmp/mcp-test-files \
  > logs/filesystem-bridge-debug.log 2>&1 &
BRIDGE_PID=$!

# Wait for bridge to initialize
sleep 5

# Start test agent
echo "Starting test agent..."
node ./test-agent.js $PORT scenario-7 > logs/test-agent-debug.log 2>&1 &
AGENT_PID=$!

# Wait and show logs
sleep 10

echo ""
echo "=== Test Agent Log ==="
cat logs/test-agent-debug.log

echo ""
echo "=== Bridge Log (last 30 lines) ==="
tail -30 logs/filesystem-bridge-debug.log

# Cleanup
kill $AGENT_PID 2>/dev/null || true
kill $BRIDGE_PID 2>/dev/null || true
kill $GATEWAY_PID 2>/dev/null || true

rm -rf /tmp/mcp-test-files