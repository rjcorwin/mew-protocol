#!/bin/bash

# MCPx Installation Script
# Installs dependencies for all components

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     MCPx Reference Implementation      ${NC}"
echo -e "${GREEN}         Installation Script            ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js (v18 or higher) from https://nodejs.org"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version is less than 18${NC}"
    echo "Recommended: Node.js v18 or higher"
    echo ""
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}Node.js version:${NC} $(node -v)"
echo -e "${YELLOW}npm version:${NC} $(npm -v)"
echo ""

# Function to install dependencies
install_component() {
    local component=$1
    local name=$2
    
    echo -e "${YELLOW}Installing $name...${NC}"
    
    if [ -d "$component" ]; then
        cd "$component"
        
        # Install dependencies
        if [ -f "package.json" ]; then
            npm install
            
            # Create .env file if it doesn't exist
            if [ ! -f ".env" ] && [ -f ".env.example" ]; then
                cp .env.example .env
                echo -e "${GREEN}✓ Created .env file from .env.example${NC}"
            fi
            
            echo -e "${GREEN}✓ $name installed successfully${NC}"
        else
            echo -e "${RED}✗ No package.json found in $component${NC}"
        fi
        
        cd ..
    else
        echo -e "${RED}✗ Directory $component not found${NC}"
    fi
    
    echo ""
}

# Install server
install_component "server" "Server"

# Install frontend
install_component "frontend" "Frontend"

# Install bridge (optional)
if [ -d "bridge" ]; then
    read -p "Install Bridge CLI tool? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_component "bridge" "Bridge"
    fi
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       Installation Complete!           ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review and update .env files if needed:"
echo "   - server/.env (set JWT_SECRET for production)"
echo "   - frontend/.env (update server URL if needed)"
echo ""
echo "2. Run the services:"
echo "   ./start.sh"
echo ""
echo "3. Run tests:"
echo "   cd server && npm test"
echo ""
echo -e "${GREEN}Ready to start MCPx!${NC}"
