#!/bin/bash

echo "Starting test with CPU monitoring..."
echo "Emergency kill: pkill -f coder-demo"

# Start monitoring CPU in background
(
  while true; do
    CPU=$(ps aux | grep -E "coder-demo|mcp-fs-bridge|mew-bridge" | grep -v grep | awk '{print $3}' | sort -rn | head -1)
    if [ ! -z "$CPU" ]; then
      echo "Top CPU usage: ${CPU}%"
      # Kill if CPU > 50%
      if (( $(echo "$CPU > 50" | bc -l) )); then
        echo "WARNING: CPU spike detected ($CPU%), killing processes!"
        pkill -f "coder-demo"
        npx pm2 kill
        exit 1
      fi
    fi
    sleep 1
  done
) &
MONITOR_PID=$!

# Clean up monitor on exit
trap "kill $MONITOR_PID 2>/dev/null" EXIT

# Start the space
cd "$(dirname "$0")"
echo "Starting space..."
../../cli/bin/mew.js space up space.yaml

# Wait a bit for stability
sleep 5

# Run the test
echo "Running calculation test..."
node test-calc.js

# Stop the space
echo "Stopping space..."
../../cli/bin/mew.js space down

kill $MONITOR_PID 2>/dev/null
echo "Test complete"