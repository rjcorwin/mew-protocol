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
}

/**
 * Ship entity managed by the game
 */
export interface Ship {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
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
  };
  speedLevel: number;
  deckBoundary: { width: number; height: number };
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
