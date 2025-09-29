#!/bin/bash
# Test script for HTTP input mechanism
#
# This script demonstrates how to use the new HTTP input feature
# which is more reliable than FIFO for automated agents

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MEW CLI HTTP Input Test ===${NC}"
echo ""

# Configuration
GATEWAY_URL="ws://localhost:8080"
SPACE_NAME="test-space"
HTTP_PORT=9090
TEST_TOKEN="test-token"

echo -e "${BLUE}Configuration:${NC}"
echo "  Gateway: $GATEWAY_URL"
echo "  Space: $SPACE_NAME"
echo "  HTTP Port: $HTTP_PORT"
echo ""

# Function to send message via HTTP
send_message() {
    local message="$1"
    echo -e "${BLUE}Sending message via HTTP...${NC}"
    
    response=$(curl -s -X POST "http://localhost:$HTTP_PORT/message" \
        -H "Content-Type: application/json" \
        -d "$message" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Message sent successfully${NC}"
        echo "  Response: $response"
    else
        echo -e "${YELLOW}✗ Failed to send message${NC}"
        return 1
    fi
}

# Function to check health endpoint
check_health() {
    echo -e "${BLUE}Checking HTTP health endpoint...${NC}"
    
    response=$(curl -s "http://localhost:$HTTP_PORT/health" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ HTTP server is healthy${NC}"
        echo "  Response: $response"
    else
        echo -e "${YELLOW}✗ HTTP server not responding${NC}"
        return 1
    fi
}

# Start the client with HTTP input
echo -e "${YELLOW}Starting MEW client with HTTP input...${NC}"
echo ""

# Start client in background with HTTP input
../bin/mew.js client connect \
    --gateway "$GATEWAY_URL" \
    --space "$SPACE_NAME" \
    --token "$TEST_TOKEN" \
    --http-port "$HTTP_PORT" \
    --no-interactive &

CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"

# Wait for client to start
echo "Waiting for client to connect..."
sleep 3

# Test 1: Check health endpoint
echo ""
echo -e "${YELLOW}Test 1: Health Check${NC}"
check_health

# Test 2: Send a chat message
echo ""
echo -e "${YELLOW}Test 2: Chat Message${NC}"
send_message '{
    "kind": "chat",
    "payload": {
        "text": "Hello from HTTP input test!",
        "format": "plain"
    }
}'

# Test 3: Send an MCP request
echo ""
echo -e "${YELLOW}Test 3: MCP Request${NC}"
send_message '{
    "kind": "mcp/request",
    "to": ["some-agent"],
    "payload": {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }
}'

# Test 4: Send batch messages
echo ""
echo -e "${YELLOW}Test 4: Batch Messages${NC}"
echo -e "${BLUE}Sending batch messages...${NC}"

batch_response=$(curl -s -X POST "http://localhost:$HTTP_PORT/messages" \
    -H "Content-Type: application/json" \
    -d '{
        "messages": [
            {
                "kind": "chat",
                "payload": {
                    "text": "Batch message 1"
                }
            },
            {
                "kind": "chat",
                "payload": {
                    "text": "Batch message 2"
                }
            },
            {
                "kind": "chat",
                "payload": {
                    "text": "Batch message 3"
                }
            }
        ]
    }' 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Batch sent successfully${NC}"
    echo "  Response: $batch_response"
else
    echo -e "${YELLOW}✗ Failed to send batch${NC}"
fi

# Wait a bit to see messages
echo ""
echo "Waiting to observe messages..."
sleep 2

# Cleanup
echo ""
echo -e "${YELLOW}Cleaning up...${NC}"
kill $CLIENT_PID 2>/dev/null || true
wait $CLIENT_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}=== Test Complete ===${NC}"
echo ""
echo "The HTTP input mechanism provides:"
echo "  • Reliable message delivery (no FIFO blocking)"
echo "  • Request/response pattern"
echo "  • Batch message support"
echo "  • Health monitoring"
echo "  • Easy integration with automation tools"
echo ""
echo "Usage example:"
echo "  mew client connect --gateway ws://localhost:8080 --space test --http-port 9090"
echo "  curl -X POST localhost:9090/message -d '{\"kind\":\"chat\",\"payload\":{\"text\":\"Hello\"}}'"