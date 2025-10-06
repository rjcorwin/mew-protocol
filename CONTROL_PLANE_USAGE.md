# CLI Control Plane Usage Guide

This guide walks through hands-on scenarios for exercising the MEW CLI control plane. Each scenario was run against commit `HEAD` using the local CLI build, and every captured screen/state payload below comes from real control-plane responses.

## Prerequisites

1. Build the CLI and expose the `mew` binary:
   ```bash
   npm run build
   npm link
   ```
2. Create a minimal space configuration for testing. The examples below use `/tmp/control-plane-demo/space.yaml` with only a human participant:
   ```yaml
   space:
     id: "control-plane-demo"
     name: "Control Plane Demo"
     description: "Minimal space for exercising CLI control plane"
     default_participant: human
     ui_theme: default

   participants:
     human:
       display_name: "Tester"
       default_to:
         chat: []
       capabilities:
         - kind: "chat"
   ```

## Scenario 1 – Launching an interactive session with the control plane

Start the space and attach the interactive UI plus control server on port `7777`:

```bash
cd /tmp/control-plane-demo
mew space up --space-dir . --port 18080 --interactive --control-port 7777
```

The CLI renders the familiar Ink interface while logging that the control plane is listening on `http://localhost:7777`. The initial `plain` snapshot from `/control/screen` shows the welcome marquee and prompt:

```
◇ system:gateway → system/welcome
connected as participant-1759757375418 (2 capabilities) • 0 other participants:
none

╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  Connected to control-plane-demo as human.                                   │
│  Type a message or use /help to get started.                                 │
│  Signal Board docks once there is activity.                                  │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 >
```

## Scenario 2 – Polling control-plane endpoints

With the session running, an automated client can probe the control server:

```bash
curl -s http://localhost:7777/control/health | jq
```

Sample response:

```json
{
  "ok": true,
  "version": "0.5.1",
  "uptime": 8.376247807
}
```

Fetch the live screen buffer and cursor metadata:

```bash
curl -s http://localhost:7777/control/screen | jq '.frames_rendered, .cursor'
```

```
8
null
```

The `/control/screen` payload also includes `raw`, `plain`, terminal dimensions, and scrollback bookkeeping for replay clients.

## Scenario 3 – Driving `/help` via injected input

Use `POST /control/send_input` to type `/help`, then issue an Enter key event:

```bash
curl -s -X POST http://localhost:7777/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"text":"/help"}'
curl -s -X POST http://localhost:7777/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"key":"enter"}'
```

A subsequent `/control/screen` call captures the expanded help overlay exactly as the operator sees it:

```
◇ system → system/help
Available Commands
   /help                                           Show this help message
   /verbose                                        Toggle verbose output
   /streams                                        Toggle stream data display
   /target [show|none|<participant...>]            Set or show default chat
                                                   targets
   /ui board [open|close|auto]                     Control Signal Board visibility
   /ui-clear                                       Clear local UI buffers
   /ui-board                                       Toggle Signal Board visibility
   /exit                                           Exit the application

   Chat Queue
   /ack [selector] [status]                        Acknowledge chat messages
   /cancel [selector] [reason]                     Cancel reasoning or pending chats

   Participant Controls
   /status <participant> [fields...]               Request participant status
   /pause <participant> [timeout] [reason]         Pause a participant
   /resume <participant> [reason]                  Resume a participant
   /forget <participant> [oldest|newest] [count]   Forget participant history
   /clear <participant> [reason]                   Clear a participant queue
   /restart <participant> [mode] [reason]          Restart a participant
   /shutdown <participant> [reason]                Shut down a participant

   Streams
   /stream request <participant> <direction> [description] [size=bytes]
                                                   Request a new stream
   /stream close <streamId> [reason]               Close an existing stream

   Envelopes
   /envelope mcp/request tool/call <participant> <tool> [jsonArguments]
                                                   Send an MCP tool call request envelope
```

The same sequence also surfaces in `/control/state`, which records published UI state objects. After triggering help, the state snapshot contains a structured `system/help` entry with the exact command list:

```json
{
  "kind": "system/help",
  "payload": {
    "lines": [
      "Available Commands",
      "/help                                           Show this help message",
      "/verbose                                        Toggle verbose output",
      "…"
    ]
  }
}
```

## Scenario 4 – Sending chat input programmatically

Inject a plain chat message and press Enter through the control plane:

```bash
curl -s -X POST http://localhost:7777/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello there"}'
curl -s -X POST http://localhost:7777/control/send_input \
  -H 'Content-Type: application/json' \
  -d '{"key":"enter"}'
```

The next `/control/screen` snapshot shows the rendered transcript with the human-authored bubble and the footer updating to “3 msgs | 1 awaiting”:

```
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
◆ you →
Hello there

▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 ◆ Connected ◇ control-plane-demo ◇ human | 3 msgs | 1 awaiting  Ctrl+C to exit
```

The `/control/state` stream simultaneously adds the corresponding `chat` envelope:

```json
{
  "kind": "chat",
  "from": "human",
  "payload": { "text": "Hello there" }
}
```

## Scenario 5 – Shutting down

Exit the interactive session with `Ctrl+C`, then stop background processes cleanly:

```bash
mew space down --space-dir .
```

This halts the gateway, removes FIFOs, and clears `.mew/pids.json`, returning the workspace to a clean slate for the next run.

---

These scenarios demonstrate the end-to-end control-plane workflow: launching the CLI with a control port, steering UI interactions through HTTP calls, and capturing faithful terminal snapshots plus structured state for automated verification.
