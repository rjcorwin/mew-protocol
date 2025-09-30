#!/bin/bash
# mew-send.sh - Safe message sending helper for MEW CLI
#
# This script provides a reliable way to send messages to a MEW client,
# trying HTTP first (most reliable) and falling back to FIFO if needed.
#
# Usage:
#   mew-send.sh '{"kind":"chat","payload":{"text":"Hello"}}'
#   
# Environment variables:
#   MEW_HTTP_PORT - HTTP port to use (default: 9090)
#   MEW_FIFO_PATH - FIFO path to use as fallback

set -e

# Configuration from environment with defaults
HTTP_PORT="${MEW_HTTP_PORT:-9090}"
HTTP_HOST="${MEW_HTTP_HOST:-localhost}"
FIFO_PATH="${MEW_FIFO_PATH:-}"
VERBOSE="${MEW_VERBOSE:-false}"

# Get the message from arguments
MESSAGE="$1"

if [ -z "$MESSAGE" ]; then
    echo "Usage: $0 <json-message>" >&2
    echo "Example: $0 '{\"kind\":\"chat\",\"payload\":{\"text\":\"Hello\"}}'" >&2
    exit 1
fi

# Logging function
log() {
    if [ "$VERBOSE" = "true" ]; then
        echo "[mew-send] $1" >&2
    fi
}

# Try HTTP first (most reliable)
log "Trying HTTP at http://$HTTP_HOST:$HTTP_PORT/message"
if curl -sf -X POST "http://$HTTP_HOST:$HTTP_PORT/message" \
    -H "Content-Type: application/json" \
    -d "$MESSAGE" 2>/dev/null; then
    log "✓ Message sent via HTTP"
    exit 0
fi
log "HTTP failed or not available"

# Fallback to FIFO if available and exists
if [ -n "$FIFO_PATH" ] && [ -p "$FIFO_PATH" ]; then
    log "Trying FIFO at $FIFO_PATH"
    if timeout 1 bash -c "echo '$MESSAGE' > '$FIFO_PATH'" 2>/dev/null; then
        log "✓ Message sent via FIFO"
        exit 0
    fi
    log "FIFO write failed or timed out"
fi

# If we get here, all methods failed
echo "Failed to send message - no available input method" >&2
echo "Ensure either:" >&2
echo "  1. HTTP server is running (start client with --http-port)" >&2
echo "  2. FIFO exists and MEW_FIFO_PATH is set" >&2
exit 1