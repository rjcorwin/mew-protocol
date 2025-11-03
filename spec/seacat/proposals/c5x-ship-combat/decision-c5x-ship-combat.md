# Decision: Ship-to-Ship Combat System (c5x-ship-combat)

**Date:** 2025-01-24
**Status:** Proposed (Awaiting User Approval)
**Deciders:** User, Claude

## Context

Seacat currently has ships for navigation but lacks interactive gameplay mechanics. Ship combat would add:
- Engaging multiplayer objectives
- Cooperative multi-crew gameplay
- Strategic depth to exploration
- Demonstration of MEW's multi-participant coordination

## Decision

Implement ship-to-ship cannon combat with the following design:

### Core Mechanics
- **Cannons as control points**: Port/starboard cannons controllable like wheel/sails
- **Manual aiming**: ±45° arc adjustment with left/right arrows
- **Physics projectiles**: Gravity-affected cannonballs with deterministic simulation
- **Damage system**: 100 HP ships, 25 damage per hit, sinking at 0 HP
- **Client prediction**: Instant visual feedback with server validation

### Technical Architecture
- **Ship authority**: Ships spawn projectiles and validate hits
- **Client-side physics**: All clients simulate same deterministic physics
- **Network messages**: 6 new message types (aim, fire, spawn, hit, damage, respawn)
- **OBB collision**: Reuse existing rotation-aware collision system

### Key Parameters
```typescript
cooldown: 4000ms
damage: 25 HP
projectileSpeed: 300 px/s
gravity: 150 px/s²
hitboxPadding: 1.2x
```

## Rationale

### Why This Design

**Manual aiming over auto-aim**
- Adds skill ceiling and strategic depth
- Players feel more agency and accomplishment
- Encourages positioning and maneuvering

**Client prediction with server validation**
- Best UX: Instant visual feedback
- Fair: Server prevents cheating
- Robust: Handles network lag gracefully

**Physics-based projectiles**
- Intuitive: Players understand gravity
- Skill-based: Leading shots requires practice
- Satisfying: Seeing arc hit feels good

**Multi-crew required**
- Encourages cooperation (MEW protocol demo)
- Creates interesting role division
- Adds communication challenge

### Alternatives Considered

1. **Auto-aim**: Too casual, reduces skill
2. **Turn-based**: Doesn't fit real-time game
3. **Server-only physics**: Too laggy for projectiles
4. **Hitscan weapons**: Less interesting than arcing shots

## Implementation Plan

Following **5-phase rollout** over 3 weeks:

1. **Week 1**: Control points + aiming (Phase 1)
2. **Week 1**: Firing + projectiles (Phase 2)
3. **Week 2**: Collision + damage (Phase 3)
4. **Week 2**: Sinking + respawn (Phase 4)
5. **Week 3**: Polish + sounds (Phase 5)

## Consequences

### Positive
- ✅ Engaging multiplayer gameplay
- ✅ Demonstrates MEW protocol's power
- ✅ Foundation for future combat features
- ✅ Clear win/lose conditions
- ✅ Reuses existing ship control patterns

### Negative
- ❌ Adds ~1000 LOC to codebase
- ❌ New message types to maintain
- ❌ Balance requires playtesting time
- ❌ Particles may impact low-end devices

### Neutral
- 📊 Bandwidth: +576 bytes/sec (negligible)
- 📊 Complexity: Medium-high (but manageable)
- 📊 Testing: Requires 2+ players for full test

## Success Criteria

- [ ] 80%+ of playtests involve combat
- [ ] Average combat lasts 30-60 seconds (not too fast/slow)
- [ ] New players hit 30%+ shots within 5 minutes
- [ ] <5ms per frame for projectile simulation
- [ ] No network desyncs in 100 test shots

## Open Questions for User

1. **Friendly fire**: Should cannons damage your own ship if hit?
2. **Respawn location**: Fixed start point or last safe position?
3. **Speed penalty**: Should damaged ships move slower?
4. **Concurrent limit**: Max players per cannon (1 or allow queuing)?
5. **Victory UI**: How to display combat scores/leaderboard?

## Approval

This proposal requires user approval before implementation begins.

**User**: [ ] Approved / [ ] Needs changes / [ ] Rejected

**Notes**: _User feedback here_
