# Proposal s2w: Stream Ownership Transfer

**Status:** Draft
**Created:** 2025-11-23
**Area:** Protocol
**Targets:** MEW Protocol v0.9.0

## Overview

This proposal adds stream authorization and ownership transfer capabilities to MEW Protocol. Currently, only the participant who creates a stream can publish frames to it. This proposal enables stream owners to delegate write access to other participants and transfer complete ownership.

## Files

- **proposal.md** - The main proposal document with problem statement, solution design, and alternatives
- **research.md** - Implementation details, current code analysis, security considerations, and testing strategy
- **decision-s2w-stream-ownership.md** - Decision record documenting rationale, design principles, and use cases

## Quick Summary

### Problem

Streams enforce single-writer semantics: only the creator can publish frames. This blocks:
- Game character control delegation (player controls character position stream)
- Collaborative workflows (multiple agents write to shared stream)
- Ownership transfer on disconnect (backup takes over stream)

### Solution

Add three new message kinds:
1. `stream/grant-write` - Owner grants write access to another participant
2. `stream/revoke-write` - Owner revokes write access from a participant
3. `stream/transfer-ownership` - Owner transfers complete ownership

Extend `system/welcome.active_streams` with `authorized_writers` array showing who can write to each stream.

### Use Case: Seacat RTS Character Control

```typescript
// 1. Character server creates position stream
{
  kind: 'stream/request',
  payload: {
    direction: 'upload',
    format: 'seacat/character-position-v1',
    metadata: { character_id: 'character-player1' }
  }
}

// 2. Player claims control via MCP tool
{
  kind: 'mcp/request',
  to: ['character-player1'],
  payload: {
    method: 'tools/call',
    params: {
      name: 'character/claim_control',
      arguments: { requester_id: 'player1' }
    }
  }
}

// 3. Character server grants write access
{
  kind: 'stream/grant-write',
  payload: {
    stream_id: 'stream-42',
    participant_id: 'player1'
  }
}

// 4. Player publishes position frames directly
#stream-42#{"position": {"x": 400, "y": 300}, ...}

// 5. Late joiner sees authorization in welcome
{
  kind: 'system/welcome',
  payload: {
    active_streams: [{
      stream_id: 'stream-42',
      owner: 'character-player1',
      authorized_writers: ['character-player1', 'player1']
    }]
  }
}
```

## Key Design Decisions

1. **Owner-centric authorization** - Only owner can grant/revoke/transfer
2. **Explicit protocol messages** - Not buried in metadata
3. **Backward compatible** - Existing streams work unchanged
4. **Late joiner transparency** - Welcome message shows current state
5. **Auto-revoke on disconnect** - Prevents zombie writers

## Status

- [x] Proposal document created
- [x] Research document created
- [x] Decision document created
- [x] CHANGELOG.md updated
- [ ] Implementation (gateway handlers)
- [ ] TypeScript types
- [ ] E2E test scenario
- [ ] SPEC.md update
- [ ] PR submission

## Context

This proposal was created for the Seacat RTS game, which uses MEW Protocol for real-time character position streaming. Characters need to transfer control between players and AI agents, requiring stream write delegation.

The proposal builds on [j8v] Stream Visibility (v0.8.0), which added `active_streams` to the welcome message with metadata preservation.

## Related

- **Depends on:** [j8v] Stream Visibility on Join with Metadata Preservation (v0.8.0)
- **Enables:** Seacat RTS character control system (r7c proposal)
- **Future work:** Read access control, conditional grants, stream templates
