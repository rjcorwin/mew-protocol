#!/bin/bash
set -e

# Check script for scenario-8-grant
# Verifies that the test completed successfully

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "Checking test results for scenario-8-grant..."

FAILED=0

# Check if foo.txt was created (via proposal fulfillment)
if [ -f "foo.txt" ]; then
    CONTENT=$(cat foo.txt)
    if [ "$CONTENT" = "foo" ]; then
        echo "✅ foo.txt created with correct content: $CONTENT"
    else
        echo "❌ foo.txt has incorrect content: $CONTENT (expected: foo)"
        FAILED=1
    fi
else
    echo "❌ foo.txt was not created (proposal was not fulfilled)"
    FAILED=1
fi

# Check if bar.txt was created (via direct request after grant)
if [ -f "bar.txt" ]; then
    CONTENT=$(cat bar.txt)
    if [ "$CONTENT" = "bar" ]; then
        echo "✅ bar.txt created with correct content: $CONTENT"
    else
        echo "❌ bar.txt has incorrect content: $CONTENT (expected: bar)"
        FAILED=1
    fi
else
    echo "❌ bar.txt was not created (direct request failed or grant not received)"
    FAILED=1
fi

# Check if grant was received by checking agent logs
if [ -f "logs/agent.log" ]; then
    if grep -q "RECEIVED CAPABILITY GRANT" logs/agent.log; then
        echo "✅ Agent received capability grant"
    else
        echo "❌ Agent did not receive capability grant"
        FAILED=1
    fi

    if grep -q "Sending PROPOSAL" logs/agent.log; then
        echo "✅ Agent sent proposal for foo.txt"
    else
        echo "❌ Agent did not send proposal"
        FAILED=1
    fi

    if grep -q "Sending DIRECT REQUEST" logs/agent.log; then
        echo "✅ Agent sent direct request for bar.txt"
    else
        echo "❌ Agent did not send direct request"
        FAILED=1
    fi
else
    echo "⚠️  Warning: agent.log not found"
fi

# Check file server logs
if [ -f "logs/file-server.log" ]; then
    if grep -q "Successfully wrote foo.txt" logs/file-server.log; then
        echo "✅ File server processed foo.txt request"
    else
        echo "❌ File server did not process foo.txt request"
        FAILED=1
    fi

    if grep -q "Successfully wrote bar.txt" logs/file-server.log; then
        echo "✅ File server processed bar.txt request"
    else
        echo "❌ File server did not process bar.txt request"
        FAILED=1
    fi
else
    echo "⚠️  Warning: file-server.log not found"
fi

# Check for capability violations (there should be none after grant)
if [ -f "logs/agent.log" ]; then
    if grep -q "capability_violation" logs/agent.log; then
        # Check if violation was before or after grant
        if grep -A1 "RECEIVED CAPABILITY GRANT" logs/agent.log | grep -q "capability_violation"; then
            echo "❌ Agent received capability violation AFTER grant"
            FAILED=1
        else
            echo "ℹ️  Agent received capability violation before grant (expected)"
        fi
    fi
fi

echo ""
echo "========================================="
if [ $FAILED -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED!"
    echo "The capability grant workflow is working correctly:"
    echo "1. Agent proposed to write foo.txt"
    echo "2. Human fulfilled and granted capability"
    echo "3. Agent directly wrote bar.txt without proposal"
    exit 0
else
    echo "❌ TEST FAILED!"
    echo "Some checks did not pass. Review the output above."
    exit 1
fi