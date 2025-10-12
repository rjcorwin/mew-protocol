# MEW Protocol Templates Guide

This guide provides step-by-step walkthroughs for testing MEW Protocol's template spaces: cat-maze, coder-agent, and note-taker.

## Prerequisites

- Node.js 18+ installed
- npm installed
- MEW CLI built and installed globally

### Build and Install MEW CLI

From the repository root:

```bash
# Build all packages
npm run build

# Install the MEW CLI globally
npm install -g .
```

Verify the installation:

```bash
# Check that mew command is available
which mew

# Check version
mew --version
```

## Cat-Maze Template

The cat-maze template demonstrates MCP bridge integration with an interactive puzzle game where an AI agent helps navigate a cat through a maze to get home.

### What's in the Cat-Maze Template?

- **Gateway**: MEW Protocol gateway for message routing
- **mew agent**: AI agent that can solve the cat-maze puzzle
- **cat-maze MCP bridge**: MCP server that provides the maze game with tools (`view`, `up`, `down`, `left`, `right`)
- **Human participant**: For observation and interaction

### Step 1: Create and Initialize Space

```bash
# Create test directory
mkdir cat-maze-test
cd cat-maze-test

# Initialize with cat-maze template
mew init cat-maze --name cat-maze
```

This creates:
- `.mew/` directory with configuration files
- `.mew/space.yaml` defining participants
- `.mew/tokens/` directory with authentication tokens
- `.mew/logs/` directory for envelope history
- `logs/` directory for process logs

### Step 2: Start the Space

```bash
mew space up
```

This will:
- Start the gateway on port 8080 (or next available port)
- Start the mew AI agent
- Start the cat-maze MCP bridge
- Connect all participants to the gateway

**Tip**: To find out which port the gateway started on:
```bash
pm2 logs cat-maze-gateway --nostream --lines 10 | grep "localhost:"
```

Check that all processes are running:

```bash
pm2 list
```

You should see three processes:
- `cat-maze-gateway` - status: online
- `cat-maze-mew` - status: online
- `cat-maze-cat-maze` - status: online

### Step 3: Test MCP Server with View Tool

Test that the MCP bridge is working by calling the `view` tool to see the maze state.

Get the human participant token:

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

**Expected Result**: The cat-maze MCP bridge should process the request and send back an `mcp/response` with the current maze state.

Check the envelope logs to verify:

```bash
tail -n 20 .mew/logs/envelope-history.jsonl
```

You should see envelopes with:
- `"kind": "mcp/request"` - Your request to cat-maze
- `"kind": "mcp/response"` - Cat-maze's response with the maze state

### Step 4: Ask MEW to Help the Cat Get Home

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

#### Verify Envelope Flow

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

### Step 5: Clean Up

When done testing, stop all processes:

```bash
mew space down
```

Verify all processes stopped:

```bash
pm2 list
```

### Cat-Maze Success Criteria

✅ Space initialized with cat-maze template
✅ All three processes started and show status: online
✅ View tool call succeeded without crashes
✅ MEW agent received chat message
✅ MEW agent sent reasoning/start and reasoning/thought messages
✅ MEW agent called MCP tools (view, movement commands)
✅ Cat-maze MCP bridge responded to tool calls
✅ Cat started moving through the maze
✅ All processes stopped cleanly

## Isometric Fleet Template

The isometric fleet template showcases the new world simulation helpers and the accompanying `isometric-fleet` MCP server. Use it when you want to prototype a multiplayer top-down client with streaming positions, patrol agents, and a controllable ship.

### What's in the Isometric Fleet Template?

- **Gateway**: Routes chat, stream, and MCP envelopes between all participants
- **Humans**: Four explorers (`human-1`..`human-4`) ready to connect from clients
- **MEW agents**: Four patrol bots (`agent-1`..`agent-4`) that continually walk square paths
- **Aurora Skiff MCP bridge**: Launches the `isometric-fleet` world server and exposes helm tools

### Step 1: Create and Initialize Space

```bash
mkdir isometric-demo
cd isometric-demo

mew init isometric-fleet --name isometric-demo
```

The initializer copies `.mew/space.yaml`, seeds the MCP bridge config, and prepares token storage.

### Step 2: Start the Space

```bash
mew space up
```

You should see PM2 processes for the gateway, four MEW agents, and the Aurora Skiff MCP bridge. Confirm with `pm2 list`.

### Step 3: Fetch a World Snapshot

Grab a human token and call the `get_world_state` tool to verify the MCP bridge is reachable:

```bash
HUMAN_TOKEN=$(cat .mew/tokens/human-1.token)

curl -X POST "http://localhost:8080/participants/human-1/messages?space=isometric-demo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HUMAN_TOKEN}" \
  -d '{
    "protocol": "mew/v0.4",
    "id": "snapshot-1",
    "from": "human-1",
    "to": ["aurora-skiff"],
    "kind": "mcp/request",
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "get_world_state",
        "arguments": {}
      }
    }
  }'
```

The response contains a structured list of players, their current positions, and the Aurora Skiff velocity.

### Step 4: Steer the Ship

Use `set_ship_heading` to adjust the vessel. This example slows the ship and nudges it north-east:

```bash
curl -X POST "http://localhost:8080/participants/human-1/messages?space=isometric-demo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HUMAN_TOKEN}" \
  -d '{
    "protocol": "mew/v0.4",
    "id": "helm-1",
    "from": "human-1",
    "to": ["aurora-skiff"],
    "kind": "mcp/request",
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "set_ship_heading",
        "arguments": {
          "shipId": "aurora-skiff",
          "headingX": 0.25,
          "headingY": 0.2
        }
      }
    }
  }'
```

Watch the terminal logs or subscribe to the `isometric/world-snapshot` notifications to see the ship and boarded players update.

### Step 5: Board a Player

To put `human-1` on the ship deck:

```bash
curl -X POST "http://localhost:8080/participants/human-1/messages?space=isometric-demo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HUMAN_TOKEN}" \
  -d '{
    "protocol": "mew/v0.4",
    "id": "board-1",
    "from": "human-1",
    "to": ["aurora-skiff"],
    "kind": "mcp/request",
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "board_ship",
        "arguments": {
          "playerId": "human-1",
          "shipId": "aurora-skiff",
          "deckX": 0,
          "deckY": 0
        }
      }
    }
  }'
```

Once boarded, the player will inherit the ship velocity on every world tick. Call `disembark` to place them back on land.

---

## Coder-Agent Template

The coder-agent template provides an AI coding assistant with file system access and a human-in-the-loop approval workflow for file modifications.

### What's in the Coder-Agent Template?

- **mew agent**: An AI coding assistant that can read files and propose modifications
- **mcp-fs-bridge**: A filesystem MCP bridge that executes approved file operations
- **human**: You, with the ability to approve or reject proposals
- **auto-fulfiller** (optional): Automatically approves proposals for automated workflows

The agent can directly call read-only file operations (like `read_file`, `list_directory`), but must create proposals for write operations (like `write_file`, `edit_file`) that require human approval.

### Step 1: Create and Initialize Space

```bash
# Create test directory
mkdir coder-test
cd coder-test

# Initialize with coder-agent template
mew init coder-agent --name coder
```

This creates:
- `.mew/` directory with configuration files
- `.mew/space.yaml` defining participants with capability restrictions
- `.mew/tokens/` directory with authentication tokens
- `.mew/logs/` directory for envelope history
- `.mew/agents/auto-fulfiller.js` - optional auto-approval agent
- `logs/` directory for process logs

### Step 2: Start the Space

```bash
mew space up
```

This will:
- Start the gateway on port 8080 (or next available port)
- Start the mew AI agent (coder assistant)
- Start the mcp-fs-bridge (filesystem access)
- Connect all participants to the gateway

**Note**: The auto-fulfiller is disabled by default (`auto_start: false` in space.yaml).

**Tip**: To find out which port the gateway started on:
```bash
pm2 logs coder-gateway --nostream --lines 10 | grep "localhost:"
```

Check that processes are running:

```bash
pm2 list
```

You should see:
- `coder-gateway` - status: online
- `coder-mew` - status: online
- `coder-mcp-fs-bridge` - status: online

### Step 3: Test MCP Filesystem Server Directly

First, let's test the filesystem MCP server directly by writing and reading a file.

Get the human token:

```bash
cat .mew/tokens/human.token
```

**Note**: The curl commands below use port 8080. If your gateway started on a different port, replace 8080 with your actual port number.

#### Write foo.txt with "foo"

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "write-foo",
    "from": "human",
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "write_file",
        "arguments": {
          "path": "foo.txt",
          "content": "foo"
        }
      }
    }
  }'
```

Replace `YOUR_TOKEN_HERE` with your human token.

Check that the file was created:

```bash
cat foo.txt
```

You should see: `foo`

#### Read foo.txt

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "read-foo",
    "from": "human",
    "to": ["mcp-fs-bridge"],
    "kind": "mcp/request",
    "payload": {
      "method": "tools/call",
      "params": {
        "name": "read_file",
        "arguments": {
          "path": "foo.txt"
        }
      }
    }
  }'
```

#### Verify MCP Server Response

Check the envelope logs:

```bash
tail -n 10 .mew/logs/envelope-history.jsonl
```

You should see:
- `"kind": "mcp/request"` - Your request to write/read
- `"kind": "mcp/response"` - Response from mcp-fs-bridge with file content

### Step 4: Ask MEW Agent to Create a File (Proposal Flow)

Now let's ask the MEW agent to write a file. The agent will create a proposal for the write operation.

#### Ask MEW to Write bar.txt

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-write-bar",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "Please create a file called bar.txt with the content \"bar\"",
      "format": "plain"
    }
  }'
```

#### Verify Proposal Flow

Watch the envelope logs:

```bash
tail -f .mew/logs/envelope-history.jsonl
```

You should see:
- `"kind": "chat"` - Your message
- `"kind": "chat/acknowledge"` - MEW acknowledging
- `"kind": "stream/request"` - MEW requesting stream
- `"kind": "reasoning/start"` - MEW starting to reason
- `"kind": "reasoning/thought"` - MEW planning the file write
- `"kind": "mcp/proposal"` - **MEW proposing a file write operation**
  - Look for `"method": "tools/call"`
  - Look for `"name": "write_file"`
  - Look for `"path": "bar.txt"` and `"content": "bar"`
- `"kind": "reasoning/thought"` - MEW explaining it needs approval
- `"kind": "chat"` - MEW asking you to confirm the operation
- `"kind": "reasoning/conclusion"` - MEW finishing reasoning
- `"kind": "stream/close"` - MEW closing the stream

The agent **cannot execute the write operation** directly. It creates a proposal and sends you a chat message explaining that the file write requires your approval.

### Step 5: Fulfill the Proposal

**How Proposal Fulfillment Works**:
1. Agent sends `mcp/proposal` with the operation it wants to perform
2. You (with appropriate capabilities) send an `mcp/request` to execute it
3. Your `mcp/request` must have `correlation_id` referencing the proposal's `id`
4. The payload of your request should match the proposal's payload
5. The target (mcp-fs-bridge) responds to you
6. The agent observes the response via broadcast and traces it back through correlation_id

#### Find the Proposal ID

Check the envelope logs for the most recent write_file proposal:

```bash
grep '"kind":"mcp/proposal"' .mew/logs/envelope-history.jsonl | jq -r 'select(.envelope.payload.params.name == "write_file") | .envelope.id + " - " + .timestamp' | tail -1
```

Copy the proposal ID (the UUID before the dash) - you'll need to replace `PROPOSAL_ID_HERE` with it in the next step.

#### Fulfill the Proposal

Send an `mcp/request` that fulfills the proposal:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-approve-bar",
    "from": "human",
    "to": ["mcp-fs-bridge"],
    "correlation_id": ["PROPOSAL_ID_HERE"],
    "kind": "mcp/request",
    "payload": {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "tools/call",
      "params": {
        "name": "write_file",
        "arguments": {
          "path": "bar.txt",
          "content": "bar"
        }
      }
    }
  }'
```

**Important:**
- Replace `PROPOSAL_ID_HERE` with the proposal envelope's `"id"` field
- The `payload` matches the proposal's payload (including `jsonrpc` fields)
- The `correlation_id` links your fulfillment to the original proposal

#### Verify File was Created

```bash
cat bar.txt
```

You should see: `bar`

### Step 6: Grant Write Capability to MEW

Now let's grant the MEW agent the capability to write files directly, demonstrating progressive trust.

#### Send Capability Grant

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "grant-write-capability",
    "from": "human",
    "to": ["mew"],
    "kind": "capability/grant",
    "payload": {
      "recipient": "mew",
      "capabilities": [
        {
          "kind": "mcp/request",
          "payload": {
            "method": "tools/call",
            "params": {
              "name": "write_file"
            }
          }
        }
      ],
      "reason": "Agent has demonstrated safe file handling"
    }
  }'
```

This grants the MEW agent permission to call the `write_file` tool directly.

#### Verify Grant Flow

Check the envelope logs:

```bash
tail -n 10 .mew/logs/envelope-history.jsonl
```

You should see:
1. `"kind": "capability/grant"` - Your grant message
2. `"kind": "system/welcome"` - Gateway sending updated capabilities to the agent
3. `"kind": "capability/grant-ack"` - MEW acknowledging the grant

#### Ask MEW to Write baz.txt

Now ask MEW to write a file. Since it now has the capability, it should call the tool directly instead of creating a proposal:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-write-baz",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "Please create a file called baz.txt with the content \"baz\"",
      "format": "plain"
    }
  }'
```

#### Verify Direct Tool Call (No Proposal!)

Watch the envelope logs:

```bash
tail -f .mew/logs/envelope-history.jsonl
```

You should see:
- `"kind": "chat"` - Your message
- `"kind": "chat/acknowledge"` - MEW acknowledging
- `"kind": "stream/request"` - MEW requesting stream
- `"kind": "reasoning/thought"` - MEW thinking
- **`"kind": "mcp/request"`** with `"name": "write_file"` - **Direct call, no proposal!**
- `"kind": "mcp/response"` - File system bridge confirming the write
- `"kind": "chat"` - MEW confirming completion

**Key Difference:** Notice there's NO `"kind": "mcp/proposal"` this time. The agent went straight to `mcp/request` because it now has the capability.

Verify the file was created:

```bash
cat baz.txt
```

You should see: `baz`

This demonstrates **progressive trust** - the agent started with restricted capabilities (proposal-only), and after demonstrating safe behavior, was granted direct write access.

### Step 7: Understanding Capabilities

The coder agent template demonstrates MEW Protocol's capability system:

#### MEW Agent Can:
- ✅ Send chat messages
- ✅ Send reasoning messages (transparent thinking)
- ✅ Call read-only file tools directly (`read_file`, `list_directory`, etc.)
- ✅ Create proposals for write operations
- ❌ Call write tools directly (`write_file`, `edit_file`, etc.) - unless granted

#### MCP-FS-Bridge Can:
- ✅ Respond to mcp/request messages (execute file operations)
- ✅ Send mcp/response messages
- ❌ Initiate chat or reasoning

#### Human Can:
- ✅ Full capabilities (wildcard `*`)
- ✅ Send any message type
- ✅ Approve proposals by sending mcp/request with correlation_id
- ✅ Grant capabilities to other participants

### Step 8: Clean Up

Stop all processes:

```bash
mew space down
```

Verify all processes stopped:

```bash
pm2 list
```

### Coder-Agent Success Criteria

✅ Space initialized with coder-agent template
✅ All processes started successfully
✅ Agent directly read files without approval
✅ Agent created proposal for write operation
✅ Manual approval of proposal succeeded
✅ File was created after approval
✅ Capability grant system working (agent uses direct calls after grant)
✅ Progressive trust demonstrated (proposal → capability grant → direct call)

### Coder-Agent Key Takeaways

1. **Capability-Based Security**: The MEW Protocol enforces fine-grained permissions at the gateway level
2. **Human-in-the-Loop**: Write operations require explicit approval, preventing unwanted modifications
3. **Proposal Pattern**: Agents can propose operations that require elevated privileges
4. **Progressive Trust**: Capabilities can be granted dynamically to agents that demonstrate safe behavior
5. **Transparent Reasoning**: The agent's thought process is visible through reasoning envelopes

## Note-Taker Template

The note-taker template provides a minimal agent for note-taking tasks.

### What's in the Note-Taker Template?

- **Gateway**: MEW Protocol gateway for message routing
- **note-taker agent**: A simple AI agent for taking and managing notes
- **Human participant**: For interaction

### Quick Start

```bash
# Create test directory
mkdir note-taker-test
cd note-taker-test

# Initialize with note-taker template
mew init note-taker --name notes

# Start the space
mew space up

# Connect and interact
mew client connect
```

The note-taker agent is designed for simple, conversational note-taking without file system access or complex tool integration.

## Next Steps

- Explore [Testing Guide](testing.md) for automated test scenarios
- See [Development Guide](development.md) for creating custom templates
- Read the [Protocol Specification](../spec/protocol/SPEC.md) for deeper protocol understanding
