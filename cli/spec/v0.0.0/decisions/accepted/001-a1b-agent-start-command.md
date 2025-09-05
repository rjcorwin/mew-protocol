# ADR-a1b: Agent Start Command

**Status:** Accepted  
**Date:** 2025-01-05  
**Incorporation:** Complete

## Context

The CLI specification includes a `meup agent start` command for starting agents. The TEST_PLAN.md currently uses this command with a `--type` flag to start built-in agents (echo, calculator, fulfiller).

However, MEUP agents are just programs that connect to a gateway WebSocket. They can be:
- Started directly as executables with appropriate arguments
- Started via space.yaml configuration with `command` and `auto_start` fields
- Started through a CLI wrapper command

We need to decide whether the `meup agent start` command adds value or unnecessary complexity.

## Options Considered

### Option 1: Remove Agent Start Command

No `meup agent start` command. Agents are started either:
- Directly as executables: `node ./agents/echo.js --gateway ws://localhost:8080`
- Via space.yaml with auto_start

**Pros:**
- Simplest approach - no unnecessary abstraction
- Agents are just programs, no special handling
- One less command to maintain
- Clear separation: manual execution vs declarative config

**Cons:**
- TEST_PLAN.md needs updates
- Users must know how to run their agents
- No convenience wrapper for common options

### Option 2: Keep Agent Start with Path

Keep `meup agent start <path>` as a convenience wrapper.

**Pros:**
- Provides standard way to start agents
- Can add common options/defaults
- Easier for users who don't know agent requirements

**Cons:**
- Adds a layer of abstraction
- Premature optimization - may not be needed
- Another command to maintain and document

### Option 3: Keep Agent Start with Types (Current)

Keep `meup agent start --type echo|calculator|fulfiller`.

**Pros:**
- Simple for built-in test agents
- TEST_PLAN.md stays unchanged

**Cons:**
- Limited to built-in agents only
- Can't test custom agents
- Inconsistent with "agents are just programs" principle

## Decision

**Recommended: Option 1 - Remove Agent Start Command**

Remove the `meup agent start` command entirely. Agents are just programs that should be started directly or via space.yaml configuration.

### Implementation Details

1. **Direct execution for manual testing:**
   ```bash
   # Start agent directly (agent handles its own args)
   node ./agents/echo.js --gateway ws://localhost:8080 --token echo-token
   
   # Or with compiled executable
   ./agents/calculator --gateway ws://localhost:8080 --space test-space
   
   # Python agent
   python ./agents/custom.py --gateway ws://localhost:8080
   ```

2. **Space.yaml for declarative configuration:**
   ```yaml
   participants:
     echo-agent:
       command: "node"
       args: ["./agents/echo.js", "--gateway", "ws://localhost:8080"]
       auto_start: true
       tokens: ["echo-token"]
     
     calculator:
       command: "./agents/calculator"  
       args: ["--gateway", "ws://localhost:8080"]
       auto_start: true
       tokens: ["calc-token"]
   ```

3. **Provide example agents with standard CLI interface:**
   ```
   agents/
   ├── echo.js          # Example echo agent
   ├── calculator.js    # Example calculator agent  
   ├── fulfiller.js     # Example fulfiller agent
   └── README.md        # How to write agents
   ```
   
   Each agent is responsible for its own argument parsing:
   ```javascript
   // agents/echo.js
   const args = parseArgs(process.argv);
   const gateway = args.gateway || 'ws://localhost:8080';
   const token = args.token || 'echo-token';
   ```

4. **Update TEST_PLAN.md to use direct execution:**
   ```bash
   # Old way (remove this)
   meup agent start --type echo --gateway ws://localhost:8080
   
   # New way
   node ./agents/echo.js --gateway ws://localhost:8080
   ```

## Consequences

### Positive
- Simplest possible approach - no premature optimization
- Agents are just programs, no special treatment needed
- No abstraction layer to maintain
- Clear separation: direct execution vs space.yaml config
- Consistent with Unix philosophy (do one thing well)
- Agents can be written in any language

### Negative
- TEST_PLAN.md needs updates to use direct execution
- Users need to know how to run their agents (node, python, etc.)
- No convenience wrapper for common options
- Each agent must handle its own argument parsing

### Mitigation
- Provide well-documented example agents with standard CLI
- Update TEST_PLAN.md with new commands
- Document common patterns for agent argument handling
- Consider adding `meup agent start` later if proven necessary