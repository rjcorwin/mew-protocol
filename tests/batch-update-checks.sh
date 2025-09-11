#!/bin/bash

# Batch update all check.sh files to use HTTP API

echo "Updating scenario 5 check.sh..."
if [ -f "scenario-5-reasoning/check.sh" ]; then
  # Update scenario 5
  sed -i '' 's|echo .* > "\$FIFO_IN"|curl -sf -X POST "http://localhost:$TEST_PORT/participants/research-agent/messages" -H "Authorization: Bearer research-token" -H "Content-Type: application/json" -d|g' scenario-5-reasoning/check.sh
  sed -i '' '/export FIFO_IN=/d' scenario-5-reasoning/check.sh
  sed -i '' 's/Input FIFO exists/Output log exists/g' scenario-5-reasoning/check.sh
  sed -i '' 's/\[ -p .*/\[ -f "$OUTPUT_LOG" \]/g' scenario-5-reasoning/check.sh
fi

echo "Updating scenario 6 check.sh..."
if [ -f "scenario-6-errors/check.sh" ]; then
  # Update scenario 6
  sed -i '' 's|echo .* > "\$FIFO_IN"|curl -sf -X POST "http://localhost:$TEST_PORT/participants/test-client/messages" -H "Authorization: Bearer test-token" -H "Content-Type: application/json" -d|g' scenario-6-errors/check.sh
  sed -i '' '/export FIFO_IN=/d' scenario-6-errors/check.sh
  sed -i '' 's/Input FIFO exists/Output log exists/g' scenario-6-errors/check.sh
  sed -i '' 's/\[ -p .*/\[ -f "$OUTPUT_LOG" \]/g' scenario-6-errors/check.sh
fi

echo "Done!"