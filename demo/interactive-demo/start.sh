#!/bin/bash

# Interactive Demo Startup Script
# This script starts the demo space with interactive connection

echo "🚀 Starting MEW Interactive Demo Space..."
echo ""
echo "This will start a space with:"
echo "  - Echo agent (repeats your messages)"
echo "  - Calculator agent (MCP tools for math)"
echo "  - Two human participant slots"
echo ""
echo "Press Ctrl+C to exit the interactive session"
echo "Then run 'mew space down' to stop the space"
echo ""
echo "Starting in 2 seconds..."
sleep 2

# Start with interactive mode on port 8090 (in case 8080 is busy)
../../cli/bin/mew.js space up -i --port 8090