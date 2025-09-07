# ADR-003: Simple FIFO Input with Log Output

**Status:** Proposed  
**Date:** 2025-01-07  
**Incorporation:** Not Incorporated

## Context

The current FIFO implementation in `meup space` has revealed a critical blocking issue that prevents test automation:

1. **Blocking Problem**: When `auto_connect: true` is set with `fifo: true`, the client connects and writes to the output FIFO. If nothing is reading from it, the process blocks indefinitely, hanging the entire test.

2. **Immediate Need**: Our test automation needs:
   - FIFO input to send test messages to the client
   - Non-blocking file output to analyze responses later
   - No complex background processes or workarounds

3. **Current Limitations**:
   - Single `fifo: true/false` flag creates both input and output FIFOs
   - Output FIFO blocks if not actively read
   - Tests hang waiting for FIFO readers

## Options Considered

### Option 1: Keep Current Design

Keep the single `fifo: true/false` flag that creates both input and output FIFOs.

**Pros:**
- No changes needed
- Simple configuration

**Cons:**
- Tests will continue to hang
- Requires complex workarounds
- Not viable for automation

### Option 2: Complex I/O Configuration

Add a comprehensive I/O configuration system with multiple input/output types, rotation, etc.

**Pros:**
- Very flexible
- Handles all future use cases

**Cons:**
- Over-engineered for current needs
- Complex to implement
- Delays fixing the immediate problem

### Option 3: Simple FIFO + Log (Recommended)

Add a simple `output_log` option that redirects output to a file instead of a FIFO:

```yaml
test-client:
  fifo: true  # Creates input FIFO only when output_log is set
  output_log: "./logs/test-client.log"  # Output goes to file
  auto_connect: true
```

**Pros:**
- Minimal change to existing configuration
- Solves the blocking problem immediately
- Easy to understand and implement
- Backward compatible (when output_log not set, behaves as before)

**Cons:**
- Less flexible than full I/O configuration
- May need to revisit for future use cases

## Decision

**Option 3: Simple FIFO + Log** is recommended because it:

1. Solves the immediate blocking problem with minimal changes
2. Is simple to understand and implement
3. Maintains backward compatibility
4. Can be implemented quickly to unblock testing
5. Leaves room for future enhancements if needed

### Implementation Details

1. **Configuration Behavior**:
   ```javascript
   // When output_log is specified, change behavior:
   if (participant.output_log) {
     // Create only input FIFO
     createFifo(`${participantId}-in`);
     
     // Redirect client output to log file
     clientArgs.push('--output-file', participant.output_log);
   } else {
     // Current behavior: create both FIFOs
     createFifo(`${participantId}-in`);
     createFifo(`${participantId}-out`);
   }
   ```

2. **Client Connection Updates**:
   ```javascript
   // In client.js connect command
   if (options.outputFile) {
     // Write to file instead of FIFO
     const logStream = fs.createWriteStream(options.outputFile, { flags: 'a' });
     // Direct all output to log file
   } else if (options.fifoOut) {
     // Current FIFO behavior
   }
   ```

3. **Space.yaml Examples**:
   ```yaml
   # For automated testing (non-blocking)
   test-client:
     fifo: true
     output_log: "./logs/test-client.log"
     auto_connect: true
   
   # For interactive debugging (current behavior)
   debug-client:
     fifo: true
     # No output_log means both FIFOs created
   ```

## Consequences

### Positive
- Immediately unblocks test automation
- Simple to implement and understand
- Minimal changes to existing code
- Backward compatible
- Tests can easily analyze output from log files
- Can tail log files for real-time debugging

### Negative
- Less flexible than a full I/O configuration system
- May need enhancement for future use cases
- Two different output modes might be confusing initially

## Examples

### Test Automation (Non-blocking)
```yaml
# scenario-1-basic/space.yaml
participants:
  test-client:
    tokens: ["test-token"]
    capabilities:
      - kind: chat
    fifo: true
    output_log: "./logs/test-client.log"
    auto_connect: true

# Test script can then:
# 1. Send messages via: echo '{"kind":"chat",...}' > fifos/test-client-in
# 2. Analyze responses: grep "pattern" logs/test-client.log
```

### Interactive Debugging (Current Behavior)
```yaml
# manual-testing/space.yaml
participants:
  debug-client:
    tokens: ["debug-token"]
    capabilities:
      - kind: "*"
    fifo: true
    # No output_log = both FIFOs created
    auto_connect: false  # Connect manually

# Can interact via:
# Terminal 1: cat < fifos/debug-client-out
# Terminal 2: echo '{"kind":"chat",...}' > fifos/debug-client-in
```

### Mixed Mode Space
```yaml
participants:
  # Automated test client
  test-client:
    fifo: true
    output_log: "./logs/test-client.log"
    auto_connect: true
    
  # Interactive debug client
  debug-client:
    fifo: true
    # No output_log - use FIFOs for both
    auto_connect: false
    
  # Agent without FIFOs
  echo-agent:
    fifo: false
    auto_start: true
    command: "node"
    args: ["./agents/echo.js"]
```

## Migration Path

1. **Phase 1** (Immediate): Implement `output_log` option
2. **Phase 2**: Update test scenarios to use `output_log`
3. **Phase 3**: Document the pattern in test README
4. **Future**: If more flexibility needed, consider fuller I/O configuration