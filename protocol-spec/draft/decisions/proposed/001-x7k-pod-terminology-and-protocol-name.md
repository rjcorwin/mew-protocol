# ADR-x7k: Pod Terminology and Protocol Name

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

The current specification uses "topic" to describe isolated communication spaces where participants collaborate. This terminology affects:
- How users understand the protocol
- The protocol name itself (MCPx vs MCPP)
- Alignment with existing technology concepts
- Documentation and API naming

### Decision Drivers
- Clarity of terminology for new users
- Alignment with container/orchestration concepts
- Distinctiveness from existing messaging protocols
- Marketability and memorability of the protocol name

## Decision

**Adopt "Pod" Terminology and rename to MCPP (Model Context Pod Protocol)**

The term "pod" better captures the isolated, bounded nature of these collaboration spaces. It aligns with modern container terminology while being distinctive. The name MCPP is memorable and maintains the MCP heritage while establishing its own identity.

Since we're in v0.x, we can make this breaking change without migration concerns. See _Implementation Notes_ section for more details.

## Options Considered

### Option 1: Keep "Topic" Terminology (MCPx)

Maintain current terminology with topics as communication spaces.

**Pros:**
- Already established in current documentation
- Familiar from pub/sub and messaging systems
- Clear metaphor (topics of conversation)
- MCPx name emphasizes extension relationship to MCP
- No migration needed

**Cons:**
- Generic term used by many protocols
- Doesn't convey the isolated, container-like nature
- Less distinctive in the ecosystem

### Option 2: Adopt "Pod" Terminology (MCPP)

Replace "topic" with "pod" throughout, rename to Model Context Pod Protocol.

**Pros:**
- Pod conveys isolation and containment
- Aligns with Kubernetes/container terminology
- More distinctive and memorable
- Better represents the bounded context concept
- MCPP is concise and unique

**Cons:**
- Requires updating all documentation
- May confuse with Kubernetes pods
- Loses explicit connection to MCP in the name
- "Pod" less intuitive for messaging context

### Option 3: "Room" Terminology (MCPR)

Use "room" as the primary term (Model Context Room Protocol).

**Pros:**
- Natural metaphor for collaboration spaces
- Used successfully by Matrix protocol
- Intuitive for chat-like interactions
- Clear spatial boundary concept

**Cons:**
- May seem too chat-focused
- Less technical/professional sounding
- Doesn't emphasize the container aspect

### Option 4: "Channel" Terminology (Keep MCPx)

Use "channel" but keep MCPx name.

**Pros:**
- Familiar from Slack, Discord, IRC
- Clear communication metaphor
- Works with existing MCPx name

**Cons:**
- Very common terminology
- Doesn't emphasize isolation
- May imply persistent/named channels

### Option 5: Hybrid Approach

Use "pod" in specification but keep MCPx as protocol name.

**Pros:**
- Better terminology without breaking name recognition
- Can explain "pods" as MCPx concept
- Gradual transition possible

**Cons:**
- Potential confusion between name and terminology
- Less cohesive branding

## Implementation Notes

### Immediate Changes Required
- Update all references from "topic" to "pod" in specifications
- Gateway endpoints change from `/topics/` to `/pods/`
- Environment variables change from `MCPX_TOPIC` to `MCPP_POD`
- Protocol identifier changes from `mcpx/v0.1` to `mcpp/v0.1`
- NPM organization becomes `@modelcontextpodprotocol` (following MCP's `@modelcontextprotocol` convention)
- Repository rename to `modelcontextpodprotocol` (following MCP's `modelcontextprotocol` convention)
- Package structure:
  - `@modelcontextpodprotocol/sdk` - Core SDK containing:
    - Client library (WebSocket connection, envelope handling)
    - Agent base classes and utilities
    - Protocol types and interfaces
    - Common utilities
  - `@modelcontextpodprotocol/gateway` - Standalone gateway server (infrastructure, not in SDK)
  - `@modelcontextpodprotocol/bridge` - MCP-to-MCPP bridge utility (tool, not in SDK)
  - `@modelcontextpodprotocol/cli` - Command-line interface tools (tool, not in SDK)

### Terminology Mapping
- "topic" → "pod"
- "join topic" → "join pod"
- "topic isolation" → "pod isolation"
- "per-topic" → "per-pod"
- MCPx → MCPP

### No Migration Path Needed

Since this is v0.x (experimental), we make a clean break:
- No backward compatibility required
- No deprecation period
- Direct cutover to new terminology
- Clear communication that v0.x is subject to breaking changes