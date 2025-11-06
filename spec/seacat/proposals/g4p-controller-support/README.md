# g4p-controller-support: Gamepad/Controller Support for Seacat

**Status**: Research Complete, Awaiting Review
**Code**: g4p
**Created**: 2025-11-03

## Quick Summary

Add comprehensive gamepad/controller support to Seacat using Phaser 3's Gamepad API. Enables players to use Xbox, PlayStation, Nintendo Switch, and generic controllers across all platforms: browsers, Electron desktop, and Steam/Steam Deck.

## Key Points

- **Technology**: W3C Gamepad API via Phaser 3 Input.Gamepad Plugin
- **Platforms**: Browser, Electron, Steam, Steam Deck
- **Scope**: Full gameplay with controller-only (no keyboard/mouse required)
- **Controllers**: Xbox, PlayStation, Nintendo, generic USB gamepads
- **Implementation**: ~2-3 weeks across 4-6 phases

## Documents in This Proposal

- **[proposal.md](./proposal.md)** - Main proposal document with technical approach, implementation phases, and control mappings
- **[research.md](./research.md)** - Comprehensive research on Phaser 3 Gamepad API, W3C standards, platform compatibility, and implementation patterns

## What This Adds

### Player Experience
- Analog stick control for smooth movement and aiming
- Controller-based ship steering and cannon operation
- Steam Deck compatibility
- Seamless keyboard ↔ controller switching
- Controller button prompts (e.g., "Press [A]" or "Press [✕]")

### Technical Benefits
- Single implementation works across all platforms
- Phaser 3 provides excellent abstraction over W3C Gamepad API
- Input abstraction layer improves code quality
- Foundation for local multiplayer support

## Implementation Phases

1. **Phase 1: Foundation** - Basic character movement with controller
2. **Phase 2: Ship Controls** - Full ship gameplay (steering, sails, cannons)
3. **Phase 3: Input Abstraction** - Unified keyboard + gamepad system
4. **Phase 4: Polish** - Button prompts, settings, multi-controller testing
5. **Phase 5: Multi-Controller** (Optional) - Local multiplayer
6. **Phase 6: Steam Integration** (Optional) - Steam Input API for advanced features

## Key Technical Decisions

### ✅ Chosen Approach: W3C Gamepad API
- Works everywhere (browser, Electron, Steam)
- Phaser 3 has excellent built-in support
- No additional libraries needed
- Defer Steam Input API until needed

### Control Mapping Philosophy
- Standard action button layout (A = interact, B = cancel)
- Left stick = movement/steering
- Right stick = camera/aiming
- Triggers = fire/actions
- D-Pad = sails/UI navigation

### Deadzone Strategy
- Inner deadzone: 0.15 (ignore stick drift)
- Outer deadzone: 0.95 (smooth to maximum)
- Radial deadzone (check magnitude, not per-axis)

## Testing Requirements

### Controllers
- ✅ Xbox One/Series controller
- ✅ PlayStation DualShock 4/DualSense
- ✅ Nintendo Switch Pro Controller
- ✅ Generic USB controller
- ✅ Steam Deck built-in controls (if available)

### Platforms
- ✅ Chrome browser
- ✅ Firefox browser
- ✅ Electron (macOS, Windows, Linux)
- ✅ Steam (optional)

### Scenarios
- Connect before game starts
- Connect during gameplay
- Disconnect and reconnect
- Multiple simultaneous controllers
- Keyboard ↔ controller switching

## Open Questions

1. **Button Rebinding**: Fixed mapping or player-configurable?
   - **Recommendation**: Start with fixed, add rebinding in Phase 4

2. **Steam Input API**: Worth the integration complexity?
   - **Recommendation**: Defer; W3C Gamepad API sufficient for now

3. **Local Multiplayer**: Priority for multi-controller support?
   - **Recommendation**: Phase 5 optional; depends on multiplayer plans

4. **Vibration**: Support controller rumble?
   - **Recommendation**: Add in Phase 4 if Gamepad API supports it

## Success Criteria

- Player can complete all gameplay using only controller
- Analog aiming is smooth and responsive
- Works on all target platforms
- Tested with 3+ different controller types
- No crashes on connect/disconnect
- Positive player feedback

## Next Steps

1. **Review**: Discuss proposal and research findings
2. **Decide**: Answer open questions above
3. **Plan**: Create detailed implementation plan
4. **Hardware**: Acquire testing controllers
5. **Implement**: Begin Phase 1 (Foundation)

## Related Proposals

- Future: Local multiplayer (would use multi-controller support from Phase 5)
- Future: Mobile touch controls (different approach, separate proposal)

## Resources

- [Phaser 3 Gamepad API Docs](https://docs.phaser.io/api-documentation/class/input-gamepad-gamepadplugin)
- [W3C Gamepad Specification](https://w3c.github.io/gamepad/)
- [Phaser Controller Tutorial](https://blog.khutchins.com/posts/phaser-3-inputs-2/)
- [Rex's Phaser 3 Notes](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/gamepad/)

---

**Ready for**: Review and decision
**Estimated effort**: 2-3 weeks (Phases 1-4)
**Risk level**: Low (well-supported technology, clear implementation path)
