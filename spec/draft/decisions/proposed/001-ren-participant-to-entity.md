# ADR-REN: Rename Participant to Entity

**Status:** Proposed (TODO: Postpone)
**Date:** 2025-01-10
**Context:** MEW Protocol v0.3
**Incorporation:** Not Incorporated

## Context

The term "Participant" is currently used throughout the MEW Protocol specification to refer to connected actors in a workspace. However, this terminology has become problematic for several reasons:

1. **Legacy Confusion**: "Participant" is a legacy term from earlier iterations of the protocol that no longer accurately reflects the current architecture
2. **Naming Conflicts**: The term conflicts with domain-specific uses, particularly in game development where "participant" might refer to game items or players with different semantics
3. **Specification Clarity**: The protocol name itself (Multi-Entity Workspace Protocol) already uses "Entity" in its expansion, creating inconsistency when the spec refers to "Participants"
4. **Conceptual Alignment**: "Entity" better captures the abstract nature of actors in the system - they can be humans, AI agents, tools, or services

## Options Considered

### Option 1: Keep "Participant"
Continue using the current terminology.

**Pros:**
- No changes required to existing documentation
- No risk of breaking existing implementations

**Cons:**
- Continues the confusion and naming conflicts
- Inconsistent with protocol name
- Makes game development and other domain-specific implementations harder

### Option 2: Rename to "Entity"
Replace all instances of "Participant" with "Entity" throughout the specification.

**Pros:**
- Aligns with protocol name (Multi-Entity Workspace Protocol)
- More abstract and flexible term
- Avoids domain-specific conflicts
- Cleaner conceptual model

**Cons:**
- Requires updating all documentation
- May temporarily confuse readers familiar with old terminology

### Option 3: Use "Actor"
Replace with the term "Actor" instead.

**Pros:**
- Common term in distributed systems
- Clear implication of active participation

**Cons:**
- Still has potential conflicts (e.g., in theater/drama applications)
- Less alignment with protocol name
- "Actor" implies agency that might not apply to all entities

## Decision

Adopt Option 2: Rename "Participant" to "Entity" throughout the specification.

### Implementation Details

1. **Specification Updates**: Replace all instances of "participant" with "entity" in SPEC.md
2. **Field Renaming**: Update protocol fields:
   - `participant_id` → `entity_id`
   - `participant_name` → `entity_name`
   - `participants` → `entities`
3. **Message Updates**: Update related message types and fields
4. **Documentation**: Add a migration note for implementers

## Consequences

### Positive
- Creates consistency between protocol name and specification terminology
- Eliminates confusion in domain-specific implementations
- Provides a more abstract and flexible conceptual model
- Aligns with the protocol's goal of supporting diverse types of actors

### Negative
- Requires a one-time update to all documentation
- May require a brief transition period where both terms are recognized
- Existing implementations will need to update their terminology (though protocol compatibility can be maintained)