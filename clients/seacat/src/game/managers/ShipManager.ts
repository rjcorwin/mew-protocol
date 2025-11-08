import Phaser from 'phaser';
import { Ship, PositionUpdate } from '../../types.js';
import { ShipRenderer } from '../rendering/ShipRenderer.js';
import { WaterRenderer } from '../rendering/WaterRenderer.js';
import { MapManager } from './MapManager.js';
import { PlayerManager } from './PlayerManager.js';
import { EffectsRenderer } from '../rendering/EffectsRenderer.js';
import * as IsoMath from '../utils/IsometricMath.js';
import { DEBUG_MODE } from '../utils/Constants.js';
import { Howl } from 'howler';
import { ViewportManager } from '../utils/ViewportManager.js';

/**
 * Manages ship lifecycle, synchronization, physics, and interactive elements.
 *
 * This is the largest and most complex manager, handling all aspects of ship entities
 * including sprite rendering, control point visualization, smooth interpolation from
 * network updates, wave bobbing, sinking animations, health displays, cannon UI,
 * and player-ship interactions.
 *
 * Responsibilities:
 * - Create and destroy ship sprites with proper rendering setup
 * - Synchronize ship state from server position updates
 * - Smoothly interpolate ship positions and rotations
 * - Apply wave bobbing effects to ships in water
 * - Render and update control points (wheel, sails, mast, cannons)
 * - Display cannon aiming UI and elevation indicators
 * - Handle ship sinking animations and respawns
 * - Update ship sprite frames based on rotation
 * - Manage players boarding and moving with ships
 * - Display health bars above ships
 * - Play sound effects for sinking and respawning
 *
 * Dependencies:
 * - ShipRenderer for all visual rendering
 * - WaterRenderer for wave height calculations
 * - PlayerManager for moving players on ships
 * - MapManager for accessing map data
 * - EffectsRenderer for health bars
 * - IsometricMath for rotation transformations
 * - Howler for sound effects
 *
 * @example
 * ```typescript
 * const shipManager = new ShipManager(
 *   scene,
 *   ships,
 *   mapManager,
 *   playerManager,
 *   shipRenderer,
 *   waterRenderer,
 *   effectsRenderer,
 *   sounds,
 *   nearControlPoints,
 *   getControllingShip,
 *   getControllingPoint,
 *   getControllingCannon,
 *   getCurrentCannonAim,
 *   getOnShip,
 *   onShipChanged,
 *   onApplyingShipRotation
 * );
 *
 * // Update ship from network
 * const newShipRelativePos = shipManager.updateShip(
 *   positionUpdate,
 *   localPlayerId,
 *   playerSprite,
 *   shipRelativePosition
 * );
 *
 * // In game loop:
 * shipManager.interpolateShips(delta, time);
 * ```
 */
export class ShipManager {
  constructor(
    private scene: Phaser.Scene,
    private ships: Map<string, Ship>,
    private mapManager: MapManager,
    private playerManager: PlayerManager,
    private shipRenderer: ShipRenderer,
    private waterRenderer: WaterRenderer,
    private effectsRenderer: EffectsRenderer,
    private sounds: {
      cannonFire?: Howl;
      hitImpact?: Howl;
      waterSplash?: Howl;
      shipSinking?: Howl;
      shipRespawn?: Howl;
    },
    private nearControlPoints: Set<string>,
    private getControllingShip: () => string | null,
    private getControllingPoint: () => 'wheel' | 'sails' | 'mast' | 'cannon' | null,
    private getControllingCannon: () => { side: 'port' | 'starboard', index: number } | null,
    private getCurrentCannonAim: () => number,
    private getOnShip: () => string | null,
    private onShipChanged: (shipId: string | null) => void,
    private onApplyingShipRotation: (rotating: boolean) => void
  ) {}

  /**
   * Update or create a ship from network position update
   * @param update Position update from server
   * @param localPlayerId Local player participant ID
   * @param localPlayerSprite Local player sprite
   * @param shipRelativePosition Reference to ship-relative position (for rotation updates)
   */
  updateShip(
    update: PositionUpdate,
    localPlayerId: string,
    localPlayerSprite: Phaser.GameObjects.Sprite,
    shipRelativePosition: { x: number; y: number } | null
  ): { x: number; y: number } | null {
    if (!update.shipData) return shipRelativePosition;

    let ship = this.ships.get(update.participantId);

    if (!ship) {
      // Create ship as a simple container with boundary dots drawn dynamically (i2m-true-isometric)
      // No sprite texture - just a graphics object that we'll redraw each frame
      const shipGraphics = this.scene.add.graphics();
      shipGraphics.setDepth(0); // Below players

      // Create ship sprite (s6r-ship-sprite-rendering)
      // Use ship1 sprite sheet with 64 rotation frames
      const shipSprite = this.scene.add.sprite(
        update.worldCoords.x,
        update.worldCoords.y,
        'ship1',
        0 // Start with frame 0 (0° rotation, facing east)
      );
      // Set origin to align deck/hull with center, not the entire sprite including mast
      // The mast extends upward, so we place origin lower (higher Y value)
      // Origin (0.5, 0.7) means: center horizontally, but 70% down vertically
      // This puts the hull/deck at the center, with mast extending above
      shipSprite.setOrigin(0.5, 0.7);
      shipSprite.setDepth(1); // Above ground tiles

      // Scale sprite to appropriate size for the ship
      // Sprite frames are 256x256, deck boundary is 128x48
      // Scale to fit: 128/256 = 0.5, then multiply by desired size (1.5x)
      const baseScale = (128 / 256) * 1.5; // 0.5 * 1.5 = 0.75
      shipSprite.setScale(baseScale); // Uniform scaling

      // Set initial sprite frame based on ship rotation (s6r-ship-sprite-rendering)
      const initialFrameIndex = this.shipRenderer.calculateShipSpriteFrame(update.shipData.rotation);
      shipSprite.setFrame(initialFrameIndex);

      // Create control point indicators
      const wheelGraphics = this.scene.add.graphics();
      const sailsGraphics = this.scene.add.graphics();
      const mastGraphics = this.scene.add.graphics();

      // Create hover indicators (for grabable range indication)
      const wheelIndicator = this.scene.add.graphics();
      const sailsIndicator = this.scene.add.graphics();
      const mastIndicator = this.scene.add.graphics();
      wheelIndicator.setDepth(10); // Above other elements
      sailsIndicator.setDepth(10);
      mastIndicator.setDepth(10);

      // Calculate relative positions from world positions
      const wheelRelative = {
        x: update.shipData.controlPoints.wheel.worldPosition.x - update.worldCoords.x,
        y: update.shipData.controlPoints.wheel.worldPosition.y - update.worldCoords.y,
      };
      const sailsRelative = {
        x: update.shipData.controlPoints.sails.worldPosition.x - update.worldCoords.x,
        y: update.shipData.controlPoints.sails.worldPosition.y - update.worldCoords.y,
      };
      // Mast is at center of ship (crow's nest for better view)
      const mastRelative = { x: 0, y: 0 };

      console.log(`Ship ${update.participantId} created:`);
      console.log(`  Ship position: (${update.worldCoords.x}, ${update.worldCoords.y})`);
      console.log(`  Deck boundary: ${update.shipData.deckBoundary.width}x${update.shipData.deckBoundary.height}`);
      console.log(`  Wheel world: (${update.shipData.controlPoints.wheel.worldPosition.x}, ${update.shipData.controlPoints.wheel.worldPosition.y})`);
      console.log(`  Wheel relative: (${wheelRelative.x}, ${wheelRelative.y})`);
      console.log(`  Sails world: (${update.shipData.controlPoints.sails.worldPosition.x}, ${update.shipData.controlPoints.sails.worldPosition.y})`);
      console.log(`  Sails relative: (${sailsRelative.x}, ${sailsRelative.y})`);

      ship = {
        id: update.participantId,
        sprite: shipSprite,
        boundaryGraphics: shipGraphics, // Graphics object for drawing boundary dots
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
        rotation: update.shipData.rotation,
        lastUpdate: update.timestamp,
        velocity: update.velocity,
        controlPoints: {
          wheel: {
            sprite: wheelGraphics,
            indicator: wheelIndicator,
            relativePosition: wheelRelative,
            controlledBy: update.shipData.controlPoints.wheel.controlledBy,
          },
          sails: {
            sprite: sailsGraphics,
            indicator: sailsIndicator,
            relativePosition: sailsRelative,
            controlledBy: update.shipData.controlPoints.sails.controlledBy,
          },
          mast: {
            sprite: mastGraphics,
            indicator: mastIndicator,
            relativePosition: mastRelative,
            controlledBy: null, // Client-side only, not synced
          },
        },
        // c5x-ship-combat: Initialize cannons if present
        cannons: update.shipData.cannons ? {
          port: update.shipData.cannons.port.map((cannonData) => {
            const cannonIndicator = this.scene.add.graphics();
            cannonIndicator.setDepth(10); // Above other elements
            return {
              sprite: this.scene.add.graphics(),
              indicator: cannonIndicator,
              relativePosition: {
                x: cannonData.worldPosition.x - update.worldCoords.x,
                y: cannonData.worldPosition.y - update.worldCoords.y,
              },
              controlledBy: cannonData.controlledBy,
              aimAngle: cannonData.aimAngle,
              elevationAngle: cannonData.elevationAngle || Math.PI / 6, // Default 30° if not present
              cooldownRemaining: cannonData.cooldownRemaining,
            };
          }),
          starboard: update.shipData.cannons.starboard.map((cannonData) => {
            const cannonIndicator = this.scene.add.graphics();
            cannonIndicator.setDepth(10); // Above other elements
            return {
              sprite: this.scene.add.graphics(),
              indicator: cannonIndicator,
              relativePosition: {
                x: cannonData.worldPosition.x - update.worldCoords.x,
                y: cannonData.worldPosition.y - update.worldCoords.y,
              },
              controlledBy: cannonData.controlledBy,
              aimAngle: cannonData.aimAngle,
              elevationAngle: cannonData.elevationAngle || Math.PI / 6, // Default 30° if not present
              cooldownRemaining: cannonData.cooldownRemaining,
            };
          }),
        } : undefined,
        speedLevel: update.shipData.speedLevel,
        deckBoundary: update.shipData.deckBoundary,
        lastWaveOffset: 0, // Initialize wave offset tracking
        // Phase 3: Initialize health
        health: update.shipData.health || 100,
        maxHealth: update.shipData.maxHealth || 100,
        // Phase 4: Initialize sinking state
        sinking: update.shipData.sinking || false,
        sinkStartTime: 0,
      };

      // NOTE: Don't call setRotation() on sprite - rotation is shown via sprite frames (s6r-ship-sprite-rendering)
      // The frame was already set above via calculateShipSpriteFrame()

      this.ships.set(update.participantId, ship);
      console.log(`Ship joined: ${update.participantId}`);

      // Send map data to newly joined ship
      this.mapManager.sendMapDataToShips();
    } else {
      // Update existing ship
      ship.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
      ship.rotation = update.shipData.rotation;
      ship.lastUpdate = update.timestamp;
      ship.velocity = update.velocity;
      ship.speedLevel = update.shipData.speedLevel;
      ship.controlPoints.wheel.controlledBy = update.shipData.controlPoints.wheel.controlledBy;
      ship.controlPoints.sails.controlledBy = update.shipData.controlPoints.sails.controlledBy;

      // c5x-ship-combat: Update cannon state
      if (update.shipData.cannons && ship.cannons) {
        ship.cannons.port.forEach((cannon, index) => {
          if (update.shipData.cannons!.port[index]) {
            const serverCannon = update.shipData.cannons!.port[index];
            cannon.controlledBy = serverCannon.controlledBy;
            cannon.aimAngle = serverCannon.aimAngle;
            cannon.elevationAngle = serverCannon.elevationAngle || cannon.elevationAngle; // Update if present
            cannon.cooldownRemaining = serverCannon.cooldownRemaining;
          }
        });
        ship.cannons.starboard.forEach((cannon, index) => {
          if (update.shipData.cannons!.starboard[index]) {
            const serverCannon = update.shipData.cannons!.starboard[index];
            cannon.controlledBy = serverCannon.controlledBy;
            cannon.aimAngle = serverCannon.aimAngle;
            cannon.elevationAngle = serverCannon.elevationAngle || cannon.elevationAngle; // Update if present
            cannon.cooldownRemaining = serverCannon.cooldownRemaining;
          }
        });
      }

      // Phase 3: Sync health from server
      ship.health = update.shipData.health || ship.health || 100;
      ship.maxHealth = update.shipData.maxHealth || ship.maxHealth || 100;

      // Phase 4: Detect sinking transition
      if (update.shipData.sinking && !ship.sinking) {
        // Ship just started sinking
        ship.sinking = true;
        ship.sinkStartTime = Date.now();
        console.log(`Ship ${ship.id} is sinking!`);

        // Phase 5: Play sinking sound (looped) (c5x-ship-combat)
        this.sounds?.shipSinking?.play();

        // Teleport local player off ship to water
        if (this.getOnShip() === ship.id) {
          this.onShipChanged(null);
          shipRelativePosition = null;
          // Player will fall into water and bob
        }

        // Teleport remote players off ship
        this.playerManager.teleportPlayersOffShip(ship.id);
      }

      // Phase 4: Detect respawn (sinking → not sinking)
      if (!update.shipData.sinking && ship.sinking) {
        console.log(`Ship ${ship.id} respawned!`);
        ship.sinking = false;
        ship.sinkStartTime = 0;

        // Phase 5: Stop sinking sound, play respawn sound (c5x-ship-combat)
        this.sounds?.shipSinking?.stop();
        this.sounds?.shipRespawn?.play();

        // Reset visual state
        ship.sprite.setAlpha(1.0);
        ship.boundaryGraphics.setAlpha(1.0);
        ship.controlPoints.wheel.sprite.setAlpha(1.0);
        ship.controlPoints.sails.sprite.setAlpha(1.0);
        ship.controlPoints.mast.sprite.setAlpha(1.0);
        if (ship.cannons) {
          ship.cannons.port.forEach(c => c.sprite.setAlpha(1.0));
          ship.cannons.starboard.forEach(c => c.sprite.setAlpha(1.0));
        }
      }

      // Update ship sprite frame to match rotation (s6r-ship-sprite-rendering)
      // NOTE: Don't call setRotation() - rotation is shown via sprite frames, not sprite rotation
      const frameIndex = this.shipRenderer.calculateShipSpriteFrame(update.shipData.rotation);
      ship.sprite.setFrame(frameIndex);

      // Phase C: Rotate players on deck when ship turns
      if (update.shipData.rotationDelta && Math.abs(update.shipData.rotationDelta) > 0.001) {
        const rotationDelta = update.shipData.rotationDelta;
        console.log(`Ship ${ship.id} rotated by ${(rotationDelta * 180 / Math.PI).toFixed(1)}°`);

        // Rotate local player if on this ship
        if (this.getOnShip() === ship.id && shipRelativePosition) {
          // Flag that we're applying rotation (don't recalculate shipRelativePosition this frame)
          this.onApplyingShipRotation(true);

          // Apply rotation to player's world position using isometric rotation
          // Note: We use ship.rotation (total angle), NOT rotationDelta
          // This matches how ship boundary corners are calculated (no accumulated error)
          const rotatedWorldPos = IsoMath.rotatePointIsometric(shipRelativePosition, ship.rotation);
          localPlayerSprite.x = ship.sprite.x + rotatedWorldPos.x;
          localPlayerSprite.y = ship.sprite.y + rotatedWorldPos.y;

          console.log(`Player rotated to world pos (${localPlayerSprite.x.toFixed(1)}, ${localPlayerSprite.y.toFixed(1)})`);
        }

        // Rotate remote players on this ship
        this.playerManager.rotatePlayersOnShip(ship.id, rotationDelta);
      }
    }

    // Draw ship boundary and control point indicators at current ship position
    if (DEBUG_MODE) {
      this.shipRenderer.drawShipBoundary(ship.boundaryGraphics, ship.sprite, ship.deckBoundary, ship.rotation);
      this.shipRenderer.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite, this.nearControlPoints.has(`${ship.id}:wheel`), 'wheel', ship.rotation);
      this.shipRenderer.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite, this.nearControlPoints.has(`${ship.id}:sails`), 'sails', ship.rotation);
      this.shipRenderer.drawControlPoint(ship.controlPoints.mast.sprite, ship.controlPoints.mast, ship.sprite, this.nearControlPoints.has(`${ship.id}:mast`), 'mast', ship.rotation);
    }

    // Draw grabable indicators (hover above control points when in range)
    const currentTime = Date.now();
    if (DEBUG_MODE) {
      this.shipRenderer.drawGrabableIndicator(ship.controlPoints.wheel.indicator, ship.controlPoints.wheel, ship.sprite, ship.rotation, this.nearControlPoints.has(`${ship.id}:wheel`), currentTime);
      this.shipRenderer.drawGrabableIndicator(ship.controlPoints.sails.indicator, ship.controlPoints.sails, ship.sprite, ship.rotation, this.nearControlPoints.has(`${ship.id}:sails`), currentTime);
      this.shipRenderer.drawGrabableIndicator(ship.controlPoints.mast.indicator, ship.controlPoints.mast, ship.sprite, ship.rotation, this.nearControlPoints.has(`${ship.id}:mast`), currentTime);
    }

    // c5x-ship-combat: Draw cannon control points
    if (DEBUG_MODE && ship.cannons) {
      ship.cannons.port.forEach((cannon, index) => {
        const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-port-${index}`);
        const isControlledByUs = this.getControllingShip() === ship.id &&
          this.getControllingPoint() === 'cannon' &&
          this.getControllingCannon()?.side === 'port' &&
          this.getControllingCannon()?.index === index;
        this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.getCurrentCannonAim());
        this.shipRenderer.drawGrabableIndicator(cannon.indicator, cannon, ship.sprite, ship.rotation, isPlayerNear, currentTime);
      });
      ship.cannons.starboard.forEach((cannon, index) => {
        const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-starboard-${index}`);
        const isControlledByUs = this.getControllingShip() === ship.id &&
          this.getControllingPoint() === 'cannon' &&
          this.getControllingCannon()?.side === 'starboard' &&
          this.getControllingCannon()?.index === index;
        this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.getCurrentCannonAim());
        this.shipRenderer.drawGrabableIndicator(cannon.indicator, cannon, ship.sprite, ship.rotation, isPlayerNear, currentTime);
      });
    }

    return shipRelativePosition;
  }

  /**
   * Interpolate ships to target positions, apply wave bobbing, and animate sinking
   * @param delta Delta time in milliseconds
   * @param time Current game time in milliseconds
   * @param localPlayerSprite Local player sprite
   * @param shipRelativePosition Local player's ship-relative position (updated by reference)
   * @param applyingShipRotation Flag to prevent recalculating position during rotation
   * @returns Updated shipRelativePosition
   */
  interpolateShips(
    delta: number,
    time: number,
    localPlayerSprite: Phaser.GameObjects.Sprite,
    shipRelativePosition: { x: number; y: number } | null,
    applyingShipRotation: boolean
  ): { x: number; y: number } | null {
    let updatedShipRelativePosition = shipRelativePosition;

    this.ships.forEach((ship) => {
      const dx = ship.targetPosition.x - ship.sprite.x;
      const dy = ship.targetPosition.y - ship.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 1) {
        // Calculate ship movement delta
        const factor = Math.min(1, (delta / 1000) * 5);
        const shipDx = dx * factor;
        const shipDy = dy * factor;

        // Move ship
        ship.sprite.x += shipDx;
        ship.sprite.y += shipDy;

        // Move local player if on this ship (move with ship delta)
        if (this.getOnShip() === ship.id) {
          localPlayerSprite.x += shipDx;
          localPlayerSprite.y += shipDy;
        }

        // Move remote players if on this ship
        this.playerManager.movePlayersOnShip(ship.id, shipDx, shipDy);
      }

      // Apply wave bobbing to ship at its current position
      const currentWaveOffset = this.waterRenderer.calculateWaveHeightAtPosition(ship.sprite.x, ship.sprite.y, time);
      const waveYDelta = currentWaveOffset - ship.lastWaveOffset;
      ship.sprite.y += waveYDelta;
      ship.lastWaveOffset = currentWaveOffset;

      // Move local player with wave delta if on this ship
      if (this.getOnShip() === ship.id) {
        localPlayerSprite.y += waveYDelta;
      }

      // Move remote players with wave delta if on this ship
      this.playerManager.movePlayersOnShip(ship.id, 0, waveYDelta);

      // Update shipRelativePosition from current player world position
      // This needs to happen every frame so player movement updates the relative position
      // BUT skip this frame if we just applied a rotation (to avoid overwriting the rotated position)
      if (this.getOnShip() === ship.id && !applyingShipRotation) {
        const dx = localPlayerSprite.x - ship.sprite.x;
        const dy = localPlayerSprite.y - ship.sprite.y;

        // Rotate to ship-local coordinates using isometric rotation (i2m-true-isometric Phase 3)
        const offset = { x: dx, y: dy };
        updatedShipRelativePosition = IsoMath.rotatePointIsometric(offset, -ship.rotation);
      }

      // Always redraw control points and ship boundary at their current positions (they move with ship sprite)
      if (DEBUG_MODE) {
        this.shipRenderer.drawShipBoundary(ship.boundaryGraphics, ship.sprite, ship.deckBoundary, ship.rotation);
        this.shipRenderer.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite, this.nearControlPoints.has(`${ship.id}:wheel`), 'wheel', ship.rotation);
        this.shipRenderer.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite, this.nearControlPoints.has(`${ship.id}:sails`), 'sails', ship.rotation);
        this.shipRenderer.drawControlPoint(ship.controlPoints.mast.sprite, ship.controlPoints.mast, ship.sprite, this.nearControlPoints.has(`${ship.id}:mast`), 'mast', ship.rotation);
      }

      // Draw grabable indicators (hover above control points when in range)
      const currentTime = Date.now();
      if (DEBUG_MODE) {
        this.shipRenderer.drawGrabableIndicator(ship.controlPoints.wheel.indicator, ship.controlPoints.wheel, ship.sprite, ship.rotation, this.nearControlPoints.has(`${ship.id}:wheel`), currentTime);
        this.shipRenderer.drawGrabableIndicator(ship.controlPoints.sails.indicator, ship.controlPoints.sails, ship.sprite, ship.rotation, this.nearControlPoints.has(`${ship.id}:sails`), currentTime);
        this.shipRenderer.drawGrabableIndicator(ship.controlPoints.mast.indicator, ship.controlPoints.mast, ship.sprite, ship.rotation, this.nearControlPoints.has(`${ship.id}:mast`), currentTime);
      }

      // c5x-ship-combat: Draw cannon control points
      if (DEBUG_MODE && ship.cannons) {
        ship.cannons.port.forEach((cannon, index) => {
          const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-port-${index}`);
          const isControlledByUs = this.getControllingShip() === ship.id &&
            this.getControllingPoint() === 'cannon' &&
            this.getControllingCannon()?.side === 'port' &&
            this.getControllingCannon()?.index === index;
          this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.getCurrentCannonAim());
          this.shipRenderer.drawGrabableIndicator(cannon.indicator, cannon, ship.sprite, ship.rotation, isPlayerNear, currentTime);
        });
        ship.cannons.starboard.forEach((cannon, index) => {
          const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-starboard-${index}`);
          const isControlledByUs = this.getControllingShip() === ship.id &&
            this.getControllingPoint() === 'cannon' &&
            this.getControllingCannon()?.side === 'starboard' &&
            this.getControllingCannon()?.index === index;
          this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.getCurrentCannonAim());
          this.shipRenderer.drawGrabableIndicator(cannon.indicator, cannon, ship.sprite, ship.rotation, isPlayerNear, currentTime);
        });
      }

      // Phase 3: Draw health bar above ship
      this.effectsRenderer.drawHealthBar(ship.sprite.x, ship.sprite.y - 40, ship.health, ship.maxHealth);

      // Phase 4: Apply sinking animation
      if (ship.sinking && ship.sinkStartTime > 0) {
        const SINK_DURATION = 5000; // 5 seconds
        const elapsed = Date.now() - ship.sinkStartTime;
        const sinkProgress = Math.min(elapsed / SINK_DURATION, 1.0);

        // Sink downward (move sprite Y down)
        const SINK_DISTANCE = 100; // pixels below water surface
        ship.sprite.y = ship.targetPosition.y + (sinkProgress * SINK_DISTANCE);

        // Fade out
        ship.sprite.setAlpha(1.0 - (sinkProgress * 0.8)); // Fade to 0.2 alpha

        // Optionally hide control points and boundary during sinking
        if (sinkProgress > 0.5) {
          ship.boundaryGraphics.setAlpha(0);
          ship.controlPoints.wheel.sprite.setAlpha(0);
          ship.controlPoints.sails.sprite.setAlpha(0);
          ship.controlPoints.mast.sprite.setAlpha(0);
          if (ship.cannons) {
            ship.cannons.port.forEach(c => c.sprite.setAlpha(0));
            ship.cannons.starboard.forEach(c => c.sprite.setAlpha(0));
          }
        }
      }
    });

    return updatedShipRelativePosition;
  }

  /**
   * Get ships map (for external access)
   */
  getShips(): Map<string, Ship> {
    return this.ships;
  }

  /**
   * Updates visibility of ships based on diamond viewport culling (d7v-diamond-viewport)
   * Uses hard cutoff (no fade) to avoid ghostly appearance
   * Call this from GameScene.update() with player position
   *
   * @param centerX - Player world X coordinate (viewport center)
   * @param centerY - Player world Y coordinate (viewport center)
   */
  updateVisibility(centerX: number, centerY: number): void {
    for (const ship of this.ships.values()) {
      const isVisible = ViewportManager.isInDiamond(
        ship.sprite.x,
        ship.sprite.y,
        centerX,
        centerY
      );

      // Update visibility for ship sprite and all related graphics
      ship.sprite.setVisible(isVisible);
      ship.boundaryGraphics.setVisible(isVisible);
      ship.controlPoints.wheel.sprite.setVisible(isVisible);
      ship.controlPoints.sails.sprite.setVisible(isVisible);
      ship.controlPoints.mast.sprite.setVisible(isVisible);

      // Update cannon visibility if present
      if (ship.cannons) {
        ship.cannons.port.forEach(c => c.sprite.setVisible(isVisible));
        ship.cannons.starboard.forEach(c => c.sprite.setVisible(isVisible));
      }
    }
  }
}
