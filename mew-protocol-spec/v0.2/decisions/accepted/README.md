# Accepted ADRs

This folder contains ADRs that have been reviewed and accepted for implementation.

## Format

**Filename:** `[proposal-number]-[adr-id]-[descriptive-name].md`

- **Proposal number:** Maintains the original number from when it was proposed
- **ADR ID:** The same unique identifier from the proposal stage
- **Descriptive name:** Same descriptive name from proposal

## Status Tracking

Each accepted ADR should have:
- **Status:** "Accepted"
- **Incorporation:** Track implementation progress
  - "Not Incorporated" - Accepted but not yet in spec
  - "Partial" - Some aspects implemented
  - "Complete" - Fully incorporated into specification

## Currently Accepted

All ADRs have been accepted and fully incorporated into the MEUP specification:

- `001-0-x7k-protocol-name.md` - Protocol naming (chose MEUP)
- `001-1-y3m-communication-space-terminology.md` - Terminology for communication spaces (chose "space")
- `002-0-m3p-namespace-pattern.md` - Message kind namespace patterns (chose Option 7: Minimal Kind)
- `002-1-q8f-capability-definitions.md` - Capability definition conventions (chose Option 1: JSON Pattern Matching)
- `003-v2c-proposal-lifecycle-management.md` - Proposal lifecycle extensions (withdraw/reject)
- `004-0-t8k-agent-reasoning-transparency.md` - Agent reasoning transparency through sub-contexts
- `004-1-k9j-sub-context-protocol-mechanics.md` - Protocol mechanics for implementing sub-contexts
- `004-2-p4m-context-field-structure.md` - Context field structure and patterns
- `005-g7r-capability-delegation.md` - Dynamic capability delegation and grants (chose capability/* and space/* namespaces)
- `006-h2n-correlation-id-structure.md` - Correlation ID as array of strings (chose Option 2: Always Array)
- `007-j3k-property-naming-convention.md` - Property naming convention (chose Option 4: Follow MCP with snake_case)
- `008-n5r-protocol-kind-separator.md` - Protocol-kind separator convention (chose slash notation)

## Moving from Proposed

When an ADR is accepted:
1. Move file from `proposed/` to `accepted/`
2. Keep the same filename (preserves proposal order)
3. Update Status to "Accepted"
4. Track Incorporation status as implementation progresses