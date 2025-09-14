# ADR-003: Space.yaml Configuration Model for Operational Space Management

## Status
Proposed

## Context

The MEW Protocol specification focuses on message exchange but is silent on operational concerns like:
- How participants are authorized and assigned capabilities
- How local agents are started and managed  
- How spaces are configured and deployed
- How participants discover each other

The current implementation introduces `space.yaml` as a comprehensive configuration system that addresses these operational needs while remaining separate from the protocol specification.

### Current space.yaml Structure:
```yaml
space:
  id: space-identifier
  name: "Human Readable Space Name"
  
participants:
  participant-id:
    tokens: ["token-value"]
    capabilities: 
      - kind: "mcp/*"
      - kind: "chat"
    command: "node"          # Local agent startup
    args: ["./agent.js"]     # Command arguments  
    auto_start: true         # Start with space
    fifo: true              # Create FIFO pipes
    output_log: "./logs/output.log"  # Non-blocking output
    auto_connect: true       # Auto-connect client

defaults:
  capabilities:
    - kind: "mcp/proposal"
    - kind: "chat"
```

## Decision

We will adopt **space.yaml as the primary configuration mechanism** for operational space management, keeping it separate from but complementary to the MEW Protocol specification.

### Configuration Philosophy:
1. **Declarative**: Describe desired state, not procedures
2. **Self-Contained**: All space configuration in one file  
3. **Environment Agnostic**: Same config works across environments
4. **Operation-Focused**: Handles deployment, not protocol semantics
5. **Protocol-Compliant**: Generates valid MEW messages

### Architecture Separation:
```
┌─────────────────────────────────────────┐
│             MEW Protocol                │  Protocol Definition
│  - Message formats and semantics       │  (transport-agnostic)
│  - Capability patterns                 │
│  - Request/response flows              │
├─────────────────────────────────────────┤
│             Gateway Core               │  Protocol Implementation
│  - Message validation and routing      │  (transport-specific)
│  - Capability enforcement              │
│  - Connection management               │
├─────────────────────────────────────────┤
│            Space.yaml + CLI            │  Operational Layer
│  - Participant lifecycle management    │  (deployment-specific)
│  - Process orchestration               │
│  - Configuration and policies          │
└─────────────────────────────────────────┘
```

## Rationale

### Why Configuration File vs Programmatic:

#### space.yaml Advantages:
- **Version Control**: Configuration changes are trackable
- **Environment Portability**: Same config, different deployments
- **Non-Technical Access**: Ops teams can modify without coding
- **Declarative Clarity**: Intent is explicit and reviewable  
- **Tooling Integration**: Standard YAML toolchain support

#### Programmatic Disadvantages:
- **Code Coupling**: Config changes require code changes
- **Runtime Complexity**: Dynamic configuration is harder to debug
- **Access Control**: Requires development access to modify
- **Environment Drift**: Hard to ensure consistency across environments

### Why YAML vs JSON/TOML/etc:

#### YAML Benefits:
- **Human Readable**: Comments, multi-line strings, clear structure
- **Ecosystem**: Widely adopted in DevOps (Docker Compose, Kubernetes)
- **Flexibility**: Supports complex data structures naturally
- **Comments**: Critical for documenting configuration decisions

#### YAML Drawbacks (Acknowledged):
- **Parsing Complexity**: Indentation sensitivity
- **Security**: YAML bombs, injection risks (mitigated by validation)
- **Type Ambiguity**: String vs number inference issues

## Implementation Details

### Configuration Loading Precedence:
```javascript
function loadSpaceConfig() {
  // 1. Command-line flag: --space-config path/to/config.yaml
  if (options.spaceConfig) return loadConfig(options.spaceConfig);
  
  // 2. Environment variable: MEW_SPACE_CONFIG
  if (process.env.MEW_SPACE_CONFIG) return loadConfig(process.env.MEW_SPACE_CONFIG);
  
  // 3. Default location: ./space.yaml
  return loadConfig('./space.yaml');
}
```

### Gateway Integration Pattern:
```javascript
// Gateway requests capability resolution from CLI layer
gateway.setCapabilityResolver(async (token, participantId) => {
  const config = await loadSpaceConfig();
  const participant = findParticipantByToken(config, token);
  return participant?.capabilities || config.defaults?.capabilities || [];
});

// CLI notifies gateway of participant lifecycle events
gateway.onParticipantJoined(async (participantId, token, metadata) => {
  // CLI can update config, spawn local agents, etc.
  await handleNewParticipant(participantId, token);
});
```

### Participant Lifecycle Management:
```yaml
participants:
  calculator-agent:
    type: local                    # Local process vs remote participant
    command: "node"
    args: ["./agents/calculator.js", "--gateway", "ws://localhost:${PORT}"]
    env:
      LOG_LEVEL: "debug"
      CACHE_DIR: "/tmp/calculator-cache"
    auto_start: true              # Start when space starts
    restart_policy: "on-failure"  # PM2 restart policy
    tokens: ["calculator-token"]
    capabilities:
      - kind: "mcp/*"
      - kind: "chat"
```

### FIFO and Output Configuration:
```yaml
participants:
  test-client:
    tokens: ["test-token"]
    capabilities: [{"kind": "chat"}]
    fifo: true                    # Create input FIFO
    output_log: "./logs/test-client.log"  # Non-blocking output
    auto_connect: true           # Auto-connect when space starts
```

## Configuration Validation

### Schema Validation:
```javascript
const spaceConfigSchema = {
  type: 'object',
  required: ['space', 'participants'],
  properties: {
    space: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
        name: { type: 'string' }
      }
    },
    participants: {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z0-9_-]+$': {
          type: 'object',
          properties: {
            tokens: { type: 'array', items: { type: 'string' } },
            capabilities: { type: 'array' },
            command: { type: 'string' },
            // ... additional participant properties
          }
        }
      }
    }
  }
};
```

### Runtime Validation:
- Validate capability patterns against MEW protocol
- Check command paths and executable permissions
- Verify port availability and resource requirements
- Ensure participant IDs are unique within space

## Security Considerations

### Token Management:
- Tokens in configuration files (not ideal but necessary for automation)
- Recommend environment variable substitution: `${TOKEN_VAR}`
- Consider encrypted configuration for production

### Capability Assignment:
- Default to minimal capabilities (proposal-only)
- Explicit capability grants in configuration
- Capability inheritance and overrides

### Process Isolation:
- Each participant runs in separate process
- Environment variable isolation
- File system access controls via process permissions

## Operational Benefits

### Development Workflow:
1. Create `space.yaml` with desired participants
2. Run `mew space up` to start entire environment
3. Modify config and restart as needed
4. Version control configuration changes

### Testing and CI/CD:
```yaml
# test-space.yaml
participants:
  test-agent:
    fifo: true
    output_log: "./test-output.log"
    auto_connect: true
    capabilities: [{"kind": "chat"}]
    
  production-agent:
    command: "node"
    args: ["./dist/agent.js"]
    auto_start: true
```

### Environment Promotion:
- Same `space.yaml` across dev/staging/prod
- Environment-specific values via substitution
- Configuration validation in CI pipeline

## Alternative Approaches Considered

### Database Configuration:
- **Pros**: Dynamic updates, user interfaces
- **Cons**: Infrastructure dependency, complexity
- **Verdict**: Too heavy for local development

### Environment Variables Only:
- **Pros**: 12-factor app compliance, simple
- **Cons**: Complex configuration becomes unwieldy
- **Verdict**: Good for runtime, bad for structure

### Code-Based Configuration:
- **Pros**: Type safety, IDE support
- **Cons**: Requires compilation, less accessible
- **Verdict**: Good for libraries, bad for operations

## Consequences

### Positive:
- **Operational Excellence**: Clear, reviewable configuration
- **Development Velocity**: Rapid environment setup
- **Environment Consistency**: Same config across environments
- **Non-Developer Accessibility**: Ops teams can manage configuration

### Negative:
- **File Management**: One more file to maintain
- **YAML Complexity**: Indentation sensitivity, type issues
- **Security Trade-off**: Tokens in files (mitigated by env vars)
- **Specification Drift**: Operational concerns leak into protocol layer

### Risks:
- **Configuration Bloat**: Feature creep in YAML structure
- **Environment Coupling**: Hard-coded environment assumptions
- **Security Leaks**: Sensitive data in version control
- **Validation Gaps**: Runtime failures due to bad configuration

## Future Evolution

### Template System:
```yaml
# space-template.yaml
space:
  id: "${SPACE_ID}"
  name: "${SPACE_NAME:-Default Space}"

participants:
  agent:
    command: "${AGENT_COMMAND}"
    tokens: ["${AGENT_TOKEN}"]
```

### Configuration Composition:
- Base configurations with overrides
- Include/import mechanisms for reusable components
- Environment-specific overlay files

### Dynamic Reconfiguration:
- Hot-reload capability changes
- Add/remove participants without full restart
- Configuration change notifications

## Migration Path

This decision affects:
1. **Documentation**: Document YAML schema and examples
2. **Validation**: Add comprehensive config validation
3. **Tooling**: Consider configuration generation tools
4. **Testing**: Test various configuration scenarios

## Status Tracking

- [ ] Document complete YAML schema
- [ ] Add configuration validation
- [ ] Create configuration templates for common patterns  
- [ ] Add environment variable substitution support