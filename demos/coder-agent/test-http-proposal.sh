#!/bin/bash

# Test if proposals include the 'to' field when addressed

echo "Testing proposal addressing via HTTP..."

# Send a chat message to the coder agent asking it to list files
echo "Sending chat message to coder-agent..."
RESPONSE=$(curl -sf -X POST "http://localhost:8080/participants/human/messages" \
  -H "Authorization: Bearer human-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "chat",
    "to": ["coder-agent"],
    "payload": {
      "text": "Can you list the files in the workspace directory?"
    }
  }')

echo "Sent chat message, waiting for agent to process..."
sleep 3

# Check agent's output log for proposals
echo ""
echo "Checking for proposals in logs..."

# Use the MEW CLI to check messages
../../cli/bin/mew.js client connect \
  --gateway ws://localhost:8080 \
  --space coder-demo \
  --token monitor-token \
  --participant-id monitor &
MONITOR_PID=$!

sleep 2

# Send another request to trigger more activity
curl -sf -X POST "http://localhost:8080/participants/monitor/messages" \
  -H "Authorization: Bearer monitor-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "chat", 
    "payload": {"text": "Monitoring proposals..."}
  }' > /dev/null

sleep 3

# Kill monitor
kill $MONITOR_PID 2>/dev/null

# Check PM2 logs for the proposal
echo ""
echo "Checking PM2 logs for proposals..."
npx pm2 logs coder-agent --lines 100 --nostream | grep -A5 "mcp/proposal" || true

echo ""
echo "Test complete. Check above for proposals with 'to' field."