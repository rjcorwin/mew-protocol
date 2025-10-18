# Proposal: Realistic Wheel-Based Ship Steering

**Proposal ID:** w3l-wheel-steering
**Status:** Draft
**Created:** 2025-10-18
**Author:** rjcorwin
**Relates to:** r8s-ship-rotation (replaces Phase F)

## Problem Statement

Current ship steering mechanics are unrealistic:

1. **Instant Rotation:** Pressing left/right instantly snaps the ship to the next heading (45° increments)
2. **No Wheel State:** The wheel has no persistent angle - it's just a control point, not a stateful mechanism
3. **Disconnected Controls:** Player input directly controls ship heading, not the wheel itself
4. **No Momentum:** Ship turns and stops instantly with no inertia or continuation

This creates an arcade-like feel rather than the realistic sailing experience we want.

## Proposed Solution

Implement realistic wheel-based steering mechanics where:

1. **Wheel has state:** The wheel has a persistent angle (e.g., -180° to +180°)
2. **Player turns wheel:** Left/right arrows rotate the wheel at a constant rate
3. **Wheel controls rudder:** Wheel angle determines rudder angle, which determines turn rate
4. **Ship turns continuously:** Ship heading changes gradually based on rudder angle
5. **Wheel centers naturally:** When released, wheel slowly returns to center (straight ahead)

### Key Mechanics

```
Player Input → Wheel Rotation → Rudder Angle → Turn Rate → Ship Heading
```

**Example Flow:**
1. Player grabs wheel and holds RIGHT arrow
2. Wheel rotates clockwise at 90°/second
3. As wheel reaches 45°, ship begins turning right
4. Ship turns at rate proportional to wheel angle (e.g., 1°/sec per 10° of wheel)
5. Player releases RIGHT arrow
6. Wheel begins returning to center at 45°/second
7. As wheel approaches 0°, ship turn rate decreases
8. When wheel reaches 0°, ship stops turning (maintains current heading)

## Current Implementation Analysis

### Ship Server State
```typescript
interface ShipState {
  heading: ShipHeading; // 8 discrete directions
  rotation: number;     // Angle in radians
  speedLevel: SpeedLevel; // 0-3
  controlPoints: {
    wheel: {
      controlledBy: string | null;
      relativePosition: { x, y };
    };
  };
}
```

**Missing:**
- Wheel angle state
- Turn rate
- Continuous heading (currently discrete 8-way)

### Current Steering Logic
```typescript
// ShipServer.ts:322
public steer(playerId: string, direction: 'left' | 'right') {
  // Instantly change heading by one step
  const currentIndex = headings.indexOf(this.state.heading);
  const delta = direction === 'left' ? -1 : 1;
  const newIndex = (currentIndex + delta + 8) % 8;
  this.setHeading(headings[newIndex]); // INSTANT rotation
}
```

**Problems:**
- No wheel state
- Instant heading change
- No continuous rotation

## Proposed Changes

### 1. Add Wheel State

```typescript
interface ShipState {
  // ... existing fields
  wheelAngle: number; // -180 to +180 degrees, 0 = centered
  targetWheelAngle: number; // Where wheel is being turned to
  turnRate: number; // Current turning rate in radians/second
}
```

### 2. New Steering Commands

Replace binary `ship/steer` with stateful wheel commands:

```typescript
// Start turning wheel (hold left/right)
{
  kind: 'ship/wheel_turn_start',
  payload: {
    playerId: string;
    direction: 'left' | 'right'; // Or 'center' to straighten
  }
}

// Stop turning wheel (release key)
{
  kind: 'ship/wheel_turn_stop',
  payload: {
    playerId: string;
  }
}
```

### 3. Wheel Physics Loop

```typescript
// Run every physics tick (60 Hz)
private updateWheelPhysics(deltaTime: number) {
  const WHEEL_TURN_RATE = Math.PI / 2; // 90°/sec
  const WHEEL_CENTER_RATE = Math.PI / 4; // 45°/sec
  const RUDDER_EFFICIENCY = 0.1; // 1°/sec turn per 10° wheel

  // Update wheel angle based on player input or centering
  if (this.wheelTurningDirection) {
    // Player is actively turning wheel
    const delta = this.wheelTurningDirection === 'right' ?
      WHEEL_TURN_RATE * deltaTime :
      -WHEEL_TURN_RATE * deltaTime;
    this.state.wheelAngle = clamp(
      this.state.wheelAngle + delta,
      -Math.PI, // -180°
      Math.PI   // +180°
    );
  } else {
    // Wheel returns to center
    if (Math.abs(this.state.wheelAngle) > 0.01) {
      const centerDelta = Math.sign(-this.state.wheelAngle) *
        WHEEL_CENTER_RATE * deltaTime;
      this.state.wheelAngle += centerDelta;

      // Snap to zero when close
      if (Math.abs(this.state.wheelAngle) < 0.01) {
        this.state.wheelAngle = 0;
      }
    }
  }

  // Calculate turn rate from wheel angle
  this.state.turnRate = this.state.wheelAngle * RUDDER_EFFICIENCY;

  // Apply turn rate to ship rotation
  if (Math.abs(this.state.turnRate) > 0.001) {
    this.state.rotation += this.state.turnRate * deltaTime;
    // Normalize rotation to -PI to PI
    this.state.rotation = normalizeAngle(this.state.rotation);
  }
}
```

### 4. Client Updates

**Input Handling:**
```typescript
// GameScene.ts - instead of JustDown, use isDown
if (this.cursors.left?.isDown) {
  this.sendWheelTurnStart('left');
} else if (this.cursors.right?.isDown) {
  this.sendWheelTurnStart('right');
} else {
  this.sendWheelTurnStop();
}
```

**Wheel Visualization:**
```typescript
// Draw wheel at its current angle
private drawWheel(wheelAngle: number, position: { x, y }) {
  // Rotate wheel sprite by wheelAngle
  this.wheelSprite.setRotation(wheelAngle);
}
```

## Benefits

1. **Realistic Feel:** Ship steering feels like actual sailing
2. **Skill Expression:** Players must learn to anticipate turn momentum
3. **Cooperative Play:** Helmsman must actively maintain course, can't just tap and walk away
4. **Visual Feedback:** Wheel angle shows current turn state at a glance
5. **Smooth Motion:** Continuous rotation instead of discrete 45° snaps

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Too hard to control | Tune turn rates and wheel centering speed |
| Network lag causes wheel desync | Server is authoritative, client predicts locally |
| Players oversteer constantly | Add visual indicators (wheel angle, turn rate) |
| Steering feels sluggish | Make wheel turn rate configurable |

## Implementation Phases

### Phase 1: Wheel State & Centering
- Add wheelAngle to ShipState
- Implement wheel centering when not controlled
- Broadcast wheelAngle in position updates
- Visualize wheel rotation on client

### Phase 2: Continuous Turning
- Replace discrete heading with continuous rotation
- Add turnRate calculation from wheelAngle
- Remove 8-way heading constraints
- Update rotation every physics tick

### Phase 3: New Control Scheme
- Add wheel_turn_start / wheel_turn_stop messages
- Update client input handling (isDown vs JustDown)
- Remove old steer message
- Handle wheel control transitions

### Phase 4: Polish
- Tune constants (turn rates, centering speed)
- Add wheel angle indicator UI
- Add sound effects for wheel creaking
- Test with multiple players

## Success Criteria

- [ ] Wheel has persistent angle state
- [ ] Ship turns continuously while wheel is off-center
- [ ] Wheel returns to center when released
- [ ] Turn rate proportional to wheel angle
- [ ] Smooth rotation (no 45° snaps)
- [ ] Feels more realistic than current instant-turn
- [ ] Network synchronization works correctly

## Constants to Tune

```typescript
const WHEEL_TURN_RATE = 90; // degrees/second
const WHEEL_CENTER_RATE = 45; // degrees/second
const RUDDER_EFFICIENCY = 0.1; // turn rate per degree of wheel
const WHEEL_MAX_ANGLE = 180; // degrees
const MIN_TURN_RATE = 0.001; // radians/sec threshold
```

## Alternatives Considered

### 1. Keep Discrete 8-Way Heading
**Rejected:** Doesn't solve the core problem of unrealistic steering

### 2. Smooth Interpolation Only (Original Phase F)
**Rejected:** Just visual polish, doesn't change the arcade-like mechanics

### 3. Auto-Centering Wheel
**Rejected:** Less realistic - real ship wheels stay where you put them until actively turned

## Open Questions

1. **Speed Dependency:** Should turn rate depend on ship speed?
   - Slower ships turn faster (more maneuverable)
   - Stopped ships don't turn at all?

2. **Wheel Lock:** Should wheel lock when not controlled?
   - Realistic: Wheel should be turnable by ship momentum
   - Gameplay: Might be confusing

3. **Turn Rate Cap:** Maximum turn rate regardless of wheel angle?
   - Prevents unrealistic spinning

## Timeline Estimate

- Phase 1: 2-3 hours (state & centering)
- Phase 2: 3-4 hours (continuous rotation)
- Phase 3: 2-3 hours (new controls)
- Phase 4: 2-3 hours (polish & tuning)

**Total:** 9-13 hours (~1.5-2 days)

## Related Work

- **r8s-ship-rotation:** Completed - provides foundation for continuous rotation
- **Milestone 5 Phase 5b:** Ship rendering and controls
- **Future:** Wind direction affecting turn rate, ship momentum/inertia

---

**Status:** Draft - awaiting review and approval
