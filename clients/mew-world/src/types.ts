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
  timestamp: number;
  platformRef: string | null; // Reference to ship if player is on a ship
  platformKind: string | null; // Transport type when platformRef is set
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
  platformKind: string | null;
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
