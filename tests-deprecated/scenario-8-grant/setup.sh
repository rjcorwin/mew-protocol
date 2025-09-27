#!/bin/bash
set -e

# Setup script for scenario-8-grant
# Can be run standalone for manual debugging

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Setting up scenario-8-grant test space..."

# Clean up any previous runs
rm -f foo.txt bar.txt
rm -rf logs/*.log
mkdir -p logs

# Create FIFOs for human interaction simulation
mkdir -p fifos
rm -f fifos/human-input fifos/human-output
mkfifo fifos/human-input
mkfifo fifos/human-output

# Start the space
echo "Starting MEW space..."
../../cli/bin/mew.js space up -d

# Wait for space to be ready
echo "Waiting for space to be ready..."
sleep 3

# Check space status
../../cli/bin/mew.js space status

echo "Space setup complete!"
echo "Participants should now be running:"
echo "  - test-agent (proposer/requester)"
echo "  - file-server (handles file operations)"
echo ""
echo "To connect as human:"
echo "  ../../cli/bin/mew.js client connect --participant human"