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
  deckBoundary: {
    // Rectangular boundary for ship deck (relative coords)
    width: number;
    height: number;
  };
  // Wheel steering state (w3l-wheel-steering proposal)
  wheelAngle: number; // Current wheel angle in radians (-PI to PI, 0 = centered)
  turnRate: number; // Current rotation rate in radians/second
  wheelTurningDirection: 'left' | 'right' | null; // Active player input direction
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
  deckWidth: number;
  deckHeight: number;
  speedValues: {
    // Pixels per second for each speed level
    0: number;
    1: number;
    2: number;
    3: number;
  };
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
