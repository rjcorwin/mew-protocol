# Protocol Flow Comparison: Same Task, Different Architectures

This document compares how the same task flows through different protocol architectures. We'll use a concrete example: **A human asks an AI agent to analyze a document and save the summary to a file.**

## The Task

1. Human requests: "Analyze report.pdf and save a summary"
2. Agent needs to read the file (via MCP server)
3. Agent analyzes the content
4. Agent writes summary.txt (via MCP server)
5. Agent reports completion to human

---

## 1. Pure MCP Protocol

In MCP, the human interacts with an agent, which has full control over MCP server access.

```
Human                     Agent                    MCP Server
  │                         │                          │
  ├──"Analyze report.pdf"──►│                          │
  │                         │                          │
  │                         ├──tools/call─────────────►│
  │                         │  (read_file)             │
  │                         │                          │
  │                         │◄──response───────────────┤
  │                         │  (file contents)         │
  │                         │                          │
  │                         │ [analyzes internally]    │
  │                         │                          │
  │                         ├──tools/call─────────────►│
  │                         │  (write_file)            │
  │                         │                          │
  │                         │◄──response───────────────┤
  │                         │  (success)               │
  │                         │                          │
  │◄──"Summary saved"───────┤                          │
  │                         │                          │
```

**Trust Model:** Human must fully trust the agent. The agent decides what to read/write.

**Visibility:** Human only sees the final response. File operations are hidden.

**Example Messages:**

```json
// Human → Agent (proprietary format, not MCP)
"Analyze report.pdf and save a summary"

// Agent → MCP Server
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {"path": "report.pdf"}
  }
}

// MCP Server → Agent
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{"type": "text", "text": "[file contents]"}]
  }
}

// Agent → MCP Server
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "write_file",
    "arguments": {
      "path": "summary.txt",
      "content": "Summary: The report shows..."
    }
  }
}

// Agent → Human
"I've analyzed report.pdf and saved the summary to summary.txt"
```

---

## 2. Agent-to-Agent (A2A) Protocol

In A2A setups, one agent might delegate file operations to another specialized agent.

```
Human              Agent₁              Agent₂           MCP Server
  │                  │                    │                 │
  ├──"Analyze..."───►│                    │                 │
  │                  │                    │                 │
  │                  ├──"Read report.pdf"►│                 │
  │                  │                    │                 │
  │                  │                    ├──tools/call────►│
  │                  │                    │  (read_file)    │
  │                  │                    │                 │
  │                  │                    │◄──response──────┤
  │                  │                    │                 │
  │                  │◄──file contents────┤                 │
  │                  │                    │                 │
  │                  │ [analyzes]         │                 │
  │                  │                    │                 │
  │                  ├──"Write summary"──►│                 │
  │                  │                    │                 │
  │                  │                    ├──tools/call────►│
  │                  │                    │  (write_file)   │
  │                  │                    │                 │
  │                  │                    │◄──response──────┤
  │                  │                    │                 │
  │                  │◄──"Done"───────────┤                 │
  │                  │                    │                 │
  │◄──"Complete"─────┤                    │                 │
  │                  │                    │                 │
```

**Trust Model:** Chain of trust. Human trusts Agent₁, Agent₁ trusts Agent₂.

**Visibility:** Human sees even less. Multiple hidden contexts.

**Example Messages:**

```json
// Human → Agent₁ (proprietary)
"Analyze report.pdf and save a summary"

// Agent₁ → Agent₂ (proprietary A2A protocol)
{
  "request": "read_file",
  "path": "report.pdf"
}

// Agent₂ → MCP Server (standard MCP)
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {"path": "report.pdf"}
  }
}

// Agent₁ → Agent₂
{
  "request": "write_file",
  "path": "summary.txt",
  "content": "Summary: ..."
}
```

---

## 3. MEW Protocol (Direct Execution)

In MEW with direct execution capabilities, all participants are in the same space with full visibility.

```
     ┌─────────────────────────────────┐
     │          Gateway                 │
     └──────┬──────┬──────┬────────────┘
            │      │      │
         Human   Agent  MCP-Server

Message Flow (all visible to all participants):
```

```
Participant    Message                                      Direction
-----------    -------                                      ---------
Human      →   {kind: "chat", payload: {text: "Analyze report.pdf"}}    → All

Agent      →   {kind: "mcp/request", to: ["mcp-server"],               → All
                payload: {method: "tools/call",
                params: {name: "read_file",
                arguments: {path: "report.pdf"}}}}

MCP-Server →   {kind: "mcp/response", to: ["agent"],                   → All
                correlation_id: ["msg-2"],
                payload: {result: {content: [{
                  type: "text", text: "[file contents]"}]}}}

Agent      →   {kind: "mcp/request", to: ["mcp-server"],               → All
                payload: {method: "tools/call",
                params: {name: "write_file",
                arguments: {path: "summary.txt",
                content: "Summary: The report shows..."}}}}

MCP-Server →   {kind: "mcp/response", to: ["agent"],                   → All
                correlation_id: ["msg-4"],
                payload: {result: {success: true}}}

Agent      →   {kind: "chat", to: ["human"],                           → All
                payload: {text: "I've analyzed report.pdf
                and saved the summary to summary.txt"}}
```

**Trust Model:** Gateway enforces capabilities. Agent has `mcp/request` capability.

**Visibility:** Complete. Human sees every operation in real-time.

**Actual MEW Messages:**

```json
// Human → All (via gateway)
{
  "protocol": "mew/v0.3",
  "id": "msg-1",
  "from": "human",
  "kind": "chat",
  "payload": {"text": "Analyze report.pdf and save a summary"}
}

// Agent → MCP Server (via gateway)
{
  "protocol": "mew/v0.3",
  "id": "msg-2",
  "from": "agent",
  "to": ["mcp-server"],
  "kind": "mcp/request",
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {"path": "report.pdf"}
    }
  }
}

// MCP Server → Agent (via gateway)
{
  "protocol": "mew/v0.3",
  "id": "msg-3",
  "from": "mcp-server",
  "to": ["agent"],
  "kind": "mcp/response",
  "correlation_id": ["msg-2"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "content": [{"type": "text", "text": "[file contents]"}]
    }
  }
}
```

---

## 4. MEW Protocol with Proposals (Human-in-the-Loop)

In MEW with proposals, untrusted agents propose operations that humans approve before execution.

```
     ┌─────────────────────────────────┐
     │          Gateway                 │
     └──────┬──────┬──────┬────────────┘
            │      │      │
         Human   Agent  MCP-Server

Agent has only "mcp/proposal" capability
Human has "mcp/request" capability
```

```
Participant    Message                                      Direction
-----------    -------                                      ---------
Human      →   {kind: "chat", payload: {text: "Analyze report.pdf"}}    → All

Agent      →   {kind: "mcp/proposal", to: ["human"],                    → All
                payload: {method: "tools/call",
                params: {name: "read_file",
                arguments: {path: "report.pdf"}}}}

Human      →   {kind: "mcp/request", to: ["mcp-server"],               → All
                correlation_id: ["msg-2"],  // fulfilling proposal
                payload: {method: "tools/call",
                params: {name: "read_file",
                arguments: {path: "report.pdf"}}}}

MCP-Server →   {kind: "mcp/response", to: ["human"],                   → All
                correlation_id: ["msg-3"],
                payload: {result: {content: [...]}}}

Agent      →   {kind: "chat", payload: {                               → All
                text: "I've analyzed the file. Here's the summary:
                [summary text]. May I save this to summary.txt?"}}

Agent      →   {kind: "mcp/proposal", to: ["human"],                    → All
                payload: {method: "tools/call",
                params: {name: "write_file",
                arguments: {path: "summary.txt",
                content: "[summary text]"}}}}

Human      →   {kind: "mcp/request", to: ["mcp-server"],               → All
                correlation_id: ["msg-6"],  // fulfilling proposal
                payload: {method: "tools/call",
                params: {name: "write_file",
                arguments: {path: "summary.txt",
                content: "[summary text]"}}}}

MCP-Server →   {kind: "mcp/response", to: ["human"],                   → All
                correlation_id: ["msg-7"],
                payload: {result: {success: true}}}

Agent      →   {kind: "chat", to: ["human"],                           → All
                payload: {text: "Summary successfully saved!"}}
```

**Trust Model:** Zero initial trust. Human reviews every operation.

**Visibility:** Complete transparency plus human control at every step.

**Key Differences with Proposals:**

1. **Agent proposes** instead of directly executing
2. **Human reviews** the proposed operation (sees exact parameters)
3. **Human fulfills** by sending the actual MCP request
4. **Agent observes** the result (broadcast to all)

**Actual MEW Proposal Messages:**

```json
// Agent → All (PROPOSAL, not request)
{
  "protocol": "mew/v0.3",
  "id": "msg-2",
  "from": "agent",
  "to": ["human"],
  "kind": "mcp/proposal",  // Note: proposal, not request
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {"path": "report.pdf"}
    }
  }
}

// Human → MCP Server (FULFILLING the proposal)
{
  "protocol": "mew/v0.3",
  "id": "msg-3",
  "from": "human",
  "to": ["mcp-server"],
  "kind": "mcp/request",  // Actual request
  "correlation_id": ["msg-2"],  // References the proposal
  "payload": {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {"path": "report.pdf"}
    }
  }
}
```

---

## Summary Comparison

| Aspect | MCP | A2A | MEW (Direct) | MEW (Proposals) |
|--------|-----|-----|--------------|-----------------|
| **Trust Boundary** | At agent | Chain of agents | At gateway | At human |
| **Human Visibility** | Final result only | Less than MCP | Everything | Everything |
| **Human Control** | Before (trust) | Before (trust) | Via capabilities | Per operation |
| **Message Transparency** | Hidden | More hidden | Full broadcast | Full broadcast |
| **Safe for Untrusted** | No | No | Partially | Yes |
| **Progressive Trust** | Binary | Binary | Capability-based | Proposal → Direct |

## Key Insights

1. **MCP/A2A**: Human must trust agents completely upfront
2. **MEW Direct**: Human sets rules, gateway enforces them
3. **MEW Proposals**: Human stays in control, approves each step
4. **Visibility**: Only MEW shows all operations to all participants
5. **Trust Evolution**: Only MEW supports gradual trust building through proposals → capabilities

The proposal mechanism is MEW's key innovation - it allows untrusted agents to participate safely while humans maintain control and build trust incrementally based on observed behavior.