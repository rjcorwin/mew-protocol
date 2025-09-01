# Proposed ADRs

This folder contains ADRs (Architecture Decision Records) that are currently under consideration.

## Format

**Filename:** `[proposal-number]-[adr-id]-[descriptive-name].md`

- **Proposal number:** Sequential number based on order of proposal (001, 002, etc.)
- **ADR ID:** Unique 3-character alphanumeric identifier (e.g., x7k, m3p)
- **Descriptive name:** Kebab-case description of the decision

## Current Proposals

- `001-0-x7k-protocol-name.md` - Protocol naming (chose MEUP)
  - `001-1-y3m-communication-space-terminology.md` - Terminology for communication spaces (chose "space")
  - `001-2-d4n-space-configuration.md` - Space configuration specification
- `002-0-m3p-namespace-pattern.md` - Message kind namespace patterns (chose Option 7: Minimal Kind)
  - `002-1-q8f-capability-definitions.md` - Capability definition conventions (chose Option 1: JSON Pattern Matching)
- `003-v2c-proposal-lifecycle-management.md` - Proposal lifecycle extensions
- `004-0-t8k-agent-reasoning-transparency.md` - Agent reasoning transparency through sub-contexts
  - `004-1-k9j-sub-context-protocol-mechanics.md` - Protocol mechanics for implementing sub-contexts
  - `004-2-p4m-context-field-structure.md` - Context field structure and patterns
- `005-g7r-capability-delegation.md` - Dynamic capability delegation and grants

## Process

1. Create new ADR with next sequential number and unique ID
2. Status should be "Proposed"
3. Incorporation should be "Not Incorporated"
4. Follow the ADR template in `/protocol-spec/CLAUDE.md`
5. After review, ADR moves to either `accepted/` or `rejected/`