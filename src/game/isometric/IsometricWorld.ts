import { randomUUID } from 'node:crypto';

import type {
  EntityId,
  MovementIntent,
  PlayerState,
  PlayerTypeConfig,
  ShipState,
  Vector2,
  WorldEvent,
  WorldEventListener,
  WorldEventType,
} from './types.js';

const clampMagnitude = (vector: Vector2, maxLength: number): Vector2 => {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0 || magnitude <= maxLength) {
    return vector;
  }

  const ratio = maxLength / magnitude;
  return { x: vector.x * ratio, y: vector.y * ratio };
};

const addVectors = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

const subtractVectors = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

const scaleVector = (vector: Vector2, scalar: number): Vector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

export interface AgentController {
  readonly id: EntityId;
  readonly playerId: EntityId;
  onTick(deltaMs: number, world: IsometricWorld): void;
}

export interface ShipController {
  readonly id: EntityId;
  readonly shipId: EntityId;
  onTick(deltaMs: number, world: IsometricWorld): void;
}

interface PendingMovement {
  intent: MovementIntent;
  remainingDistance: number;
}

export class SimplePatrolAgent implements AgentController {
  public readonly id: EntityId;
  public readonly playerId: EntityId;
  private readonly path: Vector2[];
  private currentIndex = 0;

  public constructor(playerId: EntityId, path: Vector2[]) {
    this.id = randomUUID();
    this.playerId = playerId;
    this.path = path.length > 0 ? path : [{ x: 0, y: 0 }];
  }

  public onTick(deltaMs: number, world: IsometricWorld): void {
    const player = world.getPlayer(this.playerId);
    if (!player) {
      return;
    }

    const currentTarget = this.path[this.currentIndex];
    const distanceToTarget = Math.hypot(
      currentTarget.x - player.position.x,
      currentTarget.y - player.position.y,
    );

    if (distanceToTarget < 0.05) {
      this.currentIndex = (this.currentIndex + 1) % this.path.length;
    }

    world.requestMovement({ id: this.playerId, target: this.path[this.currentIndex] });
  }
}

export class ConstantHeadingShipController implements ShipController {
  public readonly id: EntityId;
  public readonly shipId: EntityId;
  private readonly heading: Vector2;

  public constructor(shipId: EntityId, heading: Vector2) {
    this.id = randomUUID();
    this.shipId = shipId;
    const normalizedHeading = clampMagnitude(heading, 1);
    this.heading = normalizedHeading;
  }

  public onTick(deltaMs: number, world: IsometricWorld): void {
    const ship = world.getShip(this.shipId);
    if (!ship) {
      return;
    }

    world.setShipVelocity(this.shipId, this.heading);
  }
}

export class IsometricWorld {
  private readonly players = new Map<EntityId, PlayerState>();
  private readonly ships = new Map<EntityId, ShipState>();
  private readonly playerTypes = new Map<string, PlayerTypeConfig>();
  private readonly listeners = new Map<WorldEventType, Set<WorldEventListener<any>>>();
  private readonly movementQueue = new Map<EntityId, PendingMovement>();
  private readonly agentControllers = new Map<EntityId, AgentController>();
  private readonly shipControllers = new Map<EntityId, ShipController>();

  public on<Event extends WorldEventType>(event: Event, listener: WorldEventListener<Event>) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as WorldEventListener<any>);
    this.listeners.set(event, listeners);
  }

  public off<Event extends WorldEventType>(event: Event, listener: WorldEventListener<Event>) {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    listeners.delete(listener as WorldEventListener<any>);
    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  private emit<Event extends WorldEventType>(event: Event, payload: Extract<WorldEvent, { type: Event }>): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => {
      (listener as WorldEventListener<Event>)(payload);
    });
  }

  public registerPlayerType(config: PlayerTypeConfig): void {
    this.playerTypes.set(config.id, config);
  }

  public getPlayerType(id: string): PlayerTypeConfig | undefined {
    return this.playerTypes.get(id);
  }

  public spawnPlayer(options: {
    id?: EntityId;
    displayName: string;
    playerTypeId: string;
    position?: Vector2;
    isAgent?: boolean;
  }): PlayerState {
    const playerType = this.playerTypes.get(options.playerTypeId);
    if (!playerType) {
      throw new Error(`Unknown player type: ${options.playerTypeId}`);
    }

    const id = options.id ?? randomUUID();
    const player: PlayerState = {
      id,
      displayName: options.displayName,
      position: options.position ?? { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      type: playerType,
      isAgent: options.isAgent ?? false,
    };

    this.players.set(id, player);
    this.emit('player-joined', { type: 'player-joined', player });
    return player;
  }

  public spawnShip(options: {
    id?: EntityId;
    displayName: string;
    position?: Vector2;
    maxSpeedTilesPerSecond?: number;
  }): ShipState {
    const id = options.id ?? randomUUID();
    const ship: ShipState = {
      id,
      displayName: options.displayName,
      position: options.position ?? { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      maxSpeedTilesPerSecond: options.maxSpeedTilesPerSecond ?? 2,
      boardedPlayers: {},
    };

    this.ships.set(id, ship);
    this.emit('ship-updated', { type: 'ship-updated', ship });
    return ship;
  }

  public attachAgentController(controller: AgentController): void {
    this.agentControllers.set(controller.id, controller);
  }

  public attachShipController(controller: ShipController): void {
    this.shipControllers.set(controller.id, controller);
  }

  public getPlayer(id: EntityId): PlayerState | undefined {
    return this.players.get(id);
  }

  public getShip(id: EntityId): ShipState | undefined {
    return this.ships.get(id);
  }

  public requestMovement(intent: MovementIntent): void {
    const player = this.players.get(intent.id);
    if (!player) {
      return;
    }

    const remainingDistance = Math.hypot(
      intent.target.x - player.position.x,
      intent.target.y - player.position.y,
    );

    this.movementQueue.set(intent.id, { intent, remainingDistance });
  }

  public setShipVelocity(shipId: EntityId, direction: Vector2): void {
    const ship = this.ships.get(shipId);
    if (!ship) {
      return;
    }

    ship.velocity = clampMagnitude(direction, ship.maxSpeedTilesPerSecond);
  }

  public boardShip(playerId: EntityId, shipId: EntityId, deckPosition?: Vector2): void {
    const player = this.players.get(playerId);
    const ship = this.ships.get(shipId);
    if (!player || !ship) {
      return;
    }

    const relativePosition = deckPosition ?? subtractVectors(player.position, ship.position);
    ship.boardedPlayers[playerId] = relativePosition;
    player.boardedShipId = shipId;
    player.relativePosition = relativePosition;
    player.position = addVectors(ship.position, relativePosition);
    this.emit('player-moved', { type: 'player-moved', player });
  }

  public disembarkShip(playerId: EntityId): void {
    const player = this.players.get(playerId);
    if (!player || !player.boardedShipId) {
      return;
    }

    const ship = this.ships.get(player.boardedShipId);
    if (!ship) {
      return;
    }

    delete ship.boardedPlayers[playerId];
    player.boardedShipId = undefined;
    player.relativePosition = undefined;
    this.emit('player-moved', { type: 'player-moved', player });
  }

  public tick(deltaMs: number): void {
    this.agentControllers.forEach((controller) => controller.onTick(deltaMs, this));
    this.shipControllers.forEach((controller) => controller.onTick(deltaMs, this));

    const deltaSeconds = deltaMs / 1000;

    this.movementQueue.forEach((pending, playerId) => {
      const player = this.players.get(playerId);
      if (!player) {
        this.movementQueue.delete(playerId);
        return;
      }

      const direction = subtractVectors(pending.intent.target, player.position);
      const maxDistance = player.type.maxSpeedTilesPerSecond * deltaSeconds;
      const movement = clampMagnitude(direction, maxDistance);
      player.position = addVectors(player.position, movement);
      player.velocity = scaleVector(movement, 1 / deltaSeconds);
      pending.remainingDistance = Math.max(0, pending.remainingDistance - Math.hypot(movement.x, movement.y));

      if (pending.remainingDistance <= 0.01) {
        player.position = { ...pending.intent.target };
        player.velocity = { x: 0, y: 0 };
        this.movementQueue.delete(playerId);
      }

      if (player.boardedShipId) {
        const ship = this.ships.get(player.boardedShipId);
        if (ship) {
          const relativePosition = subtractVectors(player.position, ship.position);
          ship.boardedPlayers[playerId] = relativePosition;
          player.relativePosition = relativePosition;
        }
      }

      this.emit('player-moved', { type: 'player-moved', player });
    });

    this.ships.forEach((ship) => {
      if (ship.velocity.x === 0 && ship.velocity.y === 0) {
        return;
      }

      const cappedVelocity = clampMagnitude(ship.velocity, ship.maxSpeedTilesPerSecond);
      const deltaPosition = scaleVector(cappedVelocity, deltaSeconds);
      ship.position = addVectors(ship.position, deltaPosition);
      ship.velocity = cappedVelocity;

      Object.entries(ship.boardedPlayers).forEach(([playerId, relativePosition]) => {
        const player = this.players.get(playerId);
        if (!player) {
          return;
        }

        player.position = addVectors(ship.position, relativePosition);
        player.velocity = cappedVelocity;
        this.emit('player-moved', { type: 'player-moved', player });
      });

      this.emit('ship-moved', { type: 'ship-moved', ship });
    });
  }

  public snapshot(): {
    players: PlayerState[];
    ships: ShipState[];
  } {
    return {
      players: Array.from(this.players.values()).map((player) => ({
        ...player,
        position: { ...player.position },
        velocity: { ...player.velocity },
        relativePosition: player.relativePosition ? { ...player.relativePosition } : undefined,
      })),
      ships: Array.from(this.ships.values()).map((ship) => ({
        ...ship,
        position: { ...ship.position },
        velocity: { ...ship.velocity },
        boardedPlayers: Object.fromEntries(
          Object.entries(ship.boardedPlayers).map(([id, pos]) => [id, { ...pos }]),
        ),
      })),
    };
  }
}

export const createDefaultWorld = (): IsometricWorld => {
  const world = new IsometricWorld();

  world.registerPlayerType({
    id: 'human',
    displayName: 'Human Explorer',
    maxSpeedTilesPerSecond: 3,
    spriteKey: 'human-default',
    abilities: ['chat', 'navigate', 'board-ship'],
  });

  world.registerPlayerType({
    id: 'mew-agent',
    displayName: 'MEW Agent',
    maxSpeedTilesPerSecond: 2.5,
    spriteKey: 'agent-orb',
    abilities: ['pathfind', 'navigate', 'board-ship'],
  });

  return world;
};

export const buildFourByFourCrew = (world: IsometricWorld): {
  humans: PlayerState[];
  agents: PlayerState[];
} => {
  const humans: PlayerState[] = [];
  const agents: PlayerState[] = [];

  for (let index = 0; index < 4; index += 1) {
    humans.push(
      world.spawnPlayer({
        displayName: `Human ${index + 1}`,
        playerTypeId: 'human',
        position: { x: index * 2, y: 0 },
      }),
    );

    const agent = world.spawnPlayer({
      displayName: `MEW Agent ${index + 1}`,
      playerTypeId: 'mew-agent',
      position: { x: index * 2, y: 2 },
      isAgent: true,
    });
    agents.push(agent);

    const patrol = new SimplePatrolAgent(agent.id, [
      { x: index * 2, y: 2 },
      { x: index * 2 + 1, y: 3 },
      { x: index * 2, y: 4 },
      { x: index * 2 - 1, y: 3 },
    ]);
    world.attachAgentController(patrol);
  }

  return { humans, agents };
};

export const createDemoShip = (world: IsometricWorld, name = 'Aurora Skiff'): ShipState => {
  const ship = world.spawnShip({
    displayName: name,
    position: { x: 0, y: -2 },
    maxSpeedTilesPerSecond: 2,
  });

  const controller = new ConstantHeadingShipController(ship.id, { x: 0.5, y: 0 });
  world.attachShipController(controller);
  return ship;
};
