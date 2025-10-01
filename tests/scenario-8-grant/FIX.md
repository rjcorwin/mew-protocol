# Scenario 8-grant - Partial Test Failures

## Status
⚠️ Refactor complete, 14/16 tests passing

## Refactor Changes Completed
- ✅ Updated teardown.sh to use global `mew` command
- ✅ All other files were already correct
- ✅ Kept package.json (has `ws` dependency)

## Test Results
**14/16 tests passing** (2 failures)

### Passing Tests ✓
- Gateway health endpoint
- Proposal delivered to test-client
- Extract proposal details
- Capability grant sent
- Fulfill proposal via tools/call
- Gateway logged capability grant
- Fulfilment routed to file-server
- foo.txt created via fulfillment
- Agent observed capability grant
- Agent issued direct request
- File server handled write requests
- Grant acknowledgment originates from recipient
- Gateway recorded grant acknowledgment
- Gateway did not forge grant acknowledgment

### Failing Tests ✗
1. **bar.txt created via direct request** - File not created when agent makes direct request after receiving capability grant
2. **Gateway logged direct request envelope** - Gateway doesn't log the direct request envelope

## Issue Analysis
After a capability is granted to an agent, the agent should be able to make direct requests using the granted capability. The test shows:
1. Capability grant is sent and acknowledged correctly ✓
2. Agent observes the grant ✓
3. Agent issues a direct request ✓
4. **But the direct request doesn't result in the expected file creation** ✗
5. **And the gateway doesn't log the direct request envelope** ✗

## Likely Cause
The capability grant flow works, but there may be an issue with:
- Direct request routing after capability grant
- Capability enforcement/validation for granted capabilities
- Request envelope creation or logging for granted capabilities

## Next Steps
1. Debug agent direct request after receiving grant
2. Check gateway capability enforcement logic
3. Verify envelope creation for requests using granted capabilities
4. Review gateway logging for granted capability requests

## Note
The refactor changes are complete and correct. The 2 test failures appear to be functional issues with the capability grant implementation, not related to the repository restructuring.
