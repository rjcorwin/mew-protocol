# MEW Protocol Specifications

This directory contains all MEW Protocol specifications organized by component.

## Active Specifications

### Protocol (Core)
- **[v0.4](protocol/v0.4/SPEC.md)** - Current stable release
  - [Accepted Decisions](protocol/v0.4/accepted/)
  - [Rejected Decisions](protocol/v0.4/rejected/)
- **[Draft](protocol/draft/SPEC.md)** - Next version under development
  - [Accepted Decisions](protocol/draft/accepted/)
  - [Proposed Decisions](protocol/draft/proposed/)
  - [Rejected Decisions](protocol/draft/rejected/)

### CLI (Command-Line Interface)
- **[SPEC.md](cli/SPEC.md)** - Living specification
  - [Accepted Decisions](cli/accepted/)
  - [Proposed Decisions](cli/proposed/)
  - [Rejected Decisions](cli/rejected/)

### SDK (TypeScript)
- **[SPEC.md](sdk/SPEC.md)** - SDK architecture and patterns
  - [Accepted Decisions](sdk/accepted/)
  - [Proposed Decisions](sdk/proposed/)
  - [Rejected Decisions](sdk/rejected/)

### Bridge (MCP Integration)
- **[SPEC.md](bridge/SPEC.md)** - MCP-MEW bridge specification
  - [Accepted Decisions](bridge/accepted/)
  - [Proposed Decisions](bridge/proposed/)
  - [Rejected Decisions](bridge/rejected/)

## Specification Development

### Making Changes

1. Create a decision document in the appropriate `proposed/` directory
2. Discuss and refine in PR review
3. Once accepted, move to `accepted/` directory
4. Update the SPEC.md to incorporate the change

### Decision Document Format

Decision documents follow the Architecture Decision Record (ADR) format:

```markdown
# [Number]. [Title]

**Status**: Proposed | Accepted | Rejected
**Date**: YYYY-MM-DD

## Context
What is the issue we're facing?

## Decision
What are we doing about it?

## Consequences
What becomes easier or more difficult as a result?

## Alternatives Considered
What other options did we evaluate?
```

### Versioning Strategy

- **Protocol**: Uses semantic versioning (v0.4, v0.5, etc.)
  - Breaking changes allowed in v0.x minor versions
  - `v0.4/` is current stable
  - `draft/` is next version under development

- **CLI, SDK, Bridge**: Living documents (no versions)
  - Single `SPEC.md` evolves over time
  - Decisions track the evolution
  - Breaking changes documented in decisions

## Archive

Historical protocol specifications preserved in [archive/](archive/) for reference:
- [v0.0](archive/protocol/v0.0/) - Initial specification
- [v0.1](archive/protocol/v0.1/) - First iteration
- [v0.2](archive/protocol/v0.2/) - Second iteration
- [v0.3](archive/protocol/v0.3/) - Third iteration

Historical CLI versions:
- [v0.0.0](archive/cli/v0.0.0/) - Initial CLI spec
- [v0.1.0](archive/cli/v0.1.0/) - First CLI iteration

## Navigation

- **For Users**: Start with [Protocol v0.4](protocol/v0.4/SPEC.md) to understand MEW Protocol
- **For CLI Users**: See [CLI Spec](cli/SPEC.md) for command-line interface details
- **For Developers**: Check [SDK Spec](sdk/SPEC.md) for TypeScript SDK patterns
- **For MCP Integration**: Review [Bridge Spec](bridge/SPEC.md) for MCP-MEW bridge

## Related Documentation

- [Main Documentation Hub](../docs/README.md)
- [Development Guide](../docs/development.md)
- [Testing Guide](../docs/testing.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
