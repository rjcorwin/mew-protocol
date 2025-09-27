#!/bin/bash
# Main test runner for Scenario 7: MCP Bridge Test

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Scenario 7: MCP Bridge Test (HTTP) ===${NC}"
echo -e "${BLUE}Testing MCP server integration via bridge using HTTP API${NC}"

# Get directory of this script
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$TEST_DIR"

# Clean up any previous runs
./teardown.sh 2>/dev/null || true

# Setup test files in local test directory
TEST_FILES_DIR="$TEST_DIR/test-files"
mkdir -p "$TEST_FILES_DIR"
echo "Test content" > "$TEST_FILES_DIR/test.txt"
echo "Hello MCP" > "$TEST_FILES_DIR/hello.txt"
mkdir -p "$TEST_FILES_DIR/subdir"
echo "Nested file" > "$TEST_FILES_DIR/subdir/nested.txt"

echo "Test files created in $TEST_FILES_DIR"
ls -la "$TEST_FILES_DIR"

# Generate random port
export TEST_PORT=$((9700 + RANDOM % 100))

# Run setup with the port
echo -e "\n${YELLOW}Step 1: Setting up space...${NC}"
./setup.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Setup failed${NC}"
  exit 1
fi

# Export the paths that tests need
export OUTPUT_LOG="$TEST_DIR/logs/test-client-output.log"

# Wait for MCP bridge to fully initialize
echo -e "\n${YELLOW}Step 2: Waiting for MCP bridge to initialize...${NC}"
sleep 10

# Function to send MCP request via HTTP and check response
test_mcp_request() {
  local test_name="$1"
  local request="$2"
  local expected_pattern="$3"
  
  echo ""
  echo "Test: $test_name"
  
  # Clear output log
  > "$OUTPUT_LOG"
  
  # Start monitoring output
  tail -f "$OUTPUT_LOG" > /tmp/mcp-response.txt &
  TAIL_PID=$!
  
  # Send request via HTTP API
  echo "Sending request via HTTP API..."
  curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" \
    -H "Authorization: Bearer test-token" \
    -H "Content-Type: application/json" \
    -d "$request" > /dev/null
  
  # Wait for response
  sleep 5
  
  # Stop monitoring
  kill $TAIL_PID 2>/dev/null || true
  
  # Check for response
  if grep -q "$expected_pattern" /tmp/mcp-response.txt 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $test_name passed"
    return 0
  else
    echo -e "${RED}✗${NC} $test_name failed"
    echo "Expected pattern: $expected_pattern"
    echo "Response received:"
    cat /tmp/mcp-response.txt
    return 1
  fi
}

echo -e "\n${YELLOW}Step 3: Running MCP bridge tests...${NC}"

# Test 1: List MCP tools
REQUEST_1='{
  "kind": "mcp/request",
  "id": "test-1",
  "to": ["filesystem"],
  "payload": {
    "method": "tools/list",
    "params": {}
  }
}'

test_mcp_request \
  "List MCP tools" \
  "$REQUEST_1" \
  "read_file"

RESULT_1=$?

# Test 2: Read a file via MCP
REQUEST_2=$(cat <<EOF
{
  "kind": "mcp/request",
  "id": "test-2",
  "to": ["filesystem"],
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {
        "path": "$TEST_FILES_DIR/test.txt"
      }
    }
  }
}
EOF
)

test_mcp_request \
  "Read file via MCP" \
  "$REQUEST_2" \
  "Test content"

RESULT_2=$?

# Test 3: List directory via MCP
REQUEST_3=$(cat <<EOF
{
  "kind": "mcp/request",
  "id": "test-3",
  "to": ["filesystem"],
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "list_directory",
      "arguments": {
        "path": "$TEST_FILES_DIR"
      }
    }
  }
}
EOF
)

test_mcp_request \
  "List directory via MCP" \
  "$REQUEST_3" \
  "hello.txt"

RESULT_3=$?

# Calculate total result
TOTAL_RESULT=$((RESULT_1 + RESULT_2 + RESULT_3))

if [ $TOTAL_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ Scenario 7 PASSED${NC}"
else
  echo -e "\n${RED}✗ Scenario 7 FAILED${NC}"
fi

# Cleanup
echo -e "\nCleaning up..."
./teardown.sh
# Test files will be cleaned up by teardown.sh

exit $TOTAL_RESULT