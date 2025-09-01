# Decision: Orchestrator Pattern Standardization

**Date**: 2025-08-27  
**Status**: Open for Discussion  
**Proposed Outcome**: Create guidance document, not protocol requirement

## Context

Orchestrator agents are critical to the MCPx multi-agent collaboration model. They review proposals, make fulfillment decisions, and learn policies over time. The question is whether and how to standardize orchestrator behavior, interfaces, and patterns.

## Options Considered

### Option 1: Protocol-Level Orchestrator Specification
Define MCPx protocol extensions specifically for orchestrators.

**Pros:**
- Guaranteed interoperability between orchestrators
- Standard tool names ensure consistent interfaces
- Clear compliance requirements
- Easier tooling and client development

**Cons:**
- Increases protocol complexity
- Constrains innovation in orchestrator design
- May not fit all use cases
- Premature standardization before patterns emerge

**Example additions:**
```json
{
  "method": "orchestrator/teach",
  "params": {
    "rule": "always approve TODO.md updates from agent-x"
  }
}
```

### Option 2: MCP Server Capability Declaration
Orchestrators declare capabilities through standard MCP mechanisms.

**Pros:**
- Uses existing MCP patterns
- Discoverable through standard tools/list
- No protocol changes needed
- Flexible implementation

**Cons:**
- No guarantee of interface consistency
- Each orchestrator may use different tool names
- Harder for clients to work with multiple orchestrators
- No standard rule format

**Example:**
```json
{
  "tools": [
    {
      "name": "add_policy",
      "description": "Add an automation policy"
    },
    {
      "name": "list_policies", 
      "description": "Show current policies"
    }
  ]
}
```

### Option 3: Best Practices Guide (RECOMMENDED)
Create non-normative guidance without protocol requirements.

**Pros:**
- Maintains protocol simplicity
- Allows experimentation and innovation
- Community can evolve best patterns
- Can become standard later if patterns converge
- Easy to update as we learn

**Cons:**
- No guaranteed interoperability
- May lead to fragmentation
- Requires more work from implementers
- Discovery is harder

**Proposed guide contents:**
- Recommended tool naming conventions
- Common rule format suggestions
- Audit logging best practices
- Learning algorithm considerations
- Security guidelines

### Option 4: Orchestrator Profile Specification
Create a separate spec that orchestrators can claim compliance with.

**Pros:**
- Optional standardization
- Multiple profiles for different use cases
- Clear compliance markers
- Maintains protocol simplicity

**Cons:**
- Additional specification to maintain
- May still fragment into multiple profiles
- Compliance verification complexity
- May discourage innovation

**Example:**
```json
{
  "_meta": {
    "orchestrator_profile": "mcpx-orchestrator/v1"
  }
}
```

## Proposed Decision

**Option 3: Best Practices Guide** - Create a non-normative orchestrator implementation guide that provides recommendations without protocol requirements.

## Rationale

1. **Protocol Minimalism**: MCPx should remain a minimal protocol focused on secure multi-agent communication
2. **Innovation Space**: Orchestrator patterns are still evolving; premature standardization would limit innovation
3. **Market Discovery**: Let the community discover optimal patterns through implementation
4. **Progressive Formalization**: Can standardize later once patterns stabilize
5. **Low Barrier**: Doesn't increase complexity for basic implementations

## Proposed Guide Structure

### `orchestrator-patterns.md` should include:

1. **Core Concepts**
   - Role of orchestrators in MCPx
   - Proposal review patterns
   - Policy learning approaches

2. **Recommended Interfaces**
   ```
   Suggested tool names:
   - orchestrator.add_rule
   - orchestrator.remove_rule
   - orchestrator.list_rules
   - orchestrator.get_statistics
   - orchestrator.review_proposal (for manual review requests)
   ```

3. **Rule Format Suggestions**
   ```json
   {
     "pattern": "mcp/proposal:tools/call",
     "conditions": {
       "from": "agent-x",
       "tool_name": "write_file",
       "path_pattern": "*/TODO.md"
     },
     "action": "auto_approve",
     "expires": "2025-12-31"
   }
   ```

4. **Security Considerations**
   - Preventing rule injection attacks
   - Capability verification
   - Audit trail requirements

5. **Learning Patterns**
   - Human teaching interfaces
   - Statistical learning from decisions
   - Consensus mechanisms for multiple supervisors

## Implementation Path

1. **Phase 1**: Create initial best practices guide
2. **Phase 2**: Gather feedback from early implementers
3. **Phase 3**: Refine based on real-world usage
4. **Phase 4**: Consider standardization if patterns converge

## Open Questions

1. Should we provide a reference orchestrator implementation?
2. How should orchestrators indicate which patterns they follow?
3. Should there be a registry of orchestrator implementations?
4. How do we handle orchestrator composition (orchestrators managing other orchestrators)?

## Related Decisions

- Fulfill Message Kind (Decision 001) - Affects how orchestrators execute proposals
- Capability Model - Orchestrators need appropriate capabilities to fulfill proposals