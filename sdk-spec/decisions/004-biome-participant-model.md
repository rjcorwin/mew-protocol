# ADR-004: Biome Participant Unification

## Status
Proposed

## Context
In Biomes, we want to blur the line between users, agents, and spaces. They should all be treated as participants with different roles and capabilities. This simplifies the mental model and reduces code duplication.

## Decision
In @mcpx/biome-agent, implement a unified participant model where:
- All entities (users, agents, spaces) are participants
- Participants have roles that determine capabilities
- Spaces can have "space representative" participants
- No hard-coded distinction between entity types

## Consequences

### Positive
- Simplified mental model
- Code reuse for participant management
- Spaces can have agency and personality
- Easy to add new participant types
- Natural permission model

### Negative
- May be confusing initially (spaces as participants)
- Need careful role design
- Some operations only make sense for certain types
- Type safety challenges in TypeScript

## Implementation
```typescript
interface Participant {
  id: string
  type: 'user' | 'agent' | 'space'  // Hint, not restriction
  role: 'god' | 'space' | 'participant' | 'observer'
  location: SpaceId
  capabilities: string[]
  metadata: Record<string, any>
}

// A space representative is just a participant
const greenhouseSpirit: Participant = {
  id: 'greenhouse-spirit',
  type: 'space',
  role: 'space',
  location: 'rj-property.greenhouse',
  capabilities: ['narrate', 'manage-climate'],
  metadata: {
    represents: 'rj-property.greenhouse'
  }
}

// Users and agents look the same
const user: Participant = {
  id: 'alice',
  type: 'user',
  role: 'participant',
  location: 'rj-property.greenhouse',
  capabilities: ['chat', 'use-tools'],
  metadata: { name: 'Alice' }
}
```

## Role Definitions

### God Role
- Full control over space and subspaces
- Can modify space structure
- Can change participant roles
- Bypass all permissions

### Space Role
- Represents a specific space
- Can narrate events in that space
- Manages space-specific state
- Limited to their space

### Participant Role
- Standard interaction permissions
- Can use exposed tools
- Can move between spaces (if allowed)
- Can communicate with others

### Observer Role
- Read-only access
- Cannot use tools or send messages
- Useful for monitoring

## Alternatives Considered
1. **Separate classes for each type**: User, Agent, Space classes
   - Rejected: Creates artificial boundaries
2. **No space representatives**: Spaces are just containers
   - Rejected: Loses opportunity for rich interactions
3. **Role-less system**: Capabilities only
   - Rejected: Roles provide useful abstraction