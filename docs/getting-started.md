# Getting Started with MEW Protocol

Get MEW running in 5 minutes. This guide walks you through installation and your first workspace.

## What is MEW?

MEW Protocol (Multi-Entity Workspace Protocol) creates collaborative workspaces where:
- **You participate directly** - Not just observing, but actively engaged
- **AI agents assist you** - With capabilities you control
- **Trust is progressive** - Agents start restricted, earn capabilities over time
- **Everything is visible** - All messages flow through a central gateway

Think of it as a "workspace" where you work alongside AI agents, MCP servers, and other tools - with you maintaining control through capability-based security.

## Installation

### Prerequisites

- Node.js 18 or later
- npm (comes with Node.js)

Check your versions:
```bash
node --version  # Should be v18.0.0 or higher
npm --version
```

### Install MEW CLI

```bash
npm install -g @mew-protocol/mew
```

Verify installation:
```bash
mew --version
```

## Your First Workspace

### 1. Create a Workspace Directory

```bash
mkdir my-first-workspace
cd my-first-workspace
```

### 2. Start MEW

```bash
mew
```

MEW will detect you don't have a workspace yet and guide you through setup:
- Choose a template (try "cat-maze" for a fun introduction)
- Configure your AI agent (Claude, GPT-4, etc.)
- Set initial capabilities
- Generate authentication tokens

### 3. The Workspace Starts Automatically

MEW launches:
- **Gateway** - Routes all messages between participants
- **AI Agent** - Your assistant (starts with limited capabilities)
- **MCP Servers** - Tools and resources (filesystem, memory, etc.)

You'll see output showing each component starting:
```
✓ Gateway started on http://localhost:8080
✓ Agent 'mew' connected
✓ MCP bridge 'cat-maze' connected
```

### 4. Interact with Your Workspace

The CLI puts you in interactive mode. Try:

```
Type a message and press Enter to chat with agents
Type /help for available commands
```

Example:
```
> Hello! What can you help me with?
```

The AI agent will respond, and you'll see its reasoning process if transparent reasoning is enabled.

## Understanding Your Workspace

### What Just Happened?

Your workspace directory now contains:

```
my-first-workspace/
├── .mew/                    # MEW configuration
│   ├── space.yaml          # Participant config
│   ├── tokens/             # Authentication tokens
│   └── logs/               # Message history
└── logs/                   # Process logs
```

### The Key Files

- **`.mew/space.yaml`** - Defines who's in your workspace and what they can do
- **`.mew/tokens/human.token`** - Your authentication token
- **`.mew/logs/envelope-history.jsonl`** - Complete message log

### Viewing Message Flow

Every message in MEW is an "envelope" with sender, recipients, kind, and payload. To see all messages:

```bash
tail -f .mew/logs/envelope-history.jsonl
```

Each line is a JSON envelope showing the protocol in action.

## Managing Your Workspace

### Check Status

```bash
mew space status
```

Shows which processes are running and their health.

### Stop Your Workspace

```bash
mew space down
```

Gracefully stops all processes.

### Restart Your Workspace

```bash
mew space up
```

Restarts all processes with your saved configuration.

## Trying Different Templates

MEW includes three templates to explore different capabilities:

### Cat-Maze (Recommended First)

An interactive puzzle demonstrating MCP integration:

```bash
mkdir cat-maze-demo
cd cat-maze-demo
mew init cat-maze --name cat-maze
mew space up
```

Then ask the agent: "Please help the cat get home"

**What you'll learn:**
- How agents use MCP tools
- Transparent reasoning
- Message flow in MEW

### Coder-Agent (Most Powerful)

A coding assistant with file system access and approval workflow:

```bash
mkdir coder-demo
cd coder-demo
mew init coder-agent --name coder
mew space up
```

Then ask: "Please create a file called hello.txt with 'Hello MEW!'"

**What you'll learn:**
- Proposal/approval pattern
- Progressive trust
- Capability grants
- Human-in-the-loop safety

### Note-Taker (Simplest)

A minimal note-taking assistant:

```bash
mkdir notes-demo
cd notes-demo
mew init note-taker --name notes
mew space up
```

**What you'll learn:**
- Basic agent interaction
- Chat message patterns

## Key Concepts

### 1. Gateway-Enforced Capabilities

The gateway controls what each participant can do:
- **Agents** - Start with limited capabilities (read-only, proposals)
- **You** - Full access (wildcard `*`)
- **MCP Servers** - Respond to requests, can't initiate

Example from `.mew/space.yaml`:
```yaml
participants:
  mew:
    type: mew
    capabilities:
      - kind: "chat"           # Can chat
      - kind: "reasoning/*"    # Can show reasoning
      - kind: "mcp/request"    # Can call read-only tools
      - kind: "mcp/proposal"   # Must propose write operations
```

### 2. Proposal Pattern

For sensitive operations, agents **propose** instead of executing:

1. Agent sends `mcp/proposal` - "I want to write a file"
2. You review the proposal in the message log
3. You send `mcp/request` with `correlation_id` to approve
4. Agent observes the result through correlation

This keeps you in control of destructive operations.

### 3. Progressive Trust

As agents prove reliable, you can grant additional capabilities:

```bash
# Example: Grant write access to a well-behaved agent
curl -X POST 'http://localhost:8080/participants/human/messages?space=my-workspace' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "kind": "capability/grant",
    "to": ["mew"],
    "payload": {
      "capabilities": [{"kind": "mcp/request", "payload": {"method": "tools/call", "params": {"name": "write_file"}}}]
    }
  }'
```

Now the agent can write files directly without proposals.

### 4. Transparent Everything

- All messages visible in envelope history
- Agent reasoning visible in `reasoning/thought` envelopes
- Tool calls visible in `mcp/request` envelopes
- No hidden operations

## Troubleshooting

### Port Already in Use

If port 8080 is taken, MEW automatically finds the next available port. Check which port:

```bash
pm2 logs <space-name>-gateway --nostream --lines 10 | grep "localhost:"
```

### Processes Won't Start

Check process status:
```bash
pm2 list
```

View logs for a specific process:
```bash
pm2 logs <space-name>-<participant-name>
```

### Token Not Working

Regenerate your token:
```bash
cat .mew/tokens/human.token
```

Copy the token and use in your `Authorization: Bearer <token>` header.

### Complete Reset

To start fresh:
```bash
mew space down
rm -rf .mew
mew
```

## Next Steps

### Learn More

- **[Templates Guide](templates.md)** - Detailed walkthroughs of each template
- **[Development Guide](development.md)** - Build custom agents and MCP bridges
- **[Testing Guide](testing.md)** - Run end-to-end tests

### Understand the Protocol

- **[Protocol Specification](../spec/protocol/v0.4/SPEC.md)** - Complete protocol reference
- **[CLI Spec](../spec/cli/SPEC.md)** - Command-line interface details
- **[SDK Spec](../spec/sdk/SPEC.md)** - Build your own participants

### Try Advanced Features

1. **Create a custom agent** - See `docs/development.md`
2. **Add your own MCP servers** - Any stdio MCP server works
3. **Build multi-agent workflows** - Multiple agents collaborating
4. **Implement custom capabilities** - Fine-tune access control

### Join the Community

- Report issues: [GitHub Issues](https://github.com/mew-protocol/mew-protocol/issues)
- Read the changelog: [CHANGELOG.md](../CHANGELOG.md)
- Contribute: [CONTRIBUTING.md](../CONTRIBUTING.md)

## Quick Command Reference

```bash
# Installation
npm install -g @mew-protocol/mew

# Workspace management
mew                      # Interactive setup and start
mew init <template>      # Initialize with template
mew space up             # Start workspace
mew space down           # Stop workspace
mew space status         # Check status

# Interaction
mew client connect       # Connect to running workspace

# Process management (via PM2)
pm2 list                 # List all processes
pm2 logs <name>          # View logs
pm2 restart <name>       # Restart process
```

---

**You're ready to go!** Start with the cat-maze template and explore from there. MEW gives you full visibility and control over your AI workspace.
