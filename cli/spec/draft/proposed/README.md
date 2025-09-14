# MEW CLI Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) that document key architectural and design decisions made during the implementation of the MEW CLI, particularly where the implementation diverges from or extends the MEW Protocol v0.3 specification.

## Status: Proposed
All ADRs in this directory are currently **proposed** and under review. They document the current state of the CLI implementation and the rationale behind key architectural choices.

## ADR Summary

### [ADR-001: PM2-Based Process Management](./ADR-001-process-management-pm2.md)
**Decision**: Use PM2 as an embedded library for process management with space-local isolation.

**Context**: The CLI needs to manage multiple processes (gateway, agents, clients) reliably across space lifecycles. The implementation chose PM2 over native process management, Docker, or OS services.

**Impact**: 
- ✅ Robust process management with restart policies
- ✅ Space isolation with `.mew/pm2/` per space
- ⚠️ Additional dependency weight (~50MB)
- ⚠️ PM2-specific debugging complexity

---

### [ADR-002: Hybrid WebSocket + HTTP Transport](./ADR-002-hybrid-transport-websocket-http.md)
**Decision**: Implement dual transport supporting WebSocket (primary) and HTTP (auxiliary) for different use cases.

**Context**: While MEW Protocol specifies WebSocket, testing and CI/CD workflows benefit from simple HTTP message injection. The implementation adds an HTTP API for message injection.

**Impact**:
- ✅ WebSocket for interactive/real-time use cases
- ✅ HTTP for testing, automation, and external integration
- ⚠️ Two transport mechanisms to maintain
- ⚠️ Specification drift (HTTP not in MEW spec)

---

### [ADR-003: Space.yaml Configuration Model](./ADR-003-space-yaml-configuration-model.md) 
**Decision**: Adopt `space.yaml` as the primary configuration mechanism for operational space management.

**Context**: MEW Protocol focuses on message exchange but is silent on operational concerns like participant authorization, agent lifecycle, and deployment configuration.

**Impact**:
- ✅ Declarative, version-controlled configuration
- ✅ Environment portability and non-technical accessibility  
- ✅ Clear separation between protocol and operations
- ⚠️ YAML complexity and potential security issues (tokens in files)

---

### [ADR-004: Dual Interactive UI Modes](./ADR-004-dual-interactive-ui-modes.md)
**Decision**: Maintain dual interactive UI modes - Debug (readline-based) and Advanced (Ink/React-based).

**Context**: Different use cases require different levels of UI sophistication. Protocol debugging benefits from simple, reliable interfaces while daily development benefits from rich terminal UIs.

**Impact**:
- ✅ Debug mode: Reliable, testing-friendly, protocol-transparent  
- ✅ Advanced mode: Rich UX, MCP confirmations, reasoning display
- ⚠️ Two codebases to maintain with risk of feature drift
- ⚠️ Additional dependencies for advanced mode

---

### [ADR-005: Join Message Protocol Inconsistency](./ADR-005-join-message-protocol-inconsistency.md)
**Decision**: Standardize on MEW v0.3 compliant `system/join` envelope format and deprecate legacy `type: 'join'` format.

**Context**: The implementation currently uses two different join message formats inconsistently across components, creating protocol compliance and maintenance issues.

**Impact**:
- ✅ Protocol consistency with MEW v0.3 envelope format
- ✅ Future compatibility and tooling support
- ⚠️ Breaking change requiring client migration
- ⚠️ Temporary dual-format complexity during transition

## Architecture Overview

The ADRs collectively document a **layered architecture** that separates protocol implementation from operational concerns:

```
┌─────────────────────────────────────────┐
│             MEW Protocol                │  Transport-agnostic
│  - Message formats and semantics       │  specification
│  - Capability patterns                 │
│  - Request/response flows              │
├─────────────────────────────────────────┤
│             Gateway Core               │  Protocol implementation
│  - Message validation and routing      │  with transport support
│  - Capability enforcement              │
│  - WebSocket + HTTP transport          │
├─────────────────────────────────────────┤
│            CLI Layer                   │  Operational management
│  - PM2 process orchestration          │  and user experience
│  - space.yaml configuration           │
│  - Interactive UI (debug/advanced)     │
│  - Participant lifecycle management    │
└─────────────────────────────────────────┘
```

## Key Design Principles

### 1. **Protocol Compliance with Operational Extensions**
- Core message exchange follows MEW Protocol v0.3
- Operational features (process management, configuration) are implementation extensions
- Clear separation between protocol semantics and deployment concerns

### 2. **Flexibility with Fallbacks**
- Multiple interaction modes (debug vs advanced UI)
- Multiple transport options (WebSocket vs HTTP) 
- Graceful degradation when dependencies are missing

### 3. **Developer Experience Priority**
- Rich interactive experiences for daily use
- Simple, reliable interfaces for testing and debugging
- Comprehensive configuration management via declarative files

### 4. **Testing and Automation Friendly**
- HTTP transport for easy test automation
- Debug UI mode for scriptable interactions
- FIFO support for non-blocking test scenarios

## Implementation Gaps vs Specification

### Current Gaps:
1. **Join Mechanism**: MEW Protocol doesn't define participant join semantics
2. **Configuration**: No specification for operational deployment
3. **Process Management**: Protocol agnostic about process lifecycle
4. **Transport Extensions**: HTTP API is implementation-specific

### Extension Areas:
1. **`system/join` Message Kind**: Implementation-defined join protocol
2. **HTTP Message Injection**: REST API for automated message sending
3. **Space Configuration Schema**: YAML-based operational configuration
4. **Process Orchestration**: PM2-based lifecycle management

## Migration Path

### Immediate Actions (Proposed):
1. Standardize on `system/join` message format across all clients
2. Extract common protocol logic from dual UI implementations
3. Document space.yaml schema comprehensively
4. Add HTTP API to MEW Protocol extension specification

### Future Considerations:
1. **Protocol Standardization**: Propose operational extensions to MEW spec
2. **Code Consolidation**: Extract shared logic across implementation layers
3. **Testing Unification**: Common test patterns across UI modes and transports
4. **Documentation Alignment**: Ensure spec and implementation stay synchronized

## Review Process

These ADRs are proposed for review and discussion. They document current implementation decisions and their rationale. The goal is to:

1. **Clarify Design Intent**: Make architectural decisions explicit
2. **Facilitate Discussion**: Provide context for proposed changes  
3. **Guide Future Development**: Document design principles and constraints
4. **Support Refactoring**: Identify areas for consolidation and improvement

## Contributing

To propose changes or add new ADRs:

1. Create a new ADR file following the established format
2. Include Context, Decision, Rationale, and Consequences sections
3. Link to relevant implementation files and specification sections
4. Submit for review through the standard project review process

## Links

- [MEW Protocol v0.3 Specification](../../../spec/v0.3/SPEC.md)
- [CLI Draft Specification](../SPEC.md) 
- [Implementation Source Code](../../../src/)
- [Test Scenarios](../../../tests/)