# Interactive Demo Space

This is a demo space to test the new interactive connection features in MEW CLI!

## Quick Start

### Option 1: Start and Connect in One Command
```bash
# Start the space and immediately connect as 'human'
mew space up -i

# Or specify a different participant
mew space up -i --participant observer
```

### Option 2: Start in Background, Connect Later
```bash
# Start the space in background
mew space up --detach

# Connect interactively (will auto-select 'human' as default)
mew space connect

# Or connect as a specific participant
mew space connect --participant observer

# Connect from another directory
mew space connect --space-dir /path/to/demo/interactive-demo
```

## Things to Try

Once connected, try these commands:

### 1. Chat Messages
```
Hello everyone!
```
The echo agent will repeat your message back.

### 2. JSON Messages
Send partial JSON envelopes:
```json
{"kind": "chat", "payload": {"text": "This is a JSON chat"}}
```

### 3. MCP Tool Calls (if calculator is running)
```json
{"kind": "mcp/request", "to": ["calculator"], "payload": {"method": "tools/list"}}
```

Then call a tool:
```json
{"kind": "mcp/request", "to": ["calculator"], "payload": {"method": "tools/call", "params": {"name": "add", "arguments": {"a": 5, "b": 3}}}}
```

### 4. Interactive Commands
- `/help` - Show all available commands
- `/participants` - List active participants
- `/capabilities` - Show your capabilities
- `/verbose` - Toggle full JSON display
- `/replay` - Show recent messages
- `/clear` - Clear the screen
- `/exit` - Disconnect

### 5. Edge Cases
Force text that looks like JSON to be sent as chat:
```
/chat {"this": "is actually chat text"}
```

Force invalid JSON to be sent as a protocol message:
```
/json {"kind": "custom", "payload": {"test": true}}
```

## Multiple Connections

You can open multiple terminals and connect as different participants:

**Terminal 1:**
```bash
mew space connect --participant human
```

**Terminal 2:**
```bash
mew space connect --participant observer
```

Messages from one participant will appear in all connected terminals!

## Environment Variables

Customize the display:
```bash
# Show system messages (dimmed by default)
MEW_INTERACTIVE_SHOW_SYSTEM=true mew space connect

# Show heartbeat messages (hidden by default)
MEW_INTERACTIVE_SHOW_HEARTBEAT=true mew space connect

# Disable colors
MEW_INTERACTIVE_COLOR=false mew space connect
```

## Stop the Space

When done testing:
```bash
mew space down
```

## Troubleshooting

If port 8080 is in use, specify a different port:
```bash
mew space up -i --port 8090
```

If the space is already running from a previous session:
```bash
mew space down
mew space up -i
```