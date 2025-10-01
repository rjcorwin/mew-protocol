# Testing the Coder Agent Template

This walkthrough demonstrates the coder-agent template, which provides an AI coding assistant with file system access and a human-in-the-loop approval workflow for file modifications.

## What is the Coder Agent?

The coder-agent template creates a space with:
- **mew agent**: An AI coding assistant that can read files and propose modifications
- **mcp-fs-bridge**: A filesystem MCP bridge that executes approved file operations
- **human**: You, with the ability to approve or reject proposals
- **auto-fulfiller** (optional): Automatically approves proposals for automated workflows

The agent can directly call read-only file operations (like `read_file`, `list_directory`), but must create proposals for write operations (like `write_file`, `edit_file`) that require human approval.

## Prerequisites

Complete the build and installation from TESTING-CAT-MAZE.md Step 1 first to ensure:
- MEW CLI is built and installed globally (from `packages/mew`)
- You understand how to verify envelope flow

## Step 1: Create Test Space for Coder Agent

```bash
# From the mew-protocol repository root, create test directory
mkdir -p spaces/coder-test
cd spaces/coder-test
```

## Step 2: Initialize Coder Agent Template

```bash
mew init coder-agent --name coder
```

This creates:
- `.mew/` directory with configuration files
- `.mew/space.yaml` defining participants with capability restrictions
- `.mew/tokens/` directory with authentication tokens
- `.mew/logs/` directory for envelope history
- `.mew/agents/auto-fulfiller.js` - optional auto-approval agent
- `logs/` directory for process logs

## Step 3: Start the Space

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

## Step 4: Test MCP Filesystem Server Directly

First, let's test the filesystem MCP server directly by writing and reading a file.

Get the human token:

```bash
cat .mew/tokens/human.token
```

**Note**: The curl commands below use port 8080. If your gateway started on a different port (check the `mew space up` output or use the tip from Step 3), replace 8080 with your actual port number.

### Write foo.txt with "foo"

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

### Read foo.txt

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

### Verify MCP Server Response

Check the envelope logs:

```bash
tail -n 10 .mew/logs/envelope-history.jsonl
```

You should see:
- `"kind": "mcp/request"` - Your request to write/read
- `"kind": "mcp/response"` - Response from mcp-fs-bridge with file content

## Step 5: Ask MEW Agent to Write and Read a File

Now let's ask the MEW agent to write and read a file. The agent will create a proposal for the write operation.

### Ask MEW to Write bar.txt

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

### Verify Proposal Flow

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

The agent **cannot execute the write operation** directly. It creates a proposal and sends you a chat message explaining that the file write requires your approval. The proposal remains pending until you manually fulfill it (Step 6).

### Verify Proposal Timeout

Proposals have a **5-minute timeout**. Let's verify this works correctly by waiting for the timeout.

**Monitor the timeout:**

```bash
# Note the proposal creation timestamp and ID
grep '"kind":"mcp/proposal"' .mew/logs/envelope-history.jsonl | tail -1 | jq -r '.timestamp + " - Proposal ID: " + .envelope.id'

# Monitor agent logs for timeout (this will run in background for 5+ minutes)
( sleep 305 && echo "" && echo "=== Checking for timeout ===" && tail -30 logs/mew.log | grep -E "(not fulfilled|PROPOSAL_TIMEOUT)" ) &

# Note: You can continue working in this terminal while the background job waits
```

After **exactly 5 minutes** (300 seconds), the agent will:
1. Log: `"Proposal <ID> not fulfilled after 300000ms"`
2. Create a `PROPOSAL_TIMEOUT` observation
3. Continue reasoning (iteration 2) and send you a chat message explaining it needs approval

**Verify the timeout occurred:**

```bash
# After 5 minutes have passed, check the agent logs
tail -30 logs/mew.log | grep -A5 "not fulfilled"
```

You should see the timeout error followed by the PROPOSAL_TIMEOUT observation.

## Step 6: Fulfill a Fresh Proposal

The first proposal timed out in Step 5. Now let's create a fresh proposal and fulfill it to test the fulfillment flow.

**How Proposal Fulfillment Works** (from MEW Protocol Spec Section 3.2.1):
1. Agent sends `mcp/proposal` with the operation it wants to perform
2. You (with appropriate capabilities) send an `mcp/request` to execute it
3. Your `mcp/request` must have `correlation_id` referencing the proposal's `id`
4. The payload of your request should match the proposal's payload
5. The target (mcp-fs-bridge) responds to you
6. The agent observes the response via broadcast and traces it back through correlation_id

### Create a Fresh Proposal

Ask MEW to write bar.txt again:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-write-bar-again",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "Please create bar.txt with content \"bar\"",
      "format": "plain"
    }
  }'
```

The agent will create a **fresh proposal** for the same operation.

### Find the Fresh Proposal

Check the envelope logs for the most recent write_file proposal:

```bash
grep '"kind":"mcp/proposal"' .mew/logs/envelope-history.jsonl | jq -r 'select(.envelope.payload.params.name == "write_file") | .envelope.id + " - " + .timestamp' | tail -1
```

This shows the **fresh** proposal's ID and timestamp. Copy the proposal ID (the UUID before the dash) - you'll need to replace `PROPOSAL_ID_HERE` with it in the next step.

### Fulfill the Proposal

Send an `mcp/request` that fulfills the proposal by copying its payload and adding `correlation_id`:

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

### Verify File was Created

```bash
cat bar.txt
```

You should see: `bar`

Check the envelope logs for:
- `"kind": "mcp/request"` - Your approval request (with correlation_id to the fresh proposal)
- `"kind": "mcp/response"` - File system bridge confirming the write

The fresh proposal has been fulfilled and the file created successfully!

### Ask MEW to Read bar.txt

Now ask the MEW agent to read the file it just created:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-read-bar",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "Please read bar.txt and tell me what it contains",
      "format": "plain"
    }
  }'
```

The agent can read directly without approval. Check the envelope logs for:
- `"kind": "chat"` - Your message
- `"kind": "reasoning/thought"` - MEW thinking
- `"kind": "mcp/request"` with `"name": "read_file"` - Direct read (no proposal!)
- `"kind": "mcp/response"` - File contents from mcp-fs-bridge
- `"kind": "chat"` - MEW responding with the file content

## Step 7: Grant Write Capability to MEW

Now let's grant the MEW agent the capability to write files directly, demonstrating capability expansion.

### Send Capability Grant

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

### Verify Grant Acknowledgment

Check the envelope logs:

```bash
tail -n 5 .mew/logs/envelope-history.jsonl
```

You should see:
- `"kind": "capability/grant"` - Your grant message
- `"kind": "capability/grant-ack"` - MEW acknowledging the grant (optional, depending on implementation)

### Ask MEW to Write baz.txt

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

### Verify Direct Tool Call (No Proposal!)

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

### Verify File was Created

```bash
cat baz.txt
```

You should see: `baz`

This demonstrates **progressive trust** - the agent started with restricted capabilities (proposal-only), and after demonstrating safe behavior, was granted direct write access.

## Step 8: Test with Auto-Fulfiller (Optional)

The auto-fulfiller agent can automatically approve proposals for automated workflows.

### Enable Auto-Fulfiller

Edit `.mew/space.yaml` and change:

```yaml
auto-fulfiller:
  auto_start: false  # Change to true
```

Then restart the space:

```bash
mew space down
mew space up
```

Verify auto-fulfiller is running:

```bash
pm2 list | grep auto-fulfiller
```

### Test Auto-Approval

Send another write request:

```bash
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-auto-test",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {
      "text": "Create a file called goodbye.txt with \"Goodbye!\"",
      "format": "plain"
    }
  }'
```

Watch the envelope logs:

```bash
tail -f .mew/logs/envelope-history.jsonl
```

You should see:
- `"kind": "mcp/proposal"` - MEW proposes the write
- **Auto-fulfiller automatically approves** (2 second delay by default)
- `"kind": "mcp/request"` - Auto-approved request to mcp-fs-bridge
- `"kind": "mcp/response"` - File successfully written
- `"kind": "chat"` - MEW confirms completion

Verify the file was created:

```bash
cat goodbye.txt
```

## Step 8: Understanding Capabilities

The coder agent template demonstrates MEW Protocol's capability system:

### MEW Agent Can:
- ✅ Send chat messages
- ✅ Send reasoning messages (transparent thinking)
- ✅ Call read-only file tools directly (`read_file`, `list_directory`, etc.)
- ✅ Create proposals for write operations
- ❌ Call write tools directly (`write_file`, `edit_file`, etc.)

### MCP-FS-Bridge Can:
- ✅ Respond to mcp/request messages (execute file operations)
- ✅ Send mcp/response messages
- ❌ Initiate chat or reasoning

### Human Can:
- ✅ Full capabilities (wildcard `*`)
- ✅ Send any message type
- ✅ Approve proposals by sending mcp/request with correlation_id

### Auto-Fulfiller Can:
- ✅ Monitor proposals (`mcp/proposal`)
- ✅ Approve them by sending `mcp/request` to mcp-fs-bridge
- ✅ Send chat messages to notify participants

## Step 9: Clean Up

Stop all processes:

```bash
mew space down
```

Verify all processes stopped:

```bash
pm2 list
```

## Success Criteria

✅ Space initialized with coder-agent template
✅ All processes started successfully
✅ Agent directly read files without approval
✅ Agent created proposal for write operation
✅ Manual approval of proposal succeeded
✅ File was created after approval
✅ (Optional) Auto-fulfiller automatically approved proposals
✅ Capability restrictions enforced (agent cannot write directly)

## Key Takeaways

1. **Capability-Based Security**: The MEW Protocol enforces fine-grained permissions at the gateway level
2. **Human-in-the-Loop**: Write operations require explicit approval, preventing unwanted modifications
3. **Proposal Pattern**: Agents can propose operations that require elevated privileges
4. **Flexible Workflows**: Auto-fulfiller can be enabled for automated approval in trusted environments
5. **Transparent Reasoning**: The agent's thought process is visible through reasoning envelopes

This template demonstrates how MEW Protocol enables safe AI-powered coding assistants with controlled file system access!
