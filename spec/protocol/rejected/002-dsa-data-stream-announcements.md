# ADR-DSA: Data Stream Announcements

**Status:** Rejected  
**Date:** 2025-01-10  
**Context:** MEW Protocol v0.3
**Incorporation:** Not Incorporated  
**Rejection Date:** 2025-09-26  
**Rejection Rationale:** Streaming primitives remain out of scope for the v0.4 protocol release; the team will revisit once core request/proposal flows stabilize.

## Context

MEW Protocol currently handles request-response patterns and proposals well, but lacks a mechanism for entities to announce and manage continuous data streams. Many real-world applications require streaming capabilities:

1. **Live Data Feeds**: Entities may need to broadcast sensor data, market prices, or other real-time information
2. **Progress Updates**: Long-running operations need to stream progress without blocking the protocol
3. **Event Streams**: Applications need to publish event streams that other entities can observe
4. **Media Streams**: Audio, video, or other continuous media data needs protocol-level coordination

Without a formal announcement mechanism, entities cannot:
- Declare their intent to broadcast a stream
- Allow other entities to discover available streams
- Coordinate stream lifecycle (start, pause, stop)
- Prevent stream ID conflicts
- Enable capability-based access control for streams

## Options Considered

### Option 1: Ad-hoc Streaming
Allow entities to stream data without formal announcements.

**Pros:**
- Simple to implement
- No additional protocol complexity

**Cons:**
- No discovery mechanism
- ID conflicts likely
- No lifecycle management
- Cannot apply capabilities to streams
- Other entities can't prepare for incoming data

### Option 2: Stream Announcement Messages
Add dedicated message types for announcing and managing streams.

**Pros:**
- Clear protocol-level support
- Enables discovery and coordination
- Allows capability-based access control
- Prevents ID conflicts through announcement
- Clear lifecycle management

**Cons:**
- Adds protocol complexity
- Requires new message types

### Option 3: Overload Existing Messages
Use existing proposal/notification messages for streams.

**Pros:**
- No new message types needed
- Reuses existing patterns

**Cons:**
- Semantically incorrect (streams aren't proposals)
- Lacks stream-specific fields
- Confuses protocol semantics

## Decision

Adopt Option 2: Add dedicated stream announcement messages to the protocol.

### Implementation Details

#### New Message Types

1. **stream.announce**: Entity declares intention to create a stream
```json
{
  "jsonrpc": "2.0",
  "method": "stream.announce",
  "params": {
    "stream_id": "ctx123:entity456",
    "name": "Market Data Feed",
    "description": "Real-time market prices",
    "content_type": "application/json",
    "metadata": {
      "update_frequency": "100ms",
      "format": "ticker"
    }
  }
}
```

2. **stream.start**: Begin streaming data
```json
{
  "jsonrpc": "2.0",
  "method": "stream.start",
  "params": {
    "stream_id": "ctx123:entity456"
  }
}
```

3. **stream.data**: Stream data packet
```json
{
  "jsonrpc": "2.0",
  "method": "stream.data",
  "params": {
    "stream_id": "ctx123:entity456",
    "sequence": 1,
    "data": {...},
    "timestamp": "2025-01-10T10:00:00Z"
  }
}
```

4. **stream.pause**: Temporarily pause streaming
```json
{
  "jsonrpc": "2.0",
  "method": "stream.pause",
  "params": {
    "stream_id": "ctx123:entity456"
  }
}
```

5. **stream.stop**: Terminate stream
```json
{
  "jsonrpc": "2.0",
  "method": "stream.stop",
  "params": {
    "stream_id": "ctx123:entity456"
  }
}
```

6. **stream.list**: Request available streams
```json
{
  "jsonrpc": "2.0",
  "method": "stream.list",
  "id": "1"
}
```

#### Stream ID Convention

Recommend the convention: `[context_id]:[entity_id]`
- Ensures uniqueness within a workspace
- Makes ownership clear
- Allows filtering by context or entity
- Example: `game_state:npc_controller`, `sensors:temperature_monitor`

#### Capability Integration

Streams respect capability-based access control:
- `stream:announce` - Permission to announce new streams
- `stream:write:[stream_id]` - Permission to write to specific stream
- `stream:read:[stream_id]` - Permission to read from specific stream
- `stream:*` - Full stream permissions

#### Stream Lifecycle

1. **Announcement Phase**: Entity announces intent with metadata
2. **Approval Phase** (optional): If capabilities require, await approval
3. **Active Phase**: Stream is active, data flows
4. **Pause Phase** (optional): Temporarily suspended
5. **Termination Phase**: Clean shutdown with stop message

## Consequences

### Positive
- **Discovery**: Entities can discover available streams before subscribing
- **Coordination**: Clear lifecycle management prevents resource leaks
- **Access Control**: Capability system extends naturally to streams
- **Conflict Prevention**: Announcement pattern prevents ID collisions
- **Metadata**: Rich metadata enables informed subscription decisions
- **Progressive Enhancement**: Systems can ignore stream messages if not needed

### Negative
- **Protocol Complexity**: Adds 6 new message types to the protocol
- **Implementation Burden**: All implementations need stream support
- **State Management**: Entities must track stream state
- **Backward Compatibility**: Older implementations won't understand stream messages
