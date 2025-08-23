# MCPx SDK Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the MCPx SDK. These document the key architectural decisions made in designing the multi-layered SDK architecture.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-layered-architecture.md) | Layered SDK Architecture | Proposed | 2025-01-23 |
| [002](002-client-layer-design.md) | Client Layer Design | Proposed | 2025-01-23 |
| [003](003-agent-memory-system.md) | Agent Memory System | Proposed | 2025-01-23 |
| [004](004-biome-participant-model.md) | Biome Participant Unification | Proposed | 2025-01-23 |

## Architecture Overview

The MCPx SDK follows a four-layer architecture:

```
Implementations (GreenhouseBot, PirateNPC)
         ↓
@mcpx/biome-agent (Biomes framework)
         ↓
@mcpx/agent (Generic agent abstractions)
         ↓
@mcpx/client (Protocol handling)
```

## Key Decisions Summary

### Layered Architecture (ADR-001)
Clean separation of protocol, agent abstractions, domain framework, and implementations. Each layer only depends on layers below it.

### Client Design (ADR-002)
The client layer is a thin, stateless protocol handler useful for any MCPx client, not just agents. No agent concepts at this layer.

### Memory System (ADR-003)
Three-tier memory (short-term, working, long-term) provides flexibility for different agent complexities while working out-of-the-box.

### Participant Model (ADR-004)
In Biomes, users, agents, and spaces are all unified as participants with different roles, simplifying the model and enabling space representatives.

## Design Principles

1. **Separation of Concerns**: Each layer has a clear, focused responsibility
2. **Progressive Enhancement**: Start simple, add complexity as needed
3. **Protocol Agnostic**: Agent concepts separate from MCPx protocol
4. **Domain Isolation**: Biomes concepts don't pollute generic layers
5. **Testability**: Each layer independently testable
6. **Extensibility**: New domains can extend from any layer

## Open Questions

1. Should we provide TypeScript decorators for common agent patterns?
2. How do we handle agent migration between topics?
3. Should the client layer support multiple simultaneous topics?
4. Do we need a separate package for testing utilities?
5. How do we manage version compatibility between layers?

## Future ADRs

Potential topics for future decisions:
- Plugin architecture details
- Testing framework design
- Performance optimization strategies
- LLM integration patterns
- Agent orchestration patterns
- Cross-topic federation

## ADR Template

When creating a new ADR, use this template:

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[Why are we making this decision? What problem are we solving?]

## Decision
[What have we decided to do?]

## Consequences

### Positive
- [Good things that will result]

### Negative
- [Trade-offs and downsides]

## Implementation
[Optional: Code examples, architecture diagrams, etc.]

## Alternatives Considered
[Other options that were evaluated and why they were rejected]
```