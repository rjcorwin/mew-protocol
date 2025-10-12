import Phaser from 'phaser';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const WORLD_WIDTH_TILES = 40;
export const WORLD_HEIGHT_TILES = 40;

export type PlayerKind = 'human' | 'mew-agent';

export interface PlayerDefinition {
  id: string;
  displayName: string;
  kind: PlayerKind;
  speed: number; // tiles per second
  spriteKey: string;
  isAI: boolean;
}

export interface PlayerState {
  definition: PlayerDefinition;
  tileX: number;
  tileY: number;
  z: number;
  velocityX: number;
  velocityY: number;
  lastUpdated: number;
  isMoving: boolean;
  onShipId?: string;
}

export interface PlayerInterpolationState {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
  duration: number;
}

export interface PlayerRenderable {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  sprite: Phaser.GameObjects.Arc;
  interpolation?: PlayerInterpolationState;
}

export interface ShipDefinition {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  deckSpeed: number;
}

export interface ShipState extends ShipDefinition {
  velocityX: number;
  velocityY: number;
  passengers: Set<string>;
}

export interface ShipRenderable {
  container: Phaser.GameObjects.Container;
  deck: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export interface MovementFrame {
  playerId: string;
  tileX: number;
  tileY: number;
  velocityX: number;
  velocityY: number;
  ts: number;
  onShipId?: string;
}

export interface ShipFrame {
  shipId: string;
  tileX: number;
  tileY: number;
  velocityX: number;
  velocityY: number;
  ts: number;
}

export interface GameStateSnapshot {
  players: PlayerState[];
  ships: ShipState[];
  ts: number;
}

export interface StreamAnnouncement {
  streamId: string;
  participants: string[];
}

export interface JoinFormValues {
  gatewayUrl: string;
  port: number;
  username: string;
  token: string;
}

export interface MovementUpdateMessage {
  type: 'movement-update';
  payload: MovementFrame;
}

export interface ShipUpdateMessage {
  type: 'ship-update';
  payload: ShipFrame;
}

export interface SnapshotMessage {
  type: 'snapshot';
  payload: GameStateSnapshot;
}

export type MovementStreamMessage =
  | MovementUpdateMessage
  | ShipUpdateMessage
  | SnapshotMessage;

export const HUMAN_PLAYERS = 4;
export const AGENT_PLAYERS = 4;

export interface PlayerSpawn {
  id: string;
  name: string;
  kind: PlayerKind;
  tileX: number;
  tileY: number;
}
