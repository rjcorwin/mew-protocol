#!/bin/bash
# Check script for Scenario 11 - Stream Handshake

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

LOG_FILE="./logs/observer.log"

if [ ! -f "$LOG_FILE" ]; then
  echo -e "${RED}✗ Observer log not found${NC}"
  exit 1
fi

# Wait for stream/complete to appear (max 20 seconds)
ATTEMPTS=20
while ! grep -q '"stream/complete"' "$LOG_FILE"; do
  if [ $ATTEMPTS -le 0 ]; then
    break
  fi
  ATTEMPTS=$((ATTEMPTS-1))
  sleep 1
done

if ! grep -q '"stream/complete"' "$LOG_FILE"; then
  echo -e "${RED}✗ stream/complete not observed within timeout${NC}"
  exit 1
fi

STREAM_ID=$(jq -r 'select(.kind=="stream/ready" and .payload.stream.creator=="streamer") | .payload.stream.stream_id' "$LOG_FILE" | head -n 1)
if [ -z "$STREAM_ID" ] || [ "$STREAM_ID" = "null" ]; then
  echo -e "${RED}✗ stream/ready for streamer not found${NC}"
  exit 1
fi

echo "Discovered stream id: $STREAM_ID"

NAMESPACE=$(jq -r --arg stream "$STREAM_ID" 'select(.kind=="stream/ready" and .payload.stream.stream_id==$stream) | .payload.stream.namespace' "$LOG_FILE" | head -n 1)
if [ -z "$NAMESPACE" ] || [ "$NAMESPACE" = "null" ]; then
  echo -e "${RED}✗ stream namespace missing in stream/ready${NC}"
  exit 1
fi

if [[ "$NAMESPACE" != "streams-space/"* ]]; then
  echo -e "${RED}✗ Namespace $NAMESPACE does not start with streams-space/${NC}"
  exit 1
fi

declare -a SEQUENCES
SEQUENCE_STREAM=$(jq -r --arg stream "$STREAM_ID" 'select(.kind=="stream/data" and .payload.stream.stream_id==$stream) | .payload.sequence' "$LOG_FILE" | sort -n)
SEQ_COUNT=$(echo "$SEQUENCE_STREAM" | awk 'NF' | wc -l | tr -d ' ')
if [ -z "$SEQ_COUNT" ]; then SEQ_COUNT=0; fi

if [ "$SEQ_COUNT" -lt 2 ]; then
  echo -e "${RED}✗ Expected at least two stream/data packets, found $SEQ_COUNT${NC}"
  exit 1
fi

SEQ1=$(echo "$SEQUENCE_STREAM" | awk 'NF{print $0; exit}')
SEQ2=$(echo "$SEQUENCE_STREAM" | awk 'NF{if (++c==2){print $0; exit}}')

if [ "$SEQ1" != "1" ] || [ "$SEQ2" != "2" ]; then
  echo -e "${RED}✗ Expected sequences 1 and 2, found: $SEQ1 $SEQ2${NC}"
  exit 1
fi

INVALID_CONTEXT=$(jq -r --arg stream "$STREAM_ID" 'select(.kind=="stream/data" and .payload.stream.stream_id==$stream and .context != .payload.stream.namespace) | .id' "$LOG_FILE" | head -n 1)
if [ -n "$INVALID_CONTEXT" ] && [ "$INVALID_CONTEXT" != "null" ]; then
  echo -e "${RED}✗ stream/data message had incorrect context (message id $INVALID_CONTEXT)${NC}"
  exit 1
fi

FORMAT_ID=$(jq -r --arg stream "$STREAM_ID" 'select(.kind=="stream/ready" and .payload.stream.stream_id==$stream) | .payload.stream.formats[0].id' "$LOG_FILE" | head -n 1)
if [ "$FORMAT_ID" != "llm/tokens" ]; then
  echo -e "${RED}✗ Expected format id llm/tokens, found $FORMAT_ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Stream handshake validated${NC}"
