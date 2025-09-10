#!/bin/bash

# MCP Proposal Demo Starter Script
# Run from this demo folder: ./start.sh

set -e

echo "🚀 Starting MCP Proposal Demo..."
echo ""

# Determine the path to the MEW CLI
MEW_CLI="../../cli/bin/mew.js"

# Check if we can find the MEW CLI
if [ ! -f "$MEW_CLI" ]; then
  echo "❌ Error: Cannot find MEW CLI at $MEW_CLI"
  echo "   Please run this script from the demo folder:"
  echo "   cd demos/mcp-proposal"
  echo "   ./start.sh"
  exit 1
fi

# Stop any existing space
echo "📦 Cleaning up any existing space..."
$MEW_CLI space down 2>/dev/null || true

# Start the demo space
echo "🌟 Starting demo space..."
$MEW_CLI space up -c space.yaml

echo ""
echo "✅ Demo space is running!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Connect with the advanced UI (default):"
echo "   $MEW_CLI space connect"
echo ""
echo "2. Or connect with debug mode:"
echo "   $MEW_CLI space connect --debug"
echo ""
echo "3. Once connected, type 'propose' to trigger an MCP proposal"
echo ""
echo "4. To stop the demo:"
echo "   $MEW_CLI space down"
echo ""
echo "💡 Tip: The proposer agent auto-starts with the space and will respond to 'propose' in chat"