#!/bin/bash
set -e

FIFO_IN="./fifos/test-client-in"
OUTPUT_LOG="./logs/test-client-output.log"

# Function to send MCP request and check response
test_mcp_request() {
  local test_name="$1"
  local request="$2"
  local expected_pattern="$3"
  
  echo ""
  echo "Test: $test_name"
  
  > "$OUTPUT_LOG"
  
  # Send request
  echo "$request" > "$FIFO_IN"
  
  # Wait for response
  sleep 3
  
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
REQUEST_1=$(cat <<EOF
{"protocol": "meup/v0.2","kind": "mcp/request","id": "test-2","from": "test-client","to": ["filesystem"],"payload": {"method": "tools/list","params": {}},"ts": "2025-01-01T00:00:00Z"}
EOF
)

test_mcp_request \
  "List MCP tools" \
  "$REQUEST_1" \
  "tools.*read_file"

RESULT_1=$?

echo "RESULT_1: $RESULT_1"