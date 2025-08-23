# ADR-001: Layered SDK Architecture

## Status
Proposed

## Context
MCPx needs an SDK that supports diverse use cases:
- Simple protocol clients (dashboards, bridges)
- Generic agents (task automation, AI assistants)
- Biomes-specific agents (space representatives, NPCs)
- Future domain-specific extensions

We need clear separation between protocol handling, agent abstractions, and domain logic.

## Decision
Adopt a four-layer architecture:
1. **@mcpx/client**: Pure protocol implementation
2. **@mcpx/agent**: Generic agent abstractions
3. **@mcpx/biome-agent**: Biomes-specific framework
4. **Implementations**: Concrete agents

Each layer depends only on layers below it.

## Consequences

### Positive
- Clear separation of concerns
- Each layer is independently useful
- Maximum code reuse
- Easy to test each layer in isolation
- New domains can extend from appropriate layer
- Protocol changes isolated to client layer

### Negative
- More packages to maintain
- Potential for version mismatches between layers
- Learning curve for understanding layer responsibilities
- Some overhead in layer boundaries

## Implementation Notes
```typescript
// Clean dependency chain
@mcpx/client
    ↓
@mcpx/agent (extends client)
    ↓
@mcpx/biome-agent (extends agent)
    ↓
GreenhouseBot (extends biome-agent)
```

## Alternatives Considered
1. **Monolithic SDK**: All functionality in one package
   - Rejected: Too rigid, forces unnecessary dependencies
2. **Two layers** (client + agent): No domain separation
   - Rejected: Biomes concepts would pollute generic agent
3. **Plugin-only architecture**: Everything as plugins
   - Rejected: No clear structure, harder to understand