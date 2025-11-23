# [j8v] Stream Visibility on Join with Metadata Preservation

## Summary

Implements stream visibility for late joiners with complete metadata preservation, enabling applications (like games) to communicate stream format and parsing information to participants who join after streams are active.

## Problem

When participants join a MEW Protocol space with active streams, they receive stream data frames (`#streamID#data`) without context about:
- What streams exist
- Who owns them
- What format/encoding the data uses
- How to parse the stream content

This violates MEW Protocol's "Unified Context" goal and makes it impossible for late joiners to properly handle streamed data in applications like real-time games where streams may use custom binary formats.

## Solution

**Part 1: Stream Visibility**
Add `active_streams` field to `system/welcome` message payload

**Part 2: Metadata Preservation** (NEW)
Preserve ALL metadata from original `stream/request` when communicating streams to late joiners:
- Store entire payload when creating streams
- Include all fields (direction, description, content_type, format, metadata, custom fields) in welcome message
- Zero information loss between early and late joiners

## Changes

### 1. Proposal Updates
- **spec/protocol/proposals/j8v-stream-visibility/proposal.md**
  - Added comprehensive metadata preservation design principle
  - Extended StreamMetadata fields with content_type, format, metadata
  - Added 4 real-world use case examples (games, chat, files, AI reasoning)
  - Updated implementation guidance with spread operator approach

### 2. Type Definitions (src/types/protocol.ts)
```typescript
// Extended StreamRequestPayload
export interface StreamRequestPayload {
  direction: string;
  expected_size_bytes?: number;
  description?: string;
  content_type?: string;      // NEW
  format?: string;            // NEW
  metadata?: Record<string, unknown>;  // NEW
  [key: string]: unknown;     // Extensible
}

// Extended StreamMetadata
export interface StreamMetadata {
  stream_id: string;
  owner: string;
  direction: 'upload' | 'download';
  created: string;
  expected_size_bytes?: number;  // NEW
  description?: string;          // NEW
  content_type?: string;         // NEW
  format?: string;               // NEW
  metadata?: Record<string, unknown>;  // NEW
  [key: string]: unknown;        // Extensible
}
```

### 3. Gateway Implementation (src/cli/commands/gateway.ts)

**Stream Creation (line 385):**
```typescript
space.activeStreams.set(streamId, {
  requestId: envelope.id,
  participantId: participantId,
  created: new Date().toISOString(),
  ...envelope.payload  // Preserve ALL fields
});
```

**Active Streams Array Building (line 535):**
```typescript
function buildActiveStreamsArray(space) {
  return space.activeStreams
    ? Array.from(space.activeStreams.entries()).map(([streamId, info]) => {
        const { requestId, participantId, created, ...metadata } = info;
        return {
          stream_id: streamId,
          owner: participantId,
          created: created,
          ...metadata  // Spread all metadata
        };
      })
    : [];
}
```

### 4. Test Enhancements (e2e/scenario-15-stream-visibility/)

**Updated stream request:**
```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "expected_size_bytes": 1024,
    "description": "Test stream",
    "content_type": "text/plain",
    "format": "utf8"
  }
}
```

**New validation checks:**
- Stream metadata includes description ✓
- Stream metadata includes content_type ✓
- Stream metadata includes format ✓
- Stream metadata includes expected_size_bytes ✓

**Test Results:**
- Before: 13 tests passing
- After: **17 tests passing**
- All tests pass on both macOS (local) and Linux (CI)

### 5. Documentation Updates

**CHANGELOG.md:**
- Updated [j8v] entry with metadata preservation details
- Added use cases enabled section
- Changed status to "Done"

**Test Documentation (check.sh):**
- Added comprehensive header explaining lazy auto-connect mechanism
- Inline comments clarifying virtual WebSocket behavior
- Step-by-step flow documentation

## Use Cases Enabled

### Real-time Game Movement
```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "application/x-game-positions",
    "format": "binary-vector3",
    "metadata": {
      "update_rate_hz": 60,
      "coordinate_system": "world-space"
    }
  }
}
```

Late joiners receive complete context to parse binary position data.

### Voice Chat Transcription
```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "text/plain",
    "format": "utf8-newline-delimited",
    "metadata": {
      "language": "en-US",
      "speaker": "alice"
    }
  }
}
```

### File Transfer
```json
{
  "kind": "stream/request",
  "payload": {
    "direction": "upload",
    "content_type": "image/png",
    "description": "Screenshot",
    "expected_size_bytes": 524288,
    "metadata": {
      "filename": "screenshot.png",
      "checksum_sha256": "abc123..."
    }
  }
}
```

## Testing

**Local (macOS):**
```bash
npm run build       # ✓ Builds without TypeScript errors
npm run lint        # ✓ No linting errors
./e2e/scenario-15-stream-visibility/test.sh  # ✓ 17/17 tests pass
```

**CI (Linux):**
- All e2e tests pass
- Scenario 15 shows 17 tests passed, 0 failed

## Backward Compatibility

- All new fields are **optional**
- Older clients ignore new fields (no breaking changes)
- Older gateways don't send metadata (degraded experience, not broken)
- Protocol version remains `mew/v0.4` (additive change)

## Files Changed

1. `spec/protocol/proposals/j8v-stream-visibility/proposal.md` - Enhanced proposal
2. `spec/protocol/SPEC.md` - Updated welcome message and stream/request sections
3. `src/types/protocol.ts` - Extended type definitions
4. `src/cli/commands/gateway.ts` - Metadata preservation implementation
5. `e2e/scenario-15-stream-visibility/check.sh` - Enhanced test + documentation
6. `CHANGELOG.md` - Updated entry
7. `PR.md` - This file

## Checklist

- [x] Proposal created and enhanced
- [x] Specs updated (integrated into proposal)
- [x] Types updated
- [x] Implementation complete
- [x] Tests added/updated (17 assertions)
- [x] Tests passing locally
- [x] Tests passing in CI
- [x] CHANGELOG updated
- [x] Documentation added
- [x] Builds without errors
- [x] Backward compatible

## Related

- Proposal: `spec/protocol/proposals/j8v-stream-visibility/`
- Test: `e2e/scenario-15-stream-visibility/`
- Spec: `spec/protocol/SPEC.md` Section 3.8.1 (Welcome Message)
