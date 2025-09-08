# Protocol Examples - Setup and Run Instructions

This directory contains working examples demonstrating MCP, A2A, and MEUP protocols, all using the same calculator scenario where a user asks "What's 41 + 1?" and an agent uses a calculator tool to compute the answer.

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

First, install the WebSocket library needed for MEUP examples:

```bash
cd examples
npm init -y
npm install ws
```

## Running the Examples

### 1. MCP (Model Context Protocol) Example

The MCP example demonstrates direct tool access between an AI host and a calculator server.

**Terminal 1 - Start the Calculator Server:**
```bash
cd mcp
node calculator-server.js
```

**Terminal 2 - Run the Client Demo:**
```bash
cd mcp
node client-demo.js
```

The client will:
- Connect to the calculator server via stdio
- Discover available tools
- Simulate a conversation asking "What's 41 + 1?" and "What's 2^10?"
- Enter interactive mode for custom calculations

### 2. A2A (Agent-to-Agent) Example

The A2A example shows autonomous agents collaborating, with one agent delegating calculations to another.

**Terminal 1 - Start the Calculator Agent:**
```bash
cd a2a
node calculator-agent.js
```

**Terminal 2 - Run the Conversational Agent:**
```bash
cd a2a
node conversational-agent.js
```

The conversational agent will:
- Discover the calculator agent via its Agent Card
- Delegate calculation requests to the calculator agent
- Show task-based interaction with status tracking
- Enter interactive mode for custom questions

### 3. MEUP (Multi-Entity Unified-context Protocol) Example

The MEUP example demonstrates controlled orchestration with capability-based security and proposal/approval patterns.

**Terminal 1 - Start the MEUP Gateway:**
```bash
cd meup
node gateway.js
```

**Terminal 2 - Run the Participants Demo:**
```bash
cd meup
node participants.js
```

The demo will:
- Connect three participants (Assistant, Calculator, Observer) to the gateway
- Show the Assistant proposing calculations (proposal-only capability)
- Have the Observer auto-approve proposals
- Allow the Calculator to execute approved requests
- Enter interactive mode with commands:
  - `chat <message>` - Send a chat message
  - `calc <expression>` - Have the assistant propose a calculation
  - `auto on/off` - Toggle auto-approval
  - `quit` - Exit

### 4. Protocol Composition Example

This example shows all three protocols working together in a single system.

**Terminal 1 - Start the MEUP Gateway:**
```bash
cd meup
node gateway.js
```

**Terminal 2 - Run the Composed System:**
```bash
cd composition
node composed-system.js
```

The composed system demonstrates:
- Corporate Assistant using MCP for local tools (time, policy)
- Corporate Assistant using A2A to delegate to Math Service
- Math Service using embedded MCP calculator
- All interactions visible in MEUP space for monitoring
- Compound interest calculation showing complex delegation
- Interactive mode for custom requests

## Understanding the Examples

### Key Differences

1. **MCP**: Direct, synchronous tool access. Best for trusted, local tools.
2. **A2A**: Task-based, asynchronous agent collaboration. Best for autonomous services.
3. **MEUP**: Controlled, observable multi-party orchestration. Best for security-sensitive environments.

### Message Flow Comparison

| Protocol | Connection | Discovery | Execution | Security |
|----------|------------|-----------|-----------|----------|
| MCP | Stdio/HTTP | Tool listing | Direct RPC | Trust-based |
| A2A | HTTP | Agent Cards | Task-based | Service isolation |
| MEUP | WebSocket | Capability broadcast | Proposal/approval | Capability-based |

### When to Use Each

- **Use MCP** when you need direct, efficient tool access in a trusted environment
- **Use A2A** when agents need to collaborate autonomously with clear task boundaries
- **Use MEUP** when you need visibility, control, and security in multi-party interactions
- **Combine protocols** when building complex systems that need different interaction patterns

## Architecture Notes

### MCP Architecture
```
AI Host <--stdio--> Calculator Server
   |                      |
   └── JSON-RPC 2.0 ──────┘
```

### A2A Architecture
```
Conversational Agent <--HTTP--> Calculator Agent
        |                            |
        └──── Agent Card Discovery ──┘
        └──── Task Management ───────┘
```

### MEUP Architecture
```
     MEUP Gateway
    /     |      \
Assistant Calculator Observer
   |        |         |
proposal  execute  approve
```

### Composed Architecture
```
        MEUP Space (visibility)
             |
    Corporate Assistant
      /            \
   MCP            A2A
(local tools)  (Math Service)
                    |
                   MCP
              (calculator)
```

## Troubleshooting

- If ports 3000, 8080, or 8081 are in use, modify the port numbers in the respective files
- Ensure the MEUP gateway is started before running MEUP-dependent examples
- For the composition example, both the MEUP gateway and Math Service must be running
- Calculator server (MCP) uses stdio, so it must be started in a separate terminal

## Next Steps

- Modify the calculator implementations to add more mathematical operations
- Experiment with different capability configurations in MEUP
- Try building your own agents that combine multiple protocols
- Explore adding authentication and encryption for production use