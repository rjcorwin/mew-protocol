# Protocol Specification Guidelines

## Architecture Decision Records (ADRs)

### Purpose
ADRs document important architectural decisions for the MCPx/MCPP protocol. They provide context, evaluate options, and record decisions with their rationale.

### Directory Structure
Each protocol version maintains its own ADR folders:
```
protocol-spec/
├── v0/
│   ├── decisions/
│   │   ├── proposed/    # ADRs under consideration
│   │   ├── accepted/    # Approved ADRs
│   │   └── rejected/    # Rejected ADRs
│   ├── SPEC.md
│   └── PATTERNS.md
└── v1/                   # Future version
    └── decisions/
        ├── proposed/
        ├── accepted/
        └── rejected/
```

### ADR Lifecycle

#### 1. Proposal Stage
- Create new ADR in `proposed/` folder
- Generate unique 3-character alphanumeric ID (e.g., `x7k`)
- Number sequentially based on proposal order
- Filename format: `[proposal-number]-[adr-id]-[descriptive-name].md`
- Example: `001-x7k-pod-terminology.md`
- Status: "Proposed"
- Incorporation: "Not Incorporated"

#### 2. Review and Decision
- ADRs are reviewed and discussed
- Can be updated based on feedback
- Track incorporation into spec
- Decision is made to accept or reject

#### 3. Accepted
- Move to `accepted/` folder
- Maintain same filename (number and ID)
- Example: `001-x7k-pod-terminology.md`
- Update Status to "Accepted"
- Update Incorporation to "Partial" or "Complete"

#### 4. Rejected
- Move to `rejected/` folder  
- Renumber based on rejection order (keep ADR ID)
- Example: `001-x7k-pod-terminology.md` (first rejection)
- Update Status to "Rejected"
- Add rejection rationale
- Incorporation remains "Not Incorporated"

### Naming Convention

**Filename Format:** `[number]-[adr-id]-[descriptive-name].md`
- Number: Sequential within each folder (proposed/accepted/rejected)
- ADR ID: Unique 3-character alphanumeric identifier (remains constant through lifecycle)
- Descriptive name: Kebab-case description of the decision

**Examples:**
- Proposed: `001-x7k-pod-terminology.md`
- Accepted: `001-x7k-pod-terminology.md` (keeps proposal number)
- Rejected: `001-a3b-alternative-routing.md` (renumbered in rejection order)

**Note:** The proposal number preserves historical context - you can see the order proposals were made even after they're accepted/rejected.

### ADR Format

```markdown
# ADR-[ADR-ID]: [Title]

**Status:** [Proposed|Accepted|Rejected]
**Date:** [YYYY-MM-DD]
**Context:** [Protocol Version]
**Incorporation:** [Not Incorporated|Partial|Complete]

## Context
[Describe the problem or decision that needs to be made]
[What forces are at play?]
[Why does this decision need to be made now?]

## Options Considered

### Option 1: [Name]
[Description]

**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

### Option 2: [Name]
[Repeat for each option]

## Decision
[State the decision and chosen option]
[Explain why this option was selected]

### Implementation Details
[Specific details about how this will be implemented]
[Examples, code snippets, diagrams as needed]

## Consequences

### Positive
- [Positive outcome 1]
- [Positive outcome 2]

### Negative
- [Negative outcome or tradeoff 1]
- [Negative outcome or tradeoff 2]

## Security Considerations
[Any security implications]

## Migration Path
[If applicable, how existing implementations will migrate]
```

### Writing Good ADRs

#### Context Section
- State the problem clearly
- Explain why the decision is needed now
- List constraints and requirements
- Keep it concise but complete

#### Options Section
- Include all reasonable alternatives
- Be fair in evaluating pros/cons
- Consider "do nothing" as an option when appropriate
- Think about long-term implications

#### Decision Section
- Be explicit about what was decided
- Explain the rationale
- Include concrete implementation details
- Provide examples where helpful

### Best Practices

1. **One Decision Per ADR**: Each ADR should address a single architectural decision

2. **Immutable Once Accepted**: Accepted ADRs should not be edited. Create new ADRs to supersede old ones.

3. **Clear Titles**: Use descriptive titles that indicate the decision area

4. **Version Specific**: ADRs are tied to protocol versions. Breaking changes require new versions.

5. **Examples Are Key**: Include concrete examples in JSON/TypeScript to illustrate concepts

6. **Consider All Stakeholders**: Think about implementers, users, and operators

### Incorporation Status

**Not Incorporated:** Decision made but not yet reflected in spec
**Partial:** Some aspects incorporated, others pending
**Complete:** Fully incorporated into the specification

Track incorporation to ensure specs stay synchronized with decisions.

### Example Workflow

```bash
# Create new proposal (4th proposal with ID 'x7k')
echo "# ADR-x7k: Pod Terminology" > protocol-spec/v0/decisions/proposed/004-x7k-pod-terminology.md

# After acceptance, move maintaining filename
mv protocol-spec/v0/decisions/proposed/004-x7k-pod-terminology.md \
   protocol-spec/v0/decisions/accepted/004-x7k-pod-terminology.md

# Or if rejected (becomes 2nd rejection)
mv protocol-spec/v0/decisions/proposed/004-x7k-pod-terminology.md \
   protocol-spec/v0/decisions/rejected/002-x7k-pod-terminology.md
```

### Versioning Impact

- ADRs in v0 can make breaking changes freely
- Once v1.0 is released, breaking changes require new major version
- Minor versions can add capabilities but not break existing ones
- ADRs should note their version compatibility

### Review Process

1. Create ADR in proposed folder
2. Open PR for review
3. Gather feedback from implementers
4. Update based on feedback
5. Make accept/reject decision
6. Move to appropriate folder with numbering
7. Update any affected documentation

