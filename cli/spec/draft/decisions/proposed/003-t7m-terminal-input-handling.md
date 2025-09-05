# ADR-t7m: Terminal Input Handling

**Status:** Proposed  
**Date:** 2025-01-05  
**Incorporation:** Not Incorporated

## Context

When a user connects to a space interactively via `meup space up` or `meup client connect`, they can type input in the terminal. We need to decide how to handle non-command input (text that doesn't start with `/`).

The terminal interface needs to balance:
- Ease of use for humans
- Ability to send different message types
- Consistency with the MEUP protocol
- Testing and debugging needs

## Options Considered

### Option 1: Plain Text as Chat

Any non-command input is automatically wrapped as a chat message.

```bash
$ meup space up
> Hello world
# Sends: {"kind": "chat", "payload": {"text": "Hello world"}}
```

**Pros:**
- Most intuitive for users
- Similar to chat applications
- Low friction for common case
- Good for human interaction

**Cons:**
- Can only send chat messages easily
- Need special syntax for other message types
- Might be limiting for testing

### Option 2: JSON Envelopes Required

Users must type valid JSON for all messages.

```bash
$ meup space up
> {"kind": "chat", "payload": {"text": "Hello"}}
# Sends exactly what was typed
```

**Pros:**
- Full protocol access
- Consistent with FIFO mode
- Good for testing/debugging
- Can send any message type

**Cons:**
- Terrible UX for humans
- Error-prone (JSON syntax)
- High friction for common use
- Not suitable for demos

### Option 3: Smart Detection

Detect JSON vs plain text and handle accordingly.

```bash
$ meup space up
> Hello world
# Sends: {"kind": "chat", "payload": {"text": "Hello world"}}

> {"kind": "mcp/request", "payload": {...}}
# Sends the JSON as-is
```

**Pros:**
- Best of both worlds
- Natural for humans
- Full access when needed
- Good for testing and demos

**Cons:**
- Ambiguity (what if someone wants to chat about JSON?)
- More complex to implement
- Might surprise users

### Option 4: Mode Switching

Start in chat mode, use commands to switch modes.

```bash
$ meup space up
[chat mode]> Hello world
# Sends: {"kind": "chat", "payload": {"text": "Hello world"}}

[chat mode]> /mode json
[json mode]> {"kind": "mcp/request", "payload": {...}}
# Sends the JSON as-is

[json mode]> /mode chat
[chat mode]> Back to chatting
```

**Pros:**
- Clear user intent
- No ambiguity
- Full protocol access
- Explicit mode indicator

**Cons:**
- Extra step to switch modes
- Users must remember current mode
- More complex than Option 1

### Option 5: Prefix-Based

Use a prefix to indicate raw JSON input.

```bash
$ meup space up
> Hello world
# Sends: {"kind": "chat", "payload": {"text": "Hello world"}}

> @json {"kind": "mcp/request", "payload": {...}}
# Sends the JSON as-is

> @mcp request tools/list
# Sends: {"kind": "mcp/request", "payload": {"method": "tools/list"}}
```

**Pros:**
- Clear intent per message
- No mode to track
- Can add shortcuts for common patterns
- Extensible

**Cons:**
- Need to remember prefixes
- Slightly more typing for non-chat

## Decision

**Recommended: Option 3 - Smart Detection**

We need to support both simple chat for human interaction AND the ability to send any MEUP message type for testing and advanced use. Smart detection provides this flexibility while maintaining good UX.

### Implementation Details

1. **Detection Logic:**
   ```javascript
   function processInput(input) {
     const trimmed = input.trim();
     
     // 1. Check for commands
     if (trimmed.startsWith('/')) {
       return handleCommand(trimmed);
     }
     
     // 2. Try to parse as JSON
     if (trimmed.startsWith('{')) {
       try {
         const parsed = JSON.parse(trimmed);
         // Validate it looks like a MEUP message
         if (parsed.kind && parsed.payload) {
           return sendMessage(parsed);
         }
       } catch (e) {
         // Not valid JSON, treat as chat
       }
     }
     
     // 3. Default to chat
     return sendMessage({
       kind: 'chat',
       payload: {
         text: trimmed
       }
     });
   }
   ```

2. **Usage Examples:**
   ```bash
   $ meup space up --participant developer
   Connected as 'developer' to space 'my-space'
   
   > Hello everyone
   # Sends: {"kind": "chat", "payload": {"text": "Hello everyone"}}
   
   > {"kind": "mcp/request", "payload": {"method": "tools/list"}}
   # Sends the JSON exactly as typed
   
   > How's the code review going?
   # Sends: {"kind": "chat", "payload": {"text": "How's the code review going?"}}
   
   > {"kind": "chat", "payload": {"text": "I can also send chat via JSON"}}
   # Sends the JSON exactly as typed
   
   > { this is not valid JSON }
   # Sends: {"kind": "chat", "payload": {"text": "{ this is not valid JSON }"}}
   ```

3. **Escape Hatch:**
   For the edge case where someone wants to send a chat message that starts with `{`:
   ```bash
   > /chat {"foo": "bar"} is valid JSON
   # Forces chat mode, sends: {"kind": "chat", "payload": {"text": "{\"foo\": \"bar\"} is valid JSON"}}
   ```

4. **Display Format:**
   ```bash
   > Hello
   [developer → all] chat: Hello
   
   > {"kind": "mcp/request", "payload": {"method": "tools/list"}}
   [developer → all] mcp/request: {"method": "tools/list"}
   
   [echo-agent → developer] mcp/response: {"tools": [...]}
   
   > Thanks!
   [developer → all] chat: Thanks!
   ```

5. **Error Handling:**
   ```bash
   > {"kind": "invalid"}
   Error: Message missing required 'payload' field
   
   > {"not valid json
   # Treated as chat since it doesn't parse
   [developer → all] chat: {"not valid json
   ```

## Consequences

### Positive
- Natural chat interface for humans
- Full protocol access when needed
- Good for both demos and testing
- No mode switching required
- Handles common cases elegantly

### Negative
- Slight ambiguity when chatting about JSON
- More complex than pure chat mode
- Detection logic could surprise users occasionally
- Need to validate JSON structure

### Mitigation
- Provide `/chat` command for edge cases
- Clear error messages for malformed JSON
- Document the detection behavior clearly
- Show message type in output for clarity