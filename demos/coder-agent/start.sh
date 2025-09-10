#!/bin/bash

# Coder Agent Demo Starter Script

set -e

echo "🚀 Starting Coder Agent Demo..."
echo ""

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
  echo "⚠️  Warning: OPENAI_API_KEY not set"
  echo "   The agent will use basic placeholder logic."
  echo "   For full functionality, set your OpenAI API key:"
  echo "   export OPENAI_API_KEY='sk-your-api-key-here'"
  echo ""
fi

# Determine the path to the MEW CLI
MEW_CLI="../../cli/bin/mew.js"

# Check if we can find the MEW CLI
if [ ! -f "$MEW_CLI" ]; then
  echo "❌ Error: Cannot find MEW CLI at $MEW_CLI"
  echo "   Please run this script from the demo folder:"
  echo "   cd demos/coder-agent"
  echo "   ./start.sh"
  exit 1
fi

# Check if MCP filesystem server is installed
if ! npm list -g @modelcontextprotocol/server-filesystem &> /dev/null; then
  echo "📦 Installing MCP filesystem server..."
  npm install -g @modelcontextprotocol/server-filesystem
fi

# Stop any existing space
echo "📦 Cleaning up any existing space..."
$MEW_CLI space down 2>/dev/null || true

# Start the demo space
echo "🌟 Starting demo space..."
$MEW_CLI space up -c space.yaml

echo ""
echo "✅ Coder Agent demo is running!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Connect to the space:"
echo "   $MEW_CLI space connect"
echo ""
echo "2. Try these commands:"
echo "   - 'Look at example.js'"
echo "   - 'Implement the calculateFactorial function'"
echo "   - 'Complete the TodoList class'"
echo "   - 'Create unit tests for the code'"
echo ""
echo "3. Check the workspace/ directory to see file changes"
echo ""
echo "4. To stop the demo:"
echo "   $MEW_CLI space down"
echo ""
echo "💡 The coder agent has access to the workspace/ directory and can read, write, and modify files there."