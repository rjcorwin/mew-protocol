import { MEWAgent, AgentConfig } from './MEWAgent.js';
import { Envelope } from '../types/index.js';
import type { StreamFrame } from '../client/MEWClient.js';

interface MovementConfig {
  /**
   * Display name announced to the world server via the movement stream handshake
   */
  displayName?: string;
  /**
   * Logical player type (ships, humans, mew-agents, etc.)
   */
  playerType?: string;
  /**
   * Description that the world server uses when requesting a world broadcast stream
   */
  worldStreamDescription?: string;
  /**
   * Description used when this agent requests an upload stream for movement commands
   */
  movementStreamDescription?: string;
  /**
   * Tiles per second this agent can traverse. Defaults to 1.5 tiles/sec.
   */
  speedTilesPerSecond?: number;
  /**
   * Minimum number of milliseconds between move commands. Derived from the speed if omitted.
   */
  minimumMoveIntervalMs?: number;
  /**
   * Interval in milliseconds for re-evaluating navigation goals.
   */
  planningIntervalMs?: number;
  /**
   * When true the agent stays on the ground plane and avoids ship decks.
   */
  stayOnGround?: boolean;
}

export interface MobileAgentConfig extends AgentConfig {
  movement?: MovementConfig;
}

interface TerrainDefinition {
  width: number;
  height: number;
  tiles: string[];
  legend?: Record<string, string>;
}

interface PlayerSnapshot {
  id: string;
  displayName?: string;
  type?: string;
  plane?: 'ground' | 'ship';
  x: number;
  y: number;
  deck?: { x: number; y: number };
  speed?: number;
}

interface ShipSnapshot {
  id: string;
  x: number;
  y: number;
  deckLayout: string[];
  deckWidth: number;
  deckHeight: number;
}

interface WorldState {
  terrain: TerrainDefinition;
  players: PlayerSnapshot[];
  ship?: ShipSnapshot;
  tick: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface DirectionVector {
  dx: number;
  dy: number;
}

const DIRECTION_VECTORS: Record<Direction, DirectionVector> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

/**
 * MobileMEWAgent augments the base MEWAgent with world-stream awareness and
 * throttled movement command handling. It is intentionally conservative so that
 * template-specific behaviour can build on top of it without reimplementing
 * stream bookkeeping or cooldown management.
 */
export class MobileMEWAgent extends MEWAgent {
  private movementConfig: Required<Omit<MovementConfig, 'displayName' | 'playerType' | 'stayOnGround'>> & {
    displayName?: string;
    playerType?: string;
    stayOnGround: boolean;
  };
  private baseName?: string;

  private worldState?: WorldState;
  private worldStreamId?: string;
  private movementStreamId?: string;
  private readonly streamRequests = new Map<string, { description?: string; from: string }>();
  private readonly worldStreamHandlers = new Map<string, (frame: StreamFrame) => void>();
  private planTimer?: NodeJS.Timeout;
  private readonly moveQueue: Direction[] = [];
  private lastMoveSentAt = 0;
  private lastPlanAt = 0;
  private handshakeSent = false;

  constructor(config: MobileAgentConfig) {
    const movementDefaults: Required<Omit<MovementConfig, 'displayName' | 'playerType'>> & {
      displayName?: string;
      playerType?: string;
      stayOnGround: boolean;
    } = {
      worldStreamDescription: 'isometric-world-state',
      movementStreamDescription: 'isometric-player-input',
      speedTilesPerSecond: 1.5,
      minimumMoveIntervalMs: Math.round(1000 / 1.5),
      planningIntervalMs: 1000,
      displayName: undefined,
      playerType: undefined,
      stayOnGround: false
    };

    const mergedMovement = {
      ...movementDefaults,
      ...(config.movement || {})
    };

    if (!config.movement?.minimumMoveIntervalMs && config.movement?.speedTilesPerSecond) {
      mergedMovement.minimumMoveIntervalMs = Math.max(
        100,
        Math.round(1000 / Math.max(0.1, config.movement.speedTilesPerSecond))
      );
    }

    super({
      autoRespond: false,
      mockLLM: true,
      reasoningEnabled: false,
      logLevel: 'info',
      ...(config || {})
    });

    this.baseName = config.name;
    this.movementConfig = mergedMovement;

    this.on('welcome', () => this.handleWelcome());
    this.on('stream/request', (envelope: Envelope) => this.handleStreamRequest(envelope));
    this.on('stream/open', (envelope: Envelope) => this.handleStreamOpen(envelope));
    this.on('stream/close', (envelope: Envelope) => this.handleStreamClose(envelope));
  }

  override async start(): Promise<void> {
    await super.start();

    if (!this.planTimer) {
      this.planTimer = setInterval(() => this.tickPlanner(), this.movementConfig.planningIntervalMs);
    }
  }

  override stop(): void {
    if (this.planTimer) {
      clearInterval(this.planTimer);
      this.planTimer = undefined;
    }

    this.worldStreamHandlers.forEach((_handler, streamId) => {
      this.off(`stream/data/${streamId}`, this.worldStreamHandlers.get(streamId)!);
    });
    this.worldStreamHandlers.clear();

    super.stop();
  }

  private handleWelcome(): void {
    const requestId = this.requestStream(
      {
        direction: 'upload',
        description: this.movementConfig.movementStreamDescription
      },
      'gateway'
    );

    this.streamRequests.set(requestId, {
      description: this.movementConfig.movementStreamDescription,
      from: this.options.participant_id!
    });
  }

  private handleStreamRequest(envelope: Envelope): void {
    this.streamRequests.set(envelope.id, {
      description: envelope.payload?.description,
      from: envelope.from
    });
  }

  private handleStreamOpen(envelope: Envelope): void {
    const correlationId = envelope.correlation_id?.[0];
    if (!correlationId) return;

    const meta = this.streamRequests.get(correlationId);
    if (!meta) return;

    const streamId = envelope.payload?.stream_id;
    if (!streamId) return;

    if (
      meta.from === this.options.participant_id &&
      meta.description === this.movementConfig.movementStreamDescription
    ) {
      this.movementStreamId = streamId;
      this.sendHandshake();
      return;
    }

    if (meta.description === this.movementConfig.worldStreamDescription) {
      if (this.worldStreamId === streamId) {
        return;
      }

      this.worldStreamId = streamId;
      const handler = (frame: StreamFrame) => this.handleWorldStreamFrame(frame);
      this.worldStreamHandlers.set(streamId, handler);
      this.on(`stream/data/${streamId}`, handler);
    }
  }

  private handleStreamClose(envelope: Envelope): void {
    const streamId = envelope.payload?.stream_id || envelope.correlation_id?.[0];
    if (!streamId) return;

    if (streamId === this.movementStreamId) {
      this.movementStreamId = undefined;
      this.handshakeSent = false;
      return;
    }

    if (this.worldStreamHandlers.has(streamId)) {
      const handler = this.worldStreamHandlers.get(streamId)!;
      this.off(`stream/data/${streamId}`, handler);
      this.worldStreamHandlers.delete(streamId);
      if (this.worldStreamId === streamId) {
        this.worldStreamId = undefined;
        this.worldState = undefined;
      }
    }
  }

  private handleWorldStreamFrame(frame: StreamFrame): void {
    try {
      const payload = JSON.parse(frame.payload) as WorldState;
      if (payload && payload.players && payload.terrain) {
        this.worldState = payload;
        this.planMovement();
      }
    } catch (error) {
      this.log('warn', `Failed to parse world state frame: ${(error as Error).message}`);
    }
  }

  private sendHandshake(): void {
    if (!this.movementStreamId || this.handshakeSent) {
      return;
    }

    const handshake = {
      type: 'join',
      displayName: this.movementConfig.displayName || this.baseName || this.options.participant_id,
      playerType: this.movementConfig.playerType || 'mew-agent'
    };

    this.sendStreamData(this.movementStreamId, JSON.stringify(handshake));
    this.handshakeSent = true;
  }

  private tickPlanner(): void {
    this.executeNextMove();
    const now = Date.now();
    if (now - this.lastPlanAt >= this.movementConfig.planningIntervalMs) {
      this.planMovement();
    }
  }

  private planMovement(): void {
    if (!this.worldState) return;

    const me = this.worldState.players.find((player) => player.id === this.options.participant_id);
    if (!me) return;

    const start = { x: Math.round(me.x), y: Math.round(me.y) };
    const terrain = this.worldState.terrain;

    const candidateTiles = this.collectWalkableTiles(terrain);
    if (candidateTiles.length === 0) {
      return;
    }

    const targetIndex = Math.floor(Math.random() * candidateTiles.length);
    const target = candidateTiles[targetIndex];

    if (target.x === start.x && target.y === start.y) {
      return;
    }

    const path = this.findPath(start, target, terrain);
    if (!path || path.length === 0) {
      return;
    }

    this.moveQueue.length = 0;
    for (const step of path) {
      this.moveQueue.push(step);
    }

    this.lastPlanAt = Date.now();
  }

  private executeNextMove(): void {
    if (!this.movementStreamId || this.moveQueue.length === 0) {
      return;
    }

    const now = Date.now();
    if (now - this.lastMoveSentAt < this.movementConfig.minimumMoveIntervalMs) {
      return;
    }

    const direction = this.moveQueue.shift();
    if (!direction) {
      return;
    }

    this.sendStreamData(this.movementStreamId, JSON.stringify({ type: 'move', direction }));
    this.lastMoveSentAt = now;
  }

  private collectWalkableTiles(terrain: TerrainDefinition): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < terrain.height; y += 1) {
      const row = terrain.tiles[y] || '';
      for (let x = 0; x < terrain.width; x += 1) {
        const cell = row[x];
        if (this.isTileWalkable(cell)) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  private isTileWalkable(cell: string | undefined): boolean {
    if (!cell) return false;
    if (cell === 'W') return false; // Water
    if (cell === 'R') return false; // Rocks/obstacles
    if (cell === 'S' && this.movementConfig.stayOnGround) return false;
    return true;
  }

  private findPath(
    start: { x: number; y: number },
    goal: { x: number; y: number },
    terrain: TerrainDefinition
  ): Direction[] | null {
    const queue: Array<{ x: number; y: number }> = [];
    queue.push(start);

    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);

    const parents = new Map<string, { from: string; direction: Direction }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === goal.x && current.y === goal.y) {
        break;
      }

      for (const direction of Object.keys(DIRECTION_VECTORS) as Direction[]) {
        const { dx, dy } = DIRECTION_VECTORS[direction];
        const nx = current.x + dx;
        const ny = current.y + dy;

        if (nx < 0 || ny < 0 || nx >= terrain.width || ny >= terrain.height) {
          continue;
        }

        const tile = terrain.tiles[ny]?.[nx];
        if (!this.isTileWalkable(tile)) {
          continue;
        }

        const key = `${nx},${ny}`;
        if (visited.has(key)) {
          continue;
        }

        visited.add(key);
        parents.set(key, {
          from: `${current.x},${current.y}`,
          direction
        });
        queue.push({ x: nx, y: ny });
      }
    }

    const path: Direction[] = [];
    let currentKey = `${goal.x},${goal.y}`;
    if (!parents.has(currentKey) && !(start.x === goal.x && start.y === goal.y)) {
      return null;
    }

    while (currentKey !== `${start.x},${start.y}`) {
      const parent = parents.get(currentKey);
      if (!parent) break;
      path.unshift(parent.direction);
      currentKey = parent.from;
    }

    return path;
  }
}

