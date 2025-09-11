#!/bin/bash
# Script to update all check.sh files to use HTTP/curl instead of FIFO

# This script will update check.sh files across all test scenarios
# to use HTTP/curl instead of echo to FIFO

set -e

# Function to update a check.sh file
update_check_file() {
    local file="$1"
    local http_port="$2"
    
    echo "Updating $file to use HTTP port $http_port..."
    
    # Create a temporary file
    local temp_file="${file}.tmp"
    
    # Read the file and perform replacements
    sed -E \
        -e "s|export FIFO_IN=\"[^\"]+\"|export HTTP_PORT=\"$http_port\"|g" \
        -e "s|\\[ -p '\\\$FIFO_IN' \\]|curl -sf http://localhost:\$HTTP_PORT/health | grep -q 'ok'|g" \
        -e "s|\"Input FIFO exists\"|\"HTTP endpoint is available\"|g" \
        -e "s|\\(echo '([^']+)' > \"\\\$FIFO_IN\" &\\)|curl -sf -X POST \"http://localhost:\$HTTP_PORT/message\" -H \"Content-Type: application/json\" -d '\\1' > /dev/null|g" \
        -e "s|echo '([^']+)' > \"\\\$FIFO_IN\"|curl -sf -X POST \"http://localhost:\$HTTP_PORT/message\" -H \"Content-Type: application/json\" -d '\\1' > /dev/null|g" \
        "$file" > "$temp_file"
    
    # Move temp file to original
    mv "$temp_file" "$file"
    
    echo "✓ Updated $file"
}

# Update all scenario check.sh files with their respective ports
update_check_file "scenario-2-mcp/check.sh" "9092"
update_check_file "scenario-3-proposals/check.sh" "9093"
update_check_file "scenario-4-capabilities/check.sh" "9094"
update_check_file "scenario-5-reasoning/check.sh" "9095"
update_check_file "scenario-6-errors/check.sh" "9096"
update_check_file "scenario-7-mcp-bridge/check.sh" "9097"

echo ""
echo "✓ All check.sh files updated to use HTTP/curl"
echo ""
echo "Note: You'll also need to update:"
echo "  1. Each space.yaml to use http_port instead of fifo"
echo "  2. Each setup.sh to export HTTP_PORT instead of FIFO_IN"
echo "  3. Each test.sh to export HTTP_PORT"