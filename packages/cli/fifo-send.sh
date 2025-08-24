#!/bin/bash
# FIFO Bridge Helper Script
# Usage: ./fifo-send.sh "command"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FIFO_PATH="${SCRIPT_DIR}/.cli-fifos/input.fifo"

if [ ! -p "$FIFO_PATH" ]; then
  echo "Error: FIFO not found at $FIFO_PATH"
  echo "Make sure the bridge is running first"
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Usage: $0 <command>"
  exit 1
fi

echo "$1" > "$FIFO_PATH"
echo "Sent: $1"
