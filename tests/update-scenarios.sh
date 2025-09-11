#!/bin/bash

# Script to update all test scenarios to use HTTP API instead of FIFOs

set -e

SCENARIOS=(
  "scenario-3-proposals"
  "scenario-4-capabilities"
  "scenario-5-reasoning"
  "scenario-6-errors"
  "scenario-7-mcp-bridge"
)

for SCENARIO in "${SCENARIOS[@]}"; do
  echo "Updating $SCENARIO..."
  
  # Update space.yaml - remove fifo: true, keep output_log and auto_connect
  if [ -f "$SCENARIO/space.yaml" ]; then
    sed -i '' '/fifo: true/d' "$SCENARIO/space.yaml" 2>/dev/null || true
    sed -i '' '/fifo: false/d' "$SCENARIO/space.yaml" 2>/dev/null || true
  fi
  
  # Copy setup and teardown scripts from scenario-1
  cp scenario-1-basic/setup.sh "$SCENARIO/setup.sh"
  cp scenario-1-basic/teardown.sh "$SCENARIO/teardown.sh"
  
  # Update scenario name in setup.sh
  case "$SCENARIO" in
    "scenario-3-proposals")
      sed -i '' 's/Scenario: Basic Message Flow/Scenario: MCP Proposals/' "$SCENARIO/setup.sh"
      ;;
    "scenario-4-capabilities")
      sed -i '' 's/Scenario: Basic Message Flow/Scenario: Dynamic Capability Granting/' "$SCENARIO/setup.sh"
      ;;
    "scenario-5-reasoning")
      sed -i '' 's/Scenario: Basic Message Flow/Scenario: Agent Reasoning and Thinking/' "$SCENARIO/setup.sh"
      ;;
    "scenario-6-errors")
      sed -i '' 's/Scenario: Basic Message Flow/Scenario: Error Handling/' "$SCENARIO/setup.sh"
      ;;
    "scenario-7-mcp-bridge")
      sed -i '' 's/Scenario: Basic Message Flow/Scenario: MCP Bridge/' "$SCENARIO/setup.sh"
      ;;
  esac
  
  # Update check.sh to use curl instead of echo to FIFO
  if [ -f "$SCENARIO/check.sh" ]; then
    # Remove FIFO_IN references
    sed -i '' '/export FIFO_IN=/d' "$SCENARIO/check.sh"
    sed -i '' 's/"Input FIFO exists" "\[ -p .*//' "$SCENARIO/check.sh"
    
    # Replace echo to FIFO with curl commands
    # This is complex, so we'll handle each scenario individually
    echo "  Note: check.sh needs manual updates for $SCENARIO"
  fi
done

echo "Done! Scenarios updated to use HTTP API."
echo "Note: You'll need to manually update the check.sh scripts to replace echo > FIFO with curl commands."