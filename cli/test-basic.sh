#!/bin/bash

# Basic test of MEUP CLI
# This tests that the gateway starts and accepts connections

set -e

echo "=== MEUP CLI Basic Test ==="

# Configuration
GATEWAY_PORT=18080
TEST_DIR="/tmp/meup-test-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Cleanup function
cleanup() {
  echo "Cleaning up..."
  kill $GATEWAY_PID 2>/dev/null || true
  kill $ECHO_PID 2>/dev/null || true
  kill $CLIENT_PID 2>/dev/null || true
  rm -f test-in test-out
  cd /
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Start gateway
echo "1. Starting gateway..."
node /Users/rj/Git/rjcorwin/mcpx-protocol/cli/bin/meup.js gateway start --port $GATEWAY_PORT --log-level debug > gateway.log 2>&1 &
GATEWAY_PID=$!

# Wait for gateway to be ready
echo "2. Waiting for gateway to start..."
RETRIES=10
while [ $RETRIES -gt 0 ]; do
  if curl -s "http://localhost:$GATEWAY_PORT/health" 2>/dev/null | grep '"status":"ok"' > /dev/null 2>&1; then
    echo "   Gateway is healthy!"
    break
  fi
  RETRIES=$((RETRIES - 1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Gateway health check failed!"
  cat gateway.log
  exit 1
fi

# Start echo agent
echo "3. Starting echo agent..."
node /Users/rj/Git/rjcorwin/mcpx-protocol/cli/bin/meup.js agent start --type echo --gateway ws://localhost:$GATEWAY_PORT --space test-space > echo.log 2>&1 &
ECHO_PID=$!
sleep 1

# Create FIFOs
echo "4. Creating FIFOs..."
mkfifo test-in test-out

# Connect client with FIFOs
echo "5. Connecting client with FIFO..."
node /Users/rj/Git/rjcorwin/mcpx-protocol/cli/bin/meup.js client connect --gateway ws://localhost:$GATEWAY_PORT --space test-space --participant-id test-client --fifo-in test-in --fifo-out test-out > client.log 2>&1 &
CLIENT_PID=$!
sleep 1

# Send test message
echo "6. Sending test chat message..."
# First wait a moment for the welcome message to be processed
sleep 1
echo '{"kind":"chat","payload":{"text":"Hello test"}}' > test-in

# Read response
echo "7. Waiting for echo response..."
# Wait for messages to flow
sleep 2

# Read all available lines from the FIFO (non-blocking)
# Use a background process to read lines  
(
  while IFS= read -r line; do
    echo "$line"
  done < test-out
) > response.txt 2>/dev/null &
READ_PID=$!

# Wait for messages to be processed
sleep 2

# Stop reading
kill $READ_PID 2>/dev/null || true

# Look for echo response in the output
RESPONSE=$(grep '"kind":"chat"' response.txt | grep '"from":"echo-agent"' | head -1 || echo "")
echo "All responses received:"
cat response.txt

if [ -z "$RESPONSE" ]; then
  echo "ERROR: Did not receive echo response!"
  echo "Gateway log:"
  tail -20 gateway.log
  echo "Echo log:"
  tail -20 echo.log  
  echo "Client log:"
  tail -20 client.log
  echo "Test output FIFO content:"
  ls -la test-out 2>/dev/null || echo "test-out does not exist"
  cat test-out 2>/dev/null || echo "Could not read test-out"
  exit 1
fi

# Verify response
echo "8. Verifying response..."
echo "$RESPONSE" | grep '"Echo: Hello test"' > /dev/null || (echo "ERROR: Response does not contain expected echo!" && exit 1)

echo "=== TEST PASSED ==="
echo "Successfully:"
echo "✓ Started gateway"
echo "✓ Started echo agent"
echo "✓ Connected client with FIFO"
echo "✓ Sent chat message"
echo "✓ Received echo response"