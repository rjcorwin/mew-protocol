# Model Context Pod Protocol (MCPP)

An MCPP Pod is a shared context for Services, Agents, and Humans to collaborate as a unit with individual capability controls to facilitate progressive trust systems.

## Core Concepts

1. **Multi-entity collaboration**: Humans, AI agents, robots, and services communicate through both structured MCP operations and unstructured chat messages
2. **Peer-to-peer capabilities**: Every participant is an MCP server, creating a network of shared tools and resources
3. **Capability-based control**: Participants have different permission levels - some can only propose operations (`mcp/proposal/*`) while others can execute them
4. **Shared observable context**: All operations within a pod are visible to all participants, enabling audit trails and pattern learning
5. **Progressive automation**: Orchestrators learn from approval patterns, gradually automating routine decisions while maintaining safety

## Protocol Evolution

MCPP represents a natural progression of agent interaction protocols:

### 1. Coding Agents: Direct Control
**Human → Agent**
- Human directly controls and instructs agent
- Agent executes tasks on behalf of human
- Single point of control, simple trust model

### 2. MCP (Model Context Protocol): Tool Integration
**Human → Agent → MCP Server → Service**
```
┌───────┐      ┌───────┐      ┌────────────┐      ┌─────────┐
│ Human │──────│ Agent │──────│ MCP Server │──────│ Service │
└───────┘      └───────┘      └────────────┘      └─────────┘
               Chat/Control    MCP Tool Use        API Calls
```
- Agent uses MCP to access external services
- Standardized tool interface for service integration
- Human maintains control through agent

### 3. A2A (Agent-to-Agent): Task Delegation
**Human → Primary Agent → Secondary Agent**
```
┌───────┐      ┌────────────┐                    ┌────────────┐
│ Human │──────│   Agent A  │────────────────────│   Agent B  │
└───────┘      └────────────┘                    └────────────┘
           Chat/Control          A2A Tasks             │
                   │                                   │
                   │                              ┌────────────┐
                   └──────────────────────────────│ MCP Server │
                              MCP Tool Use        └────────────┘
```
- Primary agent delegates structured tasks to other agents
- Agents can have their own MCP tool access
- Hierarchical task distribution

### 4. MCPP: Collaborative Pod Architecture
**Multi-Party Collaboration with Capability Control**

```
                           ┌─────────────────────────┐
                           │     MCPP Pod Topic      │
                           │  (Shared Context Space) │
                           └─────────────────────────┘
                                       │
                    ┌──────────────────┼───────────────────┐
                    │                  │                   │
            ┌───────▼────────┐ ┌───────▼────────┐ ┌────────▼────────┐
            │                │ │                │ │                 │
            │   Human User   │ │  Trusted Agent │ │ Untrusted Agent │
            │                │ │                │ │                 │
            │ Capabilities:  │ │ Capabilities:  │ │ Capabilities:   │
            │ - mcp/*        │ │ - mcp/request:*│ │ - mcp/proposal:*│
            │ - chat         │ │ - chat         │ │ - chat          │
            └────────────────┘ └────────────────┘ └─────────────────┘
                    │                  │                   │
                    │                  │                   │
            ┌───────▼────────┐ ┌───────▼────────┐ ┌────────▼───────┐
            │  MCP Server A  │ │  MCP Server B  │ │  MCP Server C  │
            └────────────────┘ └────────────────┘ └────────────────┘
                    │                  │                   │
            ┌───────▼────────┐ ┌───────▼────────┐ ┌────────▼───────┐
            │   Service A    │ │   Service B    │ │   Service C    │
            └────────────────┘ └────────────────┘ └────────────────┘
```

## MCPP Key Concepts

### Shared Context Pod
All participants (humans, agents, services) operate within a shared "pod" - a topic-based communication space where:
- All messages are broadcast by default (full observability)
- Every participant can see the entire conversation and all operations
- Context is shared across all participants in real-time

### Capability-Based Security
Each participant has specific capabilities that control what they can do:
- **Full Access (`mcp/*`)**: Can execute any MCP operation directly
- **Request Only (`mcp/request:*`)**: Can make MCP requests but not proposals
- **Proposal Only (`mcp/proposal:*`)**: Must propose operations for others to execute
- **Response Only (`mcp/response:*`)**: Can only respond to requests, not initiate

### Progressive Trust System
The protocol enables trust to grow over time:
1. **Initial State**: New agents start with minimal capabilities (proposals only)
2. **Observation**: Humans and orchestrators observe agent behavior
3. **Trust Building**: Good behavior leads to expanded capabilities
4. **Automation**: Trusted patterns become automated approvals
5. **Full Autonomy**: Proven agents gain direct execution rights

### Message Types in MCPP

#### Direct MCP Operations
Trusted participants send MCP requests directly:
```json
{
  "kind": "mcp/request:tools/call:read_file",
  "from": "trusted-agent",
  "payload": { /* MCP request */ }
}
```

#### Proposals for Approval
Untrusted participants propose operations:
```json
{
  "kind": "mcp/proposal:tools/call:write_file",
  "from": "untrusted-agent",
  "payload": { /* Proposed operation */ }
}
```

#### Fulfillment by Trusted Party
Trusted participant executes approved proposals:
```json
{
  "kind": "mcp/request:tools/call:write_file",
  "from": "human-user",
  "correlation_id": "proposal-123",
  "payload": { /* Actual execution */ }
}
```

## Example Workflow: Collaborative Code Review

1. **Untrusted Agent** proposes code changes:
   - Sends `mcp/proposal:tools/call:write_file`
   - Visible to all pod participants

2. **Human User** reviews the proposal:
   - Sees the proposed changes in the shared context
   - Can discuss via chat messages
   - Decides whether to approve

3. **Trusted Orchestrator** learns patterns:
   - Observes which proposals get approved
   - Identifies safe operation patterns
   - Begins auto-approving similar proposals

4. **Progressive Automation**:
   - Over time, routine proposals are auto-approved
   - Human focuses on exceptional cases
   - System becomes more autonomous while maintaining safety

## Benefits of MCPP

- **Collaborative Supervision**: Multiple parties can jointly oversee operations
- **Learning from Decisions**: Orchestrators learn from human judgment patterns
- **Gradual Automation**: Systems become more autonomous over time
- **Full Auditability**: All operations visible in the shared context
- **Flexible Trust**: Capabilities can be adjusted based on observed behavior
- **Unified Protocol**: Everything uses MCP at its core, ensuring compatibility

## Protocol Status

Currently in draft specification phase. See `/modelcontextpodprotocol/draft/SPEC.md` for the detailed protocol specification.
