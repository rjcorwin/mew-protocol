# MEW Protocol Testing Walkthrough

This is a step-by-step guide to testing the MEW Protocol. Follow these steps in order to verify that all components are working correctly.

## Prerequisites

- Node.js 18+ installed
- npm installed
- Clean repository clone

## Step 1: Build and Install Globally

First, build all packages and install the CLI globally:

```bash
# From the mew-protocol repository root, navigate to packages/mew
cd packages/mew

# Build all packages
npm run build

# Install the MEW CLI globally (from the cli/ directory)
cd cli
npm install -g --force .
cd ../..
```

Verify the installation:

```bash
# Check that mew command is available
which mew

# Check version
mew --version
```

You should see the mew binary path and version number.

## Step 2: Create Test Space for Cat-Maze

Create a dedicated directory for testing the cat-maze template:

```bash
# Create test directory
mkdir -p spaces/cat-maze-test
cd spaces/cat-maze-test
```

## Step 3: Initialize Cat-Maze Template

Initialize the space with the cat-maze template:

```bash
mew init cat-maze --name cat-maze
```

This creates:
- `.mew/` directory with configuration files
- `.mew/space.yaml` defining participants
- `.mew/tokens/` directory with authentication tokens
- `.mew/logs/` directory for envelope history
- `logs/` directory for process logs

Verify the files were created:

```bash
ls -la .mew/
cat .mew/space.yaml
```

## Step 4: Start the Space

Start all participants (gateway, mew agent, cat-maze MCP bridge):

```bash
mew space up
```

This will:
- Start the gateway on port 8080 (or next available port)
- Start the mew AI agent
- Start the cat-maze MCP bridge
- Connect all participants to the gateway

**Tip**: To find out which port the gateway started on, check the gateway logs:
```bash
pm2 logs cat-maze-gateway --nostream --lines 5 | grep "listening on"
```

Check that all processes are running:

```bash
pm2 list
```

You should see three processes:
- `cat-maze-gateway` - status: online
- `cat-maze-mew` - status: online
- `cat-maze-cat-maze` - status: online

## Step 5: Test MCP Server with View Tool

Now let's test that the MCP bridge is working by calling the `view` tool to see the maze state.

First, get the human participant token:

```bash
cat .mew/tokens/human.token
```

Copy the token value, then send an MCP request:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=cat-maze' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "test-view-1",
    "from": "human",
    "to": ["cat-maze"],
    "kind": "mcp/request",
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "view",
        "arguments": {}
      }
    }
  }'
```

Replace `YOUR_TOKEN_HERE` with the token from `human.token`.

**Expected Result**: The curl command should complete without error. The cat-maze MCP bridge should process the request and send back an `mcp/response` with the current maze state.

Check the envelope logs to verify:

```bash
tail -n 20 .mew/logs/envelope-history.jsonl
```

You should see envelopes with:
- `"kind": "mcp/request"` - Your request to cat-maze
- `"kind": "mcp/response"` - Cat-maze's response with the maze state

## Step 6: Ask MEW to Help the Cat Get Home

Now let's test the MEW agent by asking it to solve the cat-maze puzzle.

Send a chat message to the mew agent:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=cat-maze' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-help-cat",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "mew, please help the cat get home",
      "format": "plain"
    }
  }'
```

**Expected Behavior**: The MEW agent should:

1. Send `chat/acknowledge` to confirm receipt
2. Send `stream/request` to the gateway
3. Send `reasoning/start` to begin transparent reasoning
4. Send multiple `reasoning/thought` messages as it thinks through the problem
5. Send `mcp/request` messages to call tools on the cat-maze MCP server:
   - `view` - to see the current maze state
   - `up`, `down`, `left`, `right` - to move the cat
6. Send `reasoning/conclusion` when done thinking
7. Send a final `chat` response to the human
8. Send `stream/close` to close the stream

### Verify Envelope Flow

Watch the envelope logs to see all protocol messages:

```bash
tail -f .mew/logs/envelope-history.jsonl
```

Each line is a complete MEW protocol envelope in JSON format. You should see envelope kinds in this order:
- `"kind": "chat"` - Your message to mew
- `"kind": "chat/acknowledge"` - MEW acknowledging your message
- `"kind": "stream/request"` - MEW requesting a stream
- `"kind": "reasoning/start"` - MEW starting transparent reasoning
- `"kind": "reasoning/thought"` - MEW's thoughts as it works through the problem
- `"kind": "mcp/request"` - MEW calling tools (view, up, down, left, right)
- `"kind": "mcp/response"` - Cat-maze responding with tool results
- `"kind": "reasoning/conclusion"` - MEW finishing reasoning
- `"kind": "chat"` - MEW's final response to you
- `"kind": "stream/close"` - MEW closing the stream

### Verify Cat Movement

The cat should start moving through the maze. Each successful move will update the maze state. Watch for tool calls to `right`, `down`, `left`, `up` in the logs.

## Step 7: Clean Up

When done testing, stop all processes:

```bash
mew space down
```

Verify all processes stopped:

```bash
pm2 list
```

You should see no processes related to cat-maze.

## Success Criteria

✅ All packages built successfully
✅ MEW CLI installed globally
✅ Space initialized with cat-maze template
✅ All three processes started and show status: online
✅ View tool call succeeded without crashes
✅ MEW agent received chat message
✅ MEW agent sent reasoning/start and reasoning/thought messages
✅ MEW agent called MCP tools (view, movement commands)
✅ Cat-maze MCP bridge responded to tool calls
✅ Cat started moving through the maze
✅ All processes stopped cleanly

If all criteria are met, the MEW Protocol is working correctly!
