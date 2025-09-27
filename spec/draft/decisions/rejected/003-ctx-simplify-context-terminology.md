# ADR-CTX: Simplify Context Terminology

**Status:** Rejected  
**Date:** 2025-01-10  
**Context:** MEW Protocol v0.3
**Incorporation:** Not Incorporated  
**Rejection Date:** 2025-09-26  
**Rejection Rationale:** Terminology cleanup will ride a future comprehensive documentation pass; v0.4 keeps existing wording to avoid churn during release prep.

## Context

The current specification uses the term "sub context" or "sub-context" to refer to logical groupings within a workspace. This terminology is unnecessarily complex and hierarchical when the actual relationship is more about partitioning or namespacing rather than true hierarchy.

The term "sub context" implies:
1. A parent-child relationship that doesn't truly exist in the protocol
2. Nested contexts, which the protocol doesn't support
3. Dependency relationships that aren't enforced

In practice, these are simply separate contexts within a shared workspace, each with their own ID and scope. The "sub" prefix adds confusion without adding meaning.

## Options Considered

### Option 1: Keep "Sub Context"
Maintain the current terminology with "sub context" or "sub-context".

**Pros:**
- No documentation changes needed
- May imply the scoping relationship to some readers

**Cons:**
- Implies hierarchy that doesn't exist
- Unnecessarily verbose
- Confusing for new implementers
- Inconsistent with the flat nature of the protocol

### Option 2: Use "Context" 
Simplify to just "context" throughout the specification.

**Pros:**
- Simpler and clearer
- Accurately represents the flat namespace
- Reduces cognitive load
- More consistent with actual protocol behavior

**Cons:**
- Requires updating documentation
- Might initially confuse readers expecting hierarchy

### Option 3: Use "Channel" or "Room"
Replace with alternative terms like "channel" or "room".

**Pros:**
- Familiar from chat applications
- Clearly indicates separate spaces

**Cons:**
- Conflicts with existing "workspace" terminology
- "Channel" implies communication path rather than logical grouping
- "Room" has physical connotations that don't apply

## Decision

Adopt Option 2: Use "context" throughout the specification, removing the "sub" prefix.

### Implementation Details

1. **Terminology Updates**:
   - Replace all instances of "sub context" with "context"
   - Replace all instances of "sub-context" with "context"
   - Update any references to "subcontext" to "context"

2. **Field Updates**:
   - Fields remain unchanged (already use `context_id` not `sub_context_id`)
   - No protocol changes required

3. **Clarification**:
   - Add a note that contexts are independent namespaces within a workspace
   - Clarify that contexts don't have hierarchical relationships
   - Explain that context IDs are flat identifiers

4. **Examples**:
   - Update all examples to use simplified terminology
   - Show how contexts partition the workspace without hierarchy

## Consequences

### Positive
- **Clarity**: Removes confusion about hierarchical relationships
- **Simplicity**: Easier to understand and explain
- **Accuracy**: Better represents the actual protocol structure
- **Consistency**: Aligns terminology with implementation

### Negative
- **Documentation Update**: One-time effort to update all references
- **Mental Model Shift**: Readers familiar with "sub context" need to adjust
- **Potential Ambiguity**: Without "sub", might need additional clarification that contexts exist within workspaces
