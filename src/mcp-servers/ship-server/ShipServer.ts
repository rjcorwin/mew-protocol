#!/usr/bin/env node

/**
 * Ship Server for MEW World
 *
 * Represents a ship entity with interactive control points.
 * Players can grab the steering wheel or sail ropes to control the ship.
 *
 * Note: This is NOT an MCP server - it's a ship state manager.
 * Control messages come via MEW protocol, not MCP stdio.
 */

import {
  ShipState,
  ShipConfig,
  ShipHeading,
  SpeedLevel,
  Position,
  Velocity,
  MapDataPayload,
} from './types.js';

/**
 * Convert heading to rotation angle in radians
 */
function headingToRotation(heading: ShipHeading): number {
  const rotations: Record<ShipHeading, number> = {
    east: 0,
    southeast: Math.PI / 4,
    south: Math.PI / 2,
    southwest: (3 * Math.PI) / 4,
    west: Math.PI,
    northwest: -(3 * Math.PI) / 4, // -135° (equivalent to 225°)
    north: -Math.PI / 2,             // -90° (equivalent to 270°)
    northeast: -Math.PI / 4,         // -45° (equivalent to 315°)
  };
  return rotations[heading];
}

/**
 * Calculate velocity vector from heading and speed
 */
function calculateVelocity(heading: ShipHeading, speed: number): Velocity {
  const angle = headingToRotation(heading);
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };
}

export class ShipServer {
  private state: ShipState;
  private config: ShipConfig;
  private updateInterval: NodeJS.Timeout | null = null;
  private mapData: MapDataPayload | null = null;
  private lastRotation: number = 0; // Track rotation for calculating delta
  private rotationDelta: number = 0; // Change since last broadcast
  private activeProjectiles: Map<string, import('./types.js').Projectile> = new Map(); // c5x-ship-combat Phase 2
  private respawnTimer: NodeJS.Timeout | null = null; // Phase 4: Respawn timer

  constructor(config: ShipConfig) {
    this.config = config;

    // Initialize ship state
    const initialRotation = headingToRotation(config.initialHeading);
    this.state = {
      participantId: config.participantId,
      position: { ...config.initialPosition },
      heading: config.initialHeading,
      rotation: initialRotation,
      speedLevel: 0, // Start stopped
      velocity: { x: 0, y: 0 },
      passengers: [],
      controlPoints: {
        wheel: {
          type: 'wheel',
          relativePosition: { ...config.wheelPosition },
          controlledBy: null,
        },
        sails: {
          type: 'sails',
          relativePosition: { ...config.sailsPosition },
          controlledBy: null,
        },
      },
      cannons: {
        port: config.cannonPositions.port.map((pos, index) => ({
          type: 'cannon' as const,
          side: 'port' as const,
          index,
          relativePosition: { ...pos },
          controlledBy: null,
          aimAngle: 0, // Perpendicular to ship (horizontal)
          elevationAngle: Math.PI / 6, // 30° default elevation (0.52 rad)
          cooldownRemaining: 0,
          lastFired: 0,
        })),
        starboard: config.cannonPositions.starboard.map((pos, index) => ({
          type: 'cannon' as const,
          side: 'starboard' as const,
          index,
          relativePosition: { ...pos },
          controlledBy: null,
          aimAngle: 0, // Perpendicular to ship (horizontal)
          elevationAngle: Math.PI / 6, // 30° default elevation (0.52 rad)
          cooldownRemaining: 0,
          lastFired: 0,
        })),
      },
      deckBoundary: {
        width: config.deckLength,   // Length (bow to stern) maps to width in local coords
        height: config.deckBeam,    // Beam (port to starboard) maps to height in local coords
      },
      // Wheel steering state (w3l-wheel-steering)
      wheelAngle: 0, // Start centered (straight ahead)
      turnRate: 0, // Not turning initially
      wheelTurningDirection: null, // No input
      // Combat state (c5x-ship-combat)
      health: config.maxHealth,
      maxHealth: config.maxHealth,
      sinking: false,
    };
    this.lastRotation = initialRotation; // Initialize lastRotation to match
  }

  /**
   * Convert isometric coordinates to Cartesian (c5x-ship-combat Phase 2)
   */
  private isometricToCartesian(point: Position): Position {
    const cartX = (point.x + point.y * 2) / 2;
    const cartY = (point.y * 2 - point.x) / 2;
    return { x: cartX, y: cartY };
  }

  /**
   * Convert Cartesian coordinates to isometric (c5x-ship-combat Phase 2)
   */
  private cartesianToIsometric(point: Position): Position {
    const isoX = point.x - point.y;
    const isoY = (point.x + point.y) / 2;
    return { x: isoX, y: isoY };
  }

  /**
   * Rotate a point in isometric space (c5x-ship-combat Phase 2)
   * Matches client's rotatePointIsometric function
   */
  private rotatePointIsometric(point: Position, angle: number): Position {
    // Transform to Cartesian
    const cart = this.isometricToCartesian(point);

    // Apply Cartesian rotation
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotatedCart = {
      x: cart.x * cos - cart.y * sin,
      y: cart.x * sin + cart.y * cos,
    };

    // Transform back to isometric
    return this.cartesianToIsometric(rotatedCart);
  }

  private setHeading(heading: ShipHeading) {
    const oldRotation = this.state.rotation;
    const newRotation = headingToRotation(heading);

    this.state.heading = heading;
    this.state.rotation = newRotation;

    // Calculate rotation delta for player rotation
    this.rotationDelta = newRotation - oldRotation;

    this.updateVelocity();
    this.logState('Heading changed');
  }

  private setSpeed(speedLevel: SpeedLevel) {
    this.state.speedLevel = speedLevel;
    this.updateVelocity();
    this.logState('Speed changed');
  }

  private updateVelocity() {
    const speed = this.config.speedValues[this.state.speedLevel];
    this.state.velocity = calculateVelocity(this.state.heading, speed);
  }

  private grabControl(participantId: string, controlPoint: 'wheel' | 'sails') {
    const control = this.state.controlPoints[controlPoint];
    if (control.controlledBy) {
      console.error(`${controlPoint} already controlled by ${control.controlledBy}`);
      return;
    }
    control.controlledBy = participantId;
    console.log(`${participantId} grabbed ${controlPoint}`);
  }

  private releaseControl(participantId: string) {
    // Release any control point this player is holding
    for (const controlPoint of Object.values(this.state.controlPoints)) {
      if (controlPoint.controlledBy === participantId) {
        console.log(`${participantId} released ${controlPoint.type}`);
        controlPoint.controlledBy = null;
      }
    }
  }

  /**
   * Normalize angle to range -PI to PI
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Clamp value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Update wheel physics and ship rotation (w3l-wheel-steering)
   * Called every physics tick (60 Hz)
   */
  private updateWheelPhysics(deltaTime: number) {
    const WHEEL_TURN_RATE = Math.PI / 2; // 90°/sec - how fast player can rotate wheel
    const RUDDER_EFFICIENCY = 0.1; // turn rate per radian of wheel angle
    const MIN_TURN_RATE = 0.001; // ignore tiny turn rates (radians/sec)

    // Update wheel angle based on player input
    if (this.state.wheelTurningDirection) {
      // Player is actively turning wheel
      const delta = this.state.wheelTurningDirection === 'right' ?
        WHEEL_TURN_RATE * deltaTime :
        -WHEEL_TURN_RATE * deltaTime;

      this.state.wheelAngle = this.clamp(
        this.state.wheelAngle + delta,
        -Math.PI, // -180°
        Math.PI   // +180°
      );
    }
    // Note: When not turning, wheel stays at current angle (locked)

    // Calculate turn rate from wheel angle
    this.state.turnRate = this.state.wheelAngle * RUDDER_EFFICIENCY;

    // Apply turn rate to ship rotation
    if (Math.abs(this.state.turnRate) > MIN_TURN_RATE) {
      const oldRotation = this.state.rotation;
      this.state.rotation += this.state.turnRate * deltaTime;

      // Normalize rotation to -PI to PI
      this.state.rotation = this.normalizeAngle(this.state.rotation);

      // Track rotation delta for player rotation
      this.rotationDelta = this.state.rotation - oldRotation;
    }
  }

  /**
   * Convert world coordinates to tile coordinates
   */
  private worldToTile(worldX: number, worldY: number): { x: number; y: number } | null {
    if (!this.mapData) {
      return null;
    }

    if (this.mapData.orientation === 'isometric') {
      // Isometric world-to-tile conversion
      // For isometric maps: worldX = (tileX - tileY) * (tileWidth / 2)
      //                     worldY = (tileX + tileY) * (tileHeight / 2)
      // Solving for tileX and tileY:
      const tileX = Math.floor((worldX / (this.mapData.tileWidth / 2) + worldY / (this.mapData.tileHeight / 2)) / 2);
      const tileY = Math.floor((worldY / (this.mapData.tileHeight / 2) - worldX / (this.mapData.tileWidth / 2)) / 2);
      return { x: tileX, y: tileY };
    } else {
      // Orthogonal (simple grid)
      const tileX = Math.floor(worldX / this.mapData.tileWidth);
      const tileY = Math.floor(worldY / this.mapData.tileHeight);
      return { x: tileX, y: tileY };
    }
  }

  /**
   * Check if a position is navigable (on water)
   */
  private isNavigable(worldX: number, worldY: number): boolean {
    if (!this.mapData) {
      // No map data yet, allow movement
      return true;
    }

    const tile = this.worldToTile(worldX, worldY);
    if (!tile) {
      return true; // No map data, allow movement
    }

    const tileX = tile.x;
    const tileY = tile.y;

    // Check bounds
    if (tileX < 0 || tileY < 0 || tileX >= this.mapData.mapWidth || tileY >= this.mapData.mapHeight) {
      console.log(`Out of bounds: tile (${tileX}, ${tileY}) at world (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`);
      return false;
    }

    const navigable = this.mapData.navigableTiles[tileY][tileX];
    if (!navigable) {
      console.log(`Non-navigable tile at (${tileX}, ${tileY}) - world (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`);
    }

    return navigable;
  }

  /**
   * Check if ship can move to new position
   * Tests multiple points around ship's perimeter based on heading
   */
  private canMoveTo(newX: number, newY: number): boolean {
    if (!this.mapData) {
      return true; // Allow movement until map data is received
    }

    // Test ship center
    if (!this.isNavigable(newX, newY)) {
      return false;
    }

    // Test corners of ship's bounding box
    const halfWidth = this.state.deckBoundary.width / 2;
    const halfHeight = this.state.deckBoundary.height / 2;

    const testPoints = [
      { x: newX - halfWidth, y: newY - halfHeight }, // Top-left
      { x: newX + halfWidth, y: newY - halfHeight }, // Top-right
      { x: newX - halfWidth, y: newY + halfHeight }, // Bottom-left
      { x: newX + halfWidth, y: newY + halfHeight }, // Bottom-right
    ];

    for (const point of testPoints) {
      if (!this.isNavigable(point.x, point.y)) {
        return false;
      }
    }

    return true;
  }

  private updatePhysics(deltaTime: number) {
    // Update wheel and ship rotation (w3l-wheel-steering)
    this.updateWheelPhysics(deltaTime);

    // Update cannon cooldowns (c5x-ship-combat)
    const deltaMs = deltaTime * 1000;
    for (const cannons of [this.state.cannons.port, this.state.cannons.starboard]) {
      for (const cannon of cannons) {
        if (cannon.cooldownRemaining > 0) {
          cannon.cooldownRemaining = Math.max(0, cannon.cooldownRemaining - deltaMs);
        }
      }
    }

    // Update velocity to match current rotation angle (not discrete heading)
    if (this.state.speedLevel > 0) {
      const speed = this.config.speedValues[this.state.speedLevel];
      this.state.velocity = {
        x: Math.cos(this.state.rotation) * speed,
        y: Math.sin(this.state.rotation) * speed,
      };
    }

    // Update position based on velocity
    if (this.state.speedLevel > 0) {
      const newX = this.state.position.x + this.state.velocity.x * deltaTime;
      const newY = this.state.position.y + this.state.velocity.y * deltaTime;

      // Check if new position is navigable
      const canMove = this.canMoveTo(newX, newY);

      if (canMove) {
        this.state.position.x = newX;
        this.state.position.y = newY;
      } else {
        // Hit land - stop ship
        console.log(`Ship hit land at (${newX.toFixed(1)}, ${newY.toFixed(1)}) - stopping`);
        console.log(`  Current position: (${this.state.position.x.toFixed(1)}, ${this.state.position.y.toFixed(1)})`);
        console.log(`  Has map data: ${this.mapData !== null}`);
        this.setSpeed(0);
      }
    }
  }

  private logState(context: string) {
    console.log(`[Ship ${this.config.participantId}] ${context}:`);
    console.log(`  Position: (${this.state.position.x.toFixed(1)}, ${this.state.position.y.toFixed(1)})`);
    console.log(`  Heading: ${this.state.heading}`);
    console.log(`  Speed: ${this.state.speedLevel} (${this.config.speedValues[this.state.speedLevel]} px/s)`);
    console.log(`  Velocity: (${this.state.velocity.x.toFixed(1)}, ${this.state.velocity.y.toFixed(1)})`);
  }

  /**
   * Start physics update loop
   */
  startPhysics(tickRate: number = 60) {
    const deltaTime = 1 / tickRate; // Time per frame in seconds

    this.updateInterval = setInterval(() => {
      this.updatePhysics(deltaTime);
    }, (1000 / tickRate));

    console.log(`Ship physics started at ${tickRate} Hz`);
  }

  /**
   * Stop physics update loop
   */
  stopPhysics() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Ship physics stopped');
    }
  }

  /**
   * Initialize ship (called on startup)
   */
  start() {
    console.log(`Ship server started: ${this.config.participantId}`);
    this.logState('Initial state');
  }

  /**
   * Get current ship state
   */
  getState(): ShipState {
    return { ...this.state };
  }

  /**
   * Get rotation delta since last call (for broadcasting to clients)
   * Returns the delta and clears it
   */
  getRotationDelta(): number {
    const delta = this.rotationDelta;
    this.rotationDelta = 0; // Clear after reading
    return delta;
  }

  /**
   * Public methods for control (called via MEW protocol messages)
   */

  public setMapData(mapData: MapDataPayload) {
    this.mapData = mapData;
    console.log(`Ship received map data: ${mapData.mapWidth}x${mapData.mapHeight} tiles, orientation: ${mapData.orientation}`);
  }

  public grabControlPublic(participantId: string, controlPoint: 'wheel' | 'sails') {
    this.grabControl(participantId, controlPoint);
  }

  public releaseControlPublic(participantId: string) {
    this.releaseControl(participantId);
  }

  public steer(playerId: string, direction: 'left' | 'right') {
    // Verify player controls the wheel
    if (this.state.controlPoints.wheel.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot steer - not controlling wheel`);
      return;
    }

    // Rotate heading by one step (8 directions, circular)
    const headings: ShipHeading[] = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ];

    const currentIndex = headings.indexOf(this.state.heading);
    const delta = direction === 'left' ? -1 : 1;
    const newIndex = (currentIndex + delta + headings.length) % headings.length;

    this.setHeading(headings[newIndex]);
  }

  /**
   * Start turning wheel (w3l-wheel-steering)
   * Player holds left/right to continuously rotate wheel
   */
  public startTurningWheel(playerId: string, direction: 'left' | 'right') {
    // Verify player controls the wheel
    if (this.state.controlPoints.wheel.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot turn wheel - not controlling wheel`);
      return;
    }

    this.state.wheelTurningDirection = direction;
    console.log(`Player ${playerId} started turning wheel ${direction}`);
  }

  /**
   * Stop turning wheel (w3l-wheel-steering)
   * Wheel locks at current angle, ship continues turning
   */
  public stopTurningWheel(playerId: string) {
    // Verify player controls the wheel
    if (this.state.controlPoints.wheel.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot stop turning wheel - not controlling wheel`);
      return;
    }

    this.state.wheelTurningDirection = null; // Wheel locks at current angle
    console.log(`Player ${playerId} stopped turning wheel (locked at ${(this.state.wheelAngle * 180 / Math.PI).toFixed(1)}°)`);
  }

  public adjustSails(playerId: string, adjustment: 'up' | 'down') {
    // Verify player controls the sails
    if (this.state.controlPoints.sails.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot adjust sails - not controlling sails`);
      return;
    }

    // Adjust speed level (clamped 0-3)
    const delta = adjustment === 'up' ? 1 : -1;
    const newSpeed = Math.max(0, Math.min(3, this.state.speedLevel + delta)) as SpeedLevel;

    this.setSpeed(newSpeed);
  }

  /**
   * Cannon control methods (c5x-ship-combat)
   */

  public grabCannon(playerId: string, side: 'port' | 'starboard', index: number) {
    const cannons = this.state.cannons[side];
    if (index < 0 || index >= cannons.length) {
      console.error(`Invalid cannon index: ${side} ${index}`);
      return;
    }

    const cannon = cannons[index];

    // Check if already controlled
    if (cannon.controlledBy) {
      console.error(`Cannon ${side} ${index} already controlled by ${cannon.controlledBy}`);
      return;
    }

    // Release any other control point this player has
    this.releaseControlByPlayer(playerId);

    cannon.controlledBy = playerId;
    console.log(`Player ${playerId} grabbed cannon ${side} ${index}`);
  }

  public releaseCannon(playerId: string, side: 'port' | 'starboard', index: number) {
    const cannons = this.state.cannons[side];
    if (index < 0 || index >= cannons.length) {
      console.error(`Invalid cannon index: ${side} ${index}`);
      return;
    }

    const cannon = cannons[index];

    if (cannon.controlledBy !== playerId) {
      console.error(`Player ${playerId} does not control cannon ${side} ${index}`);
      return;
    }

    cannon.controlledBy = null;
    console.log(`Player ${playerId} released cannon ${side} ${index}`);
  }

  public aimCannon(playerId: string, side: 'port' | 'starboard', index: number, aimAngle: number) {
    const cannons = this.state.cannons[side];
    if (index < 0 || index >= cannons.length) {
      console.error(`Invalid cannon index: ${side} ${index}`);
      return;
    }

    const cannon = cannons[index];

    if (cannon.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot aim cannon ${side} ${index} - not controlling`);
      return;
    }

    // Clamp aim angle to ±45°
    const maxAim = Math.PI / 4;
    cannon.aimAngle = Math.max(-maxAim, Math.min(maxAim, aimAngle));

    console.log(`Player ${playerId} aimed cannon ${side} ${index} to ${(cannon.aimAngle * 180 / Math.PI).toFixed(1)}°`);
  }

  public adjustElevation(playerId: string, side: 'port' | 'starboard', index: number, adjustment: 'up' | 'down') {
    const cannons = this.state.cannons[side];
    if (index < 0 || index >= cannons.length) {
      console.error(`Invalid cannon index: ${side} ${index}`);
      return;
    }

    const cannon = cannons[index];

    if (cannon.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot adjust elevation for cannon ${side} ${index} - not controlling`);
      return;
    }

    // Adjust elevation by 5° (0.087 radians) per key press
    const elevationStep = Math.PI / 36; // 5° = π/36
    const delta = adjustment === 'up' ? elevationStep : -elevationStep;
    const newElevation = cannon.elevationAngle + delta;

    // Clamp to 15°-60° (0.26-1.05 radians)
    const minElevation = Math.PI / 12; // 15°
    const maxElevation = Math.PI / 3;  // 60°
    cannon.elevationAngle = Math.max(minElevation, Math.min(maxElevation, newElevation));

    console.log(`Player ${playerId} adjusted elevation for cannon ${side} ${index} to ${(cannon.elevationAngle * 180 / Math.PI).toFixed(1)}°`);
  }

  public fireCannon(playerId: string, side: 'port' | 'starboard', index: number): import('./types.js').Projectile | null {
    const cannons = this.state.cannons[side];
    if (index < 0 || index >= cannons.length) {
      console.error(`Invalid cannon index: ${side} ${index}`);
      return null;
    }

    const cannon = cannons[index];

    if (cannon.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot fire cannon ${side} ${index} - not controlling`);
      return null;
    }

    // Check cooldown
    const now = Date.now();
    if (cannon.cooldownRemaining > 0) {
      console.error(`Cannon ${side} ${index} on cooldown (${cannon.cooldownRemaining}ms remaining)`);
      return null;
    }

    // Fire the cannon!
    cannon.lastFired = now;
    cannon.cooldownRemaining = this.config.cannonCooldownMs;

    console.log(`Player ${playerId} fired cannon ${side} ${index}!`);
    console.log(`  Cooldown set to: ${cannon.cooldownRemaining}ms`);

    // Phase 2: Calculate projectile spawn parameters
    // 1. Calculate cannon world position using isometric rotation
    const rotated = this.rotatePointIsometric(cannon.relativePosition, this.state.rotation);
    const spawnPos: Position = {
      x: this.state.position.x + rotated.x,
      y: this.state.position.y + rotated.y,
    };

    // 2. Calculate fire direction (horizontal component)
    const isPort = side === 'port';
    const perpendicular = this.state.rotation + (isPort ? -Math.PI / 2 : Math.PI / 2);
    const fireAngle = perpendicular + cannon.aimAngle;

    // 3. Calculate velocity with elevation (Option 3: True 3D ballistics)
    const CANNON_SPEED = 300; // px/s total muzzle velocity
    const elevation = cannon.elevationAngle;

    // Horizontal speed (in the XY plane) = CANNON_SPEED * cos(elevation)
    const horizontalSpeed = CANNON_SPEED * Math.cos(elevation);

    // Vertical component (upward, negative Y in screen space) = CANNON_SPEED * sin(elevation)
    const verticalComponent = CANNON_SPEED * Math.sin(elevation);

    // Inherit ship velocity (moving platform physics)
    const vel: Velocity = {
      x: Math.cos(fireAngle) * horizontalSpeed + this.state.velocity.x,
      y: Math.sin(fireAngle) * horizontalSpeed + this.state.velocity.y - verticalComponent,
    };

    // 4. Generate unique projectile ID
    const projectileId = `${this.state.participantId}-${side}-${index}-${now}`;

    // 5. Create projectile object
    const projectile: import('./types.js').Projectile = {
      id: projectileId,
      sourceShip: this.state.participantId,
      spawnTime: now,
      spawnPosition: spawnPos,
      initialVelocity: vel,
    };

    // 6. Store in active projectiles for Phase 3 hit validation
    this.activeProjectiles.set(projectileId, projectile);

    // 7. Auto-cleanup after 3 seconds (gives clients 1s grace period for validation)
    setTimeout(() => {
      this.activeProjectiles.delete(projectileId);
      console.log(`Projectile ${projectileId} expired (3s lifetime)`);
    }, 3000);

    console.log(`  Projectile spawned at (${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)})`);
    console.log(`  Fire angle (horiz): ${(fireAngle * 180 / Math.PI).toFixed(1)}°, Elevation: ${(elevation * 180 / Math.PI).toFixed(1)}°`);
    console.log(`  Initial velocity: (${vel.x.toFixed(1)}, ${vel.y.toFixed(1)}) px/s`);
    console.log(`  Ship velocity: (${this.state.velocity.x.toFixed(1)}, ${this.state.velocity.y.toFixed(1)}) px/s`);

    return projectile;
  }

  private releaseControlByPlayer(playerId: string) {
    // Release wheel if controlled
    if (this.state.controlPoints.wheel.controlledBy === playerId) {
      this.state.controlPoints.wheel.controlledBy = null;
    }

    // Release sails if controlled
    if (this.state.controlPoints.sails.controlledBy === playerId) {
      this.state.controlPoints.sails.controlledBy = null;
    }

    // Release any cannons
    for (const cannons of [this.state.cannons.port, this.state.cannons.starboard]) {
      for (const cannon of cannons) {
        if (cannon.controlledBy === playerId) {
          cannon.controlledBy = null;
        }
      }
    }
  }

  /**
   * Phase 3: Validate projectile hit using physics replay
   */
  public validateProjectileHit(
    projectileId: string,
    claimTimestamp: number,
    targetPosition: { x: number; y: number },
    targetRotation: number,
    targetBoundary: { width: number; height: number }
  ): boolean {
    const projectile = this.activeProjectiles.get(projectileId);

    if (!projectile) {
      console.log(`Projectile ${projectileId} not found (already expired or consumed)`);
      return false;
    }

    // Replay physics from spawn to claim timestamp
    const elapsed = (claimTimestamp - projectile.spawnTime) / 1000; // seconds
    const GRAVITY = 150; // Must match client

    const pos = {
      x: projectile.spawnPosition.x + projectile.initialVelocity.x * elapsed,
      y: projectile.spawnPosition.y + projectile.initialVelocity.y * elapsed + (0.5 * GRAVITY * elapsed * elapsed)
    };

    // Check if replayed position is within TARGET ship's OBB
    const hitboxPadding = 1.2;
    const paddedBoundary = {
      width: targetBoundary.width * hitboxPadding,
      height: targetBoundary.height * hitboxPadding
    };

    // Simple AABB check (good enough for validation)
    const dx = Math.abs(pos.x - targetPosition.x);
    const dy = Math.abs(pos.y - targetPosition.y);
    const isHit = dx < paddedBoundary.width / 2 && dy < paddedBoundary.height / 2;

    if (isHit) {
      // Mark projectile as consumed (prevent double-hit)
      this.activeProjectiles.delete(projectileId);
      console.log(`Validated hit: projectile ${projectileId} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) on target at (${targetPosition.x.toFixed(1)}, ${targetPosition.y.toFixed(1)})`);
    } else {
      console.log(`Rejected hit claim: projectile ${projectileId} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) vs target at (${targetPosition.x.toFixed(1)}, ${targetPosition.y.toFixed(1)})`);
    }

    return isHit;
  }

  /**
   * Phase 3: Apply damage to ship
   */
  public takeDamage(amount: number) {
    this.state.health = Math.max(0, this.state.health - amount);
    console.log(`Ship took ${amount} damage. Health: ${this.state.health}/${this.state.maxHealth}`);

    if (this.state.health <= 0 && !this.state.sinking) {
      this.state.sinking = true;
      console.log(`Ship sinking!`);

      // Stop movement
      this.state.velocity = { x: 0, y: 0 };
      this.state.speedLevel = 0;

      // Release all controls
      this.state.controlPoints.wheel.controlledBy = null;
      this.state.controlPoints.sails.controlledBy = null;
      for (const cannons of [this.state.cannons.port, this.state.cannons.starboard]) {
        for (const cannon of cannons) {
          cannon.controlledBy = null;
        }
      }

      // Schedule respawn after 10 seconds
      this.respawnTimer = setTimeout(() => {
        this.respawn();
      }, 10000);
    }
  }

  /**
   * Phase 4: Respawn ship at spawn point with full health
   */
  private respawn() {
    console.log(`Ship respawning at spawn point...`);

    // Reset position to spawn point (from config)
    this.state.position = { ...this.config.initialPosition };
    this.state.heading = this.config.initialHeading;
    this.state.rotation = headingToRotation(this.config.initialHeading);

    // Reset health
    this.state.health = this.state.maxHealth;
    this.state.sinking = false;

    // Reset movement
    this.state.velocity = { x: 0, y: 0 };
    this.state.speedLevel = 0;
    this.state.wheelAngle = 0;
    this.state.turnRate = 0;
    this.state.wheelTurningDirection = null;

    console.log(`Ship respawned with ${this.state.health} HP at (${this.state.position.x}, ${this.state.position.y})`);

    this.respawnTimer = null;
  }

  /**
   * Phase 4: Cleanup respawn timer
   */
  public cleanup() {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
