# Proposal r8s: Ship Rotation

**Status:** Proposed
**Created:** 2025-10-18
**Complexity:** High

## Quick Summary

Add visual and physical rotation to ships in MEW World so they face the direction they're moving. This affects ship sprite rendering, collision detection, and player positioning on deck.

## Problem

Ships have 8-directional heading but don't rotate visually. A ship moving north looks the same as a ship moving east, and the collision boundaries don't match the visual orientation.

## Solution

Implement runtime sprite rotation, oriented bounding box collision, and rotate players on deck when the ship turns.

## Impact

- **Visual:** Ships will face their heading direction
- **Gameplay:** Deck boundaries will rotate, players will rotate with ship
- **Technical:** Adds rotation angle to ship state, OBB collision logic, player position rotation

## Files

- `proposal.md` - Detailed technical proposal with implementation phases
- `research.md` - Research on rotation algorithms, game implementations, and performance
- `decision-r8s-ship-rotation.md` - Formal decision document with risks and timeline

## Implementation Phases

1. **Phase A:** Visual rotation (ship sprite rotates)
2. **Phase B:** Rotating collision (deck boundary rotates)
3. **Phase C:** Player rotation (players rotate with ship)
4. **Phase D:** Control point rotation (wheel/sails rotate)
5. **Phase E:** Ship-relative movement (optional/future)
6. **Phase F:** Smooth interpolation (polish)

## Estimated Effort

19-28 hours (2.5-3.5 days)

## Dependencies

- Milestone 5 (Ship controls) - ✅ Complete
- Milestone 6 (Platform coordinates) - ✅ Complete

## Next Steps

1. Review proposal
2. Approve/reject decision
3. Add to implementation plan
4. Begin Phase A implementation
