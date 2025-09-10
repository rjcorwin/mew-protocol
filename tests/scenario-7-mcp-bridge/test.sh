#!/bin/bash
set -e

echo "=== Scenario 7: MCP Bridge Test (FIFO) ==="

# Clean up any previous runs
../../cli/bin/meup.js space clean --all --force 2>/dev/null || true

# Setup test files
mkdir -p /tmp/mcp-test-files
echo "Test content" > /tmp/mcp-test-files/test.txt
echo "Hello MCP" > /tmp/mcp-test-files/hello.txt
mkdir -p /tmp/mcp-test-files/subdir
echo "Nested file" > /tmp/mcp-test-files/subdir/nested.txt

echo "Test files created in /tmp/mcp-test-files"
ls -la /tmp/mcp-test-files

# Clean up logs
rm -rf logs
mkdir -p logs

# Start space with random port
PORT=$((9700 + RANDOM % 100))
echo "Starting space on port $PORT..."
../../cli/bin/meup.js space up --port $PORT > logs/space-up.log 2>&1

# Wait for MCP bridge to initialize
echo "Waiting for MCP bridge to initialize..."
sleep 5

# Check that space is running
if ! ../../cli/bin/meup.js space status | grep -q "Gateway: ws://localhost:$PORT"; then
  echo "✗ Space failed to start"
  cat logs/space-up.log
  exit 1
fi

# Get the FIFO path
FIFO_IN="./fifos/test-client-in"
OUTPUT_LOG="./logs/test-client-output.log"

# Check that FIFO exists
if [ ! -p "$FIFO_IN" ]; then
  echo "✗ FIFO not created at $FIFO_IN"
  exit 1
fi

echo "FIFO ready at: $FIFO_IN"
echo "Output log at: $OUTPUT_LOG"

# Function to send MCP request and check response
test_mcp_request() {
  local test_name="$1"
  local request="$2"
  local expected_pattern="$3"
  
  echo ""
  echo "Test: $test_name"
  
  # Clear output log
  > "$OUTPUT_LOG"
  
  # Send request (non-blocking with subshell)
  echo "Sending request to FIFO..." >&2
  (echo "$request" > "$FIFO_IN" &)
  echo "Request sent" >&2
  
  # Wait for response
  sleep 5
  
  # Check for response
  if grep -q "$expected_pattern" "$OUTPUT_LOG" 2>/dev/null; then
    echo "✓ $test_name passed"
    return 0
  else
    echo "✗ $test_name failed"
    echo "Expected pattern: $expected_pattern"
    echo "Output log contents:"
    cat "$OUTPUT_LOG"
    return 1
  fi
}

# Test 1: List MCP tools
REQUEST_1='{"protocol":"mew/v0.2","kind":"mcp/request","id":"test-1","from":"test-client","to":["filesystem"],"payload":{"method":"tools/list","params":{}},"ts":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}'

test_mcp_request \
  "List MCP tools" \
  "$REQUEST_1" \
  "tools.*read_file"

RESULT_1=$?

# Small delay between tests
sleep 1

# Test 2: List tools again to verify connection
REQUEST_2='{"protocol":"mew/v0.2","kind":"mcp/request","id":"test-2","from":"test-client","to":["filesystem"],"payload":{"method":"tools/list","params":{}},"ts":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}'

test_mcp_request \
  "List tools again" \
  "$REQUEST_2" \
  "read_text_file"

RESULT_2=$?

# Small delay between tests
sleep 1

# Test 3: Read a file
REQUEST_3='{"protocol":"mew/v0.2","kind":"mcp/request","id":"test-3","from":"test-client","to":["filesystem"],"payload":{"method":"tools/call","params":{"name":"read_text_file","arguments":{"path":"/private/tmp/mcp-test-files/test.txt"}}},"ts":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}'

test_mcp_request \
  "Read file via MCP" \
  "$REQUEST_3" \
  "Test content"

RESULT_3=$?

# Calculate total result
TOTAL_RESULT=$((RESULT_1 + RESULT_2 + RESULT_3))

# Always clean up
echo ""
echo "Stopping space..."
../../cli/bin/meup.js space down
rm -rf /tmp/mcp-test-files

if [ $TOTAL_RESULT -eq 0 ]; then
  echo ""
  echo "✓ Scenario 7: MCP Bridge test PASSED"
  exit 0
else
  echo ""
  echo "✗ Scenario 7: MCP Bridge test FAILED"
  echo "Check logs for details:"
  echo "  - logs/gateway.log"
  echo "  - logs/filesystem-bridge.log"
  echo "  - logs/test-client-output.log"
  exit 1
fi