# Bug Report: Published Agent Package Not Writing Files

## Summary
The published npm package `@mew-protocol/mew/agent@0.3.0` used in the CLI template is not functioning correctly. While it emits reasoning messages, it fails to actually execute tool calls to write files, unlike the local development version used in demos.

## Steps to Reproduce

1. **Create a test directory and initialize with coder-agent template:**
```bash
mkdir /tmp/test-mew-bug && cd /tmp/test-mew-bug
/path/to/mew-protocol/packages/mew/src/bin/mew.js init coder-agent --name test-bug --port 8090
```

2. **Start the gateway with space configuration:**
```bash
/path/to/mew-protocol/packages/mew/src/bin/mew.js gateway start --port 8090 --space-config .mew/space.yaml
```

3. **Send a request to create a file:**
```bash
curl -X POST 'http://localhost:8090/participants/human/messages?space=test-bug' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "to": ["coder-agent"],
    "kind": "chat",
    "payload": {
      "text": "create hello.txt with content: Hello World"
    }
  }'
```

4. **Check if file was created:**
```bash
ls -la hello.txt
# Result: File not found
```

5. **Check logs to see agent behavior:**
```bash
# Check gateway logs for reasoning messages
grep "reasoning" logs/gateway.log

# Check PM2 logs for agent activity
npx pm2 logs coder-agent --lines 50 --nostream
```

## Test Environment
- **Location**: `/tmp/mew-test-verify/`
- **Template**: `coder-agent` from `/cli/templates/coder-agent/`
- **Gateway**: Port 8090
- **Package Version**: @mew-protocol/mew/agent@0.3.0 (published to npm)

## Expected Behavior (from demos/coder-agent)
When asked to "create foo.txt with foo", the agent should:
1. Emit `reasoning/start`
2. Emit `reasoning/thought` with reasoning about the task
3. Send `mcp/request` (or `mcp/proposal` if lacking capability) to call `write_file`
4. Receive response from MCP bridge
5. Emit final `reasoning/thought` with completion
6. Send `chat` response summarizing what was done
7. Emit `reasoning/conclusion`
8. **Actually create the file on disk**

## Actual Behavior (template with npm package)
When asked to "create hello.txt with content: Hello World", the agent:
1. ✅ Emits `reasoning/start`
2. ✅ Emits `reasoning/thought`
3. ❌ Does NOT send `mcp/request` or `mcp/proposal`
4. ❌ Does NOT attempt to call any tools
5. ✅ Sends `chat` response (but just acknowledges understanding)
6. ✅ Emits `reasoning/conclusion`
7. ❌ **File is NOT created**

## Evidence

### Gateway Logs Show Reasoning Messages ARE Sent
```
[GATEWAY DEBUG] Broadcasting reasoning/start from coder-agent to all 2 participants
[GATEWAY DEBUG] Broadcasting reasoning/thought from coder-agent to all 2 participants
[GATEWAY DEBUG] Broadcasting chat from coder-agent to all 2 participants
[GATEWAY DEBUG] Broadcasting reasoning/conclusion from coder-agent to all 2 participants
```

### But No Tool Calls or Proposals
- No `mcp/proposal` messages in logs
- No `mcp/request` for `tools/call`
- No attempt to write files
- File `/tmp/mew-test-verify/hello.txt` was never created

### Agent Configuration Shows Reasoning IS Enabled
```json
"MEW_AGENT_CONFIG": {
  "reasoningEnabled": true,
  "maxIterations": 100,
  "systemPrompt": "You are a coding assistant that WRITES FILES TO DISK..."
}
```

### Agent Has Necessary Capabilities
- ✅ Has `reasoning/*` capability (line 26 in space.yaml)
- ✅ Has `mcp/proposal` capability
- ✅ Has `mcp/request` for read operations
- ❌ Does NOT have `mcp/request` for `tools/call` with write_file (must use proposals)

## Root Cause Analysis

### SOLVED: Config Path Resolution Bug in CLI

**Root Cause**: When `loadSpaceConfig()` found a config in `.mew/space.yaml`, it returned the resolved path but the CLI wasn't using it. This caused the gateway to receive the wrong config path (e.g., `space.yaml` instead of `.mew/space.yaml`), breaking relative path resolution and environment variable handling.

**The Bug** (in `cli/src/commands/space.js`):
```javascript
// Line 352 - BEFORE (buggy):
const { config } = loadSpaceConfig(configPath);  // Ignores returned configPath!

// Line 352-354 - AFTER (fixed):
const { config, configPath: actualConfigPath } = loadSpaceConfig(configPath);
// Update configPath to the actual resolved path
configPath = actualConfigPath;
```

**Why this caused the issue**:
- `loadSpaceConfig()` checks `.mew/space.yaml` first, then falls back to `space.yaml`
- It returns both the config AND the actual path it loaded from
- But the code was ignoring the returned path and passing the original path to the gateway
- This caused the gateway to look for the config in the wrong location
- Environment variables and relative paths weren't resolved correctly

### Additional Fixes Applied

1. **Environment variable substitution**:
   - Added `resolveEnvVariables()` function at line 251 to substitute `${VAR_NAME}` syntax
   - Applied to participant env at line 547 and 572

2. **MCP cwd path resolution**:
   - Modified CLI to resolve relative `--mcp-cwd` paths to absolute paths (line 479-486)

3. **Missing OPENAI_API_KEY**:
   - Updated templates to explicitly include `OPENAI_API_KEY: "${OPENAI_API_KEY}"`
   - Removed misleading comment about automatic inheritance

## Key Differences Between Demo and Template

| Aspect | Demo (Working) | Template (Broken) |
|--------|---------------|-------------------|
| Agent Binary | Local: `node ../../packages/mew/dist/agent/index.js` | NPM: `npx @mew-protocol/mew/agent` |
| Version | Development (current source) | Published 0.3.0 |
| YOLO Mode | Enabled (can call tools directly) | Disabled (must use proposals) |
| File Writing | ✅ Works | ❌ Doesn't attempt |
| Reasoning Display | ✅ Shows in UI | ❌ Sent but not displayed properly |

## Recommended Investigation Path

### 1. Compare Source vs Published
```bash
# Check what's actually in the published package
npm pack @mew-protocol/mew/agent@0.3.0
tar -xzf mew-protocol-agent-0.3.0.tgz
diff -r package/dist /Users/rj/Git/rjcorwin/mew-protocol/packages/mew/dist/agent
```

### 2. Test Local vs Published Directly
```bash
# Test with local version
node /Users/rj/Git/rjcorwin/mew-protocol/packages/mew/dist/agent/index.js \
  --gateway ws://localhost:8090 --space test-verify --token test-token

# Test with published version
npx @mew-protocol/mew/agent@0.3.0 \
  --gateway ws://localhost:8090 --space test-verify --token test-token
```

### 3. Check Build Process
- Review `/packages/mew/src/agent/tsconfig.json`
- Check if all files are included in the build
- Verify the `dist/` output matches expectations

### 4. Debug the ReAct Loop
Add logging to trace where the loop breaks:
- After reasoning phase completes
- Before action selection
- During tool discovery
- When checking capabilities

## Key Files to Review

### Core Agent Implementation
1. `/packages/mew/src/agent/MEWAgent.ts`
   - Lines 206-223: Reasoning emission logic
   - Lines 376-378: Thought processing
   - `processWithReAct()` method: Main ReAct loop
   - `emitReasoning()` method (line 927): How reasoning messages are sent

2. `/packages/mew/src/agent/index.ts`
   - Entry point for the agent
   - Configuration parsing
   - Tool registration

### Build Configuration
3. `/packages/mew/src/agent/package.json`
   - Build scripts
   - Dependencies
   - Files included in package

4. `/packages/mew/src/agent/tsconfig.json`
   - TypeScript compilation settings
   - Output configuration

### Capability System
5. `/packages/mew/src/capability-matcher/`
   - How capabilities are evaluated
   - Pattern matching logic

### Template Configuration
6. `/cli/templates/coder-agent/space.yaml`
   - Agent capabilities configuration
   - Environment variables (MEW_AGENT_CONFIG)

7. `/cli/templates/coder-agent/package.json`
   - Dependencies and versions

## Immediate Workarounds

### Option 1: Enable YOLO Mode
Uncomment lines 32-35 in template's space.yaml to give agent direct tool access:
```yaml
- kind: "mcp/request"
  payload:
    method: "tools/call"
```

### Option 2: Use Local Development Version
Change the agent command in space.yaml:
```yaml
command: "node"
args: ["/path/to/packages/mew/dist/agent/index.js", ...]
```

### Option 3: Add Auto-fulfiller
Enable the auto-fulfiller in the demo to automatically approve proposals.

## Next Steps

1. **Rebuild and republish** the agent package with debug logging
2. **Test proposal generation** - Check if agent creates proposals when it lacks direct capability
3. **Verify tool discovery** - Ensure agent is finding MCP bridge tools
4. **Compare runtime behavior** - Run both versions with identical configs
5. **Check for missing files** in published package

## Additional Context

The MCP filesystem bridge IS working correctly:
- Successfully registered 14 tools
- Correctly uses the space directory as working directory
- Can write files when called directly via curl

The issue is specifically with the agent not attempting to use these tools, suggesting the problem is in the agent's ReAct loop or tool orchestration logic.