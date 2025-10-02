# ADR-int: Interactive Connection Command

**Status:** Accepted  
**Date:** 2025-01-10  
**Incorporation:** Complete

## Context

Currently, connecting to a MEW space requires either:
1. Using FIFOs for automation (complex setup, blocking issues)
2. Writing a custom client application
3. Using the test-interactive.js script (not part of CLI)

Developers need a simple, built-in way to connect to a space interactively for:
- Debugging protocol interactions
- Testing agent responses
- Exploring space capabilities
- Quick manual testing during development

The current `mew space up` command starts the space but doesn't provide an interactive connection. Users must use separate commands or tools to actually interact with the space.

## Options Considered

### Option 1: Add `--interactive` flag to `mew space up`

Modify the existing command to optionally connect interactively:
```bash
mew space up --interactive
mew space up -i  # shorthand
```

**Pros:**
- Natural workflow: start space and immediately connect
- Single command for common use case
- Reuses existing participant resolution logic
- Minimal new API surface

**Cons:**
- Mixes two concerns (starting space vs connecting)
- What happens if space is already running?
- Unclear how to connect to existing space

### Option 2: New `mew space connect` command

Create a dedicated command for interactive connection:
```bash
mew space connect                  # Connect to current space
mew space connect --participant alice
mew space connect --space-dir ../other-space
```

**Pros:**
- Clear separation of concerns
- Can connect to any running space
- More flexible connection options
- Follows pattern of other tools (docker exec, kubectl exec)

**Cons:**
- Additional command to learn
- Requires space to be already running

### Option 3: Extend `mew client connect` with interactive mode

Make the existing client command interactive by default:
```bash
mew client connect --gateway ws://localhost:8080 --space test
# If no --fifo flags, runs interactively
```

**Pros:**
- Builds on existing command
- Already has connection logic
- Natural extension of current functionality

**Cons:**
- Requires manual specification of gateway/space/token
- Doesn't leverage space.yaml configuration
- More complex for simple "just connect me" use case

### Option 4: Both `--interactive` flag and `connect` command

Implement both approaches for maximum flexibility:
```bash
mew space up -i                    # Start and connect
mew space connect                  # Connect to running space
```

**Pros:**
- Covers all use cases optimally
- Natural workflow for both scenarios
- Progressive disclosure of complexity

**Cons:**
- More implementation work
- Potential confusion about which to use

## Decision

Implement **Option 4: Both `--interactive` flag and `connect` command**.

This provides the best user experience for both common workflows:
1. Starting fresh: `mew space up -i`
2. Connecting to existing: `mew space connect`

### Implementation Details

#### `mew space up --interactive`

Extends the existing command:
```bash
mew space up [options]

Options:
  --space-config <path>     Path to space.yaml (default: ./space.yaml)
  --port <port>            Gateway port (default: from config or 8080)
  --participant <id>       Connect as this participant
  --interactive, -i        Connect interactively after starting space
  --detach, -d            Run in background (incompatible with -i)
```

Behavior:
1. Start the space normally (gateway, agents)
2. If `-i` flag is present:
   - Resolve participant (same logic as current)
   - Connect interactively to the space
   - Show interactive prompt
3. If `-d` flag is present:
   - Start space in background
   - Exit immediately (current behavior)
4. If neither flag:
   - Current behavior (start and exit)

#### `mew space connect`

New command for connecting to running spaces:
```bash
mew space connect [options]

Options:
  --space-config <path>     Path to space.yaml (default: ./space.yaml)
  --participant <id>       Connect as this participant
  --space-dir <path>       Directory of space to connect to (default: .)
  --gateway <url>          Override gateway URL (default: from running space)
```

Behavior:
1. Check if space is running in current/specified directory
2. Load space configuration
3. Resolve participant (same logic as `space up`)
4. Connect interactively
5. Show interactive prompt

Error handling:
- If space not running: "No running space found. Use 'mew space up' first."
- If no participant resolved: "No participant found. Specify with --participant"
- If connection fails: Show helpful error with gateway URL

#### Participant Resolution (shared logic)

Both commands use the same participant resolution:
1. Explicit `--participant <id>` flag
2. Space config `default_participant` field
3. Single human participant (no `command` field)
4. Interactive selection from human participants
5. System username match
6. Error if none found

#### Interactive Mode Override

When in interactive mode, certain participant configurations are overridden:
- `fifo: true` → Ignored (use interactive terminal instead)
- `output_log` → Ignored (output to terminal)
- `auto_connect` → Ignored (we're manually connecting)

The interactive connection always uses:
- Terminal input (stdin)
- Terminal output (stdout)
- Readline-based interface

## Consequences

### Positive
- Natural workflow for development and debugging
- No need for FIFOs or external tools
- Leverages existing space configuration
- Simple commands for common tasks
- Can connect/reconnect without restarting space

### Negative
- Two ways to achieve similar outcome (potential confusion)
- Additional command increases API surface
- Need to maintain interactive terminal code

### Security Considerations
- Interactive mode uses participant tokens from space.yaml
- No additional authentication beyond token
- Terminal history may contain sensitive commands

## Migration Path

1. **Phase 1**: Implement shared participant resolution logic
2. **Phase 2**: Add `--interactive` flag to `space up`
3. **Phase 3**: Implement `space connect` command
4. **Phase 4**: Deprecate test-interactive.js script

## Examples

### Development Workflow
```bash
# Start fresh and connect immediately
mew space up -i

# In another terminal, connect as different participant
mew space connect --participant admin

# Connect to space in another directory
mew space connect --space-dir ../other-project
```

### Testing Workflow
```bash
# Start space in background
mew space up -d

# Run automated tests...

# Connect to debug issue
mew space connect --participant debugger

# Clean up
mew space down
```

### Configuration Example
```yaml
# space.yaml
space:
  id: dev-space
  default_participant: developer  # Used by interactive connection

participants:
  developer:
    tokens: ["dev-token"]
    capabilities:
      - kind: "*"  # Full access for debugging
    # No fifo or output_log - these are for automation
    
  test-client:
    tokens: ["test-token"]
    fifo: true  # Only used in non-interactive mode
    output_log: "./logs/test.log"
```

## Future Enhancements

1. **Connection management**:
   - `mew space connect --list` - Show available participants
   - `mew space connect --reconnect` - Reconnect after disconnect

2. **Multiple interactive sessions**:
   - Allow multiple terminals to connect as different participants
   - Show participant ID in prompt

3. **Output modes**:
   - `--json` - Output raw protocol messages
   - `--pretty` - Enhanced formatting
   - `--quiet` - Suppress system messages