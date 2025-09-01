# ADR-y3m: Terminology for Communication Spaces

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Parent ADR:** 001-0-x7k (Protocol Name)

## Context

The protocol needs clear terminology for the isolated communication spaces where participants collaborate. The current specification uses "topic" but this may not best convey the bounded, container-like nature of these spaces. The terminology affects:
- How users understand the protocol
- API endpoint naming
- Documentation clarity
- Conceptual alignment with the protocol's purpose

### Decision Drivers
- Clarity of concept for new users
- Distinctiveness from generic messaging terms
- Alignment with container/isolation concepts
- Consistency with modern cloud/orchestration patterns

## Decision

**Adopt "space" as the terminology for communication spaces**

The term "space" provides the optimal balance of simplicity and flexibility. It avoids conflicts with Kubernetes `pod.yaml` files while being generic enough to represent a unified context. The phrase "meup into space" creates a memorable command pattern with natural Star Trek connotations. 

Configuration files can use flexible naming conventions:
- Default: `space.yaml` or `[name]-space.yaml`  
- But any `.yaml` file works: `meup production.yaml`, `meup code-review.yaml`, etc.

This approach provides clear terminology for documentation while allowing users complete freedom in naming their configuration files.

## Options Considered

### Option 1: Topic (Status Quo)

Keep the current "topic" terminology.

**Pros:**
- Already in documentation
- Familiar from pub/sub systems
- Clear conversation metaphor
- No migration needed

**Cons:**
- Generic term used everywhere
- Doesn't convey isolation/boundaries
- Less distinctive
- Doesn't emphasize the container aspect

### Option 2: Pod

Use "pod" as the primary term.

**Pros:**
- Conveys isolation and containment
- Aligns with Kubernetes/container concepts
- Distinctive and memorable
- Natural fit: "join a pod"
- Emphasizes bounded context

**Cons:**
- **Critical**: `pod.yaml` conflicts with Kubernetes pod definitions
- May confuse with Kubernetes pods
- Requires documentation updates
- Less familiar for messaging contexts

### Option 3: Room

Use "room" as the primary term.

**Pros:**
- Natural collaboration metaphor
- Used by Matrix protocol successfully
- Intuitive for chat-like interactions
- Clear spatial boundaries

**Cons:**
- Too chat-focused
- Less technical/professional
- Common term, not distinctive

### Option 4: Channel

Use "channel" as the primary term.

**Pros:**
- Familiar from Slack, Discord, IRC
- Clear communication metaphor
- Well understood concept

**Cons:**
- Very common terminology
- Doesn't emphasize isolation
- Implies persistent/named channels

### Option 5: Space

Use "space" as the primary term.

**Pros:**
- Neutral term
- Conveys area for collaboration
- Modern (used by various platforms)

**Cons:**
- Too generic
- Doesn't convey boundaries strongly
- Overused in tech

### Option 6: Context

Use "context" as the primary term.

**Pros:**
- Directly describes purpose
- Technically accurate
- Aligns with protocol goals
- `context.yaml` is clear filename

**Cons:**
- Abstract concept
- Could confuse with sub-contexts
- Less intuitive for users
- Might clash with other "context" configs

### Option 7: Nexus

Use "nexus" as the primary term.

**Pros:**
- Perfect "connection point" metaphor
- Distinctive and memorable
- Professional sounding
- `nexus.yaml` is unique filename
- Suggests convergence of entities

**Cons:**
- Less familiar term
- Might sound too sci-fi
- Could be taken by other tools

### Option 8: Space (RECOMMENDED)

Use "space" as the primary term.

**Pros:**
- Simple and universal
- Works perfectly with MEUP: "meup into space"
- `space.yaml` is intuitive
- Natural phrasing: "join a space"
- Familiar from Slack/Teams "spaces"

**Cons:**
- Very generic term
- Doesn't convey boundaries strongly
- Overused in tech

### Option 9: Session

Use "session" as the primary term.

**Pros:**
- Familiar from web/gaming
- Clear temporal boundaries
- `session.yaml` is descriptive
- Implies active participation

**Cons:**
- Might imply non-persistent
- Could suggest single-user
- Less distinctive

### Option 10: Mesh

Use "mesh" as the primary term.

**Pros:**
- Implies interconnection
- Modern service mesh association
- `mesh.yaml` sounds technical
- Captures multi-entity nature

**Cons:**
- Might imply peer-to-peer only
- Could confuse with service mesh
- Less intuitive for new users

### Option 11: Sphere

Use "sphere" as the primary term.

**Pros:**
- Bounded 3D space metaphor
- Unique and distinctive
- `sphere.yaml` is memorable
- Suggests completeness

**Cons:**
- More abstract
- Harder to visualize
- Less common in tech

### Option 12: Realm

Use "realm" as the primary term.

**Pros:**
- Clear boundary/kingdom metaphor
- Distinctive terminology
- `realm.yaml` sounds authoritative
- Implies governance

**Cons:**
- Gaming/fantasy connotations
- Might sound unprofessional
- Could imply hierarchy

### Option 13: Unified-Context

Use "unified-context" or shortened variants as the primary term.

**Pros:**
- Directly references MEUP's full name (Multi-Entity Unified-Context Protocol)
- Most technically accurate description
- Multiple filename options: `uc.yaml`, `unified.yaml`, `ucontext.yaml`
- Reinforces the protocol's core purpose
- No ambiguity about what it represents

**Cons:**
- Longer/hyphenated term less convenient
- More technical sounding
- `uc.yaml` might be too cryptic
- "Join a unified-context" is awkward phrasing
- Could be verbose in documentation

## Implementation Details

### Terminology Mapping
- "topic" → "space"
- "topic ID" → "space ID"
- "join topic" → "join space"
- "topic isolation" → "space isolation"
- "per-topic" → "per-space"
- "topic members" → "space participants"

### API Endpoints
```
# Old
GET /ws?topic=<name>
GET /topics
GET /topics/{id}/participants

# New
GET /ws?space=<name>
GET /spaces
GET /spaces/{id}/participants
```

### Environment Variables
```bash
# Old
MEUP_TOPIC_NAME=my-topic
MEUP_TOPIC_ID=abc123

# New
MEUP_SPACE_NAME=my-space
MEUP_SPACE_ID=abc123
```

### Configuration Files
```bash
# Default conventions
meup space.yaml              # Simple default
meup production-space.yaml   # Named space
meup ./configs/review.yaml   # Any path/name works

# The actual filename is flexible
meup my-awesome-setup.yaml   # User's choice
```

### Documentation Examples
```
# Old
"Participants join a topic to collaborate..."
"Each topic provides isolation..."
"Messages are broadcast within the topic..."

# New
"Participants join a space to collaborate..."
"Each space provides isolation..."  
"Messages are broadcast within the space..."
"Use 'meup into space' to enter the unified context..."
```

## Consequences

### Positive
- **No Conflicts**: Avoids Kubernetes `pod.yaml` collision
- **Memorable Command**: "meup into space" is iconic and fun
- **Flexible Naming**: Users can name config files anything
- **Familiar**: "Space" used by Slack, Teams, etc.
- **Simple**: Easy to understand and explain

### Negative
- **Generic**: "Space" is a common term
- **Less Distinctive**: Not as unique as "pod" or "nexus"
- **Migration Work**: Requires updating all documentation from "topic"

## Security Considerations

None - this is purely a terminology change.

## Migration Path

Since this is v0.x (experimental):
1. Update all documentation to use "space"
2. Change API endpoints
3. Update environment variable names
4. Update SDK method names
5. No backward compatibility needed in v0.x

## Future Considerations

- Space discovery mechanisms
- Space lifecycle management
- Space templates for common scenarios
- Space federation (connecting spaces)