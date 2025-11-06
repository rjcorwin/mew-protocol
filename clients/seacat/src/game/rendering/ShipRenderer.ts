import Phaser from 'phaser';
import * as IsoMath from '../utils/IsometricMath.js';

/**
 * Manages ship sprite rendering, control points, and interactive visual elements.
 *
 * This renderer handles all visual aspects of ships including debug visualizations,
 * interactive control points, cannon aiming UI, and sprite frame selection based on
 * rotation. All visual elements properly rotate with the ship using isometric math.
 *
 * Responsibilities:
 * - Draw ship deck boundaries with colored corner indicators for debugging
 * - Render interactive control points (wheel, sails, mast) that rotate with ship
 * - Draw cannons with aim arcs and elevation indicators for targeting
 * - Calculate appropriate sprite frame based on ship rotation angle
 * - Apply color coding for interaction states (available, near, controlled)
 *
 * Dependencies:
 * - IsometricMath for rotating control point positions
 * - Phaser graphics for drawing UI elements
 *
 * @example
 * ```typescript
 * const shipRenderer = new ShipRenderer(scene);
 *
 * // Draw ship boundary (debug visualization)
 * shipRenderer.drawShipBoundary(graphics, shipSprite, deckBoundary, rotation);
 *
 * // Draw control point
 * shipRenderer.drawControlPoint(
 *   graphics,
 *   controlPoint,
 *   shipSprite,
 *   isPlayerNear,
 *   'wheel',
 *   shipRotation
 * );
 *
 * // Calculate sprite frame from rotation
 * const frame = shipRenderer.calculateShipSpriteFrame(rotation);
 * shipSprite.setFrame(frame);
 * ```
 */
export class ShipRenderer {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Draw ship deck boundary with colored corner dots
   * @param graphics Graphics object to draw on
   * @param shipSprite Ship sprite
   * @param deckBoundary Deck dimensions
   * @param rotation Ship rotation in radians
   */
  drawShipBoundary(
    graphics: Phaser.GameObjects.Graphics,
    shipSprite: Phaser.GameObjects.Sprite,
    deckBoundary: { width: number; height: number },
    rotation: number
  ): void {
    graphics.clear();

    // Define the 4 corners of the deck in local ship space (relative to center)
    const halfW = deckBoundary.width / 2;
    const halfH = deckBoundary.height / 2;
    const corners = [
      { x: -halfW, y: -halfH, color: 0xff0000 }, // Top-left: Red
      { x: halfW, y: -halfH, color: 0x00ff00 },  // Top-right: Green
      { x: halfW, y: halfH, color: 0x0000ff },   // Bottom-right: Blue
      { x: -halfW, y: halfH, color: 0xffff00 },  // Bottom-left: Yellow
    ];

    // Draw each corner dot using isometric rotation (i2m-true-isometric)
    corners.forEach((corner) => {
      const rotatedPos = IsoMath.rotatePointIsometric({ x: corner.x, y: corner.y }, rotation);
      const worldX = shipSprite.x + rotatedPos.x;
      const worldY = shipSprite.y + rotatedPos.y;

      graphics.fillStyle(corner.color, 1);
      graphics.fillCircle(worldX, worldY, 6);
    });
  }

  /**
   * Draw control point (wheel, sails, or mast)
   * @param graphics Graphics object to draw on
   * @param controlPoint Control point data with relative position
   * @param shipSprite Ship sprite
   * @param isPlayerNear Whether player is near enough to interact
   * @param type Type of control point
   * @param shipRotation Ship rotation (optional override)
   */
  drawControlPoint(
    graphics: Phaser.GameObjects.Graphics,
    controlPoint: { relativePosition: { x: number; y: number }; controlledBy: string | null },
    shipSprite: Phaser.GameObjects.Sprite,
    isPlayerNear: boolean = false,
    type: 'wheel' | 'sails' | 'mast' = 'wheel',
    shipRotation?: number
  ): void {
    graphics.clear();

    // Phase D: Rotate control point position with ship rotation using isometric rotation (i2m-true-isometric Phase 4)
    // Apply ship's rotation to the relative position to get rotated world position
    // Use passed rotation parameter if available (s6r-ship-sprite-rendering), otherwise fall back to sprite rotation
    const rotation = shipRotation !== undefined ? shipRotation : shipSprite.rotation;
    const rotatedPos = IsoMath.rotatePointIsometric(controlPoint.relativePosition, rotation);
    const worldX = shipSprite.x + rotatedPos.x;
    const worldY = shipSprite.y + rotatedPos.y;

    // Draw a circle at the control point position
    // Yellow if player is near and can interact, red if controlled by other, green/brown if free
    let color: number;
    let opacity: number;
    if (isPlayerNear) {
      color = 0xffcc00; // Bright amber-yellow when player is close enough to interact
      opacity = 0.8; // Higher opacity for better visibility
    } else if (controlPoint.controlledBy) {
      color = 0xff0000; // Red if controlled by someone
      opacity = 0.5;
    } else {
      // Different color for mast (brown) vs other controls (green)
      color = type === 'mast' ? 0x8b4513 : 0x00ff00; // Brown for mast, green for others
      opacity = 0.5;
    }

    graphics.fillStyle(color, opacity);
    graphics.fillCircle(worldX, worldY, 8);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(worldX, worldY, 8);
  }

  /**
   * Draw cannon control point with aim arc (c5x-ship-combat)
   * @param graphics Graphics object to draw on
   * @param cannon Cannon data with position, aim, elevation, cooldown
   * @param shipSprite Ship sprite
   * @param shipRotation Ship rotation in radians
   * @param isPlayerNear Whether player is near enough to interact
   * @param isControlledByUs Whether we are controlling this cannon
   * @param currentCannonAim Current local cannon aim angle (for immediate feedback)
   */
  drawCannon(
    graphics: Phaser.GameObjects.Graphics,
    cannon: { relativePosition: { x: number; y: number }; controlledBy: string | null; aimAngle: number; elevationAngle: number; cooldownRemaining: number },
    shipSprite: Phaser.GameObjects.Sprite,
    shipRotation: number,
    isPlayerNear: boolean = false,
    isControlledByUs: boolean = false,
    currentCannonAim: number = 0
  ): void {
    graphics.clear();

    // Calculate cannon world position with isometric rotation
    const rotatedPos = IsoMath.rotatePointIsometric(cannon.relativePosition, shipRotation);
    const worldX = shipSprite.x + rotatedPos.x;
    const worldY = shipSprite.y + rotatedPos.y;

    // Determine cannon color based on state
    let color: number;
    let opacity: number;

    if (isPlayerNear) {
      color = 0xffff00; // Yellow if player is near
      opacity = 0.8;
    } else if (cannon.controlledBy) {
      color = 0xff0000; // Red if controlled by someone
      opacity = 0.5;
    } else {
      color = 0xff8800; // Orange for cannons (distinct from green controls)
      opacity = 0.5;
    }

    // Draw cannon control point
    graphics.fillStyle(color, opacity);
    graphics.fillCircle(worldX, worldY, 8);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(worldX, worldY, 8);

    // If controlled by us, draw aim arc and aim line
    if (isControlledByUs) {
      const maxAim = Math.PI / 4; // ±45°
      const aimLength = 60; // Length of aim indicator line

      // Determine which side cannon is on (port = left, starboard = right)
      // Port cannons aim to the left (negative Y in ship space)
      // Starboard cannons aim to the right (positive Y in ship space)
      const isPort = cannon.relativePosition.y < 0;
      const perpendicularAngle = isPort ? shipRotation - Math.PI / 2 : shipRotation + Math.PI / 2;

      // Draw aim arc (±45° from perpendicular)
      graphics.lineStyle(2, 0x00ffff, 0.5); // Cyan arc
      graphics.beginPath();
      graphics.arc(
        worldX,
        worldY,
        aimLength,
        perpendicularAngle - maxAim,
        perpendicularAngle + maxAim,
        false
      );
      graphics.strokePath();

      // Draw current aim line (use local aim for immediate feedback if we're controlling)
      const aimAngle = isControlledByUs ? currentCannonAim : cannon.aimAngle;
      const currentAimAngle = perpendicularAngle + aimAngle;
      const aimEndX = worldX + Math.cos(currentAimAngle) * aimLength;
      const aimEndY = worldY + Math.sin(currentAimAngle) * aimLength;

      graphics.lineStyle(3, 0xff00ff, 1); // Bright magenta aim line
      graphics.beginPath();
      graphics.moveTo(worldX, worldY);
      graphics.lineTo(aimEndX, aimEndY);
      graphics.strokePath();

      // Draw crosshair at end of aim line
      const crosshairSize = 8;
      graphics.lineStyle(2, 0xff00ff, 1);
      graphics.beginPath();
      graphics.moveTo(aimEndX - crosshairSize, aimEndY);
      graphics.lineTo(aimEndX + crosshairSize, aimEndY);
      graphics.moveTo(aimEndX, aimEndY - crosshairSize);
      graphics.lineTo(aimEndX, aimEndY + crosshairSize);
      graphics.strokePath();

      // Draw elevation indicator (Option 3: Show elevation angle)
      const elevationDegrees = Math.round(cannon.elevationAngle * 180 / Math.PI);
      const elevationText = `${elevationDegrees}°`;

      // Create text above cannon (elevation display)
      const textStyle = {
        fontSize: '14px',
        color: '#00ffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      };

      // Note: We'll use the graphics to draw simple text representation
      // Draw a small elevation bar indicator instead (3 segments for 15°/30°/45°/60°)
      const elevBarX = worldX - 20;
      const elevBarY = worldY - 25;
      const segmentHeight = 4;
      const numSegments = Math.round((cannon.elevationAngle - Math.PI / 12) / (Math.PI / 36)); // 0-9 segments (15°-60° in 5° steps)

      for (let i = 0; i < 9; i++) {
        const alpha = i < numSegments ? 0.8 : 0.2;
        const segColor = i < numSegments ? 0x00ff00 : 0x333333;
        graphics.fillStyle(segColor, alpha);
        graphics.fillRect(elevBarX, elevBarY - (i * segmentHeight), 40, segmentHeight - 1);
      }

      // Draw elevation number
      graphics.fillStyle(0x000000, 0.8);
      graphics.fillRect(elevBarX - 2, elevBarY - 42, 44, 14);
      // Note: Phaser Graphics doesn't support text, we'd need a Text object for actual numbers
      // For now, the bar indicator shows elevation visually
    }

    // Draw cooldown indicator if reloading
    if (cannon.cooldownRemaining > 0) {
      const cooldownProgress = cannon.cooldownRemaining / 4000; // Assume 4s cooldown
      // console.log(`Drawing cooldown: ${cannon.cooldownRemaining}ms remaining (${(cooldownProgress * 100).toFixed(0)}%)`);
      graphics.fillStyle(0x888888, 0.7);
      graphics.fillCircle(worldX, worldY, 12 * cooldownProgress);
    }
  }

  /**
   * Draw grabable indicator that hovers above a control point when in range
   * This is a placeholder for what will eventually be an animated sprite
   * @param graphics Graphics object to draw on
   * @param controlPoint Control point data with relative position
   * @param shipSprite Ship sprite
   * @param shipRotation Ship rotation in radians
   * @param isInRange Whether the player is in range to grab this control point
   * @param time Current game time for animation (optional)
   */
  drawGrabableIndicator(
    graphics: Phaser.GameObjects.Graphics,
    controlPoint: { relativePosition: { x: number; y: number } },
    shipSprite: Phaser.GameObjects.Sprite,
    shipRotation: number,
    isInRange: boolean,
    time?: number
  ): void {
    graphics.clear();

    // Only draw if player is in range
    if (!isInRange) {
      return;
    }

    // Calculate control point world position with isometric rotation
    const rotatedPos = IsoMath.rotatePointIsometric(controlPoint.relativePosition, shipRotation);
    const worldX = shipSprite.x + rotatedPos.x;
    const worldY = shipSprite.y + rotatedPos.y;

    // Position indicator above the control point
    const HOVER_HEIGHT = 25; // pixels above control point
    const indicatorY = worldY - HOVER_HEIGHT;

    // Add subtle bobbing animation using time
    const bobOffset = time ? Math.sin(time / 200) * 3 : 0; // 3px amplitude, ~3 second period

    // Draw a simple down-pointing arrow/chevron as placeholder
    const arrowSize = 10;
    const arrowY = indicatorY + bobOffset;

    // Draw filled arrow pointing down
    graphics.fillStyle(0x00ff00, 0.9); // Bright green, high opacity
    graphics.lineStyle(2, 0xffffff, 1); // White outline

    // Draw chevron/arrow shape (inverted V pointing down)
    graphics.beginPath();
    graphics.moveTo(worldX, arrowY + arrowSize); // Bottom point
    graphics.lineTo(worldX - arrowSize, arrowY); // Top left
    graphics.lineTo(worldX, arrowY + arrowSize / 2); // Middle notch
    graphics.lineTo(worldX + arrowSize, arrowY); // Top right
    graphics.lineTo(worldX, arrowY + arrowSize); // Back to bottom
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  /**
   * Calculate sprite sheet frame index from ship rotation (s6r-ship-sprite-rendering)
   * @param rotation Ship rotation in radians
   * @returns Frame index (0-63) corresponding to rotation angle
   */
  calculateShipSpriteFrame(rotation: number): number {
    // Subtract 45° offset to align Blender camera orientation with game coordinates
    // Blender camera was rotated 45° around Z axis for isometric view
    const offset = Math.PI / 4; // 45 degrees
    const offsetRotation = rotation - offset;

    // Normalize rotation to 0-2π range
    const normalizedRotation = ((offsetRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Convert to frame index (0-63)
    // 64 frames cover 360° (2π radians), so each frame is 5.625° (π/32 radians)
    // Negate rotation to reverse direction (Blender rendered counter-clockwise, game rotates clockwise)
    const frameIndex = Math.round(((Math.PI * 2 - normalizedRotation) / (Math.PI * 2)) * 64) % 64;

    return frameIndex;
  }
}
