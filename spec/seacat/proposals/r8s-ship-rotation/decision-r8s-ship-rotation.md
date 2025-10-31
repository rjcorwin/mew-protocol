# Decision: Ship Rotation Implementation

**Proposal:** r8s-ship-rotation
**Status:** Implemented (Phases A-D Complete)
**Date:** 2025-10-18
**Decider:** rjcorwin

## Context

Ships in Seacat currently have 8-directional heading but do not visually rotate to match. This creates a disconnect between the ship's logical direction and visual representation, affects collision accuracy, and prevents realistic player positioning on rotating decks.

## Decision

Implement full 8-directional ship rotation with the following approach:

### Core Technical Decisions

1. **Ship Sprite Rotation: Runtime Rotation**
   - Use Phaser's `sprite.setRotation()` with calculated angles from heading
   - Single ship sprite asset rotated at runtime
   - Alternative rejected: Pre-rendered 8-angle sprites (more memory, harder to interpolate)

2. **Deck Boundary Collision: Oriented Bounding Box (OBB)**
   - Transform player position to ship-local space and test against axis-aligned rectangle
   - Exact collision for rectangular decks with O(1) performance
   - Alternatives rejected: SAT (overkill for rectangles), polygon (slower), circle (inaccurate)

3. **Player Rotation: Rotate Around Ship Center on Heading Change**
   - Store player positions in ship-local coordinates
   - Rotate positions when ship heading changes (not every frame)
   - Transform to world space for rendering
   - Alternative rejected: World-aligned positions (breaks on rotation)

4. **Control Point Rotation: Phaser Scene Graph Children**
   - Make control point graphics children of ship sprite
   - Automatic rotation propagation via scene graph
   - Alternative rejected: Manual rotation (more code, prone to errors)

5. **Player Movement on Deck: World-Aligned (Initially)**
   - Players walk in world directions even while on ship
   - Simpler implementation, familiar controls
   - Ship-relative movement reserved for future enhancement
   - Alternative deferred: Ship-relative movement (more realistic but potentially confusing)

6. **Rotation Animation: Smooth Interpolation**
   - Interpolate rotation over 0.5 seconds (configurable)
   - Update player positions incrementally during rotation
   - Alternative rejected: Instant rotation (jarring, unrealistic)

### Implementation Phases

**Phase A: Visual Rotation (Low Risk)** ✅ **COMPLETED**
- Add `rotation` field to ship state
- Render ship sprite with rotation
- No gameplay changes
- Commit: db8c893

**Phase B: Rotating Collision (Medium Risk)** ✅ **COMPLETED**
- Implement OBB collision detection
- Update boarding detection for rotated ships
- Test thoroughly from all angles
- Commit: 4ce0cdb

**Phase C: Player Rotation (High Risk)** ✅ **COMPLETED**
- Rotate players when ship turns
- Synchronize across all clients
- Most complex phase, requires careful testing
- Commits: 2a28bfb, 8c45164, ec1047b, 915adf6

**Phase D: Control Points (Low Risk)** ✅ **COMPLETED**
- Rotate control points with ship rotation
- Update interaction detection for rotated positions
- Commit: 0eb0348

**Phase E: Ship-Relative Movement (Optional/Future)** ⏭️ **DEFERRED**
- Transform player input to ship-local space
- Deferred to future milestone

**Phase F: Interpolation Polish (Low Risk)** ❌ **CANCELLED**
- Smooth rotation animation
- Visual improvement only
- **Reason:** Replaced by w3l-wheel-steering proposal for realistic wheel-based steering

## Consequences

### Positive

- **Visual Realism:** Ships will visually match their heading direction
- **Accurate Collision:** Deck boundaries match visual ship orientation
- **Realistic Player Positioning:** Players rotate naturally with the ship
- **Extensible:** Foundation for future features (ship-relative movement, multi-deck ships)
- **Performance:** Minimal cost (rotations only on heading change, ~0.002ms per ship)

### Negative

- **Implementation Complexity:** Significantly more complex than current non-rotating system
- **Testing Surface:** More edge cases to test (all 8 rotations × boarding/leaving/walking)
- **Potential Bugs:** Rotation math errors could cause player position desync
- **Migration Risk:** Existing ships/players may need position corrections

### Neutral

- **Memory:** Negligible increase (one float per ship for rotation angle)
- **Network:** One additional field in position updates (rotation: number)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Floating point error accumulation | Medium | Medium | Recalculate from canonical heading, don't accumulate deltas |
| Player position desync across clients | Medium | High | Broadcast rotation delta, all clients apply same rotation |
| Players clip through rotated deck | Low | Medium | Test all 8 rotations, add safety margins to boundary |
| Control points become inaccessible during rotation | Low | Low | Prevent grabbing during active rotation |
| Performance degradation with many players | Low | Low | Only rotate on heading change, not every frame |

## Alternatives Considered

### 1. No Rotation (Status Quo)

**Rejected:** Visual disconnect breaks immersion, collision inaccurate

### 2. 4-Direction Rotation Only

**Rejected:** Still need rotation logic, inconsistent behavior for diagonal headings

### 3. Pre-Rendered Sprites for 8 Angles

**Rejected:** 8× memory, harder to interpolate, more art work for minimal quality gain

### 4. Separate Facing and Movement Direction

**Rejected:** Overly complex for current scope, confusing gameplay

## Open Questions

1. **Rotation Speed:** Should it be instant, 0.5s, or 1s?
   - **Recommendation:** Start with 0.5s, make configurable
   - **Resolution:** Test with playtesters

2. **Player Rotation Feel:** Will rotating with ship feel natural?
   - **Recommendation:** Implement and playtest
   - **Fallback:** Add option to disable rotation (players stay world-aligned)

3. **Movement Style:** World-aligned or ship-relative?
   - **Decision:** Start with world-aligned (Phase E deferred)
   - **Rationale:** Simpler, less confusing, can add ship-relative later

## Implementation Notes

### Code Changes Required

**Ship Server (`src/mcp-servers/ship-server/`):**
- Add `rotation: number` to ShipState
- Add `headingToRotation()` helper
- Include rotation in position broadcasts
- Add `rotationDelta` calculation

**Client (`clients/seacat/src/game/GameScene.ts`):**
- Implement `isPointInRotatedRect()` for OBB collision
- Update `checkShipBoundary()` to use OBB
- Implement `rotatePoint()` helper
- Rotate player positions on `rotationDelta`
- Set `ship.sprite.rotation` from received updates
- Convert control points to sprite children

**Types (`clients/seacat/src/types.ts`):**
- Add `rotation: number` to ShipData interface
- Add `rotationDelta?: number` to ShipData interface

### Testing Checklist

- [x] Ship sprite rotates visually for all 8 headings
- [x] Players can board ship from all 8 directions
- [x] Players on deck rotate when ship turns
- [x] Multiple players rotate together correctly
- [x] Control points stay in correct positions
- [x] No visual glitches during rotation
- [x] Position synchronization works across clients
- [x] Players can't walk outside rotated deck boundary
- [ ] Smooth interpolation (if enabled) looks good - CANCELLED, see w3l-wheel-steering
- [ ] Performance acceptable with 10+ players on rotating ship - NOT TESTED YET

## Success Metrics

- Ship rotation visually matches heading in 100% of cases
- Boarding detection works from all angles (0% false positives/negatives)
- Player positions stay synchronized (< 5px error) during rotation
- No client crashes or position desync in 100 test rotations
- FPS remains above 30 with 20 players on rotating ship

## Timeline Estimate

- **Phase A:** 2-3 hours (basic rotation)
- **Phase B:** 4-6 hours (OBB collision, testing)
- **Phase C:** 8-12 hours (player rotation, synchronization, testing)
- **Phase D:** 2-3 hours (control point children)
- **Phase F:** 3-4 hours (interpolation polish)

**Total:** 19-28 hours (2.5-3.5 days of focused work)

**Phase E (ship-relative movement):** 4-6 hours if pursued later

## Related Work

- **Milestone 5 Phase 5b:** Completed - ship rendering and controls
- **Milestone 5 Phase 5c:** Completed - collision detection
- **Milestone 6:** Completed - platform coordinate system
- **Future:** Ship-relative movement (Phase E), multi-deck ships, ship-to-ship collision

## Decision

**Status:** ✅ Implemented (Phases A-D Complete, Phase F Cancelled)

**Implementation Order:** A → B → C → D

**Completion Date:** 2025-10-18

**Actual Timeline:** ~4 hours (faster than 19-28 hour estimate due to focused scope)

**Next Steps:**
1. ✅ Phase A-D implementation complete
2. ⏭️ Phase E (ship-relative movement) deferred
3. ❌ Phase F cancelled - replaced by w3l-wheel-steering proposal
4. ➡️ See proposal w3l-wheel-steering for realistic wheel-based steering mechanics

---

**Approval Signatures:**

- [x] Product Owner: rjcorwin - Date: 2025-10-18
- [x] Technical Lead: rjcorwin - Date: 2025-10-18
- [x] QA Lead: Tested manually - Date: 2025-10-18
