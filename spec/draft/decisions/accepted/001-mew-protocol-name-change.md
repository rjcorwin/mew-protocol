# ADR-001: MEW Protocol Name Change

**Status:** Accepted
**Date:** 2025-01-09
**Incorporation:** Complete

## Context

The protocol is currently named MEUP (Multi-Entity Unified-context Protocol). A proposal has been made to rename it to MEW Protocol, which is shorter and potentially more memorable. The acronym MEW needs to be defined to maintain the semantic meaning and purpose of the protocol.

## Options Considered

### Option 1: Multi-Entity Workspace
**MEW** = Multi-Entity Workspace

**Pros:**
- Emphasizes the "space" concept that's central to the protocol
- "Workspace" clearly conveys a collaborative environment
- Maintains the multi-entity aspect from the original name
- Simple and intuitive

**Cons:**
- Loses the "unified context" concept
- Less emphasis on the protocol aspect

### Option 2: Message Exchange Web
**MEW** = Message Exchange Web

**Pros:**
- Emphasizes the message-passing nature of the protocol
- "Web" suggests interconnected participants
- Clear focus on communication

**Cons:**
- Too generic, could apply to many messaging protocols
- Loses the multi-entity and context aspects

### Option 3: Multi-Entity Wire
**MEW** = Multi-Entity Wire

**Pros:**
- "Wire" is a common protocol/transport metaphor
- Very concise
- Maintains multi-entity focus

**Cons:**
- Loses context and workspace concepts
- "Wire" might be too low-level

### Option 4: Mediated Entity Workflow
**MEW** = Mediated Entity Workflow

**Pros:**
- "Mediated" captures the gateway's role
- "Workflow" implies coordination and proposals
- Emphasizes the orchestration aspect

**Cons:**
- "Workflow" might be too restrictive
- Less emphasis on the unified context

### Option 5: Multiparty Exchange Wire
**MEW** = Multiparty Exchange Wire

**Pros:**
- "Multiparty" emphasizes multiple participants
- "Exchange" captures bidirectional communication
- "Wire" suggests protocol-level operation

**Cons:**
- Doesn't capture the unified context aspect
- Similar to generic messaging protocols

### Option 6: Multi-Entity Unified
**MEU** = Multi-Entity Unified

**Pros:**
- Preserves the exact core concepts from MEUP
- Drops only "Protocol" which is implied by context
- Maintains the unified context concept explicitly
- Minimal semantic change from original

**Cons:**
- "MEU" pronunciation less memorable than "MEW"
- Feels incomplete without "Protocol"
- Less intuitive what "Unified" means without more context

### Option 7: Multi-Entity Protocol
**MEP** = Multi-Entity Protocol

**Pros:**
- Simple and clear
- Explicitly identifies as a protocol
- Maintains multi-entity focus
- Generic enough to be flexible

**Cons:**
- Loses the unified context concept entirely
- Very generic, could describe many protocols
- No differentiation from other multi-party protocols
- "MEP" less memorable as a sound

## Decision

**Recommended: Option 1 - Multi-Entity Workspace (MEW)**

**MEW** should stand for **Multi-Entity Workspace**. This option provides the best balance of semantic meaning and memorability:

1. **Multi-Entity**: Preserves the core concept of multiple participants (agents, tools, humans) operating together
2. **Workspace**: Effectively captures the "unified-context" concept - a workspace IS a unified context where all participants share visibility
3. **Memorable**: The "mew" pronunciation is playful and memorable, making the protocol more approachable

The term "workspace" naturally conveys:
- A unified context where all work happens
- Shared visibility and transparency 
- Collaboration between multiple entities
- A bounded environment (matching the "space" concept in the protocol)

This interpretation maintains the essential semantics of MEUP while providing a more intuitive and memorable name.

### Implementation Details

1. Update all references from "MEUP" to "MEW" throughout the specification
2. Update the protocol identifier from `"meup/v0.2"` to `"mew/v0.2"`
3. Update the abstract to define MEW as "Multi-Entity Workspace"
4. Maintain backward compatibility notes for migration from MEUP

## Consequences

### Positive
- Shorter, more memorable name (3 letters vs 4)
- "MEW" is easier to pronounce and remember
- Playful connection to cat sound ("mew") makes it memorable and approachable
- Perfect metaphor: "herding cats" captures the challenge of coordinating multiple autonomous agents
  - Independent agents (cats) need coordination in a shared workspace
  - Capability-based control manages what each "cat" can do
  - Proposal pattern prevents chaos from agents doing whatever they want
- "Workspace" is more intuitive than "Unified-context Protocol"
- Maintains semantic continuity with the original goals

### Negative
- Breaking change for existing implementations
- Need to update all documentation and references
- Potential confusion during transition period
- Loss of explicit "protocol" in the acronym (though context makes it clear)

