# ADR-cmp: Composition Over Inheritance

**Status:** Accepted  
**Date:** 2025-09-12  
**Incorporation:** Complete

## Context

The current SDK implementation uses inheritance for the three-layer architecture:
- `MEWParticipant extends MEWClient`
- `MEWAgent extends MEWParticipant`

This creates tight coupling between layers and violates the principle of composition over inheritance. It also makes it difficult to:
- Test layers independently
- Swap implementations
- Extend functionality without modifying base classes
- Maintain clear separation of concerns

The inheritance chain also leads to confusion about which layer is responsible for what functionality, as child classes have direct access to parent implementation details.

## Options Considered

### Option 1: Keep Inheritance (Current)
Continue with the current inheritance model.

**Pros:**
- No breaking changes needed
- Simple to understand inheritance chain
- Direct access to parent methods
- Less code to write initially

**Cons:**
- Tight coupling between layers
- Difficult to test in isolation
- Violates SOLID principles
- Hard to extend without modification
- Unclear separation of concerns

### Option 2: Use Composition
Refactor to use composition, where each layer contains an instance of the lower layer.

**Pros:**
- Clear separation of concerns
- Easy to test with mocks
- Follows SOLID principles
- Flexible and extensible
- Can swap implementations
- Better encapsulation

**Cons:**
- Breaking change for existing code
- Need to expose necessary methods
- Slightly more verbose
- Requires delegation methods

### Option 3: Hybrid Approach
Use composition internally but maintain inheritance for backwards compatibility.

**Pros:**
- Backwards compatible
- Gradual migration path
- Benefits of composition internally

**Cons:**
- More complex implementation
- Maintains confusing public API
- Technical debt

## Decision

**Option 2: Use Composition** should be adopted for the next major version.

The architecture should be refactored to:

```typescript
class MEWParticipant {
  private client: MEWClient;
  
  constructor(options: ParticipantOptions) {
    this.client = new MEWClient(options);
    this.setupEventHandlers();
  }
  
  // Delegate connection methods
  async connect(): Promise<void> {
    return this.client.connect();
  }
  
  // Use client for sending
  protected send(envelope: Envelope): void {
    this.client.send(envelope);
  }
}

class MEWAgent {
  private participant: MEWParticipant;
  
  constructor(config: AgentConfig) {
    this.participant = new MEWParticipant(config);
    this.setupAutonomousBehavior();
  }
  
  // Delegate to participant
  async start(): Promise<void> {
    await this.participant.connect();
    // Start agent-specific behavior
  }
}
```

### Implementation Details

1. **MEWClient** remains standalone
   - Pure transport layer
   - No knowledge of higher layers
   - Event-based communication

2. **MEWParticipant** contains MEWClient
   - Creates and manages client instance
   - Subscribes to client events
   - Exposes protocol-level API
   - Hides transport details

3. **MEWAgent** contains MEWParticipant
   - Creates and manages participant instance
   - Subscribes to participant events
   - Adds autonomous behavior
   - Hides protocol details

4. **Migration Strategy**
   - Create new major version (2.0)
   - Provide migration guide
   - Maintain 1.x branch for fixes
   - Deprecation warnings in 1.x

## Consequences

### Positive
- **Better Testing**: Each layer can be tested with mocked dependencies
- **Clear Contracts**: Explicit interfaces between layers
- **Flexibility**: Can swap implementations (e.g., different transports)
- **Maintainability**: Changes isolated to specific layers
- **Extensibility**: Easy to add new functionality without modifying core
- **Better Documentation**: Clear separation makes documentation clearer

### Negative
- **Breaking Change**: Existing code will need updates
- **More Code**: Need delegation methods and interfaces
- **Learning Curve**: Developers need to understand new structure
- **Migration Effort**: Existing applications need refactoring