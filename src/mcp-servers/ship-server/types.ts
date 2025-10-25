/**
 * Ship state and control types for MEW World ship entities
 */

/**
 * 8-directional heading for ship navigation
 */
export type ShipHeading =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

/**
 * Speed level for ship (0-3)
 * 0 = stopped, 1 = slow, 2 = medium, 3 = fast
 */
export type SpeedLevel = 0 | 1 | 2 | 3;

/**
 * Position in 2D space
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Velocity vector
 */
export interface Velocity {
  x: number;
  y: number;
}

/**
 * Ship control point (relative to ship origin)
 */
export interface ControlPoint {
  type: 'wheel' | 'sails';
  relativePosition: Position; // Offset from ship origin
  controlledBy: string | null; // Participant ID of player controlling, or null
}

/**
 * Cannon control point with aiming
 */
export interface CannonControlPoint {
  type: 'cannon';
  side: 'port' | 'starboard';
  index: number; // 0, 1, etc for multiple cannons per side
  relativePosition: Position; // Offset from ship origin
  controlledBy: string | null; // Player controlling this cannon
  aimAngle: number; // Aim angle in radians, relative to perpendicular (±π/4)
  cooldownRemaining: number; // ms until can fire again
  lastFired: number; // Timestamp of last fire
}

/**
 * Complete ship state
 */
export interface ShipState {
  participantId: string; // Ship's participant ID in MEW space
  position: Position; // World coordinates
  heading: ShipHeading; // Direction ship is facing
  rotation: number; // Rotation angle in radians (0 = east, PI/2 = south, etc.)
  speedLevel: SpeedLevel; // Current speed setting (0-3)
  velocity: Velocity; // Calculated from heading + speed
  passengers: string[]; // List of participant IDs on the ship
  controlPoints: {
    wheel: ControlPoint;
    sails: ControlPoint;
  };
  cannons: {
    port: CannonControlPoint[];
    starboard: CannonControlPoint[];
  };
  deckBoundary: {
    // Rectangular boundary for ship deck (relative coords)
    width: number;
    height: number;
  };
  // Wheel steering state (w3l-wheel-steering proposal)
  wheelAngle: number; // Current wheel angle in radians (-PI to PI, 0 = centered)
  turnRate: number; // Current rotation rate in radians/second
  wheelTurningDirection: 'left' | 'right' | null; // Active player input direction
  // Combat state (c5x-ship-combat)
  health: number; // Current health (0-maxHealth)
  maxHealth: number; // Maximum health
  sinking: boolean; // true if health <= 0
}

/**
 * Ship configuration (constant properties)
 */
export interface ShipConfig {
  participantId: string;
  initialPosition: Position;
  initialHeading: ShipHeading;
  wheelPosition: Position; // Relative to ship origin
  sailsPosition: Position; // Relative to ship origin
  cannonPositions: {
    port: Position[]; // Array of cannon positions on port side
    starboard: Position[]; // Array of cannon positions on starboard side
  };
  deckLength: number; // Ship length (bow to stern) in pixels
  deckBeam: number;   // Ship beam (port to starboard) in pixels
  speedValues: {
    // Pixels per second for each speed level
    0: number;
    1: number;
    2: number;
    3: number;
  };
  // Combat config (c5x-ship-combat)
  maxHealth: number; // Starting health
  cannonCooldownMs: number; // Reload time in milliseconds
}

/**
 * Ship control message payloads
 */

export interface GrabControlPayload {
  controlPoint: 'wheel' | 'sails';
  playerId: string;
}

export interface ReleaseControlPayload {
  controlPoint: 'wheel' | 'sails';
  playerId: string;
}

export interface SteerPayload {
  direction: 'left' | 'right';
  playerId: string;
}

export interface WheelTurnStartPayload {
  direction: 'left' | 'right';
  playerId: string;
}

export interface WheelTurnStopPayload {
  playerId: string;
}

export interface AdjustSailsPayload {
  adjustment: 'up' | 'down';
  playerId: string;
}

/**
 * Cannon control payloads (c5x-ship-combat)
 */
export interface GrabCannonPayload {
  side: 'port' | 'starboard';
  index: number;
  playerId: string;
}

export interface ReleaseCannonPayload {
  side: 'port' | 'starboard';
  index: number;
  playerId: string;
}

export interface AimCannonPayload {
  side: 'port' | 'starboard';
  index: number;
  aimAngle: number; // Radians, will be clamped to ±π/4
  playerId: string;
}

export interface FireCannonPayload {
  side: 'port' | 'starboard';
  index: number;
  playerId: string;
}

/**
 * Map navigation data for collision detection
 */
export interface MapDataPayload {
  tileWidth: number;
  tileHeight: number;
  mapWidth: number; // in tiles
  mapHeight: number; // in tiles
  navigableTiles: boolean[][]; // [y][x] - true if navigable (water), false if land
  orientation: 'orthogonal' | 'isometric'; // Map orientation
}
