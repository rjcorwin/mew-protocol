#!/bin/bash

# MCPx Start Script
# Starts the server and frontend services

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SERVER_ONLY=false
FRONTEND_ONLY=false
PRODUCTION=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_ONLY=true
            shift
            ;;
        --frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        --production)
            PRODUCTION=true
            shift
            ;;
        --help)
            echo "MCPx Start Script"
            echo ""
            echo "Usage: ./start.sh [options]"
            echo ""
            echo "Options:"
            echo "  --server      Start only the server"
            echo "  --frontend    Start only the frontend"
            echo "  --production  Run in production mode"
            echo "  --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./start.sh                  # Start both in development mode"
            echo "  ./start.sh --server         # Start only server"
            echo "  ./start.sh --production     # Start both in production mode"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     MCPx Reference Implementation      ${NC}"
echo -e "${GREEN}           Starting Services            ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if dependencies are installed
check_dependencies() {
    local component=$1
    
    if [ ! -d "$component/node_modules" ]; then
        echo -e "${YELLOW}Dependencies not installed for $component${NC}"
        echo "Run ./install.sh first"
        exit 1
    fi
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    
    # Kill all child processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Wait a moment for processes to terminate
    sleep 1
    
    # Force kill if needed
    jobs -p | xargs -r kill -9 2>/dev/null || true
    
    echo -e "${GREEN}Services stopped${NC}"
    exit 0
}

# Set up trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Function to start a service
start_service() {
    local service_dir=$1
    local service_name=$2
    local command=$3
    local port=$4
    
    check_dependencies "$service_dir"
    
    echo -e "${YELLOW}Starting $service_name...${NC}"
    
    cd "$service_dir"
    
    # Start the service in background
    if [ "$PRODUCTION" = true ]; then
        npm run build 2>&1 | sed "s/^/[$service_name] /" &
        wait $!
        npm start 2>&1 | sed "s/^/[$service_name] /" &
    else
        npm run dev 2>&1 | sed "s/^/[$service_name] /" &
    fi
    
    local pid=$!
    cd ..
    
    # Wait for service to start
    sleep 2
    
    # Check if service is running
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✓ $service_name started on port $port (PID: $pid)${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to start $service_name${NC}"
        return 1
    fi
}

# Start services based on flags
if [ "$FRONTEND_ONLY" = true ]; then
    start_service "frontend" "Frontend" "dev" "3001"
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Frontend is running at:${NC}"
    echo -e "${BLUE}http://localhost:3001${NC}"
    echo -e "${GREEN}========================================${NC}"
elif [ "$SERVER_ONLY" = true ]; then
    start_service "server" "Server" "dev" "3000"
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Server is running at:${NC}"
    echo -e "${BLUE}http://localhost:3000${NC}"
    echo -e "${GREEN}WebSocket endpoint:${NC}"
    echo -e "${BLUE}ws://localhost:3000/v0/ws${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    # Start both services
    echo -e "${YELLOW}Starting Server and Frontend...${NC}"
    echo ""
    
    # Start server first
    if ! start_service "server" "Server" "dev" "3000"; then
        echo -e "${RED}Failed to start server, aborting${NC}"
        exit 1
    fi
    
    echo ""
    
    # Then start frontend
    if ! start_service "frontend" "Frontend" "dev" "3001"; then
        echo -e "${RED}Failed to start frontend${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}      All services running!             ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${GREEN}Frontend:${NC} ${BLUE}http://localhost:3001${NC}"
    echo -e "${GREEN}Server:${NC}   ${BLUE}http://localhost:3000${NC}"
    echo -e "${GREEN}WebSocket:${NC} ${BLUE}ws://localhost:3000/v0/ws${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
fi

echo ""

# Keep script running
while true; do
    sleep 1
done