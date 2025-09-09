#!/bin/bash
set -e

echo "=== Simple MCP Bridge Test ==="

# Setup test files
rm -rf /tmp/mcp-test-files logs
mkdir -p /tmp/mcp-test-files logs
echo "Test content" > /tmp/mcp-test-files/test.txt

# Start space
PORT=$((9000 + RANDOM % 1000))
echo "Starting space on port $PORT..."
../../cli/bin/meup.js space up --port $PORT > /dev/null 2>&1 &
SPACE_PID=$!

# Wait for everything to initialize
echo "Waiting for initialization..."
sleep 5

# Check if bridge registered
echo ""
echo "Checking MCP bridge registration..."
if grep -q "filesystem joined space" logs/gateway.log; then
  echo "✓ MCP bridge connected"
else
  echo "✗ MCP bridge failed to connect"
  exit 1
fi

if grep -q "system/register" logs/gateway.log; then
  echo "✓ MCP bridge sent registration"
else
  echo "✗ MCP bridge failed to register"
  exit 1
fi

if grep -q "Registered.*tools from MCP server" logs/filesystem-bridge.log 2>/dev/null || \
   grep -q "Registering.*MCP tools" logs/filesystem-bridge-error.log 2>/dev/null; then
  echo "✓ MCP tools registered"
else
  echo "✗ MCP tools not registered"
  exit 1
fi

echo ""
echo "=== Test Summary ==="
echo "✓ MCP bridge is working correctly"
echo "✓ Tools are registered and available"
echo ""
echo "The bridge successfully:"
echo "- Connected to the gateway"
echo "- Started the MCP filesystem server"
echo "- Registered MCP tools with the space"

# Cleanup
../../cli/bin/meup.js space down
rm -rf /tmp/mcp-test-files

echo ""
echo "✓ Test complete"