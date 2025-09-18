#!/bin/bash
# Check script for Scenario 12 - SDK Streams

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$TEST_DIR" ]; then
  export TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

cd "$TEST_DIR"

CONSUMER_LOG="./logs/sdk-consumer.log"

if [ ! -f "$CONSUMER_LOG" ]; then
  echo -e "${RED}✗ Consumer log not found${NC}"
  exit 1
fi

# Wait for record event (max 20 seconds)
ATTEMPTS=20
while ! grep -q '"event":"record"' "$CONSUMER_LOG"; do
  if [ $ATTEMPTS -le 0 ]; then
    echo -e "${RED}✗ Did not observe record event in consumer log${NC}"
    exit 1
  fi
  ATTEMPTS=$((ATTEMPTS-1))
  sleep 1
done

STREAM_ID=$(jq -r 'select(.event=="ready") | .stream.stream_id' "$CONSUMER_LOG" | head -n 1)
if [ -z "$STREAM_ID" ] || [ "$STREAM_ID" = "null" ]; then
  echo -e "${RED}✗ Failed to capture stream/ready event${NC}"
  exit 1
fi

NAMESPACE=$(jq -r --arg stream "$STREAM_ID" 'select(.event=="ready" and .stream.stream_id==$stream) | .stream.namespace' "$CONSUMER_LOG" | head -n 1)
if [[ -z "$NAMESPACE" || "$NAMESPACE" = "null" ]]; then
  echo -e "${RED}✗ Namespace missing in stream/ready${NC}"
  exit 1
fi

if [[ "$NAMESPACE" != "sdk-streams-space/"* ]]; then
  echo -e "${RED}✗ Namespace $NAMESPACE does not follow expected format${NC}"
  exit 1
fi

SEQUENCE_STREAM=$(jq -r --arg stream "$STREAM_ID" 'select(.event=="data" and .stream.stream_id==$stream) | .sequence' "$CONSUMER_LOG" | sort -n)
SEQ_COUNT=$(echo "$SEQUENCE_STREAM" | awk 'NF' | wc -l | tr -d ' ')
if [ -z "$SEQ_COUNT" ]; then SEQ_COUNT=0; fi

if [ "$SEQ_COUNT" -lt 2 ]; then
  echo -e "${RED}✗ Unexpected stream/data sequences: insufficient count ($SEQ_COUNT)${NC}"
  exit 1
fi

SEQ1=$(echo "$SEQUENCE_STREAM" | awk 'NF{print $0; exit}')
SEQ2=$(echo "$SEQUENCE_STREAM" | awk 'NF{if (++c==2){print $0; exit}}')

if [ "$SEQ1" != "1" ] || [ "$SEQ2" != "2" ]; then
  echo -e "${RED}✗ Unexpected stream/data sequences: $SEQ1 $SEQ2${NC}"
  exit 1
fi

STATUS=$(jq -r --arg stream "$STREAM_ID" 'select(.event=="record" and .record.stream_id==$stream) | .record.status' "$CONSUMER_LOG" | head -n 1)
if [ "$STATUS" != "complete" ]; then
  echo -e "${RED}✗ Expected stream status complete, found $STATUS${NC}"
  exit 1
fi

LAST_SEQUENCE=$(jq -r --arg stream "$STREAM_ID" 'select(.event=="record" and .record.stream_id==$stream) | .record.lastSequence' "$CONSUMER_LOG" | head -n 1)
if [ "$LAST_SEQUENCE" != "2" ]; then
  echo -e "${RED}✗ Expected lastSequence 2, found $LAST_SEQUENCE${NC}"
  exit 1
fi

FORMAT_ID=$(jq -r --arg stream "$STREAM_ID" 'select(.event=="record" and .record.stream_id==$stream) | .record.formats[0].id' "$CONSUMER_LOG" | head -n 1)
if [ "$FORMAT_ID" != "llm/tokens" ]; then
  echo -e "${RED}✗ Expected first format id llm/tokens, found $FORMAT_ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ SDK stream scenario validated${NC}"
