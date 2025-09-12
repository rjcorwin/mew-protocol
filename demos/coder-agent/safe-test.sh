#!/bin/bash

echo "=== SAFE TEST WITH PROCESS MONITORING ==="
echo "Emergency kill commands ready:"
echo "  pkill -f coder-demo"
echo "  npx pm2 kill"
echo "  pkill -9 node"
echo ""

# Monitor process count
(
  while true; do
    NODE_COUNT=$(ps aux | grep -E "node|npm" | grep -v grep | wc -l)
    if [ $NODE_COUNT -gt 20 ]; then
      echo "⚠️  WARNING: $NODE_COUNT node processes detected! Killing all..."
      pkill -f "coder-demo"
      npx pm2 kill
      pkill -9 node
      echo "Emergency kill executed!"
      exit 1
    fi
    echo "Process count: $NODE_COUNT (safe)"
    sleep 2
  done
) &
MONITOR_PID=$!

# Cleanup on exit
trap "kill $MONITOR_PID 2>/dev/null; npx pm2 kill 2>/dev/null" EXIT

# Start space
echo "Starting space..."
cd "$(dirname "$0")"
timeout 30 ../../cli/bin/mew.js space up space.yaml

if [ $? -eq 0 ]; then
  echo "Space started successfully"
  
  # Give it 5 seconds
  sleep 5
  
  # Check PM2 status
  echo "PM2 Status:"
  npx pm2 list
  
  # Stop space
  echo "Stopping space..."
  ../../cli/bin/mew.js space down
else
  echo "Space failed to start or timed out"
  npx pm2 kill
fi

kill $MONITOR_PID 2>/dev/null
echo "Test complete"