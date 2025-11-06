# Proposal g4p: Gamepad/Controller Support

**Status**: Proposed
**Created**: 2025-11-03
**Area**: Seacat Game Client
**Targets**: Browser, Electron Desktop, Steam (Steam Deck)

## Summary

Add comprehensive gamepad/controller support to Seacat using Phaser 3's Gamepad API (wrapping the W3C Gamepad API). This enables players to use Xbox, PlayStation, Nintendo, and other standard controllers across all deployment platforms: web browsers, Electron desktop apps, and Steam/Steam Deck.

## Motivation

**Player Experience**:
- Controllers provide superior analog control for sailing and cannon aiming
- Essential for Steam Deck compatibility
- More comfortable for extended play sessions
- Expected feature for couch gaming

**Platform Requirements**:
- Steam Deck players expect native controller support
- Many players prefer gamepad over keyboard/mouse for action games
- Accessibility: Some players need controller support for physical reasons

**Technical Benefits**:
- W3C Gamepad API works across all target platforms
- Phaser 3 provides excellent gamepad abstraction
- Single implementation works everywhere (browser, Electron, Steam)

## Goals

### Primary Goals
1. Support standard game controllers (Xbox, PlayStation, Switch Pro)
2. Enable all core gameplay with controller-only (no mouse/keyboard required)
3. Smooth analog control for movement, steering, and aiming
4. Work across browser, Electron, and Steam builds
5. Graceful handling of controller connect/disconnect

### Secondary Goals
6. Show controller-specific button prompts (e.g., "Press [A]" vs "Press [Cross]")
7. Allow simultaneous keyboard and controller input (seamless switching)
8. Support local multiplayer with multiple controllers
9. Make controls configurable/rebindable

### Stretch Goals
10. Steam Input API integration for enhanced Steam/Steam Deck features
11. Vibration/rumble support
12. Advanced Steam Deck features (gyro, trackpads)

## Non-Goals

- Mobile touch controller simulation (separate proposal)
- VR controller support
- HOTAS/flight stick support
- Mouse emulation via controller

## Technical Approach

### Core Technology

**W3C Gamepad API** via **Phaser 3 Input.Gamepad Plugin**

```javascript
// Enable in game config
const config = {
  input: {
    gamepad: true
  }
};
```

### Controller Detection

Handle both pre-connected and runtime-connected controllers:

```javascript
create() {
  // Check for already-connected controllers
  if (this.input.gamepad.total > 0) {
    this.setupController(this.input.gamepad.getPad(0));
  }

  // Listen for new connections
  this.input.gamepad.on('connected', (pad) => {
    this.onControllerConnected(pad);
  });

  this.input.gamepad.on('disconnected', (pad) => {
    this.onControllerDisconnected(pad);
  });
}
```

### Input Abstraction

Create a unified input system supporting both keyboard and gamepad:

```javascript
class InputManager {
  update() {
    this.updateKeyboard();
    this.updateGamepad();
  }

  isActionActive(action) {
    return this.keyboard.isActionActive(action) ||
           this.gamepad.isActionActive(action);
  }

  getMovementVector() {
    // Prefer gamepad stick if detected
    const gamepadMove = this.gamepad.getMovement();
    if (gamepadMove.length() > DEADZONE) {
      return gamepadMove;
    }
    return this.keyboard.getMovement();
  }
}
```

### Control Mapping

#### On Foot (Character Movement)

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Move | Arrow Keys / WASD | Left Stick |
| Interact (board ship, use object) | E | A (Xbox) / Cross (PS) |
| Cancel / Exit | Escape | B (Xbox) / Circle (PS) |
| Menu | M | Start |
| Camera Control | N/A | Right Stick (optional) |

#### On Ship (Sailing Controls)

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Steer Ship | A/D | Left Stick Horizontal |
| Sails Up/Down | W/S | D-Pad Up/Down or Left Stick Vertical |
| Walk on Deck | Arrow Keys | Left Stick |
| Interact (wheel, cannons) | E | A |
| Exit Control | Escape | B |

#### Cannon Controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Aim Cannon | Mouse | Right Stick |
| Fire | Space | R2 Trigger |
| Next/Previous Cannon | [ / ] | L1 / R1 Bumpers |
| Exit Cannon | Escape | B |

### Analog Input Handling

**Deadzone Implementation**:

```javascript
const INNER_DEADZONE = 0.15;  // Ignore drift
const OUTER_DEADZONE = 0.95;  // Smooth to max

function processStick(stick) {
  const length = stick.length();

  // Apply inner deadzone
  if (length < INNER_DEADZONE) {
    return { x: 0, y: 0 };
  }

  // Apply outer deadzone and normalize
  const normalizedLength = Math.min(
    (length - INNER_DEADZONE) / (OUTER_DEADZONE - INNER_DEADZONE),
    1.0
  );

  const angle = stick.angle();
  return {
    x: Math.cos(angle) * normalizedLength,
    y: Math.sin(angle) * normalizedLength
  };
}
```

**Trigger Handling**:

```javascript
const TRIGGER_THRESHOLD = 0.1;

function isFirePressed(gamepad) {
  return gamepad.R2 > TRIGGER_THRESHOLD;
}
```

### Button State Tracking

Track "just pressed" state manually:

```javascript
class GamepadTracker {
  constructor() {
    this.previousButtons = new Map();
  }

  update(gamepad) {
    gamepad.buttons.forEach((button, index) => {
      this.previousButtons.set(index, button.pressed);
    });
  }

  isJustPressed(button) {
    const nowPressed = button.pressed;
    const wasPressed = this.previousButtons.get(button.index) || false;
    return nowPressed && !wasPressed;
  }
}
```

### Visual Feedback

Detect controller type and show appropriate button prompts:

```javascript
function detectControllerType(gamepad) {
  const id = gamepad.id.toLowerCase();

  if (id.includes('xbox') || id.includes('xinput')) {
    return 'xbox';
  }
  if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense')) {
    return 'playstation';
  }
  if (id.includes('switch') || id.includes('pro controller')) {
    return 'nintendo';
  }

  return 'generic';
}

function showInteractPrompt(controllerType) {
  const prompts = {
    xbox: 'Press [A] to interact',
    playstation: 'Press [✕] to interact',
    nintendo: 'Press [B] to interact',
    generic: 'Press button 0 to interact'
  };

  return prompts[controllerType];
}
```

## Implementation Phases

### Phase 1: Foundation (MVP)
**Goal**: Basic controller support for character movement

**Tasks**:
1. Enable Phaser gamepad plugin in game config
2. Add controller detection and connection events
3. Implement basic movement with left stick
4. Add A button for interact
5. Show "Controller Connected" notification
6. Test with Xbox controller on Windows/macOS

**Success Criteria**:
- Player can move character with left stick
- Player can board ship with A button
- Controller connect/disconnect handled gracefully

### Phase 2: Ship Controls
**Goal**: Full ship gameplay with controller

**Tasks**:
1. Map steering to left stick horizontal
2. Map sails to D-Pad or stick vertical
3. Implement cannon aiming with right stick
4. Add R2 trigger for firing
5. Add L1/R1 for cannon switching
6. Implement proper deadzones for sticks

**Success Criteria**:
- Player can sail ship using only controller
- Cannon aiming feels smooth and responsive
- All ship interactions accessible via controller

### Phase 3: Input Abstraction
**Goal**: Seamless keyboard + controller support

**Tasks**:
1. Create `InputManager` class
2. Implement `isActionActive()` abstraction
3. Support automatic input source switching
4. Add "just pressed" detection for gamepad
5. Refactor existing keyboard code to use abstraction

**Success Criteria**:
- Player can switch between keyboard and controller mid-game
- No conflicts between input sources
- Code is cleaner and more maintainable

### Phase 4: Polish
**Goal**: Professional controller experience

**Tasks**:
1. Detect controller type and show appropriate prompts
2. Add button prompt UI (e.g., "[A] Board Ship")
3. Create controller settings menu
4. Add vibration/rumble support (if supported)
5. Test with multiple controller types

**Success Criteria**:
- Button prompts show correct controller icons
- Settings allow deadzone/sensitivity adjustment
- Tested with Xbox, PlayStation, and generic controllers

### Phase 5: Multi-Controller (Optional)
**Goal**: Local multiplayer support

**Tasks**:
1. Detect and track multiple controllers
2. Assign controllers to players
3. Handle per-player input
4. Test 2-4 player local co-op

**Success Criteria**:
- Multiple players can play simultaneously
- Each controller controls independent player

### Phase 6: Steam Integration (Optional)
**Goal**: Enhanced Steam/Steam Deck experience

**Tasks**:
1. Evaluate Steam Input API integration
2. Add Steam-specific controller configuration
3. Support Steam Deck trackpads/gyro (if desired)
4. Add Steam controller glyphs

**Success Criteria**:
- Enhanced features on Steam build
- Graceful fallback on other platforms

## Platform Considerations

### Browser
- **Limitation**: Button press required before gamepad access
- **Solution**: Show "Press any button" prompt on start screen
- **Testing**: Chrome, Firefox, Edge

### Electron Desktop
- **Works**: Identical to browser (uses Chromium)
- **No special code needed**
- **Testing**: macOS, Windows, Linux builds

### Steam / Steam Deck
- **Basic Support**: W3C Gamepad API works out of the box
- **Enhanced Support**: Steam Input API for advanced features
- **Recommendation**: Start with Gamepad API, add Steam Input later if needed
- **Steam Deck**: Ensure Xbox controller mapping for compatibility

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Different button mappings across controllers | High | Use Phaser's abstraction; test multiple controllers |
| Analog stick drift causing unwanted movement | Medium | Implement robust deadzone system |
| Controller not detected until button press | Low | Show prompt; check `gamepad.total` on start |
| No "just pressed" detection | Medium | Implement manual state tracking |
| Steam Deck specific features require Steam API | Low | Accept limitation; focus on core controls first |

## Testing Strategy

### Manual Testing

**Controllers to test**:
- Xbox One / Series controller (USB & Bluetooth)
- PlayStation DualShock 4 / DualSense
- Nintendo Switch Pro Controller
- Generic USB controller
- Steam Deck built-in controls (if available)

**Test scenarios**:
1. Connect controller before game launch
2. Connect controller after game started
3. Disconnect controller during gameplay
4. Reconnect after disconnect
5. Switch between keyboard and controller
6. Multiple controllers simultaneously

**Platforms to test**:
- Chrome browser
- Firefox browser
- Electron (macOS, Windows, Linux)
- Steam (Windows, Linux, Steam Deck)

### Automated Testing

- Unit tests for input abstraction layer
- Mock Gamepad API for CI
- Integration tests for input state tracking

## Open Questions

1. **Button Rebinding**: Should players be able to remap controls, or use fixed mapping?
   - **Recommendation**: Fixed mapping initially, add rebinding in Phase 4

2. **Steam Integration**: Is Steam Input API worth the complexity?
   - **Recommendation**: Defer until after basic support ships; evaluate based on player feedback

3. **Local Multiplayer**: Is this a priority?
   - **Recommendation**: Phase 5 (optional); depends on networking/multiplayer plans

4. **Rumble/Vibration**: Should we support controller vibration?
   - **Recommendation**: Add in Phase 4 if Gamepad API supports it well

5. **Mobile Controllers**: Should mobile Bluetooth controllers work?
   - **Recommendation**: Out of scope; mobile has different UX needs

## Success Metrics

- ✅ Player can complete all gameplay actions using only controller
- ✅ Analog aiming feels smooth and responsive
- ✅ Works on all three platforms (browser, Electron, Steam)
- ✅ Tested with at least 3 different controller types
- ✅ No crashes or errors on controller connect/disconnect
- ✅ Community feedback is positive

## Resources Required

- **Development Time**: ~2-3 weeks (Phases 1-4)
- **Hardware**: Access to Xbox, PlayStation, and generic controllers for testing
- **Testing**: Steam Deck for platform-specific testing (optional)

## References

See [research.md](./research.md) for comprehensive research and technical details.

**Key Resources**:
- Phaser 3 Gamepad API: https://docs.phaser.io/api-documentation/class/input-gamepad-gamepadplugin
- W3C Gamepad Spec: https://w3c.github.io/gamepad/
- Phaser Controller Tutorial: https://blog.khutchins.com/posts/phaser-3-inputs-2/
- Rex's Phaser 3 Gamepad Notes: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/gamepad/

## Next Steps

1. Review and approve this proposal
2. Create detailed implementation plan
3. Set up testing hardware (controllers)
4. Begin Phase 1 implementation
5. Iterate based on playtesting feedback

## Appendix: Example Code Structure

```
clients/seacat/src/
├── input/
│   ├── InputManager.ts          // Main input coordinator
│   ├── KeyboardProvider.ts      // Keyboard input handling
│   ├── GamepadProvider.ts       // Gamepad input handling
│   ├── InputAction.ts           // Action definitions (move, interact, etc.)
│   └── types.ts                 // Input-related types
├── config/
│   └── controls.ts              // Control mappings and defaults
├── ui/
│   └── ButtonPrompts.ts         // Controller button prompt UI
└── scenes/
    └── GameScene.ts             // Use InputManager instead of direct input
```

**Usage in scenes**:

```typescript
class GameScene extends Phaser.Scene {
  private inputManager: InputManager;

  create() {
    this.inputManager = new InputManager(this);
  }

  update(time: number, delta: number) {
    this.inputManager.update(time, delta);

    // Check actions
    if (this.inputManager.isActionJustPressed('interact')) {
      this.handleInteract();
    }

    // Get movement
    const movement = this.inputManager.getMovementVector();
    this.player.move(movement.x, movement.y);

    // Get aim direction (for cannons)
    const aim = this.inputManager.getAimVector();
    if (aim.length() > 0.1) {
      this.cannon.aim(aim.angle());
    }
  }
}
```
