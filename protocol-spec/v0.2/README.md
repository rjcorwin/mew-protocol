# MEUP Protocol v0.2

**Status:** Experimental  
**Released:** 2025-01-03  
**Protocol Version:** meup/v0.2

## Overview

This is the v0.2 release of the MEUP (Multi-Entity Unified Protocol) specification. This version represents the first complete specification with all foundational ADRs incorporated.

## Key Documents

- **[SPEC.md](./SPEC.md)** - Complete protocol specification
- **[decisions/](./decisions/)** - Architecture Decision Records
  - **[accepted/](./decisions/accepted/)** - Incorporated design decisions
  - **[rejected/](./decisions/rejected/)** - Decisions not adopted
  - **[proposed/](./decisions/proposed/)** - (Currently empty)

## Major Features

- Broadcast messaging within spaces
- Capability-based security with JSON pattern matching
- Proposal/fulfillment pattern for untrusted agents
- Space management operations (invite, kick, grant, revoke)
- Reasoning transparency with context support
- Array-based correlation IDs for workflow support
- Slash notation for message kinds

## Implementation Checklist

See Section 8 of SPEC.md for detailed implementation requirements:
- Section 8.1: Gateway requirements
- Section 8.2: Participant requirements

## Breaking Changes from Previous Versions

This version is NOT backward compatible with v0.0 or v0.1. Key changes:
- Protocol identifier: `meup/v0.2`
- Slash notation for kinds (e.g., `mcp/request`)
- Array correlation IDs
- JSON pattern capabilities

## Future Compatibility

As a v0.x release, breaking changes may occur in future minor versions. Production systems should pin to specific versions until v1.0 provides stability guarantees.

## Contributing

Please submit feedback and contributions to: https://github.com/rjcorwin/mcpx-protocol