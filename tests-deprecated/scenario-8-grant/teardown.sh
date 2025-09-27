#!/bin/bash

# Teardown script for scenario-8-grant
# Can be run standalone for manual cleanup

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Tearing down scenario-8-grant test space..."

# Stop the space
../../cli/bin/mew.js space down 2>/dev/null || true

# Kill any lingering processes
pkill -f "scenario-8-grant" 2>/dev/null || true

# Clean up FIFOs
rm -f fifos/human-input fifos/human-output 2>/dev/null || true

# Clean up test files (optional, comment out to preserve for inspection)
# rm -f foo.txt bar.txt

echo "Teardown complete!"