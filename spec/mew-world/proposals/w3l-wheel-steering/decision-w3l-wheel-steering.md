# Decision: Realistic Wheel-Based Ship Steering

**Proposal:** w3l-wheel-steering
**Status:** Proposed
**Date:** 2025-10-18
**Decider:** TBD

## Context

The current ship steering system (implemented in r8s-ship-rotation) allows instant heading changes via discrete 45° rotations. While the rotation system works correctly, the steering mechanics feel arcade-like rather than realistic:

- Press left/right → ship instantly snaps to new heading
- No wheel state or momentum
- Player can tap once and walk away
- No skill required for steering

This is inconsistent with the realistic sailing experience we're building in MEW World.

## Decision

Implement realistic wheel-based steering mechanics where the wheel is a stateful mechanism that controls ship rotation rate, not heading directly.

### Core Mechanics

**Before (Current):**
```
Player Input (tap left) → Ship Heading (instant -45°)
```

**After (Proposed):**
```
Player Input (hold left) → Wheel Angle → Turn Rate → Ship Rotation (continuous)
                           ↓ (release)
                           Wheel Locked → Turn Rate Constant → Ship Continues Turning
```

### Key Design Decisions

1. **Wheel Has Persistent State**
   - wheelAngle: -180° to +180° (0 = centered/straight)
   - Not just a control point, but a stateful mechanism

2. **Continuous Rotation Instead of Discrete Heading**
   - Remove 8-way heading constraint
   - Ship rotation is continuous (any angle 0-360°)
   - Smoother, more realistic turning

3. **Turn Rate Proportional to Wheel Angle**
   - Wheel at 0° → no turning
   - Wheel at 90° → moderate turn rate
   - Wheel at 180° → maximum turn rate
   - Formula: `turnRate = wheelAngle * RUDDER_EFFICIENCY`

4. **Wheel Position Locks When Released**
   - Wheel stays at current angle when player releases controls
   - Ship continues turning at constant rate
   - Player must manually return wheel to center to stop turning

5. **New Control Messages**
   - Replace: `ship/steer {direction: 'left'|'right'}` (instant)
   - With: `ship/wheel_turn_start {direction}` + `ship/wheel_turn_stop` (continuous)

## Implementation Plan

### Phase 1: Wheel State & Position Locking (Foundation)

**Server Changes:**
```typescript
// Add to ShipState
interface ShipState {
  wheelAngle: number; // -PI to PI radians, 0 = centered
  turnRate: number;   // Current rotation rate (radians/second)
  wheelTurningDirection: 'left' | 'right' | null; // Active input
}

// New physics loop
private updateWheelPhysics(deltaTime: number) {
  // 1. Update wheel angle based on input or centering
  // 2. Calculate turn rate from wheel angle
  // 3. Apply turn rate to ship rotation
}
```

**Client Changes:**
```typescript
// Visualize wheel rotation
drawControlPoint() {
  // Rotate wheel graphic by wheelAngle
  wheelGraphics.setRotation(ship.wheelAngle);
}
```

**Success Criteria:**
- [ ] Wheel angle state persists in ShipServer
- [ ] Wheel holds position when no input (locked)
- [ ] Wheel angle broadcast to clients
- [ ] Wheel visual rotates on screen

### Phase 2: Continuous Ship Rotation

**Server Changes:**
```typescript
// Remove discrete heading constraint
// OLD: heading: ShipHeading (8 discrete values)
// NEW: rotation: number (continuous radians)

private updateWheelPhysics(deltaTime: number) {
  // Calculate turn rate
  const RUDDER_EFFICIENCY = 0.1; // radians/sec per radian of wheel
  this.state.turnRate = this.state.wheelAngle * RUDDER_EFFICIENCY;

  // Apply to rotation
  if (Math.abs(this.state.turnRate) > 0.001) {
    this.state.rotation += this.state.turnRate * deltaTime;
    this.state.rotation = normalizeAngle(this.state.rotation); // Keep in -PI to PI
  }
}
```

**Client Changes:**
```typescript
// Ship sprite uses continuous rotation (already implemented in Phase A)
ship.sprite.setRotation(update.shipData.rotation);
```

**Success Criteria:**
- [ ] Ship rotation is continuous (not snapping to 45° increments)
- [ ] Turn rate calculated from wheel angle
- [ ] Ship turns while wheel is off-center
- [ ] Ship continues turning at constant rate when wheel locked at angle

### Phase 3: New Input System

**Protocol Changes:**
```typescript
// NEW: Wheel turn start (when key pressed)
{
  kind: 'ship/wheel_turn_start',
  to: [shipId],
  payload: {
    playerId: string;
    direction: 'left' | 'right';
  }
}

// NEW: Wheel turn stop (when key released)
{
  kind: 'ship/wheel_turn_stop',
  to: [shipId],
  payload: {
    playerId: string;
  }
}

// DEPRECATED: ship/steer (instant turn)
// Remove after migration
```

**Server Handler:**
```typescript
public startTurningWheel(playerId: string, direction: 'left' | 'right') {
  if (this.controlPoints.wheel.controlledBy !== playerId) return;
  this.wheelTurningDirection = direction;
}

public stopTurningWheel(playerId: string) {
  if (this.controlPoints.wheel.controlledBy !== playerId) return;
  this.wheelTurningDirection = null; // Wheel locks at current angle
}
```

**Client Input:**
```typescript
// CHANGE: Use isDown instead of JustDown
if (this.controllingPoint === 'wheel') {
  if (this.cursors.left?.isDown) {
    if (!this.currentWheelDirection || this.currentWheelDirection !== 'left') {
      this.sendWheelTurnStart('left');
      this.currentWheelDirection = 'left';
    }
  } else if (this.cursors.right?.isDown) {
    if (!this.currentWheelDirection || this.currentWheelDirection !== 'right') {
      this.sendWheelTurnStart('right');
      this.currentWheelDirection = 'right';
    }
  } else {
    if (this.currentWheelDirection) {
      this.sendWheelTurnStop();
      this.currentWheelDirection = null;
    }
  }
}
```

**Success Criteria:**
- [ ] New messages implemented
- [ ] Client sends turn_start when key pressed
- [ ] Client sends turn_stop when key released
- [ ] Old steer message removed
- [ ] Smooth transition from old to new system

### Phase 4: Tuning & Polish

**Constants to Tune:**
```typescript
const WHEEL_TURN_RATE = Math.PI / 2; // 90°/sec - how fast player can rotate wheel
const RUDDER_EFFICIENCY = 0.1; // turn rate multiplier
const WHEEL_MAX_ANGLE = Math.PI; // 180° max
const TURN_RATE_THRESHOLD = 0.001; // ignore tiny turn rates
```

**Polish Items:**
- [ ] Tune constants for good feel
- [ ] Add wheel angle indicator UI (e.g., compass-like dial)
- [ ] Add sound effects (wheel creaking)
- [ ] Add visual feedback (rope tension on wheel)
- [ ] Test with multiple players
- [ ] Document controls in game UI

**Success Criteria:**
- [ ] Steering feels realistic but responsive
- [ ] Players can easily see current wheel angle
- [ ] No network desync issues
- [ ] Satisfying audio/visual feedback

## Consequences

### Positive

- **Realistic Sailing:** Ship steering feels like actual sailing mechanics
- **Skill Expression:** Players must anticipate momentum and overshoot
- **Set and Forget:** Helmsman can set a turn and attend to other ship tasks
- **Smooth Motion:** Continuous rotation looks much better than 45° snaps
- **Foundation for Advanced Physics:** Sets up for wind, currents, ship momentum

### Negative

- **Learning Curve:** Players must learn new steering mechanics
- **More Complex:** More state and logic than instant turns
- **Tuning Required:** Constants must be carefully balanced
- **Breaking Change:** Existing players must adapt to new controls

### Neutral

- **Network Bandwidth:** Minimal increase (one extra field: wheelAngle)
- **Performance:** Negligible (one more calculation per physics tick)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Players find steering too difficult | Medium | High | Extensive playtesting, tunable constants |
| Wheel desync across clients | Low | Medium | Server authoritative, client prediction |
| Ship turns unexpectedly (forgot wheel angle) | Medium | Medium | Add turn rate indicators, wheel angle UI |
| Network lag makes steering unresponsive | Low | Medium | Client-side prediction for local player |
| Breaking existing muscle memory | High | Low | Tutorial/onboarding, in-game instructions |

## Alternatives Considered

### 1. Smooth Interpolation Only (Original Phase F)
**Why Rejected:**
- Only visual polish, doesn't fix arcade-like mechanics
- Still instant discrete turns, just animated
- Doesn't add depth or skill expression

### 2. Keep Current Instant Steering
**Why Rejected:**
- Unrealistic and breaks immersion
- No skill expression
- Inconsistent with realistic sailing goals

### 3. Speed-Based Turn Rate
**Why Deferred:**
- Can add later as enhancement
- Want to establish basic wheel mechanics first
- Complexity vs value tradeoff

### 4. Wheel Auto-Centers When Released
**Why Rejected:**
- Reduces gameplay value - can't set a course
- Forces player to constantly hold wheel for sustained turns
- Less flexible for single-player ship operation

## Open Questions

1. **Should turn rate depend on ship speed?**
   - **Option A:** Turn rate independent of speed (simpler)
   - **Option B:** Slower ships turn faster (more realistic)
   - **Recommendation:** Start with A, add B later if needed

2. **Maximum turn rate cap?**
   - **Option A:** No cap - wheel at max = fastest turn
   - **Option B:** Cap turn rate even at max wheel angle
   - **Recommendation:** Option B to prevent unrealistic spinning

3. **Wheel angle limits?**
   - **Current:** ±180° (full rotation)
   - **Alternative:** ±90° (quarter turn)
   - **Recommendation:** Start with ±180°, can tune down if feels wrong

4. **Should we add a "center wheel" quick-key?**
   - **Option A:** Player must manually rotate back to center
   - **Option B:** Dedicated key to auto-center wheel quickly
   - **Recommendation:** Start without, add if playtesters request it

## Success Metrics

- Ship steering feels realistic (playtester feedback)
- Players can maintain straight course with minimal input
- Turn rate feels responsive but not twitchy
- No network desync issues in 100 test turns
- 90% of playtesters prefer new system over old (after tutorial)

## Timeline Estimate

- **Phase 1:** 2-3 hours (wheel state & centering)
- **Phase 2:** 3-4 hours (continuous rotation)
- **Phase 3:** 2-3 hours (new input messages)
- **Phase 4:** 2-3 hours (tuning & polish)

**Total:** 8-12 hours (~1-2 days of focused work)

## Testing Plan

1. **Unit Tests:**
   - [ ] Wheel centering math
   - [ ] Turn rate calculation
   - [ ] Angle normalization

2. **Integration Tests:**
   - [ ] Wheel turn start/stop
   - [ ] Multi-player wheel control
   - [ ] Network synchronization

3. **Manual Testing:**
   - [ ] Steer in circles
   - [ ] Quick direction changes
   - [ ] Gradual course corrections
   - [ ] Multiple players on same ship
   - [ ] Network lag scenarios

## Related Work

- **r8s-ship-rotation (Completed):** Foundation for continuous rotation
- **Milestone 5 Phase 5b (Completed):** Ship controls infrastructure
- **Future Enhancements:**
  - Wind direction affecting turn rate
  - Ship momentum/inertia
  - Rudder damage (reduced efficiency)
  - Different ship types with different turn rates

## Next Steps

1. Review proposal with team
2. Gather feedback on mechanics design
3. Approve or request changes
4. Create implementation tasks
5. Begin Phase 1 implementation
6. Iterate based on playtesting

---

**Status:** Proposed - awaiting review and approval

**Recommendation:** Approve for implementation

**Reviewer Notes:**

- [ ] Mechanics design sound?
- [ ] Implementation plan feasible?
- [ ] Constants seem reasonable?
- [ ] Risks adequately addressed?
- [ ] Timeline realistic?

**Approval Signatures:**

- [ ] Product Owner: _________________ Date: _______
- [ ] Technical Lead: _________________ Date: _______
- [ ] UX Designer: ___________________ Date: _______
