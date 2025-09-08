#!/bin/bash
set -e

echo "Checking MCP bridge test results..."

# Check if test agent completed successfully
if [ -f .meup/pids.json ]; then
  echo "Space is still running"
  
  # Check logs for test results
  if grep -q "ALL TESTS PASSED!" logs/*.log 2>/dev/null; then
    echo "✓ All MCP bridge tests passed"
    exit 0
  fi
  
  if grep -q "MCP participant not found" logs/*.log 2>/dev/null; then
    echo "✗ MCP bridge failed to register"
    exit 1
  fi
  
  if grep -q "Got MCP response" logs/*.log 2>/dev/null; then
    echo "✓ MCP bridge is responding to requests"
  else
    echo "✗ No MCP responses received"
    exit 1
  fi
fi

echo "✗ Test did not complete"
exit 1