# Bug Fix: Slow Movement on Ship Deck

**Date:** 2025-10-20
**Issue:** Players moved very slowly when walking around on ship deck
**Status:** Fixed

## Problem

Players walking on a ship's deck were moving at drastically reduced speed (approximately 0.3x normal). This made navigation on the ship frustrating and unnatural.

**Root Cause:**

The movement code was applying tile-based speed modifiers to players on ship decks. Since ships are positioned over water tiles, and water tiles have a low speed modifier (0.3 for slow movement through water), players on deck inherited this slow speed even though they were walking on the solid deck, not swimming.

```typescript
// GameScene.ts:611-616 (old code)
const collision = this.checkTileCollision(newX, newY);

if (collision.walkable) {
  // This was always using water's speedModifier (0.3) when on ship!
  this.localPlayer.x += velocity.x * collision.speedModifier;
  this.localPlayer.y += velocity.y * collision.speedModifier;
}
```

## Solution

Added a check to bypass tile collision and speed modifiers when the player is on a ship:

```typescript
// GameScene.ts:610-625 (new code)
if (this.onShip) {
  // Player is on ship deck - move at full speed
  this.localPlayer.x += velocity.x;
  this.localPlayer.y += velocity.y;
} else {
  // Player is on land - check tile collision and apply speed modifier
  const collision = this.checkTileCollision(newX, newY);

  if (collision.walkable) {
    // Apply movement with speed modifier from terrain
    this.localPlayer.x += velocity.x * collision.speedModifier;
    this.localPlayer.y += velocity.y * collision.speedModifier;
  }
}
```

When `this.onShip` is set (player has boarded a ship), movement is applied at full speed without checking the underlying terrain tiles.

## Impact

- Players on ship decks now move at full speed (100 pixels/second)
- Movement on deck feels natural and responsive
- No impact on land-based movement or terrain speed modifiers
- Deck boundaries still enforced (handled separately in ship-relative coordinates)

## Testing

1. Board a ship
2. Walk around the deck using arrow keys
3. Verify movement speed matches land-based movement
4. Verify movement still respects deck boundaries (can't walk off ship)
5. Disembark and verify land movement still uses terrain modifiers

## Related

- **Ship System:** Platform-relative coordinates
- **Terrain System:** Tile-based speed modifiers
- **w3l-wheel-steering:** Ship control mechanics
