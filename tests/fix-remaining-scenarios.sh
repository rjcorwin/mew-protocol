#!/bin/bash

echo "Fixing scenario 6 check.sh..."

# Fix scenario 6
sed -i '' 's|TEST_FIFO="${TEST_FIFO:-./fifos/test-client-in}"|OUTPUT_LOG="${OUTPUT_LOG:-./logs/test-client-output.log}"|' scenario-6-errors/check.sh
sed -i '' 's|TEST_LOG="${TEST_LOG:-./logs/test-client-output.log}"|OUTPUT_LOG="${OUTPUT_LOG:-./logs/test-client-output.log}"|' scenario-6-errors/check.sh
sed -i '' 's|echo "Testing: Test client FIFO exists.*|echo "Testing: Output log exists ... \\c"|' scenario-6-errors/check.sh
sed -i '' 's|check_test "" "\[ -f "$OUTPUT_LOG" \]|check_test "" "[ -f '"'"'$OUTPUT_LOG'"'"' ]"|' scenario-6-errors/check.sh
sed -i '' '/echo "Testing: Output log exists/,+1d' scenario-6-errors/check.sh

# Replace all echo > FIFO with curl commands in scenario 6
sed -i '' 's|(echo .* > "$TEST_FIFO" &)|curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" -H "Authorization: Bearer test-token" -H "Content-Type: application/json" -d|g' scenario-6-errors/check.sh

# Fix the curl commands - they need the JSON after -d
sed -i '' "s|curl.*-d\$|& '{}' > /dev/null|" scenario-6-errors/check.sh

echo "Scenarios updated!"