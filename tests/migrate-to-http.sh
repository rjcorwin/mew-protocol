#!/bin/bash
# Comprehensive migration script to update all test scenarios from FIFO to HTTP

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Migrating Test Scenarios to HTTP Input ===${NC}"
echo ""

# Define scenarios and their HTTP ports
# Using a different approach for compatibility
SCENARIOS="scenario-2-mcp:9092 scenario-3-proposals:9093 scenario-4-capabilities:9094 scenario-5-reasoning:9095 scenario-6-errors:9096 scenario-7-mcp-bridge:9097"

# Function to update space.yaml
update_space_yaml() {
    local scenario="$1"
    local port="$2"
    local file="$scenario/space.yaml"
    
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}Skipping $file (not found)${NC}"
        return
    fi
    
    echo "Updating $file..."
    
    # Replace fifo: true with http_port
    sed -i.bak \
        -e "s/fifo: true.*$/http_port: $port  # Use HTTP input instead of FIFO/" \
        "$file"
    
    echo -e "${GREEN}✓ Updated $file${NC}"
}

# Function to update setup.sh
update_setup_sh() {
    local scenario="$1"
    local port="$2"
    local file="$scenario/setup.sh"
    
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}Skipping $file (not found)${NC}"
        return
    fi
    
    echo "Updating $file..."
    
    # Create temporary file with updates
    cat > "${file}.new" << 'EOF'
#!/bin/bash
# Setup script - Initializes the test space
#
# Can be run standalone for manual testing or called by test.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# If TEST_DIR not set, we're running standalone
if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

EOF
    
    # Get the scenario name from the original file
    local scenario_name=$(grep -o "Scenario:.*" "$file" | head -1 | cut -d: -f2- | sed 's/^ *//')
    
    cat >> "${file}.new" << EOF
echo -e "\${YELLOW}=== Setting up Test Space ===\${NC}"
echo -e "\${BLUE}Scenario: $scenario_name\${NC}"
echo -e "\${BLUE}Directory: \$TEST_DIR\${NC}"
echo ""

cd "\$TEST_DIR"

# Clean up any previous runs
echo "Cleaning up previous test artifacts..."
../../cli/bin/mew.js space clean --all --force 2>/dev/null || true

# Use random port to avoid conflicts
if [ -z "\$TEST_PORT" ]; then
  export TEST_PORT=\$((8000 + RANDOM % 1000))
fi

echo "Starting space on port \$TEST_PORT..."

# Ensure logs directory exists
mkdir -p ./logs

# Start the space using mew space up
../../cli/bin/mew.js space up --port "\$TEST_PORT" > ./logs/space-up.log 2>&1

# Check if space started successfully
if ../../cli/bin/mew.js space status | grep -q "Gateway: ws://localhost:\$TEST_PORT"; then
  echo -e "\${GREEN}✓ Space started successfully\${NC}"
else
  echo -e "\${RED}✗ Space failed to start\${NC}"
  cat ./logs/space-up.log
  exit 1
fi

# Wait for all components to be ready
echo "Waiting for components to initialize..."
sleep 3

# Export paths for check.sh to use
export HTTP_PORT="$port"  # Port configured in space.yaml
export OUTPUT_LOG="\$TEST_DIR/logs/test-client-output.log"

# Wait a bit for HTTP server to start
sleep 2

# Verify HTTP endpoint is available
if curl -sf "http://localhost:\$HTTP_PORT/health" > /dev/null 2>&1; then
  echo -e "\${GREEN}✓ HTTP input server is ready\${NC}"
else
  echo -e "\${YELLOW}⚠ HTTP server may still be starting\${NC}"
fi

echo -e "\${GREEN}✓ Setup complete\${NC}"
echo ""
echo "Gateway running on: ws://localhost:\$TEST_PORT"
echo "Test client I/O:"
echo "  HTTP Input: http://localhost:\$HTTP_PORT/message"
echo "  Output Log: \$OUTPUT_LOG"
echo ""
echo "You can now:"
echo "  - Run tests with: ./check.sh"
echo "  - Send messages: curl -X POST localhost:\$HTTP_PORT/message -H 'Content-Type: application/json' -d '{\"kind\":\"chat\",\"payload\":{\"text\":\"Hello\"}}'"
echo "  - Read responses: tail -f \$OUTPUT_LOG"

# Set flag for check.sh
export SPACE_RUNNING=true
EOF
    
    chmod +x "${file}.new"
    mv "${file}.new" "$file"
    
    echo -e "${GREEN}✓ Updated $file${NC}"
}

# Function to update test.sh
update_test_sh() {
    local scenario="$1"
    local port="$2"
    local file="$scenario/test.sh"
    
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}Skipping $file (not found)${NC}"
        return
    fi
    
    echo "Updating $file..."
    
    # Update the export statements
    sed -i.bak \
        -e "s|export FIFO_IN=.*|export HTTP_PORT=\"$port\"  # Port configured in space.yaml|" \
        "$file"
    
    echo -e "${GREEN}✓ Updated $file${NC}"
}

# Process each scenario
for entry in $SCENARIOS; do
    scenario="${entry%%:*}"
    port="${entry##*:}"
    
    echo ""
    echo -e "${BLUE}Processing $scenario (HTTP port: $port)${NC}"
    echo "----------------------------------------"
    
    update_space_yaml "$scenario" "$port"
    update_setup_sh "$scenario" "$port"
    update_test_sh "$scenario" "$port"
done

echo ""
echo -e "${GREEN}=== Migration Complete ===${NC}"
echo ""
echo "Note: check.sh files still need manual updates for their specific test logic"
echo "Use the following pattern to update echo commands to curl:"
echo '  echo '"'"'{"kind":"chat","payload":{"text":"Hello"}}'"'"' > "$FIFO_IN"'
echo "  becomes:"
echo '  curl -sf -X POST "http://localhost:$HTTP_PORT/message" \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"kind":"chat","payload":{"text":"Hello"}}'"'"' > /dev/null'