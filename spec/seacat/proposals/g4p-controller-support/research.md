# Controller Support Research (g4p)

## Executive Summary

This research explores adding comprehensive gamepad/controller support to Seacat across multiple deployment targets: web browsers, Electron desktop apps, and Steam (including Steam Deck). The core technology is the W3C Gamepad API, which is supported across all platforms via Chromium/browser engines.

**Key Finding**: A single implementation using Phaser 3's Gamepad API (which wraps the W3C Gamepad API) can work across all three target platforms with minimal platform-specific code.

## Platform Analysis

### 1. Browser-Based Deployment

**Technology**: W3C Gamepad API
**Support**: All modern browsers (Chrome, Firefox, Edge, Safari)
**Status**: ✅ Fully supported

The W3C Gamepad API is a browser standard that provides access to connected game controllers. It supports:
- Standard gamepad mapping (17 buttons, 4 axes)
- Multiple simultaneous controllers (up to 4)
- Connection/disconnection events
- Analog stick and trigger input

**Important Limitation**: For security/fingerprinting prevention, browsers require user interaction with a controller before exposing it via the API. Users must press a button before the `gamepadconnected` event fires.

**Browser Compatibility**:
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (as of Safari 14.1+)
- Mobile browsers: Limited support (iOS Safari experimental)

### 2. Electron Desktop Apps

**Technology**: W3C Gamepad API (via Chromium)
**Support**: Full support through Electron's Chromium engine
**Status**: ✅ Fully supported

Since Electron embeds Chromium, the same W3C Gamepad API works identically. No additional libraries needed.

**Key Considerations**:
- Same security limitation as browsers (button press required)
- No Electron-specific APIs needed
- Works on Windows, macOS, and Linux

**Testing Evidence**: Multiple developers have successfully used the Gamepad API in Electron apps, including a dedicated gamepad tester app built with Electron.

### 3. Steam & Steam Deck

**Technology**: Multiple options available
**Status**: ⚠️ Requires careful consideration

#### Option A: W3C Gamepad API (Recommended)

**Approach**: Continue using browser/Electron Gamepad API
**Pros**:
- Same code works everywhere
- No additional libraries
- Steam Deck controller exposes itself as a standard gamepad
- Works in Steam's browser overlay

**Cons**:
- No access to Steam Input's advanced features (action sets, configuration UI)
- No Steam-specific controller icons/glyphs
- Players can't customize controls through Steam interface

**Steam Deck Compatibility**:
- Chrome on Steam Deck supports the Deck controller via Gamepad API
- Requires enabling controller support: `flatpak --user override --filesystem=/run/udev:ro com.google.Chrome`
- Set Steam Input to "Gamepad with Mouse Trackpad" mode
- Controller mapping: Xbox One controller layout ensures Steam Deck compatibility

#### Option B: Steam Input API (Native Integration)

**Approach**: Use Steamworks SDK for controller input
**Pros**:
- Full Steam Input feature set
- Player-configurable controls
- Support for action sets (menu, gameplay, etc.)
- Official Steam controller glyphs
- Better Steam Deck integration

**Cons**:
- Requires Steamworks SDK integration
- Platform-specific code (Steam-only)
- Need to package as native app (can use Electron + Greenworks)
- Adds complexity

**Implementation Path**:
1. Package Electron app with Steamworks integration (via Greenworks or alternative)
2. Implement ISteamInput API for controller handling
3. Maintain fallback to Gamepad API for non-Steam platforms

**Greenworks Consideration**: The traditional Greenworks library hasn't been updated in years and requires specific version combinations (Electron/Node/Steamworks). Alternative: Direct Steamworks integration or newer wrappers.

#### Option C: Hybrid Approach

Use W3C Gamepad API as baseline, detect Steam environment, optionally enhance with Steam Input API if available.

```javascript
if (isSteamEnvironment() && steamworksAvailable) {
  // Use Steam Input API for enhanced features
  useSteamInput();
} else {
  // Fall back to standard Gamepad API
  useGamepadAPI();
}
```

**Recommendation for Initial Implementation**: Start with Option A (W3C Gamepad API only). Add Steam Input later if needed based on player feedback.

## Phaser 3 Gamepad API

### Overview

Phaser 3 includes a comprehensive Gamepad Plugin that wraps the W3C Gamepad API with game-developer-friendly interfaces.

**Official Documentation**:
- https://docs.phaser.io/api-documentation/class/input-gamepad-gamepadplugin
- https://rexrainbow.github.io/phaser3-rex-notes/docs/site/gamepad/

### Setup

Enable in game config:

```javascript
const config = {
  input: {
    gamepad: true
  }
};
const game = new Phaser.Game(config);
```

Access in scene:

```javascript
this.input.gamepad
```

### Gamepad Detection & Connection

**Connection Events**:

```javascript
// Listen for new gamepads
this.input.gamepad.once('connected', (pad) => {
  console.log('Gamepad connected:', pad.id);
});

// Listen for disconnections
this.input.gamepad.once('disconnected', (pad) => {
  console.log('Gamepad disconnected');
});
```

**Important**: Due to browser security, the `connected` event may not fire until user presses a button. Best practice:

```javascript
// Check for already-connected gamepads
if (this.input.gamepad.total > 0) {
  const pad = this.input.gamepad.getPad(0);
  this.setupGamepad(pad);
}

// Also listen for future connections
this.input.gamepad.once('connected', (pad) => {
  this.setupGamepad(pad);
});
```

### Accessing Gamepads

**By index**:
```javascript
const pad = this.input.gamepad.getPad(0);  // First gamepad
```

**Built-in properties** (up to 4 gamepads):
```javascript
const pad1 = this.input.gamepad.pad1;
const pad2 = this.input.gamepad.pad2;
const pad3 = this.input.gamepad.pad3;
const pad4 = this.input.gamepad.pad4;
```

**All gamepads**:
```javascript
const allPads = this.input.gamepad.getAll();
```

### Button Input

Phaser provides convenient named button properties:

**Action Buttons** (right cluster):
- `gamepad.A` - Bottom button (Xbox A, PS Cross)
- `gamepad.B` - Right button (Xbox B, PS Circle)
- `gamepad.X` - Left button (Xbox X, PS Square)
- `gamepad.Y` - Top button (Xbox Y, PS Triangle)

**D-Pad** (left cluster):
- `gamepad.up`
- `gamepad.down`
- `gamepad.left`
- `gamepad.right`

**Shoulder Buttons**:
- `gamepad.L1` - Left shoulder
- `gamepad.R1` - Right shoulder
- `gamepad.L2` - Left trigger (analog, 0-1 value)
- `gamepad.R2` - Right trigger (analog, 0-1 value)

**Stick Buttons**:
- `gamepad.leftStick.button` - L3 (press left stick)
- `gamepad.rightStick.button` - R3 (press right stick)

**Center Buttons**:
- Button index 8 - Select/Back/Share
- Button index 9 - Start/Menu/Options
- Button index 16 - Center/Home/Guide (if available)

**Checking button state**:

```javascript
if (gamepad.A) {
  // A button is currently pressed
}

if (gamepad.L2 > 0.5) {
  // Left trigger pressed more than halfway
}
```

### Analog Sticks

Phaser provides Vector2 objects for analog sticks:

```javascript
const leftStick = gamepad.leftStick;
const rightStick = gamepad.rightStick;

// Access properties
leftStick.x        // -1 to 1 (left/right)
leftStick.y        // -1 to 1 (up/down)
leftStick.length() // Magnitude (0 to ~1.41)
leftStick.angle()  // Angle in radians
```

**Movement example**:

```javascript
update(time, delta) {
  const pad = this.input.gamepad.getPad(0);
  if (!pad) return;

  const moveSpeed = 200;

  if (pad.leftStick.length() > 0.1) { // Deadzone
    const angle = pad.leftStick.angle();
    const magnitude = pad.leftStick.length();

    this.player.setVelocity(
      Math.cos(angle) * magnitude * moveSpeed,
      Math.sin(angle) * magnitude * moveSpeed
    );
  }
}
```

### Button Events

Listen globally for any button press/release:

```javascript
this.input.gamepad.on('down', (pad, button, value) => {
  console.log('Button pressed:', button.index, 'on pad:', pad.index);
});

this.input.gamepad.on('up', (pad, button, value) => {
  console.log('Button released:', button.index);
});
```

### Gamepad Properties

Each gamepad object provides:

- `id` - String describing the controller (e.g., "Xbox 360 Controller")
- `index` - Numeric index (0-3)
- `buttons` - Array of button objects
- `axes` - Array of axis values
- `connected` - Boolean connection state
- `timestamp` - Last update timestamp

## W3C Standard Gamepad Mapping

The W3C specification defines a "standard gamepad" layout with consistent button/axis indices across all controllers.

### Button Mapping (Indices 0-16)

| Index | Physical Button | Xbox | PlayStation | Switch |
|-------|----------------|------|-------------|---------|
| 0 | Bottom button (right cluster) | A | Cross (✕) | B |
| 1 | Right button (right cluster) | B | Circle (○) | A |
| 2 | Left button (right cluster) | X | Square (□) | Y |
| 3 | Top button (right cluster) | Y | Triangle (△) | X |
| 4 | Top left front button | LB | L1 | L |
| 5 | Top right front button | RB | R1 | R |
| 6 | Bottom left front button | LT | L2 | ZL |
| 7 | Bottom right front button | RT | R2 | ZR |
| 8 | Left button (center cluster) | Back/View | Share | - |
| 9 | Right button (center cluster) | Start/Menu | Options | + |
| 10 | Left stick pressed | LS | L3 | L-stick |
| 11 | Right stick pressed | RS | R3 | R-stick |
| 12 | Top button (left cluster) | D-Pad Up | D-Pad Up | D-Pad Up |
| 13 | Bottom button (left cluster) | D-Pad Down | D-Pad Down | D-Pad Down |
| 14 | Left button (left cluster) | D-Pad Left | D-Pad Left | D-Pad Left |
| 15 | Right button (left cluster) | D-Pad Right | D-Pad Right | D-Pad Right |
| 16 | Center button | Xbox/Guide | PS | Home |

### Axis Mapping (Indices 0-3)

| Index | Control | Range |
|-------|---------|-------|
| 0 | Left stick horizontal | -1.0 (left) to 1.0 (right) |
| 1 | Left stick vertical | -1.0 (up) to 1.0 (down) |
| 2 | Right stick horizontal | -1.0 (left) to 1.0 (right) |
| 3 | Right stick vertical | -1.0 (up) to 1.0 (down) |

**Note**: Some controllers may report additional axes for L2/R2 triggers, but the standard only defines 4 axes.

### Important Consideration: DualShock (PlayStation) Mapping

PlayStation controllers may use different button mappings than the standard:
- Physical Cross = Button 0 (standard) OR Button 1 (some browsers)
- Physical Circle = Button 1 (standard) OR Button 2 (some browsers)

Phaser attempts to normalize this, but testing on multiple controllers is recommended.

## Input Handling Best Practices

### 1. Deadzone Implementation

Analog sticks report small values even when untouched due to hardware drift. Implement deadzones:

```javascript
const STICK_DEADZONE = 0.15;

function getStickValue(stick) {
  const length = stick.length();
  if (length < STICK_DEADZONE) {
    return { x: 0, y: 0, length: 0 };
  }
  return stick;
}
```

**Recommended deadzone values**:
- Inner deadzone: 0.1 - 0.2 (ignore small movements)
- Outer deadzone: 0.9 - 1.0 (clamp to max before reaching physical limit)

### 2. Trigger Thresholds

Triggers report as axes (0-1 values), not boolean buttons. Apply thresholds:

```javascript
const TRIGGER_THRESHOLD = 0.1;  // Considered "pressed" above this
const TRIGGER_FULL = 0.9;       // Considered "fully pressed"

if (gamepad.L2 > TRIGGER_THRESHOLD) {
  // Trigger activated
}

if (gamepad.R2 > TRIGGER_FULL) {
  // Full trigger press (e.g., for charged attacks)
}
```

### 3. Handling "Just Pressed" State

**Problem**: Phaser gamepads don't provide a `justDown` equivalent like keyboard input.

**Solution**: Track state manually:

```javascript
class InputTracker {
  constructor() {
    this.previousState = {};
  }

  isJustPressed(button) {
    const currentlyPressed = button.pressed;
    const wasPressed = this.previousState[button.index] || false;

    if (currentlyPressed && !wasPressed) {
      this.previousState[button.index] = true;
      return true;
    }

    this.previousState[button.index] = currentlyPressed;
    return false;
  }
}
```

**Important**: Update state tracking BEFORE checking input, ideally at the start of `update()`.

### 4. Unified Input Abstraction Layer

To support both keyboard and gamepad seamlessly, create an abstraction layer:

```javascript
class InputProvider {
  isActionPressed(action) {
    // Check both keyboard and gamepad
    return this.keyboard.isDown(action) || this.gamepad.isDown(action);
  }

  getMovementVector() {
    // Combine keyboard WASD and gamepad stick
    const keyboardVec = this.getKeyboardMovement();
    const gamepadVec = this.getGamepadMovement();

    // Use gamepad if any stick movement detected, else keyboard
    return gamepadVec.length() > 0.1 ? gamepadVec : keyboardVec;
  }
}
```

**Reference Implementation**: https://blog.khutchins.com/posts/phaser-3-inputs-2/

This developer created `KHInputKey` base class and separate `KHInputProviderKeyboard` / `KHInputProviderController` classes to unify both input types.

### 5. Disconnect Handling

**Critical**: Reset all input states when a gamepad disconnects to prevent "phantom inputs":

```javascript
this.input.gamepad.on('disconnected', (pad) => {
  // Clear any active inputs from this pad
  this.inputProvider.resetGamepad(pad.index);

  // Notify player
  this.showNotification('Controller disconnected');
});
```

### 6. Update Order

Always update input providers BEFORE consuming input:

```javascript
update(time, delta) {
  // 1. Update input state
  this.inputProvider.update(time, delta);

  // 2. Query input and act
  if (this.inputProvider.isActionPressed('jump')) {
    this.player.jump();
  }
}
```

## Implementation Strategy for Seacat

### Phase 1: Foundation
1. Enable Phaser gamepad support in game config
2. Add gamepad detection on scene create
3. Display controller connection status to player
4. Log detected controllers for debugging

### Phase 2: Basic Controls
Map essential actions to controller:

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Move | Arrow Keys / WASD | Left Stick |
| Interact (board ship, etc.) | E | A Button |
| Cancel | Escape | B Button |
| Menu | M | Start |
| Camera | N/A | Right Stick |

### Phase 3: Ship Controls
Extend controller support to ship mechanics:

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Steer Ship | A/D | Left Stick Horizontal |
| Sails Up/Down | W/S | D-Pad Up/Down |
| Aim Cannon | Mouse | Right Stick |
| Fire Cannon | Space | R2 Trigger |
| Change Cannon | [ / ] | L1 / R1 |

### Phase 4: Polish
1. Implement proper deadzones
2. Add "just pressed" detection for discrete actions
3. Show controller button prompts (e.g., "Press [A] to board")
4. Support controller rebinding (advanced)
5. Test with multiple controller types

### Phase 5: Platform-Specific
1. Test in browser
2. Test in Electron build
3. (Optional) Add Steam Input integration for Steam build
4. Test on Steam Deck

## Controller Types & Compatibility

### Primary Testing Targets

1. **Xbox Controllers** (Xbox One, Series X/S)
   - Most common on Windows
   - Standard mapping well-supported
   - Official USB/Bluetooth support

2. **PlayStation Controllers** (DualShock 4, DualSense)
   - Common on all platforms
   - May require DS4Windows on Windows
   - Possible button mapping variations

3. **Nintendo Switch Pro Controller**
   - Works via Bluetooth
   - Non-standard button layout (A/B swapped vs Xbox)
   - Requires Steam Input or manual remapping

4. **Steam Deck Built-in Controls**
   - Reports as Xbox controller
   - Additional inputs (gyro, trackpads) require Steam Input API
   - Gamepad API provides basic button/stick support

5. **Generic USB Controllers**
   - Variable quality and mapping
   - May not follow standard mapping
   - Test with at least one generic controller

### Browser-Specific Notes

- **Chrome/Edge**: Best gamepad support
- **Firefox**: Good support, slightly different event timing
- **Safari**: Requires user gesture before gamepad access
- **Mobile**: Very limited gamepad support (avoid relying on it)

## Visual Feedback Considerations

### Button Prompts

Display appropriate button icons based on detected controller:

```javascript
function getControllerType(gamepad) {
  const id = gamepad.id.toLowerCase();

  if (id.includes('xbox') || id.includes('xinput')) return 'xbox';
  if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense')) return 'playstation';
  if (id.includes('switch') || id.includes('pro controller')) return 'nintendo';

  return 'generic';
}

function getButtonPrompt(action, controllerType) {
  const prompts = {
    interact: { xbox: 'A', playstation: 'Cross', nintendo: 'B', generic: 'Button 0' },
    cancel: { xbox: 'B', playstation: 'Circle', nintendo: 'A', generic: 'Button 1' },
    // ...
  };

  return prompts[action][controllerType];
}
```

### Visual Button Icons

Consider adding controller button sprite sheets:
- Xbox buttons (A, B, X, Y in Xbox colors)
- PlayStation symbols (✕, ○, □, △)
- Nintendo buttons (A, B, X, Y in Nintendo positions)
- Stick/trigger icons

**Resource**: https://thoseawesomeguys.com/prompts/ (Free controller prompts)

## Testing Strategy

### Automated Testing
- Difficult for gamepad input (requires physical hardware)
- Mock Gamepad API for unit tests
- Focus on input abstraction layer

### Manual Testing Checklist

**Controllers**:
- [ ] Xbox controller (USB)
- [ ] Xbox controller (Bluetooth)
- [ ] PlayStation controller
- [ ] Generic USB controller
- [ ] Steam Deck (if available)

**Scenarios**:
- [ ] Connect controller before launching game
- [ ] Connect controller after game started
- [ ] Disconnect controller during gameplay
- [ ] Reconnect controller after disconnect
- [ ] Multiple controllers simultaneously
- [ ] Switch between controller and keyboard mid-game

**Platforms**:
- [ ] Chrome browser
- [ ] Firefox browser
- [ ] Electron app (macOS)
- [ ] Electron app (Windows)
- [ ] Electron app (Linux)
- [ ] Steam build (if applicable)

**Actions**:
- [ ] Character movement feels responsive
- [ ] Deadzone prevents drift
- [ ] Cannon aiming with stick works smoothly
- [ ] Button prompts show correct buttons
- [ ] Menu navigation works
- [ ] All mapped actions function correctly

## Potential Challenges & Solutions

### Challenge 1: Gamepad Not Detected Until Button Press

**Issue**: Browser security prevents gamepad access until user interaction.

**Solution**:
- Show "Press any button on controller" prompt on start screen
- Check `gamepad.total` on scene start to detect already-connected gamepads
- Use both `connected` event and polling

### Challenge 2: Different Button Mappings Across Controllers

**Issue**: PlayStation vs Xbox button positions differ.

**Solution**:
- Use semantic action names internally, not button numbers
- Let Phaser handle most mapping differences
- Allow rebinding for edge cases
- Show controller-specific button prompts

### Challenge 3: Analog Stick Drift

**Issue**: Sticks report small values when at rest, causing unwanted movement.

**Solution**:
- Implement deadzone (0.1-0.2)
- Use radial deadzone (check `length()`) rather than per-axis
- Make deadzone configurable in settings

### Challenge 4: No "Just Pressed" Detection

**Issue**: Unlike keyboard, gamepads don't have built-in `justDown` state.

**Solution**:
- Track button states frame-to-frame
- Create abstraction layer providing `isJustPressed()` method
- Update state before checking input

### Challenge 5: Steam Deck Specific Features

**Issue**: Gamepad API doesn't expose trackpads, gyro, back buttons.

**Solution**:
- Accept that advanced features require Steam Input API
- Ensure basic controls work well with just buttons/sticks
- Consider Steam Input integration for v2.0

### Challenge 6: Electron + Steam Integration

**Issue**: Greenworks is outdated and difficult to configure.

**Solution**:
- Start without Steamworks integration
- Use only W3C Gamepad API initially
- Evaluate alternatives to Greenworks if Steam features needed later
- Consider: https://liana.one/integrate-electron-steam-api-steamworks

## References

### Official Documentation
- W3C Gamepad Specification: https://w3c.github.io/gamepad/
- Phaser 3 Gamepad API: https://docs.phaser.io/api-documentation/class/input-gamepad-gamepadplugin
- MDN Gamepad API Guide: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API

### Tutorials & Guides
- Phaser 3 Controller Input Tutorial: https://blog.khutchins.com/posts/phaser-3-inputs-2/
- Rex Rainbow's Phaser 3 Notes (Gamepad): https://rexrainbow.github.io/phaser3-rex-notes/docs/site/gamepad/
- Standard Gamepad Mapping Reference: https://adamjones.me/blog/gamepad-mapping/

### Tools & Libraries
- phaser3-merged-input (unified input plugin): https://github.com/GaryStanton/phaser3-merged-input
- Gamepad Tester (Electron): https://github.com/ungoldman/gamepad-tester
- Greenworks (Steamworks for Electron): https://github.com/greenheartgames/greenworks

### Steam Resources
- Publishing Web Games on Steam with Electron: https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron
- Steam Deck Controller Guide: https://steamcommunity.com/sharedfiles/filedetails/?id=2804823261
- Steamworks ISteamInput API: https://partner.steamgames.com/doc/api/isteaminput

## Recommended Implementation Order

1. **Start Simple**: W3C Gamepad API via Phaser 3
2. **Test Early**: Get basic movement working and test with real controllers
3. **Abstract Early**: Create input abstraction layer from the start
4. **Iterate**: Add complexity (deadzones, button prompts) after basics work
5. **Platform Later**: Ensure browser/Electron work before considering Steam-specific features

## Decision Points

The following questions need answers before implementation:

1. **Scope**: Basic controls only, or full feature parity with keyboard/mouse?
2. **Rebinding**: Allow player-configurable controls, or use fixed mapping?
3. **Steam Integration**: W3C Gamepad API only, or invest in Steam Input API?
4. **Visual Prompts**: Generic "Button 0" prompts, or controller-specific icons?
5. **Multi-controller**: Support local multiplayer with multiple gamepads?
6. **Accessibility**: Support controls-only navigation (no mouse required)?

These decisions should inform the proposal and implementation plan.
