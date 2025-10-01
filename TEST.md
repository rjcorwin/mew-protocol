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

## Testing MCP Tool Calls

The cat-maze template is useful for testing MCP bridge functionality.

### Setup Cat-Maze Space

```bash
cd /path/to/mew-protocol/spaces
mkdir cat-maze-test
cd cat-maze-test
mew init cat-maze --name cat-maze
mew space up
```

### Verify All Participants Are Running

```bash
pm2 list
```

You should see three processes:
- `cat-maze-gateway` - Gateway process
- `cat-maze-mew` - MEW AI agent
- `cat-maze-cat-maze` - Cat-maze MCP bridge

### Check MCP Bridge Logs

```bash
pm2 logs cat-maze-cat-maze --nostream --lines 30
```

Look for:
- MCP requests being received
- MCP responses being sent
- Any tool call errors

The `mew` agent will automatically start calling the cat-maze MCP tools when it connects.

## Testing via HTTP API

You can send messages directly to participants via HTTP using their tokens:

```bash
# Get the token for a participant
cat .mew/tokens/human.token

# Send an MCP request via HTTP
curl -X POST 'http://localhost:8080/participants/human/messages?space=cat-maze' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "kind": "mcp/request",
    "id": "test-1",
    "to": ["cat-maze"],
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "view",
        "arguments": {}
      }
    }
  }'
```

**Note**: MCP requests must be wrapped in MEW protocol envelopes with the `payload` field containing the MCP `method` and `params`.

## Notes

- **No workspace configuration**: The repo no longer uses npm workspaces, which simplifies `npm link`
- **Port conflicts**: `mew space up` will automatically find an available port if the default is in use
- **Missing dependency**: If you see errors about `jsonpath-plus`, make sure it's in `packages/mew/package.json` dependencies
