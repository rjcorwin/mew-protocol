#!/bin/bash

# Test all updated scenarios

echo "Testing all scenarios with HTTP API..."
echo "=================================="

PASSED=0
FAILED=0

for i in 1 2 3 4 5 6 7; do
  dir="scenario-${i}-*"
  name=$(ls -d $dir 2>/dev/null | head -1)
  
  if [ -d "$name" ]; then
    echo ""
    echo "Testing $name..."
    cd "$name"
    
    # Run test with timeout
    timeout 45 ./test.sh > /tmp/test-output.txt 2>&1
    result=$?
    
    # Check result
    if grep -q "Scenario.*PASSED" /tmp/test-output.txt; then
      echo "✅ $name: PASSED"
      ((PASSED++))
    elif grep -q "Scenario.*FAILED" /tmp/test-output.txt; then
      echo "❌ $name: FAILED"
      tail -20 /tmp/test-output.txt | grep -E "✗|failed|error" || true
      ((FAILED++))
    elif [ $result -eq 124 ]; then
      echo "⏱️  $name: TIMEOUT"
      ((FAILED++))
    else
      echo "❓ $name: UNKNOWN (exit code: $result)"
      ((FAILED++))
    fi
    
    # Always cleanup
    ./teardown.sh 2>/dev/null || true
    cd ..
  fi
done

echo ""
echo "=================================="
echo "Summary: $PASSED passed, $FAILED failed"

if [ $FAILED -eq 0 ]; then
  echo "🎉 All scenarios passed!"
  exit 0
else
  echo "❌ Some scenarios failed or timed out"
  exit 1
fi