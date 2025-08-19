#!/bin/bash

# MCPx Stop Script
# Stops running MCPx services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping MCPx services...${NC}"

# Kill processes on common ports
kill_port() {
    local port=$1
    local name=$2
    
    # Find process using the port
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Stopping $name on port $port (PID: $pid)...${NC}"
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
        echo -e "${GREEN}✓ $name stopped${NC}"
    else
        echo -e "${YELLOW}No $name process found on port $port${NC}"
    fi
}

# Stop server on port 3000
kill_port 3000 "Server"

# Stop frontend on port 3001
kill_port 3001 "Frontend"

# Also try to kill any npm/node processes related to MCPx
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo -e "${GREEN}All MCPx services stopped${NC}"