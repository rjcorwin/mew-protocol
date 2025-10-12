export type EntityId = string;

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerTypeConfig {
  id: string;
  displayName: string;
  /**
   * Maximum tiles per second the player is allowed to travel.
   */
  maxSpeedTilesPerSecond: number;
  spriteKey: string;
  abilities: string[];
}

export interface PlayerState {
  id: EntityId;
  displayName: string;
  type: PlayerTypeConfig;
  position: Vector2;
  velocity: Vector2;
  /**
   * True when the participant is controlled by an AI routine.
   */
  isAgent: boolean;
  boardedShipId?: EntityId;
  /**
   * Position relative to the origin of the ship while boarded.
   */
  relativePosition?: Vector2;
}

export interface ShipState {
  id: EntityId;
  displayName: string;
  position: Vector2;
  velocity: Vector2;
  /**
   * Tiles per second the ship can move at maximum.
   */
  maxSpeedTilesPerSecond: number;
  /**
   * The local positions of players currently boarded on the ship.
   */
  boardedPlayers: Record<EntityId, Vector2>;
}

export interface MovementIntent {
  id: EntityId;
  target: Vector2;
}

export type WorldEvent =
  | { type: 'player-joined'; player: PlayerState }
  | { type: 'player-left'; playerId: EntityId }
  | { type: 'player-moved'; player: PlayerState }
  | { type: 'ship-moved'; ship: ShipState }
  | { type: 'ship-updated'; ship: ShipState };

export type WorldEventType = WorldEvent['type'];

export type WorldEventListener<Event extends WorldEventType> = (
  payload: Extract<WorldEvent, { type: Event }>,
) => void;
