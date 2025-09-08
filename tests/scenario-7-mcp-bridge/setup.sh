#!/bin/bash
set -e

# Create test files for MCP server
TEST_DIR="/tmp/mcp-test-files"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

echo "Hello from MCP bridge!" > "$TEST_DIR/hello.txt"
echo "This is a test file" > "$TEST_DIR/test.txt"
mkdir -p "$TEST_DIR/subdir"
echo "File in subdirectory" > "$TEST_DIR/subdir/nested.txt"

echo "Test files created in $TEST_DIR"
ls -la "$TEST_DIR"