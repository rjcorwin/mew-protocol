# Proposed ADRs

This folder contains ADRs (Architecture Decision Records) that are currently under consideration.

## Format

**Filename:** `[proposal-number]-[adr-id]-[descriptive-name].md`

- **Proposal number:** Sequential number based on order of proposal (001, 002, etc.)
- **ADR ID:** Unique 3-character alphanumeric identifier (e.g., x7k, m3p)
- **Descriptive name:** Kebab-case description of the decision

## Current Proposals

- `001-x7k-pod-terminology-and-protocol-name.md` - Pod terminology and MCPP naming
- `002-m3p-namespace-pattern.md` - Message kind namespace patterns
- `003-h9j-pod-discovery-and-hub-architecture.md` - Hub discovery architecture
- `004-v2c-proposal-lifecycle-management.md` - Proposal lifecycle extensions
- `005-0-t8k-agent-reasoning-transparency.md` - Agent reasoning transparency through sub-contexts
  - `005-1-k9j-sub-context-protocol-mechanics.md` - Protocol mechanics for implementing sub-contexts
  - `005-2-p4m-context-field-structure.md` - Context field structure and patterns

## Process

1. Create new ADR with next sequential number and unique ID
2. Status should be "Proposed"
3. Incorporation should be "Not Incorporated"
4. Follow the ADR template in `/protocol-spec/CLAUDE.md`
5. After review, ADR moves to either `accepted/` or `rejected/`