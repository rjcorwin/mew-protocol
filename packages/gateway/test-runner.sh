#!/bin/bash

# Gateway Test Runner Script
# This script ensures reproducible test runs for the gateway package

set -e

echo "🧹 Cleaning up existing processes..."

# Kill any existing Node processes on port 3000
lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true

# Kill any existing vitest processes
pkill -f vitest 2>/dev/null || true

echo "✅ Cleanup complete"
echo ""
echo "🧪 Running Gateway Tests..."
echo ""

# Run the tests
npm test

echo ""
echo "✨ Test run complete!"