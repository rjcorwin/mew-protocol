/**
 * Player facing direction (8-way)
 */
export type Direction =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

/**
 * Position update message sent via MEW protocol streams
 */
export interface PositionUpdate {
  participantId: string;
  worldCoords: {
    x: number;
    y: number;
  };
  tileCoords: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  facing: Direction; // Direction the player is facing (for animation sync)
  timestamp: number;
  platformRef: string | null; // Reference to ship if player is on a ship
  shipData?: ShipData; // Present if this is a ship position update
}

/**
 * Ship-specific data in position updates
 */
export interface ShipData {
  rotation: number; // Rotation angle in radians
  rotationDelta?: number; // Change in rotation since last update (for rotating players on deck)
  speedLevel: number;
  deckBoundary: {
    width: number;
    height: number;
  };
  controlPoints: {
    wheel: {
      worldPosition: { x: number; y: number };
      controlledBy: string | null;
    };
    sails: {
      worldPosition: { x: number; y: number };
      controlledBy: string | null;
    };
  };
  // c5x-ship-combat: Cannon data
  cannons?: {
    port: Array<{
      worldPosition: { x: number; y: number };
      controlledBy: string | null;
      aimAngle: number;
      elevationAngle: number;
      cooldownRemaining: number;
    }>;
    starboard: Array<{
      worldPosition: { x: number; y: number };
      controlledBy: string | null;
      aimAngle: number;
      elevationAngle: number;
      cooldownRemaining: number;
    }>;
  };
  // Phase 3: Health tracking
  health?: number;
  maxHealth?: number;
  sinking?: boolean;
}

/**
 * Player data managed by the game
 */
export interface Player {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  targetPosition: { x: number; y: number };
  lastUpdate: number;
  velocity: { x: number; y: number };
  platformRef: string | null;
  onShip: string | null; // Ship participant ID if player is on a ship
  lastWaveOffset: number; // Track wave offset for smooth bobbing in water
}

/**
 * Ship entity managed by the game
 */
export interface Ship {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  boundaryGraphics: Phaser.GameObjects.Graphics; // Graphics for drawing isometric boundary dots
  targetPosition: { x: number; y: number };
  rotation: number; // Current rotation angle in radians
  lastUpdate: number;
  velocity: { x: number; y: number };
  controlPoints: {
    wheel: {
      sprite: Phaser.GameObjects.Graphics;
      relativePosition: { x: number; y: number }; // Position relative to ship center
      controlledBy: string | null;
    };
    sails: {
      sprite: Phaser.GameObjects.Graphics;
      relativePosition: { x: number; y: number }; // Position relative to ship center
      controlledBy: string | null;
    };
    mast: {
      sprite: Phaser.GameObjects.Graphics;
      relativePosition: { x: number; y: number }; // Position relative to ship center (center of ship)
      controlledBy: string | null; // Local-only, for camera zoom
    };
  };
  // c5x-ship-combat: Cannon control points
  cannons?: {
    port: Array<{
      sprite: Phaser.GameObjects.Graphics;
      relativePosition: { x: number; y: number };
      controlledBy: string | null;
      aimAngle: number;
      elevationAngle: number;
      cooldownRemaining: number;
    }>;
    starboard: Array<{
      sprite: Phaser.GameObjects.Graphics;
      relativePosition: { x: number; y: number };
      controlledBy: string | null;
      aimAngle: number;
      elevationAngle: number;
      cooldownRemaining: number;
    }>;
  };
  speedLevel: number;
  deckBoundary: { width: number; height: number };
  lastWaveOffset: number; // Track wave offset for smooth bobbing
  // Phase 3: Health tracking
  health: number;
  maxHealth: number;
  // Phase 4: Sinking state tracking
  sinking: boolean;
  sinkStartTime: number;
}

/**
 * Projectile entity managed by the game (c5x-ship-combat Phase 2)
 */
export interface Projectile {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  velocity: { x: number; y: number };
  spawnTime: number;
  sourceShip: string;
  minFlightTime: number; // Minimum ms before water collision can trigger (prevents instant despawn from deck-level firing)
}

/**
 * Connection configuration from the form
 */
export interface ConnectionConfig {
  gatewayUrl: string;
  spaceName: string;
  username: string;
  token: string;
}
