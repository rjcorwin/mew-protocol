# Bug Report: Agent Template and Connection Issues

**Date**: 2025-08-22  
**Reporter**: MCPx Development Session  
**Severity**: HIGH  
**Components Affected**: Agent Templates, MCPx CLI, MCPx Studio

## Executive Summary
Multiple critical issues were discovered with agent creation and startup, particularly affecting agents created through MCPx Studio. The primary issue is an infinite connection loop in the basic agent template, along with participant ID mismatches and template mapping problems.

## Issues Identified

### 1. Basic Agent Template Connection Loop (I007)
**Severity**: CRITICAL  
**Status**: Confirmed  

#### Description
Agents using the basic template get stuck in an infinite reconnection loop, continuously attempting to connect to the same topic.

#### Symptoms
- Agent repeatedly logs: `Agent agent-1755768438203 connected to room:general`
- Process consumes resources continuously
- Agent never becomes functional
- Frontend shows agent as connected but agent doesn't respond

#### Reproduction Steps
1. Create agent via Studio with "AI" type (which maps to basic template)
2. Start agent: `mcpx agent start agent-1755843081098`
3. Observe continuous connection messages

#### Observed Output
```
Agent agent-1755768438203 connected to room:general
Agent agent-1755768438203 connected to room:general
Agent agent-1755768438203 connected to room:general
[... repeats indefinitely ...]
```

#### Affected Agents
- agent-1755843081098
- agent-1755843132763
- All agents created with basic template

---

### 2. Agent Participant ID Mismatch (I008)
**Severity**: HIGH  
**Status**: Confirmed  

#### Description
Agents are using incorrect participant IDs during runtime, despite having correct IDs in their configuration files.

#### Evidence
- Config file shows: `"participantId": "agent-1755843081098"`
- Runtime logs show: `Agent agent-1755768438203 connected`
- The ID `agent-1755768438203` appears to be hardcoded somewhere in the template

#### Impact
- Agents cannot be properly identified in topics
- Multiple agents may conflict if using same wrong ID
- Message routing may fail

---

### 3. Agent Auto-Start Failures (I009)
**Severity**: HIGH  
**Status**: Confirmed  

#### Description
Agents created via Studio fail to start automatically when running `mcpx start`.

#### Current State (from `mcpx status`)
```
agent-1755842775458  agent     ●       -      81870  # Running
agent-1755843081098  agent     ○       -      -      # Not running
agent-1755843132763  agent     ○       -      -      # Not running
test-agent-3         agent     ●       -      81880  # Running
test-studio          agent     ●       -      81889  # Running
```

#### Expected Behavior
All enabled agents should start when `mcpx start` is executed.

---

### 4. Template Placeholder Issues (I010)
**Severity**: MEDIUM  
**Status**: Partially Fixed  

#### Description
Some agent templates contain unreplaced placeholders like `{{displayName}}` and `{{agentScript}}`.

#### Affected Templates
- test-agent
- test-basic
- Possibly others

#### Example Config
```json
{
  "participantName": "{{displayName}}",
  "script": "node",
  "args": ["{{agentScript}}"]
}
```

---

### 5. OpenAI Template Mapping Confusion (I011)
**Severity**: MEDIUM  
**Status**: Confirmed  

#### Description
MCPx Studio "AI" agent type is mapped to "openai" template but actually creates agents with basic template configuration.

#### Current Mapping (in AgentWizard.tsx)
```typescript
const templateMap = {
  'AI': 'openai',
  'Claude': 'claude',
  'Basic': 'basic'
};
```

#### Actual Result
- Agent created with basic template configuration
- Missing OpenAI-specific settings
- Agent fails to function as AI agent

---

## Studio UI/UX Issues

### 6. Agent Runtime Status Not Updating (I012)
**Severity**: LOW  
**Status**: Confirmed  

- Studio shows all agents with "Stop" buttons regardless of actual state
- No visual indication of which agents are actually running
- Refresh button doesn't update runtime status

### 7. No Error Feedback (I013, I014)
**Severity**: MEDIUM  
**Status**: Confirmed  

- No user feedback when agent creation partially succeeds but start fails
- No error message when clicking Start on an agent that fails to start
- User left wondering if action succeeded

### 8. Agent List Not Auto-Refreshing (I015)
**Severity**: LOW  
**Status**: Confirmed  

- After creating an agent, list doesn't update automatically
- Manual refresh required to see new agents
- Creates confusion about whether creation succeeded

---

## Root Cause Analysis

### Primary Issues
1. **Template System**: The basic agent template has fundamental issues with connection handling
2. **Configuration Management**: Mismatch between configuration and runtime behavior
3. **Error Handling**: Insufficient error propagation from CLI to Studio

### Contributing Factors
- Templates using hardcoded values instead of configuration
- Lack of validation when agents start
- No health checks for running agents
- Studio backend doesn't properly check agent runtime status

---

## Recommended Fixes

### Immediate (P0)
1. Fix basic agent template connection loop
2. Ensure participant IDs from config are used at runtime
3. Add error handling for agent start failures

### Short-term (P1)
1. Fix template placeholder replacement
2. Implement proper OpenAI template
3. Add agent health checks
4. Improve Studio error feedback

### Long-term (P2)
1. Refactor template system for better extensibility
2. Add agent testing framework
3. Implement agent status monitoring
4. Create template validation system

---

## Workarounds

### For Connection Loop Issue
- Don't use basic template for now
- Use test-agent-3 or test-studio as reference implementations

### For Failed Agent Starts
- Manually start agents: `mcpx agent start <name>`
- Check logs for specific errors
- Verify configuration before starting

### For Studio Issues
- Use CLI commands directly for reliable agent management
- Manually refresh after operations
- Check `mcpx status` for actual system state

---

## Testing Notes

### Working Agents
- agent-1755842775458 (first created, working properly)
- test-agent-3 (reference implementation)
- test-studio (created via CLI)

### Failing Agents
- agent-1755843081098 (connection loop)
- agent-1755843132763 (won't start)
- Most agents with placeholders

---

## Files Involved

### Core Files
- `/Users/rj/Git/rjcorwin/MCPx/agent/src/cli.ts` - Basic agent implementation
- `/Users/rj/Git/rjcorwin/MCPx/agent/src/run-basic-agent.ts` - Basic agent runner
- `/Users/rj/Git/rjcorwin/MCPx/mcpx-cli/src/lib/AgentManager.ts` - Agent management
- `/Users/rj/Git/rjcorwin/MCPx/mcpx-cli/src/commands/agent.ts` - CLI commands

### Studio Files
- `/Users/rj/Git/rjcorwin/MCPx/mcpx-studio/src/renderer/components/AgentWizard.tsx` - Agent creation UI
- `/Users/rj/Git/rjcorwin/MCPx/mcpx-cli/src/commands/studio-server.ts` - Backend API

### Configuration Files
- `~/.mcpx/agents/*/config.json` - Individual agent configurations
- `~/.mcpx/runtime/*.json` - Runtime state files

---

## Session Context

This bug report was compiled during a development session where:
1. Successfully implemented MCPx CLI for unified management
2. Created MCPx Studio desktop application
3. Fixed multiple issues with Studio/CLI integration
4. Discovered these agent template issues during testing

The core MCPx system and Studio are functional, but agent templates need immediate attention to ensure reliable agent operation.