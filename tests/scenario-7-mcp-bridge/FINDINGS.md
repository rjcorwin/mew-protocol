# Scenario 7 MCP Bridge Test - Investigation Findings

## Issue
The MCP Bridge test (scenario 7) times out when sending MCP requests to the filesystem bridge participant.

## Root Cause IDENTIFIED ✅
The gateway is not applying the correct capabilities to the MCP bridge participant. The bridge only receives `"chat"` capability instead of the configured `"mcp/response"` and `"chat"` capabilities from space.yaml.

## Investigation Findings

### 1. Bridge Initialization ✅
- The MCP bridge successfully starts and connects to the gateway
- The MCP server (filesystem server) initializes correctly
- The bridge successfully discovers and registers 14 tools from the MCP server
- Tools are properly registered with the MEWParticipant base class

### 2. Message Routing ✅
- Test client successfully sends MCP requests to the filesystem participant
- Messages are properly routed through the gateway
- The gateway accepts and forwards the messages

### 3. Message Reception ❌
**The issue is a capability mismatch:**
- Bridge logs show it only has `{"kind": "chat"}` capability
- Space.yaml configures `{"kind": "mcp/response"}` and `{"kind": "chat"}`
- MEWParticipant filters messages based on capabilities
- Since bridge lacks "mcp/response", it never receives MCP requests

### 4. Capability Configuration Issue ❌
- Space.yaml correctly specifies capabilities
- But gateway only assigns "chat" capability to the bridge
- This prevents the bridge from receiving MCP requests

## Technical Details

### Expected Flow:
1. test-client sends `mcp/request` with method `tools/list` to filesystem
2. filesystem bridge receives the message via MEWParticipant's message handler
3. MEWParticipant's `handleMCPRequest` processes the request
4. MEWParticipant's `handleToolsList` returns the registered tools
5. Response is sent back to test-client

### Actual Flow:
1. test-client sends `mcp/request` ✅
2. Gateway routes message ✅
3. **Bridge doesn't process the message** ❌
4. No response is generated
5. Test times out waiting for response

## Problems Fixed During Investigation

1. **Bridge startup sequence** (Fixed ✅)
   - Changed `mew-bridge.js` to call `bridge.start()` instead of `bridge.connect()`
   - Ensures proper initialization sequence

2. **Race condition** (Fixed ✅)
   - Moved MCP server initialization from constructor to `start()` method
   - Ensures MCP server is ready before connecting to gateway

3. **Test directory missing** (Fixed ✅)
   - MCP filesystem server requires `/tmp/mcp-test-files` to exist
   - Added creation of test files in test script

## Remaining Issue

**Gateway capability assignment for MCP bridges:**
- The gateway is not correctly reading and applying capabilities from space.yaml for MCP bridge participants
- This is likely an issue in the CLI's space management code where it launches bridge processes
- The bridge gets a hardcoded/default capability set instead of the configured one

## Evidence

Bridge logs clearly show the capability mismatch:
```json
Bridge: Participant info: {
  "id": "filesystem",
  "capabilities": [
    {"kind": "chat"}  // Should also have {"kind": "mcp/response"}
  ]
}
```

## Test Results Summary
- Tests 1-6: ✅ All passing
- Test 7: ❌ Failing due to capability assignment issue

The MCP bridge implementation is correct. The issue is with how the gateway assigns capabilities to bridge participants.