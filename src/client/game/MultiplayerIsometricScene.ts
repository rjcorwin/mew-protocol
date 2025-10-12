import Phaser from 'phaser';
import { AgentNavigator } from './ai/AgentNavigator.js';
import { PlayerEntity } from './entities/PlayerEntity.js';
import { ShipEntity } from './entities/ShipEntity.js';
import {
  GameStateSnapshot,
  MovementFrame,
  PlayerDefinition,
  PlayerState,
  ShipDefinition,
  ShipFrame,
  ShipState,
  WORLD_HEIGHT_TILES,
  WORLD_WIDTH_TILES,
  PlayerSpawn
} from './types.js';
import { isoToScreen } from './utils/isometric.js';

export interface SceneOptions {
  localPlayerId: string;
  onLocalMovement: (frame: MovementFrame) => void;
  humanPlayers: PlayerSpawn[];
  agentPlayers: PlayerSpawn[];
  ships: ShipDefinition[];
  initialSnapshot?: GameStateSnapshot;
}

interface AgentRuntime {
  navigator: AgentNavigator;
  lastUpdate: number;
}

export class MultiplayerIsometricScene extends Phaser.Scene {
  private readonly options: SceneOptions;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW?: Phaser.Input.Keyboard.Key;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyS?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private readonly players = new Map<string, PlayerEntity>();
  private readonly agents = new Map<string, AgentRuntime>();
  private readonly ships = new Map<string, ShipEntity>();
  private lastSentFrame?: MovementFrame;
  private lastSnapshotAt = 0;

  constructor(options: SceneOptions) {
    super({ key: 'MultiplayerIsometricScene' });
    this.options = options;
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#0b132b');
  }

  create(): void {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keyW = this.input.keyboard?.addKey('W');
    this.keyA = this.input.keyboard?.addKey('A');
    this.keyS = this.input.keyboard?.addKey('S');
    this.keyD = this.input.keyboard?.addKey('D');

    this.drawIsometricGrid();
    this.spawnShips();
    this.spawnPlayers();

    if (this.options.initialSnapshot) {
      this.applySnapshot(this.options.initialSnapshot);
    }
  }

  update(time: number, delta: number): void {
    this.updateLocalPlayer(delta);
    this.updateAI(delta);
    for (const entity of this.players.values()) {
      entity.update(delta);
    }
    this.broadcastSnapshot(time);
  }

  handleMovementFrame(frame: MovementFrame): void {
    const entity = this.ensurePlayer(frame);

    const next: PlayerState = {
      ...entity.state,
      tileX: frame.tileX,
      tileY: frame.tileY,
      velocityX: frame.velocityX,
      velocityY: frame.velocityY,
      isMoving: Math.abs(frame.velocityX) > 0.01 || Math.abs(frame.velocityY) > 0.01,
      onShipId: frame.onShipId
    };
    entity.updateState(next);
  }

  handleShipFrame(frame: ShipFrame): void {
    const ship = this.ships.get(frame.shipId);
    if (!ship) {
      return;
    }

    const next: ShipState = {
      ...ship.state,
      tileX: frame.tileX,
      tileY: frame.tileY,
      velocityX: frame.velocityX,
      velocityY: frame.velocityY,
      passengers: ship.state.passengers
    };
    ship.updateState(next);
  }

  applySnapshot(snapshot: GameStateSnapshot): void {
    snapshot.players.forEach((state) => {
      const entity = this.players.get(state.definition.id);
      if (entity) {
        entity.updateState(state);
      }
    });

    snapshot.ships.forEach((state) => {
      const entity = this.ships.get(state.id);
      if (entity) {
        entity.updateState(state);
      }
    });
  }

  getLocalPlayer(): PlayerEntity | undefined {
    return this.players.get(this.options.localPlayerId);
  }

  private spawnShips(): void {
    for (const definition of this.options.ships) {
      const state: ShipState = {
        ...definition,
        velocityX: 0,
        velocityY: 0,
        passengers: new Set<string>()
      };
      const entity = new ShipEntity(this, state);
      this.ships.set(definition.id, entity);
    }
  }

  private spawnPlayers(): void {
    const makeDefinition = (spawn: PlayerSpawn, isAI: boolean): PlayerDefinition => ({
      id: spawn.id,
      displayName: spawn.name,
      kind: spawn.kind,
      speed: 3,
      spriteKey: spawn.kind === 'human' ? 'human' : 'mew',
      isAI
    });

    const createPlayer = (spawn: PlayerSpawn, isAI: boolean): void => {
      const definition = makeDefinition(spawn, isAI);
      const state: PlayerState = {
        definition,
        tileX: spawn.tileX,
        tileY: spawn.tileY,
        z: 0,
        velocityX: 0,
        velocityY: 0,
        lastUpdated: performance.now(),
        isMoving: false
      };
      const entity = new PlayerEntity(this, state);
      this.players.set(definition.id, entity);
      if (isAI) {
        this.agents.set(definition.id, { navigator: new AgentNavigator(), lastUpdate: performance.now() });
      }
    };

    this.options.humanPlayers.forEach((spawn) => createPlayer(spawn, false));
    this.options.agentPlayers.forEach((spawn) => createPlayer(spawn, true));
  }

  private drawIsometricGrid(): void {
    const graphics = this.add.graphics({ lineStyle: { width: 1, color: 0x1c2541, alpha: 0.6 } });

    for (let x = 0; x < WORLD_WIDTH_TILES; x++) {
      for (let y = 0; y < WORLD_HEIGHT_TILES; y++) {
        const { x: screenX, y: screenY } = isoToScreen(x, y, 0);
        const halfWidth = 32;
        const halfHeight = 16;
        graphics.lineStyle(1, 0x1c2541, 0.35);
        graphics.beginPath();
        graphics.moveTo(screenX, screenY - halfHeight);
        graphics.lineTo(screenX + halfWidth, screenY);
        graphics.lineTo(screenX, screenY + halfHeight);
        graphics.lineTo(screenX - halfWidth, screenY);
        graphics.closePath();
        graphics.strokePath();
      }
    }

    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1.2);
  }

  private updateLocalPlayer(delta: number): void {
    const entity = this.getLocalPlayer();
    if (!entity) {
      return;
    }

    const speed = entity.state.definition.speed;
    const step = (speed * delta) / 1000;
    let moveX = 0;
    let moveY = 0;

    const left = this.cursors?.left?.isDown || this.keyA?.isDown;
    const right = this.cursors?.right?.isDown || this.keyD?.isDown;
    const up = this.cursors?.up?.isDown || this.keyW?.isDown;
    const down = this.cursors?.down?.isDown || this.keyS?.isDown;

    if (left) moveX -= step;
    if (right) moveX += step;
    if (up) moveY -= step;
    if (down) moveY += step;

    if (!moveX && !moveY) {
      if (entity.state.isMoving) {
        const stationary: PlayerState = {
          ...entity.state,
          velocityX: 0,
          velocityY: 0,
          isMoving: false
        };
        entity.updateState(stationary);
        this.maybeSendMovementFrame(stationary);
      }
      return;
    }

    const nextX = Phaser.Math.Clamp(entity.state.tileX + moveX, 0, WORLD_WIDTH_TILES - 1);
    const nextY = Phaser.Math.Clamp(entity.state.tileY + moveY, 0, WORLD_HEIGHT_TILES - 1);

    const velocityX = moveX / (delta / 1000 || 1);
    const velocityY = moveY / (delta / 1000 || 1);

    const updated: PlayerState = {
      ...entity.state,
      tileX: nextX,
      tileY: nextY,
      velocityX,
      velocityY,
      isMoving: true
    };

    const onShip = this.findShipAtTile(nextX, nextY);
    updated.onShipId = onShip?.state.id;

    if (onShip && !onShip.state.passengers.has(entity.state.definition.id)) {
      onShip.state.passengers.add(entity.state.definition.id);
    } else if (!onShip) {
      for (const ship of this.ships.values()) {
        ship.state.passengers.delete(entity.state.definition.id);
      }
    }

    entity.updateState(updated);
    this.maybeSendMovementFrame(updated);
    this.cameras.main.startFollow(entity.renderable.container, true, 0.15, 0.15);
  }

  private updateAI(delta: number): void {
    const now = performance.now();
    for (const [id, runtime] of this.agents.entries()) {
      const entity = this.players.get(id);
      if (!entity) continue;
      const updated = runtime.navigator.update(entity.state, delta);
      runtime.lastUpdate = now;
      entity.updateState(updated);
    }
  }

  private findShipAtTile(tileX: number, tileY: number): ShipEntity | undefined {
    for (const ship of this.ships.values()) {
      const halfW = ship.state.width / 2;
      const halfH = ship.state.height / 2;
      const dx = tileX - ship.state.tileX;
      const dy = tileY - ship.state.tileY;
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        return ship;
      }
    }
    return undefined;
  }

  private maybeSendMovementFrame(state: PlayerState): void {
    const frame: MovementFrame = {
      playerId: state.definition.id,
      tileX: state.tileX,
      tileY: state.tileY,
      velocityX: state.velocityX,
      velocityY: state.velocityY,
      ts: Date.now(),
      onShipId: state.onShipId
    };

    if (!this.shouldSendFrame(frame)) {
      return;
    }

    this.lastSentFrame = frame;
    this.options.onLocalMovement(frame);
  }

  private shouldSendFrame(frame: MovementFrame): boolean {
    if (!this.lastSentFrame) {
      return true;
    }

    const dx = Math.abs(this.lastSentFrame.tileX - frame.tileX);
    const dy = Math.abs(this.lastSentFrame.tileY - frame.tileY);
    const velocityChanged =
      Math.abs(this.lastSentFrame.velocityX - frame.velocityX) > 0.1 ||
      Math.abs(this.lastSentFrame.velocityY - frame.velocityY) > 0.1;
    const shipChanged = this.lastSentFrame.onShipId !== frame.onShipId;
    const moved = dx > 0.05 || dy > 0.05;
    const timeElapsed = frame.ts - this.lastSentFrame.ts;

    return moved || velocityChanged || shipChanged || timeElapsed > 200;
  }

  private broadcastSnapshot(time: number): void {
    if (time - this.lastSnapshotAt < 2000) {
      return;
    }

    const players: PlayerState[] = Array.from(this.players.values()).map((entity) => ({
      ...entity.state,
      tileX: entity.state.tileX,
      tileY: entity.state.tileY
    }));
    const ships: ShipState[] = Array.from(this.ships.values()).map((ship) => ({
      ...ship.state,
      passengers: new Set(ship.state.passengers)
    }));

    const snapshot: GameStateSnapshot = {
      players,
      ships,
      ts: Date.now()
    };
    this.lastSnapshotAt = time;
    this.events.emit('snapshot-ready', snapshot);
  }

  private ensurePlayer(frame: MovementFrame): PlayerEntity {
    let entity = this.players.get(frame.playerId);
    if (entity) {
      return entity;
    }

    const definition: PlayerDefinition = {
      id: frame.playerId,
      displayName: frame.playerId,
      kind: 'human',
      speed: 3,
      spriteKey: 'human',
      isAI: false
    };

    const state: PlayerState = {
      definition,
      tileX: frame.tileX,
      tileY: frame.tileY,
      z: 0,
      velocityX: frame.velocityX,
      velocityY: frame.velocityY,
      lastUpdated: performance.now(),
      isMoving: Math.abs(frame.velocityX) > 0.01 || Math.abs(frame.velocityY) > 0.01,
      onShipId: frame.onShipId
    };

    entity = new PlayerEntity(this, state);
    this.players.set(frame.playerId, entity);
    return entity;
  }
}
