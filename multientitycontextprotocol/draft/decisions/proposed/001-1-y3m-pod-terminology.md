# ADR-y3m: Pod Terminology for Communication Spaces

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

**Adopt "pod" as the terminology for communication spaces**

The term "pod" better captures the isolated, bounded nature of these collaboration spaces. It aligns with modern container terminology while being distinctive. Participants "join a pod" to collaborate, which is intuitive and memorable.

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

### Option 2: Pod (Recommended)

Use "pod" as the primary term.

**Pros:**
- Conveys isolation and containment
- Aligns with Kubernetes/container concepts
- Distinctive and memorable
- Natural fit: "join a pod"
- Emphasizes bounded context

**Cons:**
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

**Cons:**
- Abstract concept
- Could confuse with sub-contexts
- Less intuitive for users

## Implementation Details

### Terminology Mapping
- "topic" → "pod"
- "topic ID" → "pod ID"
- "join topic" → "join pod"
- "topic isolation" → "pod isolation"
- "per-topic" → "per-pod"
- "topic members" → "pod participants"

### API Endpoints
```
# Old
GET /ws?topic=<name>
GET /topics
GET /topics/{id}/participants

# New
GET /ws?pod=<name>
GET /pods
GET /pods/{id}/participants
```

### Environment Variables
```bash
# Old
MEUP_TOPIC_NAME=my-topic
MEUP_TOPIC_ID=abc123

# New
MEUP_POD_NAME=my-pod
MEUP_POD_ID=abc123
```

### Documentation Examples
```
# Old
"Participants join a topic to collaborate..."
"Each topic provides isolation..."
"Messages are broadcast within the topic..."

# New
"Participants join a pod to collaborate..."
"Each pod provides isolation..."
"Messages are broadcast within the pod..."
```

## Consequences

### Positive
- **Clear Boundaries**: Pod implies a contained, isolated space
- **Modern Alignment**: Fits with container/cloud terminology
- **Distinctive**: Not overused in messaging protocols
- **Intuitive**: "Join a pod" is natural phrasing
- **Professional**: Technical but accessible term

### Negative
- **Kubernetes Confusion**: May be confused with k8s pods
- **Learning Curve**: Less familiar than "topic" or "channel"
- **Migration Work**: Requires updating all documentation

## Security Considerations

None - this is purely a terminology change.

## Migration Path

Since this is v0.x (experimental):
1. Update all documentation to use "pod"
2. Change API endpoints
3. Update environment variable names
4. Update SDK method names
5. No backward compatibility needed in v0.x

## Future Considerations

- Pod discovery mechanisms
- Pod lifecycle management
- Pod templates for common scenarios
- Pod federation (connecting pods)