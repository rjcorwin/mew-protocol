# Decision: Development Debug Visualization Mode (v9d-debug-visualization)

**Date:** 2025-11-08
**Status:** Proposed (Awaiting User Approval)
**Deciders:** User, Claude

## Context

Seacat currently displays ship boundary boxes and grabbable point markers at all times. These visual aids were useful during development but should be hidden in normal gameplay for a cleaner, more polished experience. However, they remain valuable for:
- Development and debugging
- Understanding collision boundaries
- Troubleshooting grabbing/interaction issues
- Future feature development

We need a mechanism to toggle these debug visualizations without removing the code entirely.

## Decision

Implement a development debug mode using a simple boolean constant to show/hide debug visualizations.

### Core Mechanism

**Configuration Constant Approach**
- Simple boolean constant: `const DEBUG_MODE = false;`
- Set to `true` during development, `false` for production
- Located in a central config file for easy access
- No runtime overhead or complexity

### Debug Visualizations Controlled

1. **Ship Boundary Boxes** (OBB rectangles)
   - Currently: Always visible
   - Debug Mode: Togglable

2. **Grabbable Point Markers** (hover indicators)
   - Currently: Always visible
   - Debug Mode: Togglable

3. **Future Debug Features** (extensible)
   - Velocity vectors
   - Collision detection zones
   - Network sync status
   - Performance metrics overlay

### Technical Implementation

```typescript
// config.ts or similar central location
export const DEBUG_MODE = false; // Set to true for development

// Usage in rendering code
if (DEBUG_MODE) {
  this.drawBoundaryBox(ship);
  this.drawGrabbableMarkers(controlPoints);
}
```

That's it! Simple conditional rendering based on a constant.

## Rationale

### Why Simple Constant

**Advantages:**
- Zero runtime overhead (compile-time constant)
- Dead simple to understand and use
- No complex state management
- Easy to find and toggle (single location)
- Can be tree-shaken by bundler when `false`

**Compared to alternatives:**
- Simpler than URL parameters (no parsing needed)
- Simpler than keyboard shortcuts (no event handlers)
- Simpler than settings UI (no UI code)
- Simpler than session storage (no persistence logic)

### Developer Workflow

Developer workflow is straightforward:
1. Set `DEBUG_MODE = true` in config
2. Develop with visualizations visible
3. Set `DEBUG_MODE = false` before committing
4. Production builds have clean visuals

### Alternatives Considered

1. **URL parameter (`?debug=true`)**
   - ✅ Can toggle without code changes
   - ✅ Easy to share debug links
   - ❌ Adds URL parsing overhead
   - ❌ More complex implementation

2. **Keyboard shortcut (Ctrl+Shift+D)**
   - ✅ Quick runtime toggle
   - ✅ No page reload needed
   - ❌ Requires event handler code
   - ❌ State management complexity

3. **In-game settings menu**
   - ✅ Discoverable UI
   - ✅ Runtime toggleable
   - ❌ Requires building UI
   - ❌ Overkill for dev feature

4. **Console command**
   - ✅ Zero UI footprint
   - ✅ Runtime toggleable
   - ❌ Requires opening dev tools
   - ❌ Less convenient

5. **Environment variable**
   - ✅ Standard practice
   - ✅ Build-time configuration
   - ❌ Harder to toggle quickly
   - ❌ Requires rebuild

## Implementation Plan

### Single Phase (30 minutes)
1. Create config constant: `export const DEBUG_MODE = false;`
2. Wrap ship boundary box rendering in `if (DEBUG_MODE)` check
3. Wrap grabbable marker rendering in `if (DEBUG_MODE)` check
4. Test with `DEBUG_MODE = true` and `DEBUG_MODE = false`
5. Verify no visual artifacts when disabled
6. Document in code comments where to find the constant

That's it!

## Consequences

### Positive
- ✅ Cleaner production gameplay experience
- ✅ Maintains developer debugging capabilities
- ✅ Dead simple implementation (~10 LOC total)
- ✅ Zero runtime overhead (compile-time constant)
- ✅ Extensible for future debug features
- ✅ No state management needed
- ✅ Tree-shakeable when disabled

### Negative
- ❌ Requires code change to toggle (must edit constant)
- ❌ Extra conditional checks in render loop (minimal cost)
- ❌ Could accidentally ship with debug enabled (git diff will show)
- ❌ Not discoverable to end users (intentional)

### Neutral
- 📊 Performance: Zero overhead (constant folding)
- 📊 Complexity: Minimal (single boolean constant)
- 📊 Discoverability: Developer-only feature

## Success Criteria

- [ ] `DEBUG_MODE` constant exists in config file
- [ ] Ship boundary boxes only render when `DEBUG_MODE = true`
- [ ] Grabbable markers only render when `DEBUG_MODE = true`
- [ ] Visuals are completely hidden when `DEBUG_MODE = false`
- [ ] No performance degradation (constant folding works)
- [ ] Code comment documents where to find constant
- [ ] Setting to `false` produces clean gameplay visuals

## Open Questions for User

1. **Config file location**: Where should the constant live? (e.g., `src/config.ts`, `src/debug.ts`, or top of `GameScene.ts`?)
2. **Default value**: Should we commit with `DEBUG_MODE = false` (clean) or `true` (convenient for active dev)?
3. **Granularity**: Single boolean, or separate flags for boxes vs markers? (e.g., `DEBUG_BOXES`, `DEBUG_MARKERS`)
4. **Future features**: Any other debug visualizations to plan for? (velocity vectors, collision zones, network stats, etc.)

## Approval

This proposal requires user approval before implementation begins.

**User**: [ ] Approved / [ ] Needs changes / [ ] Rejected

**Notes**: _User feedback here_
