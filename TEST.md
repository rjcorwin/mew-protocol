# Testing MEW Protocol

This guide covers local development and testing workflows for the MEW Protocol repository.

## Setup for Local Development

### 1. Install Dependencies and Build

From the repository root:

```bash
cd packages/mew
npm install
npm run build:all
```

### 2. Link Globally for Testing

Create a global symlink to use the local version of `mew`:

```bash
npm link
```

Verify it's working:

```bash
which mew
mew --version
```

### 3. After Code Changes

Just rebuild - the symlink persists:

```bash
npm run build:all
```

## PM2 Process Management

MEW Protocol uses PM2 to manage long-running processes (gateway, agents, MCP bridges). Understanding PM2 commands is essential for testing and debugging.

### Key PM2 Commands

#### List All Processes

```bash
pm2 list
```

Shows all running processes with status, CPU, memory, and uptime. Look for your space's processes (e.g., `coder-gateway`, `coder-mew`, `coder-mcp-fs-bridge`).

#### View Process Logs

**Critical**: Always use `--nostream` with `pm2 logs` in scripts and documentation!

```bash
# Without --nostream: Streams logs continuously (like tail -f), never exits
# This will HANG your terminal or automation scripts
pm2 logs process-name

# With --nostream: Dumps logs and exits immediately (recommended)
pm2 logs process-name --nostream --lines 50
```

**Why `--nostream` matters:**
- Without it: `pm2 logs` acts like `tail -f`, continuously streaming new logs
- With it: Dumps the requested number of lines and exits
- Use `--nostream` for scripting, testing, and documentation
- Omit `--nostream` only when actively watching logs in a terminal

#### Get Detailed Process Info

```bash
pm2 describe process-name
```

Shows configuration, environment variables, log paths, and process metrics.

#### Restart a Process

```bash
pm2 restart process-name
```

Useful after code changes or when a process is misbehaving.

#### Stop a Process

```bash
pm2 stop process-name
```

Stops without deleting the process from PM2.

#### Delete a Process

```bash
pm2 delete process-name
```

Stops and removes the process from PM2's process list.

### Common PM2 Patterns for MEW Testing

#### Check if Space is Running

```bash
pm2 list | grep "your-space-name"
```

#### View Gateway Logs (Non-Blocking)

```bash
pm2 logs your-space-gateway --nostream --lines 50
```

#### Debug MCP Bridge Issues

```bash
# Check error logs specifically
pm2 logs your-space-mcp-bridge --nostream --lines 30 --err
```

#### Clean Up All Processes from a Space

```bash
# mew space down handles this automatically, but if needed manually:
pm2 delete your-space-gateway your-space-mew your-space-mcp-fs-bridge
```

### PM2 Log Locations

PM2 stores logs in its default directory (usually `~/.pm2/logs/`):
- `{process-name}-out.log` - stdout
- `{process-name}-error.log` - stderr

**Note**: MEW spaces also create their own log files. See the "MEW Space Logs" section below for space-specific logging.

## MEW Space Log Structure

Every MEW space creates logs in a consistent structure for easy debugging.

### Log Directories

When you run `mew space up`, two log directories are created:

1. **`logs/` directory** - Participant logs (one file per participant):
   ```
   logs/
   ├── gateway.log
   ├── gateway-error.log
   ├── <participant-id>.log
   └── <participant-id>-error.log
   ```

2. **`.mew/logs/` directory** - Protocol-level logs:
   ```
   .mew/logs/
   └── envelope-history.jsonl
   ```

### Participant Logs Pattern

Each participant gets its own log file: `logs/<participant-id>.log`

For example, in a coder-agent space:
- `logs/gateway.log` - Gateway stdout
- `logs/gateway-error.log` - Gateway stderr
- `logs/mew.log` - MEW agent stdout (participant ID is "mew")
- `logs/mew-error.log` - MEW agent stderr
- `logs/mcp-fs-bridge.log` - Filesystem bridge stdout
- `logs/mcp-fs-bridge-error.log` - Filesystem bridge stderr

### Viewing Participant Logs

**For quick checks** (non-blocking):
```bash
# View last 50 lines of a participant's log
tail -n 50 logs/mew.log

# View error log
tail -n 50 logs/mew-error.log
```

**For real-time monitoring**:
```bash
# Watch agent reasoning in real-time
tail -f logs/mew.log

# Watch gateway message routing
tail -f logs/gateway.log
```

**Using PM2** (when you need process info too):
```bash
# Non-blocking (recommended for scripts)
pm2 logs your-space-mew --nostream --lines 50

# Streaming (only for interactive debugging)
pm2 logs your-space-mew
```

### Envelope History

The most important log for debugging MEW Protocol behavior is the envelope history:

```bash
# View recent envelopes
tail -n 50 .mew/logs/envelope-history.jsonl

# Watch envelopes in real-time
tail -f .mew/logs/envelope-history.jsonl

# Search for specific message kinds
grep '"kind":"mcp/proposal"' .mew/logs/envelope-history.jsonl

# Pretty-print a specific envelope
tail -n 1 .mew/logs/envelope-history.jsonl | jq .
```

Each line is a complete JSON envelope showing:
- `kind` - Message type (chat, mcp/request, reasoning/start, etc.)
- `from` - Sender participant ID
- `to` - Recipient participant IDs (or broadcast if empty)
- `correlation_id` - Related message IDs
- `payload` - Message-specific data

**Tip**: Use `.mew/logs/envelope-history.jsonl` as your primary debugging tool. It shows the complete protocol-level message flow, which is often more useful than individual participant logs.

## Manual Testing with Spaces

### Create and Test a New Space

```bash
# Navigate to spaces directory
cd /path/to/mew-protocol/spaces

# Create a new test directory
mkdir test-npm-link
cd test-npm-link

# Initialize with a template
mew init coder-agent --name test-npm-link

# Start the space
mew space up

# The space will auto-select an available port if needed
# Watch for output showing gateway URL and participant PIDs
```

### Check Running Processes

```bash
pm2 list
```

You should see processes like:
- `{space-name}-gateway` - Gateway process
- `{space-name}-mew` - MEW agent participant
- `{space-name}-{template-specific-agent}` - Template-specific agent (e.g., `cat-maze`, `mcp-fs-bridge`)

All processes should show status as `online`.

### Stop the Space

```bash
mew space down
```

This will cleanly stop all processes and clean up PM2 resources.

## Template-Specific Testing Walkthroughs

For complete step-by-step testing guides for each template, see:

- **[TESTING-CAT-MAZE.md](./TESTING-CAT-MAZE.md)** - Testing MCP bridge functionality with the cat-maze template
  - Building and installing MEW CLI
  - Testing MCP tool calls (view, move commands)
  - Testing MEW agent with chat messages
  - Verifying transparent reasoning flow
  - Debugging envelope history

- **[TESTING-CODER-AGENT.md](./TESTING-CODER-AGENT.md)** - Testing the coder-agent template
  - Direct MCP filesystem operations
  - Agent proposals and manual fulfillment
  - Capability grants and progressive trust
  - Auto-fulfiller workflows

These walkthroughs demonstrate end-to-end workflows for testing MEW Protocol features.

## Notes

- **No workspace configuration**: The repo no longer uses npm workspaces, which simplifies `npm link`
- **Port conflicts**: `mew space up` will automatically find an available port if the default is in use
- **Missing dependency**: If you see errors about `jsonpath-plus`, make sure it's in `packages/mew/package.json` dependencies
