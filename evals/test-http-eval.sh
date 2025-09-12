#!/bin/bash

# Simple HTTP-based evaluation test for the coder agent

echo "=========================================="
echo "MEW Protocol Coder Agent Evaluation Test"
echo "=========================================="

# Test 1: Create a simple file
echo -e "\n📋 Test 1: Create a simple text file"
echo "Sending request to coder-agent..."

curl -sf -X POST "http://localhost:8080/participants/human/messages" \
  -H "Authorization: Bearer human-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "chat",
    "to": ["coder-agent"],
    "payload": {
      "text": "Please create a file called test.txt with the content: Hello from the evaluation test!"
    }
  }'

echo -e "\n✅ Request sent"
echo "Waiting for agent to process..."
sleep 5

# Test 2: Create a todo app
echo -e "\n📋 Test 2: Create todo list HTML app"
echo "Sending request to coder-agent..."

curl -sf -X POST "http://localhost:8080/participants/human/messages" \
  -H "Authorization: Bearer human-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "chat",
    "to": ["coder-agent"],
    "payload": {
      "text": "Please create a todo list HTML app as todo.html with: 1) input field for new todos, 2) add button, 3) list of todos, 4) checkboxes to mark complete, 5) delete buttons, 6) embedded CSS and JavaScript"
    }
  }'

echo -e "\n✅ Request sent"
echo "Waiting for agent to process..."
sleep 8

# Test 3: Modify the file
echo -e "\n📋 Test 3: Change background color"
echo "Sending request to coder-agent..."

curl -sf -X POST "http://localhost:8080/participants/human/messages" \
  -H "Authorization: Bearer human-token" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "chat",
    "to": ["coder-agent"],
    "payload": {
      "text": "Please read todo.html and change the background color to light blue (#e3f2fd)"
    }
  }'

echo -e "\n✅ Request sent"
echo "Waiting for agent to process..."
sleep 8

# Check the files created in workspace
echo -e "\n📁 Checking workspace files:"
ls -la /Users/rj/Git/rjcorwin/mew-protocol/demos/coder-agent/workspace/

echo -e "\n=========================================="
echo "✅ Evaluation test completed!"
echo "Check the workspace directory for created files"
echo "Check PM2 logs for agent activity: npx pm2 logs coder-agent"
echo "=========================================="