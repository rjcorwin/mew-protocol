# ADR-iui: Interactive UI Architecture

**Status:** Accepted  
**Date:** 2025-01-10  
**Incorporation:** Complete

## Context

The interactive connection feature needs a user interface for sending and receiving MEW protocol messages. The goal is to create a dead-simple implementation that:
- Shows all protocol messages (sent and received)
- Provides lightweight helpers for common tasks
- Remains useful for debugging even after better UIs are created
- Requires minimal dependencies and complexity

This is explicitly NOT trying to be a polished chat interface or sophisticated client. It's a protocol debugging tool with convenience features.

## Options Considered

### Option 1: Raw Protocol Mode Only

Show only JSON messages, require full JSON input:
```
< {"protocol":"mew/v0.4","kind":"system/welcome",...}
> {"protocol":"mew/v0.4","kind":"chat","payload":{"text":"hello"}}
< {"protocol":"mew/v0.4","kind":"chat","from":"echo",...}
```

**Pros:**
- Purest protocol view
- No ambiguity about what's being sent
- Easiest to implement

**Cons:**
- Tedious to type full envelopes
- Hard to read in terminal
- Not practical for actual use

### Option 2: Smart Input Detection

Detect input type and handle accordingly:
- JSON → Send as protocol message
- `/command` → Execute command
- Plain text → Auto-wrap as chat message

**Pros:**
- Natural for both simple and complex usage
- Progressive disclosure of complexity
- Convenient for common cases

**Cons:**
- Edge cases (what if chat text starts with `{`?)
- "Magic" behavior might confuse users
- Need escape hatches for edge cases

### Option 3: Modal Interface

Different modes for different message types:
```
[chat mode] > Hello
[mcp mode] > tools/list
[raw mode] > {"kind":"custom","payload":{}}
```

**Pros:**
- Clear what mode you're in
- Optimized input per mode
- No ambiguity

**Cons:**
- Mode switching is cumbersome
- Another thing to learn
- State to manage

### Option 4: Prefix-Based Commands

Everything is explicit with prefixes:
```
> chat: Hello everyone
> mcp: tools/list
> raw: {"kind":"custom","payload":{}}
> /help
```

**Pros:**
- Always explicit
- No ambiguity
- Easy to extend

**Cons:**
- More typing for common cases
- Less natural than smart detection

## Decision

Implement **Option 2: Smart Input Detection** with clear rules and escape hatches.

This provides the best balance of simplicity and power while maintaining the tool's debugging focus.

### Implementation Details

#### Input Processing Pipeline

```
User Input → Input Detector → Message Builder → WebSocket Send
                ↓
         Command Handler
```

#### Input Detection Rules

Applied in order:
1. **Commands** (starts with `/`): Execute command
2. **Valid JSON** (parseable as JSON): Send as-is if valid envelope, otherwise wrap
3. **Plain text**: Wrap as chat message

```javascript
function processInput(input) {
  // 1. Commands
  if (input.startsWith('/')) {
    return handleCommand(input);
  }
  
  // 2. Try JSON
  try {
    const json = JSON.parse(input);
    if (isValidEnvelope(json)) {
      // Full envelope - send as-is
      return sendMessage(json);
    } else if (json.kind) {
      // Partial envelope - add protocol fields
      return sendMessage(wrapEnvelope(json));
    } else {
      // Not an envelope - treat as chat
      return sendChat(JSON.stringify(json));
    }
  } catch {
    // 3. Plain text - send as chat
    return sendChat(input);
  }
}
```

#### Display Format

All messages shown with consistent format:
```
[timestamp] direction participant kind
└─ payload preview
```

Examples:
```
[10:23:45] → you chat
└─ "Hello everyone"

[10:23:46] ← echo-agent chat
└─ "Echo: Hello everyone"

[10:23:50] → you mcp/request
└─ method: "tools/list", to: ["calculator"]

[10:23:51] ← calculator mcp/response
└─ tools: [3 tools]
```

Verbose mode (`/verbose` command) shows full JSON:
```
[10:23:45] → you chat
{
  "protocol": "mew/v0.4",
  "id": "msg-123",
  "kind": "chat",
  "payload": {"text": "Hello"}
}
```

#### Commands

Essential commands for debugging:
```
/help           Show available commands
/participants   List active participants  
/capabilities   Show your capabilities
/verbose        Toggle verbose output
/json <msg>     Force input as JSON (escape hatch)
/chat <text>    Force input as chat (escape hatch)
/replay         Show last N messages
/clear          Clear screen
/exit           Disconnect and exit
```

Future commands (not in initial implementation):
```
/filter <kind>  Filter messages by kind
/save <file>    Save session to file
/load <file>    Replay messages from file
/stats          Show message statistics
```

#### Message Building Helpers

Shortcuts for common MEW protocol messages:
```javascript
// Partial envelope completion
{"kind": "chat", "payload": {"text": "hi"}}
// Becomes full envelope with protocol, id, ts

// MCP shortcuts (future)
{"kind": "mcp/request", "method": "tools/list"}
// Adds proper payload structure

// Direct targeting
{"kind": "chat", "to": ["agent-1"], "text": "hi"}
// Restructures into proper envelope
```

#### Output Filtering

Control what's displayed:
- System messages (welcome, presence) - dimmed by default
- Heartbeats - hidden by default
- Chat messages - normal color
- MCP messages - highlighted
- Errors - red

Configuration via environment or flags:
```bash
MEW_INTERACTIVE_SHOW_HEARTBEAT=true
MEW_INTERACTIVE_SHOW_SYSTEM=true
MEW_INTERACTIVE_COLOR=false  # Disable colors
```

#### Terminal UI Components

Minimal UI using just readline and ANSI codes:
```
┌─ MEW Interactive (space: dev-space, participant: human) ──────┐
│                                                                │
│ [10:23:45] → you chat                                        │
│ └─ "Hello everyone"                                          │
│                                                                │
│ [10:23:46] ← echo-agent chat                                 │
│ └─ "Echo: Hello everyone"                                    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
> _
```

Status line shows:
- Connected/disconnected state
- Current space
- Current participant
- Message count
- Error state (if any)

## Consequences

### Positive
- Natural interaction for both simple and complex usage
- All protocol messages visible for debugging
- Lightweight implementation (readline + WebSocket)
- Escape hatches prevent getting stuck
- Useful even after better UIs exist

### Negative
- Smart detection might surprise users initially
- Need clear documentation of detection rules
- Some edge cases require escape hatches
- Not suitable for production use (debugging tool)

### Security Considerations
- All messages shown in terminal (including tokens/secrets)
- Command history may contain sensitive data
- No message encryption or privacy

## Migration Path

1. **Phase 1**: Basic implementation with chat and JSON
2. **Phase 2**: Add command system
3. **Phase 3**: Add message formatting and colors
4. **Phase 4**: Add filtering and shortcuts
5. **Future**: Keep as debug tool, build separate production UI

## Examples

### Simple Chat Session
```
> Hello everyone
[10:23:45] → you chat
└─ "Hello everyone"

[10:23:46] ← echo-agent chat
└─ "Echo: Hello everyone"

> How can I help?
[10:23:50] → you chat
└─ "How can I help?"
```

### MCP Interaction
```
> {"kind": "mcp/request", "to": ["calculator"], "payload": {"method": "tools/list"}}
[10:24:00] → you mcp/request
└─ method: "tools/list", to: ["calculator"]

[10:24:01] ← calculator mcp/response
└─ tools: ["add", "subtract", "multiply", "divide"]

> {"kind": "mcp/request", "to": ["calculator"], "payload": {"method": "tools/call", "params": {"name": "add", "arguments": {"a": 5, "b": 3}}}}
[10:24:10] → you mcp/request
└─ method: "tools/call", name: "add", args: {a: 5, b: 3}

[10:24:11] ← calculator mcp/response
└─ result: 8
```

### Debugging Session
```
> /verbose
Verbose mode: ON

> /participants
Active participants:
- you (human) [capabilities: chat, mcp/*]
- echo-agent [capabilities: chat]
- calculator [capabilities: mcp/response]

> {"kind": "invalid"}
[10:25:00] → you invalid
{
  "protocol": "mew/v0.4",
  "id": "msg-456",
  "ts": "2025-01-10T10:25:00Z",
  "from": "human",
  "kind": "invalid"
}

[10:25:01] ← system system/error
{
  "protocol": "mew/v0.4",
  "kind": "system/error",
  "payload": {
    "error": "Unknown message kind: invalid",
    "code": "INVALID_KIND"
  }
}
```

### Edge Cases
```
> { this is not json but starts with brace
[10:26:00] → you chat
└─ "{ this is not json but starts with brace"

> /chat {"actual": "json", "as": "text"}
[10:26:10] → you chat
└─ "{\"actual\": \"json\", \"as\": \"text\"}"

> /json {"kind": "custom", "payload": {"force": "json"}}
[10:26:20] → you custom
└─ {"force": "json"}
```

## Future Enhancements

1. **Better MCP support**:
   - Auto-complete for tool names
   - Parameter hints
   - Response formatting

2. **Session management**:
   - Save/replay sessions
   - Session statistics
   - Export for analysis

3. **Advanced filtering**:
   - Regex patterns
   - Participant filtering
   - Time-based filtering

4. **Separate production UI**:
   - Full chat interface
   - Rich formatting
   - File uploads
   - Keep this as debug tool

## Testing Requirements

1. Test input detection for edge cases
2. Test command parsing
3. Test message formatting
4. Test color output on different terminals
5. Test verbose vs normal modes
6. Test with large message volumes
7. Test reconnection handling