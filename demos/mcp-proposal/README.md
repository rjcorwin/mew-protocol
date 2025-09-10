# MCP Proposal/Approval Demo

This demo showcases the MEW Protocol v0.3 MCP (Model Context Protocol) proposal and approval workflow, featuring the new advanced interactive UI with confirmation dialogs.

## Overview

The demo includes:
- A proposer agent that suggests file operations requiring approval
- Risk assessment (SAFE/CAUTION/DANGEROUS) for operations
- Interactive approval UI with both advanced (Ink-based) and debug modes
- Full MEW v0.3 protocol compliance

## Files

- `space.yaml` - Space configuration with proposer agent
- `simple-proposer.js` - Agent that proposes MCP operations
- `start.sh` - Quick start script for the demo

## Quick Start

```bash
cd demos/mcp-proposal
./start.sh
```

This will:
1. Stop any existing space
2. Start the demo space with gateway and agents
3. Show instructions for connecting

Note: The demo is designed to be run from the `demos/mcp-proposal` folder.

## Manual Setup

### 1. Start the Demo Space

From the demo folder:
```bash
cd demos/mcp-proposal
../../cli/bin/mew.js space up
```

This starts:
- Gateway on port 8080
- Proposer agent (auto-starts with space)
- Echo agent for testing

### 2. Connect Interactively

#### Advanced UI Mode (default)
```bash
../../cli/bin/mew.js space connect
```

Features:
- Rich terminal interface with native scrolling
- Visual confirmation dialogs for MCP operations
- Risk level indicators with color coding

#### Debug Mode
```bash
../../cli/bin/mew.js space connect --debug
```

Features:
- Simple readline interface
- Raw protocol messages
- Good for debugging and automation

### 3. Trigger Proposals

Say "propose" in chat to have the proposer agent suggest an operation:
```
> propose
```


### 4. Approve/Deny Operations

When an MCP proposal arrives:

**In Advanced UI:**
- Press `a` to approve
- Press `d` to deny
- Press `Esc` to cancel

**In Debug Mode:**
Send approval/denial as JSON:
```json
{
  "kind": "mcp/approval",
  "payload": {
    "operationId": "proposal-1",
    "approved": true
  }
}
```

## Example Confirmation Dialog

```
┌─ MCP Operation Approval Required ──────────────────┐
│ proposer-agent wants to execute: file/read         │
│                                                     │
│ Method: file/read                                   │
│ Path: /Users/rj/Git/mew-protocol/README.md        │
│ Reason: Review project documentation               │
│                                                     │
│ Risk Level: SAFE (read-only operation)            │
│                                                     │
│ [a] Approve  [d] Deny  [Esc] Cancel               │
└─────────────────────────────────────────────────────┘
```

## Protocol Flow

1. Proposer sends `mcp/proposal` with operation details
2. Human participant sees confirmation dialog
3. Human sends `mcp/approval` with decision
4. Proposer receives approval/denial and responds

## Risk Assessment Levels

- **SAFE**: Read-only operations, listing, browsing
- **CAUTION**: File writes, configuration changes
- **DANGEROUS**: System file access, code execution

## Stopping the Demo

```bash
../../cli/bin/mew.js space down
```

## Troubleshooting

If the proposer agent doesn't connect:
1. Check logs: `npx pm2 logs proposer-agent`
2. Restart the space: `../../cli/bin/mew.js space down && ../../cli/bin/mew.js space up`

## Architecture

This demo showcases the architecture from ADR-007:
- Native terminal scrolling with Ink's `Static` component
- Persistent bottom UI for input and status
- Operation confirmation workflow with risk assessment
- Fallback to debug mode for testing/automation