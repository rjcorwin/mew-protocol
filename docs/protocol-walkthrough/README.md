# Protocol Walkthrough: MCP, A2A, and MEUP

## Introduction

This walkthrough demonstrates three complementary protocols in the AI ecosystem using a simple calculator example. We'll show how each protocol addresses different architectural needs and how they can work together.

Our example: A user asks "What's 41 + 1?" and an AI agent uses a calculator tool to compute the answer before responding.

## Overview of Protocols

### MCP (Model Context Protocol)
**Focus:** Tool and resource connectivity for individual AI applications  
**Problem Solved:** Standardizing how AI models access external tools and data sources  
**Architecture:** Client-server between AI host and tool servers

### A2A (Agent-to-Agent)
**Focus:** Inter-agent communication and collaboration  
**Problem Solved:** Enabling independent AI agents to discover and delegate work to each other  
**Architecture:** Peer-to-peer between autonomous agents with task management

### MEUP (Multi-Entity Unified-context Protocol)
**Focus:** Transparent multi-party orchestration with security  
**Problem Solved:** Providing visibility and control over AI interactions through capability-based access  
**Architecture:** Broadcast messaging in shared spaces with gateway enforcement

---

## Example 1: MCP - Direct Tool Access

### Topology
```
User → AI Host (Client) → Calculator Server
```

### How It Works

1. **Setup Phase:**
   - Calculator Server implements MCP server with a `calculate` tool
   - AI Host connects to Calculator Server via stdio/HTTP
   - Server advertises available tools during initialization

2. **Execution Flow:**

**User asks:** "What's 41 + 1?"

**AI Host discovers tools:**
```json
// Client → Server
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

// Server → Client
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [{
      "name": "calculate",
      "description": "Perform mathematical calculations",
      "inputSchema": {
        "type": "object",
        "properties": {
          "expression": {
            "type": "string",
            "description": "Mathematical expression to evaluate"
          }
        },
        "required": ["expression"]
      }
      // Note: outputSchema is optional in MCP
      // When provided, it defines the structure of the tool's return value
      // When omitted (as here), tools return flexible content arrays
    }]
  }
}
```

**AI invokes the tool:**
```json
// Client → Server
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "calculate",
    "arguments": {
      "expression": "41 + 1"
    }
  }
}

// Server → Client
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{
      "type": "text",
      "text": "42"
    }]
  }
}
```

**AI responds:** "41 + 1 equals 42"

### Key Characteristics
- **Direct connection** between AI and tools
- **Synchronous** request-response pattern
- **Simple** tool discovery and invocation
- **Optional output schemas** - tools can define structured return types or use flexible content arrays
- **No inter-agent communication**

### Problem Solved
MCP standardizes tool integration, allowing any AI application to use any MCP-compliant tool server without custom integrations.

---

## Example 2: A2A - Agent Delegation

### Topology
```
User → Conversational Agent → Calculator Agent
         (A2A Client)           (A2A Server)
```

### How It Works

1. **Setup Phase:**
   - Calculator Agent publishes an Agent Card describing its capabilities
   - Conversational Agent discovers Calculator Agent via registry or direct configuration
   - Both agents maintain independent state and can handle long-running tasks

2. **Execution Flow:**

**User asks Conversational Agent:** "What's 41 + 1?"

**Step 1: Conversational Agent discovers Calculator Agent:**
```json
// GET https://calc-agent.example.com/.well-known/agent-card.json
// Response: Agent Card
{
  "protocolVersion": "0.2.9",
  "name": "Calculator Agent",
  "description": "Specialized agent for mathematical calculations",
  "url": "https://calc-agent.example.com/a2a/v1",
  "preferredTransport": "JSONRPC",
  "skills": [{
    "id": "arithmetic",
    "name": "Arithmetic Operations",
    "description": "Perform basic mathematical calculations",
    "inputModes": ["text/plain", "application/json"],
    "outputModes": ["application/json", "text/plain"]
  }]
}
```

**Step 2: Conversational Agent sends calculation request:**
```json
// POST https://calc-agent.example.com/a2a/v1
// Option A: Natural language message (agent interprets intent)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Calculate: 41 + 1"
      }],
      "messageId": "msg-456"
    }
  }
}

// Option B: Structured message (more explicit intent)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Please perform this calculation"
      }, {
        "kind": "data",
        "data": {
          "operation": "calculate",
          "expression": "41 + 1"
        }
      }],
      "messageId": "msg-456"
    }
  }
}
```

**Step 3: Calculator Agent processes and returns task:**
```json
// Response from Calculator Agent
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "task-123",
    "contextId": "ctx-789",
    "status": {
      "state": "completed",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    "history": [{
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Calculate: 41 + 1"
      }],
      "messageId": "msg-456",
      "taskId": "task-123",
      "contextId": "ctx-789"
    }],
    "artifacts": [{
      "artifactId": "art-101",
      "name": "calculation_result",
      "parts": [{
        "kind": "text",
        "text": "The result is 42"
      }, {
        "kind": "data",
        "data": {
          "expression": "41 + 1",
          "result": 42,
          "timestamp": "2024-01-01T10:00:00Z"
        }
      }]
    }],
    "kind": "task"
  }
}
```

**Step 4: (Optional) Check task status later:**
```json
// POST https://calc-agent.example.com/a2a/v1
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "id": "task-123"
  }
}
// Returns the same task object with current status
```

**Conversational Agent responds to user:** "According to my calculations, 41 + 1 equals 42"

### Key Characteristics
- **Agent autonomy** - each agent is independent
- **Message-based** communication - agents interpret messages, not direct function calls
- **Task-based** interactions with state management
- **Asynchronous** support (streaming, webhooks)
- **Discovery** through Agent Cards
- **Multiple transports** (JSON-RPC, gRPC, REST)

### Key Difference from MCP
Unlike MCP where clients directly invoke specific tools, A2A agents communicate through messages that the receiving agent interprets. This allows agents to:
- Use natural language understanding to interpret requests
- Maintain context across multiple messages
- Decide how to handle requests based on their own logic
- Evolve their capabilities without breaking client integrations

### Problem Solved
A2A enables specialized agents to collaborate without knowing each other's internal implementation, creating an ecosystem of interoperable AI services.

---

## Example 3: A2A + MCP - Protocol Layering

### Topology
```
User → Conversational Agent → Calculator Agent → MCP Calculator Server
         (A2A Client)           (A2A Server +        (Tool Server)
                                 MCP Client)
```

### How It Works

This example shows how the Calculator Agent from Example 2 can internally use the MCP Calculator Server from Example 1, demonstrating protocol layering.

1. **Setup Phase:**
   - MCP Calculator Server runs as a subprocess or service
   - Calculator Agent connects to MCP server as a client
   - Calculator Agent exposes A2A interface to other agents
   - Conversational Agent discovers Calculator Agent via A2A

2. **Execution Flow:**

**User asks:** "What's 41 + 1?"

**Step 1: Conversational Agent sends message to Calculator Agent (A2A):**
```json
// POST https://calc-agent.example.com/a2a/v1
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{
        "kind": "text",
        "text": "Calculate: 41 + 1"
      }]
    }
  }
}
```

**Step 2: Calculator Agent internally calls MCP tool:**
```json
// Calculator Agent → MCP Server (stdio or HTTP)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "calculate",
    "arguments": {
      "expression": "41 + 1"
    }
  }
}

// MCP Server → Calculator Agent
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "42"
    }]
  }
}
```

**Step 3: Calculator Agent wraps MCP result in A2A task response:**
```json
// Response to Conversational Agent
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "task-123",
    "status": {
      "state": "completed"
    },
    "artifacts": [{
      "parts": [{
        "kind": "text",
        "text": "The result is 42"
      }, {
        "kind": "data",
        "data": {
          "expression": "41 + 1",
          "result": 42,
          "mcp_tool_used": "calculate"  // Metadata showing MCP usage
        }
      }]
    }],
    "kind": "task"
  }
}
```

### Architecture Benefits

This layered approach provides several advantages:

1. **Separation of Concerns:**
   - MCP handles low-level tool execution
   - A2A handles high-level agent communication
   - Each protocol does what it does best

2. **Reusability:**
   - The same MCP Calculator Server can be used by multiple agents
   - The Calculator Agent can switch tool providers without changing its A2A interface
   - Tools remain simple and focused

3. **Flexibility:**
   - Calculator Agent can aggregate multiple MCP tools
   - Can add caching, validation, or rate limiting between layers
   - Can transform or enhance tool results before returning them

### Example: Agent Using Multiple MCP Servers

```
Calculator Agent
    ├── Basic Math MCP Server (arithmetic)
    ├── Scientific MCP Server (trigonometry, logarithms)
    └── Statistics MCP Server (mean, median, standard deviation)
```

The Calculator Agent could intelligently route requests to different MCP servers based on the operation needed, while presenting a unified A2A interface to other agents.

### Key Insights
- **A2A is for agent collaboration** - handles discovery, messaging, and task management
- **MCP is for tool access** - handles direct function calls and resource access
- **Agents can be both A2A servers and MCP clients** - bridging the two protocols
- **This pattern scales** - agents can compose complex capabilities from simple tools

---

## Example 4: MEUP - Controlled Multi-Party Orchestration

### Topology
```
        MEUP Gateway (WebSocket)
       /      |        |        \
    User  Assistant  Calculator  Observer
           Agent      Agent      (Human)
```

### How It Works

1. **Setup Phase:**
   - All participants connect to MEUP gateway via WebSocket
   - Gateway assigns capabilities based on trust levels
   - Assistant has proposal-only capability
   - Calculator has full MCP capability
   - Human observer can approve/reject proposals

2. **Execution Flow:**

**User joins space:**
```json
// Gateway → User (welcome message)
{
  "protocol": "meup/v0.2",
  "id": "env-welcome-1",
  "from": "system:gateway",
  "to": ["user"],
  "kind": "system/welcome",
  "payload": {
    "you": {
      "id": "user",
      "capabilities": [
        {"kind": "chat"}
      ]
    },
    "participants": [
      {
        "id": "assistant",
        "capabilities": [
          {"kind": "mcp/proposal"},
          {"kind": "chat"}
        ]
      },
      {
        "id": "calculator",
        "capabilities": [
          {"kind": "mcp/*"},
          {"kind": "chat"}
        ]
      }
    ]
  }
}
```

**User asks in chat:**
```json
{
  "protocol": "meup/v0.2",
  "id": "msg-1",
  "from": "user",
  "kind": "chat",
  "payload": {
    "text": "What's 41 + 1?"
  }
}
```

**Assistant proposes calculation (can't execute directly):**
```json
{
  "protocol": "meup/v0.2",
  "id": "prop-1",
  "from": "assistant",
  "to": ["calculator"],
  "kind": "mcp/proposal",
  "payload": {
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {"expression": "41 + 1"}
    }
  }
}
```

**Human observer sees proposal and approves by fulfilling it:**
```json
{
  "protocol": "meup/v0.2",
  "id": "req-1",
  "from": "human",
  "to": ["calculator"],
  "kind": "mcp/request",
  "correlation_id": ["prop-1"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "calculate",
      "arguments": {"expression": "41 + 1"}
    }
  }
}
```

**Calculator responds:**
```json
{
  "protocol": "meup/v0.2",
  "id": "resp-1",
  "from": "calculator",
  "to": ["human"],
  "kind": "mcp/response",
  "correlation_id": ["req-1"],
  "payload": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "content": [{
        "type": "text",
        "text": "42"
      }]
    }
  }
}
```

**Assistant observes response and answers user:**
```json
{
  "protocol": "meup/v0.2",
  "id": "msg-2",
  "from": "assistant",
  "kind": "chat",
  "payload": {
    "text": "The answer is 42. A human approved my calculation request."
  }
}
```

### Key Characteristics
- **Full transparency** - all messages visible to all participants
- **Capability-based security** - untrusted agents can only propose
- **Human-in-the-loop** approval for sensitive operations
- **Progressive trust** - capabilities can be expanded over time
- **Broadcast messaging** within shared spaces

### Problem Solved
MEUP provides visibility and control over AI interactions, enabling safe deployment of untrusted agents through proposal/approval patterns and progressive automation.

---

## Example 5: Complete Protocol Composition

The protocols can be combined for sophisticated architectures:

### Scenario: Enterprise AI Assistant Platform

```
                    A2A Protocol
    Corporate ←─────────────────────→ Specialized
    Assistant                          Math Service
        ↓                                   ↓
    MCP Protocol                      MCP Protocol
        ↓                                   ↓
    Local Tools                      Calculator
                                      Database
    
    All interactions visible in MEUP Space:
    ┌──────────────────────────────────────┐
    │         MEUP Gateway                  │
    │  [Corporate Assistant]                │
    │  [Math Service]                       │
    │  [Security Team Observer]             │
    │  [Audit Logger]                       │
    └──────────────────────────────────────┘
```

### How They Work Together

1. **MCP** provides tool connectivity:
   - Corporate Assistant uses MCP to access local company tools
   - Math Service uses MCP to access specialized calculators

2. **A2A** enables agent collaboration:
   - Corporate Assistant delegates complex math to Math Service
   - Maintains task state and handles long-running operations
   - Services discover each other through Agent Cards

3. **MEUP** adds visibility and control:
   - All agent interactions broadcast in shared space
   - Security team can monitor and intervene
   - Untrusted services start with proposal-only capabilities
   - Progressive trust through observed behavior

### Example Flow

1. User asks Corporate Assistant: "Calculate the compound interest on $10,000 at 5% for 3 years"
2. Assistant recognizes need for specialized calculation
3. In MEUP space, Assistant proposes delegation to Math Service (visible to all)
4. Security observer approves the delegation
5. Via A2A, Assistant sends task to Math Service
6. Math Service uses MCP to invoke its calculation tools
7. Results flow back through A2A to Assistant
8. All interactions logged in MEUP space for audit

---

## Comparison Summary

| Aspect | MCP | A2A | MEUP |
|--------|-----|-----|------|
| **Primary Focus** | Tool/resource access | Agent collaboration | Multi-party orchestration |
| **Architecture** | Client-server | Peer-to-peer | Broadcast with gateway |
| **Connection Type** | Direct 1:1 | Direct 1:1 | Many-to-many in spaces |
| **Security Model** | Host controls access | HTTP auth between agents | Capability-based with proposals |
| **Visibility** | Private connections | Private tasks | Full transparency |
| **State Management** | Stateless tools | Stateful tasks | Message correlation |
| **Schema Definition** | Input required, output optional | Input/output modes declared | Message payload constraints |
| **Communication Style** | Direct function calls | Message interpretation | Proposal/approval patterns |
| **Best For** | Tool integration | Agent delegation | Supervised orchestration |

## When to Use Each Protocol

### Use MCP when:
- Building AI applications that need tools/resources
- Integrating existing systems as AI capabilities
- You want simple, direct tool access
- Privacy of operations is important

### Use A2A when:
- Building specialized AI agents that need to collaborate
- Handling long-running, complex tasks
- Agents need to maintain independent state
- You need enterprise-grade agent interoperability

### Use MEUP when:
- You need visibility into AI decision-making
- Security and audit trails are critical
- Deploying untrusted agents safely
- Building human-in-the-loop AI systems
- Progressive automation is a goal

## Conclusion

These three protocols address different layers of the AI ecosystem:

- **MCP** solves the "last mile" problem of tool connectivity
- **A2A** enables the "agent economy" through standardized collaboration
- **MEUP** provides the "trust layer" through transparency and control

Together, they form a comprehensive stack for building sophisticated, safe, and interoperable AI systems. The protocols are designed to work independently or in combination, allowing architects to choose the right tool for each part of their system.