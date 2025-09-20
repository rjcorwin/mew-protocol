#!/bin/bash

# Update Dependencies Script for MEW Protocol Monorepo
# This script updates all dependencies in all packages

set -e

echo "🔄 Updating dependencies for MEW Protocol monorepo..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to update deps in a directory
update_package() {
    local dir=$1
    local name=$(basename "$dir")
    
    if [ -f "$dir/package.json" ]; then
        echo -e "${YELLOW}📦 Updating $name...${NC}"
        cd "$dir"
        
        # Check if there are any dependencies to update
        if npm outdated > /dev/null 2>&1; then
            echo "  Found outdated packages:"
            npm outdated || true
            echo ""
            
            # Update all dependencies
            echo "  Running npm update..."
            npm update
            
            # Also update to latest major versions if --latest flag is passed
            if [ "$LATEST" = "true" ]; then
                echo "  Updating to latest major versions..."
                npx npm-check-updates -u
                npm install
            fi
            
            echo -e "${GREEN}  ✓ Updated $name${NC}"
        else
            echo "  ✓ All dependencies up to date"
        fi
        echo ""
        cd - > /dev/null
    fi
}

# Parse arguments
LATEST=false
if [ "$1" = "--latest" ]; then
    LATEST=true
    echo "⚠️  Running with --latest flag: Will update to latest major versions"
    echo ""
fi

# Start from repo root
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

# FIRST: Ensure workspace links are correct before updating anything
if [ -f "$REPO_ROOT/package.json" ]; then
    echo -e "${YELLOW}🔗 Setting up workspace links...${NC}"
    npm install
    echo -e "${GREEN}✓ Workspace links ready${NC}"
    echo ""
fi

# Update root package if it exists
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 Updating root package...${NC}"
    if [ "$LATEST" = "true" ]; then
        npx npm-check-updates -u
    fi
    npm update
    echo -e "${GREEN}✓ Updated root${NC}"
    echo ""
fi

# Update all SDK packages
echo "🔧 Updating SDK packages..."
for package in sdk/typescript-sdk/*; do
    if [ -d "$package" ]; then
        update_package "$package"
    fi
done

# Update CLI
echo "🔧 Updating CLI..."
update_package "cli"

# Update Bridge
echo "🔧 Updating Bridge..."
update_package "bridge"

# Update Gateway
echo "🔧 Updating Gateway..."
update_package "gateway"

# Update all demo packages
echo "🔧 Updating demos..."
for demo in demos/*; do
    if [ -d "$demo" ] && [ -f "$demo/package.json" ]; then
        update_package "$demo"
    fi
done

# Update eval package
echo "🔧 Updating evals..."
update_package "evals"

# Run npm install again to ensure everything is linked after updates
if [ -f "$REPO_ROOT/package.json" ]; then
    echo -e "${YELLOW}🔗 Refreshing workspace links after updates...${NC}"
    cd "$REPO_ROOT"
    npm install
    echo -e "${GREEN}✓ Workspace links updated${NC}"
    echo ""
    
fi

# Note: We don't build packages during dependency updates
# Building should be done separately after updates are complete

echo -e "${GREEN}✅ All dependencies updated successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the changes with: git diff"
echo "  2. Run tests with: npm test"
echo "  3. Commit changes if everything works"

if [ "$LATEST" = "true" ]; then
    echo ""
    echo "⚠️  Major version updates were applied. Make sure to:"
    echo "  - Check for breaking changes in the changelogs"
    echo "  - Run comprehensive tests"
    echo "  - Update code if APIs have changed"
fi
