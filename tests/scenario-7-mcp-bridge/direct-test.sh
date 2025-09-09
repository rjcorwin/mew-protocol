#!/bin/bash
# Direct test without PM2

# Start gateway
PORT=9999
../../cli/bin/meup.js gateway start --port $PORT --space-config ./space.yaml > logs/gateway.log 2>&1 &
GW_PID=$!

sleep 2

# Start bridge
../../bridge/bin/meup-bridge.js \
  --gateway ws://localhost:$PORT \
  --space scenario-7 \
  --participant-id filesystem \
  --token fs-token \
  --mcp-command npx \
  --mcp-args -y,@modelcontextprotocol/server-filesystem,/tmp/mcp-test-files \
  > logs/bridge.log 2>&1 &
BR_PID=$!

sleep 5

# Start test agent
node ./test-agent.js $PORT scenario-7 > logs/test.log 2>&1 &
TEST_PID=$!

sleep 10

echo "=== Bridge Log ==="
tail -30 logs/bridge.log

echo ""
echo "=== Test Log ==="
cat logs/test.log

kill $TEST_PID $BR_PID $GW_PID 2>/dev/null || true
