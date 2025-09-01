# ADR-x7k: Protocol Name

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

The protocol needs a clear, memorable name that accurately represents its purpose and capabilities. The current name "MCPx" was a placeholder indicating an extension of MCP. A proper name should:
- Clearly indicate the multi-party nature
- Show the relationship to MCP
- Be memorable and pronounceable
- Accurately represent that humans are first-class participants
- Avoid conflicts with existing protocols

### Decision Drivers
- Accuracy in describing protocol purpose
- Clarity for new users
- Maintaining connection to MCP heritage
- Avoiding naming conflicts
- Marketability and memorability

## Decision

**Adopt MECP (Multi-Entity Context Protocol) as the protocol name**

MECP accurately describes the protocol's core purpose: enabling multiple entities (humans, AI agents, robots, services) to collaborate through a shared context. It maintains the MCP naming pattern while clearly indicating the multi-entity and context-sharing aspects.

## Options Considered

### Option 1: MCPx (Status Quo)

Keep the current MCPx name.

**Pros:**
- Already in use
- Shows MCP extension clearly
- No migration needed

**Cons:**
- Unclear what "x" means
- Sounds like a placeholder
- Doesn't describe functionality

### Option 2: MECP - Multi-Entity Context Protocol (Recommended)

**Pros:**
- Clearly indicates multiple entities (not just models)
- Emphasizes shared context (key differentiator)
- Maintains MCP naming pattern
- Simple, pronounceable, memorable
- Accurately includes humans as entities

**Cons:**
- New acronym to learn
- Requires documentation updates

### Option 3: MPCP - Multi-Participant Context Protocol

**Pros:**
- "Participant" is inclusive of all entity types
- Maintains MCP prefix and pattern
- Clear functional description
- Natural language - everyone understands "participant"
- Avoids technical jargon
- Accurate terminology for the protocol's purpose

**Cons:**
- Very similar to MCP (one letter difference)
- Could be confused in speech/pronunciation
- "Participant" is less distinctive than "Entity"
- Longer acronym (4 letters)

### Option 4: MCPP - Model Context Pod Protocol

**Pros:**
- Maintains MCP prefix
- Includes "pod" terminology
- Clear lineage from MCP

**Cons:**
- "Model" doesn't accurately include human participants
- Ties protocol name to container metaphor
- Less descriptive of actual functionality

### Option 5: MACP - Multi-Agent Context Protocol

**Pros:**
- Clear multi-party indication
- Maintains MCP pattern
- Short and memorable

**Cons:**
- "Agent" may not clearly include humans
- Could imply AI-only system

### Option 6: MCSP - Multi-Context Sharing Protocol

**Pros:**
- Emphasizes context sharing
- Clear functional description

**Cons:**
- Loses direct MCP connection in naming
- Less clear about multi-entity aspect

### Option 7: MXCP - Multi-X Context Protocol

**Pros:**
- X as variable represents any participant type (human, AI, robot, service)
- Mathematically elegant - X as universal placeholder
- Future-proof - doesn't limit participant types
- Distinctive from MCP in pronunciation
- Maintains MCP heritage pattern
- Avoids entity/participant terminology debate
- Cool technical factor

**Cons:**
- X might be unclear without explanation
- Could seem gimmicky or trendy
- Less descriptive than spelled-out names

### Option 8: MEUP - Multi-Entity Unified Protocol

Multiple expansions possible:
- **Multi-Entity Unified Protocol**
- **Multi-Entity Unified-Context Protocol** (more precise)

**Pros:**
- Natural command line usage ("meup into pod")
- Playful "beam me up" connotation
- "Unified Context" precisely describes the shared space
- Memorable and pronounceable
- CLI and protocol name unity
- Action-oriented feeling
- Flexible acronym expansion

**Cons:**
- Less formal/professional sounding
- Could be seen as gimmicky
- Doesn't maintain MCP pattern as clearly
- "Me up" phrasing might not translate well internationally

### Option 9: POD Protocol Variants

Various "POD" acronym expansions were considered (Participant Orchestration & Delegation, etc.)

**Pros:**
- Memorable acronym
- Could align with pod terminology

**Cons:**
- "POD Protocol" name already exists
- Focuses on container metaphor rather than functionality
- Longer full names

## Implementation Details

### Protocol Identifier
```json
{
  "protocol": "mecp/v0.1"
}
```

### Package Naming
- NPM organization: `@mecp`
- Repository: `mecp-protocol` or similar
- Package structure:
  - `@mecp/sdk` - Core SDK
  - `@mecp/gateway` - Gateway server
  - `@mecp/bridge` - MCP-to-MECP bridge
  - `@mecp/cli` - Command-line tools

### Documentation Updates
- Replace all instances of "MCPx" with "MECP"
- Update protocol description to emphasize multi-entity context sharing
- Maintain clear connection to MCP in documentation

## Consequences

### Positive
- **Clear Purpose**: Name describes what the protocol does
- **Inclusive**: "Entity" covers humans, AI, robots, services
- **MCP Heritage**: Maintains naming pattern and connection
- **Professional**: Sounds like a real protocol, not a placeholder
- **No Conflicts**: No known conflicts with existing protocols

### Negative
- **Breaking Change**: Requires updating all references
- **New Learning**: Users must learn new acronym
- **SEO Impact**: Lose any existing "MCPx" search presence

## Migration Path

Since this is v0.x (experimental):
1. Direct cutover to MECP naming
2. Update all documentation
3. Rename packages and repositories
4. Clear communication about the name change
5. No backward compatibility needed in v0.x