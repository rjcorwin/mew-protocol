#!/usr/bin/env node

import process from 'process';
import { MEWParticipant } from '@mew-protocol/mew/participant';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    gateway: process.env.MEW_GATEWAY || 'ws://localhost:8080',
    space: process.env.MEW_SPACE || 'isometric-fleet',
    token: process.env.MEW_TOKEN || 'harbor-token',
    participantId: process.env.MEW_PARTICIPANT_ID || 'harbor-master',
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--gateway':
      case '-g':
        options.gateway = args[++i];
        break;
      case '--space':
      case '-s':
        options.space = args[++i];
        break;
      case '--token':
      case '-t':
        options.token = args[++i];
        break;
      case '--participant-id':
      case '--id':
      case '-i':
        options.participantId = args[++i];
        break;
      default:
        break;
    }
  }

  return options;
}

const TERRAIN_LAYOUT = [
  'WWWWWWWWWWWWWWWWWWWW',
  'WWWGGGGGGWWWWGGGGWWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGDDDDGGGGWW',
  'WWGGGGGGGGDDDDGGGGWW',
  'WWGGGGGGGGDDDDGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWGGGGGGGGWWWWGGGGWW',
  'WWWGGGGGGWWWWGGGGWWW',
  'WWWWWWWWWWWWWWWWWWWW'
];

const TERRAIN_WIDTH = TERRAIN_LAYOUT[0].length;
const TERRAIN_HEIGHT = TERRAIN_LAYOUT.length;
const STREAM_DESCRIPTIONS = {
  world: 'isometric-world-state',
  input: 'isometric-player-input',
};

const SHIP_DECK_LAYOUT = [
  'SSS',
  'S.S',
  'SSS'
];

const SHIP_AUTOPILOT_ROUTE = [
  { x: 10, y: 2 },
  { x: 10, y: 4 },
  { x: 10, y: 6 },
  { x: 10, y: 7 },
  { x: 10, y: 9 },
  { x: 10, y: 12 }
];

const DIRECTION_VECTORS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

const SPAWN_POINTS = [
  { x: 4, y: 11 },
  { x: 6, y: 11 },
  { x: 8, y: 11 },
  { x: 5, y: 13 },
  { x: 7, y: 13 },
  { x: 9, y: 13 },
  { x: 6, y: 9 },
  { x: 8, y: 9 }
];

class HarborWorld {
  constructor(participant) {
    this.participant = participant;
    this.players = new Map();
    this.playerStreams = new Map();
    this.streamRequests = new Map();
    this.spawnIndex = 0;
    this.worldStreamId = undefined;
    this.worldTick = 0;
    this.lastTickAt = Date.now();
    this.lastBroadcastAt = 0;
    this.tickIntervalMs = 100;
    this.broadcastIntervalMs = 200;
    this.tickTimer = undefined;
    this.ship = {
      id: 'aurora',
      x: 10,
      y: 2,
      renderX: 10,
      renderY: 2,
      speed: 1.2,
      deckLayout: SHIP_DECK_LAYOUT,
      movement: null,
      mode: 'autopilot',
      manualTarget: null,
      autopilotIndex: 0
    };
  }

  async start() {
    this.participant.on('stream/request', (envelope) => this.handleStreamRequest(envelope));
    this.participant.on('stream/open', (envelope) => this.handleStreamOpen(envelope));
    this.participant.on('stream/close', (envelope) => this.handleStreamClose(envelope));
    this.participant.on('welcome', () => this.handleWelcome());

    this.participant.registerTool({
      name: 'ship.set_manual_target',
      description: 'Set a manual waypoint for the Aurora within the harbor channel.',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'integer', minimum: 0, maximum: TERRAIN_WIDTH - 1 },
          y: { type: 'integer', minimum: 0, maximum: TERRAIN_HEIGHT - 1 }
        },
        required: ['x', 'y']
      },
      execute: async (args) => {
        const target = {
          x: Number(args?.x),
          y: Number(args?.y)
        };

        if (!Number.isInteger(target.x) || !Number.isInteger(target.y)) {
          throw new Error('x and y must be integers');
        }

        if (!this.canPlaceShipAt(target.x, target.y)) {
          throw new Error('Target tile cannot fit the ship deck. Choose water or dock tiles.');
        }

        this.ship.mode = 'manual';
        this.ship.manualTarget = target;
        this.ship.autopilotIndex = 0;
        if (!this.ship.movement) {
          this.scheduleShipMovement();
        }

        return {
          status: 'ok',
          message: `Ship steering toward (${target.x}, ${target.y})`
        };
      }
    });

    this.participant.registerTool({
      name: 'ship.resume_autopilot',
      description: 'Return the ship to its looping autopilot patrol.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async () => {
        this.ship.mode = 'autopilot';
        this.ship.manualTarget = null;
        if (!this.ship.movement) {
          this.scheduleShipMovement();
        }
        return {
          status: 'ok',
          message: 'Autopilot resumed.'
        };
      }
    });

    await this.participant.connect();

    this.tickTimer = setInterval(() => this.tick(), this.tickIntervalMs);
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  shutdown() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    this.participant.disconnect();
    process.exit(0);
  }

  handleWelcome() {
    const requestId = this.participant.requestStream(
      {
        direction: 'upload',
        description: STREAM_DESCRIPTIONS.world
      },
      'gateway'
    );

    this.streamRequests.set(requestId, {
      description: STREAM_DESCRIPTIONS.world,
      from: this.participant.options.participant_id
    });

    this.scheduleShipMovement();
  }

  handleStreamRequest(envelope) {
    this.streamRequests.set(envelope.id, {
      description: envelope.payload?.description,
      from: envelope.from
    });
  }

  handleStreamOpen(envelope) {
    const correlationId = envelope.correlation_id?.[0];
    if (!correlationId) return;

    const meta = this.streamRequests.get(correlationId);
    if (!meta) return;

    const streamId = envelope.payload?.stream_id;
    if (!streamId) return;

    if (meta.description === STREAM_DESCRIPTIONS.world && meta.from === this.participant.options.participant_id) {
      this.worldStreamId = streamId;
      this.broadcastWorldState(true);
      return;
    }

    if (meta.description === STREAM_DESCRIPTIONS.input) {
      const playerId = meta.from;
      const handler = (frame) => this.handlePlayerStreamData(playerId, streamId, frame);
      this.playerStreams.set(streamId, handler);
      this.participant.on(`stream/data/${streamId}`, handler);
      this.ensurePlayer(playerId, streamId);
      return;
    }
  }

  handleStreamClose(envelope) {
    const streamId = envelope.payload?.stream_id || envelope.correlation_id?.[0];
    if (!streamId) return;

    if (streamId === this.worldStreamId) {
      this.worldStreamId = undefined;
      return;
    }

    if (this.playerStreams.has(streamId)) {
      const handler = this.playerStreams.get(streamId);
      this.participant.off(`stream/data/${streamId}`, handler);
      this.playerStreams.delete(streamId);

      const playerEntry = [...this.players.entries()].find(([, value]) => value.streamId === streamId);
      if (playerEntry) {
        this.players.delete(playerEntry[0]);
      }
    }
  }

  ensurePlayer(playerId, streamId) {
    if (this.players.has(playerId)) {
      const existing = this.players.get(playerId);
      existing.streamId = streamId;
      existing.lastActive = Date.now();
      return existing;
    }

    const spawn = SPAWN_POINTS[this.spawnIndex % SPAWN_POINTS.length];
    this.spawnIndex += 1;

    const player = {
      id: playerId,
      displayName: playerId,
      type: 'unknown',
      plane: 'ground',
      x: spawn.x,
      y: spawn.y,
      deckX: null,
      deckY: null,
      streamId,
      speed: 2.2,
      move: null,
      lastActive: Date.now(),
      renderX: spawn.x,
      renderY: spawn.y
    };

    this.players.set(playerId, player);
    return player;
  }

  handlePlayerStreamData(playerId, streamId, frame) {
    const player = this.ensurePlayer(playerId, streamId);
    player.lastActive = Date.now();

    let payload;
    try {
      payload = JSON.parse(frame.payload);
    } catch (error) {
      return;
    }

    if (!payload || typeof payload !== 'object') {
      return;
    }

    if (payload.type === 'join') {
      if (payload.displayName) {
        player.displayName = String(payload.displayName);
      }
      if (payload.playerType) {
        player.type = String(payload.playerType);
      }
      if (payload.speed) {
        const parsed = Number(payload.speed);
        if (!Number.isNaN(parsed) && parsed > 0.2) {
          player.speed = parsed;
        }
      }
      return;
    }

    if (payload.type === 'move' && typeof payload.direction === 'string') {
      this.queueMove(player, payload.direction);
      return;
    }

    if (payload.type === 'disembark') {
      this.tryDisembark(player);
    }
  }

  queueMove(player, directionKey) {
    if (!DIRECTION_VECTORS[directionKey]) return;
    if (player.move) return;

    const vector = DIRECTION_VECTORS[directionKey];

    if (player.plane === 'ground') {
      const targetX = player.x + vector.dx;
      const targetY = player.y + vector.dy;

      if (!this.isWithinBounds(targetX, targetY)) return;
      const tile = this.tileAt(targetX, targetY);
      if (!this.isWalkable(tile)) return;

      const isDeck = this.isDeckTile(targetX, targetY);
      const duration = 1 / Math.max(player.speed, 0.1);

      player.move = {
        kind: 'ground',
        startX: player.x,
        startY: player.y,
        targetX,
        targetY,
        duration,
        elapsed: 0,
        direction: directionKey,
        boardDeck: isDeck
      };
      return;
    }

    if (player.plane === 'ship') {
      const deckTargetX = player.deckX + vector.dx;
      const deckTargetY = player.deckY + vector.dy;
      const worldTargetX = Math.round(this.ship.renderX) + deckTargetX;
      const worldTargetY = Math.round(this.ship.renderY) + deckTargetY;

      if (this.isDeckRelative(deckTargetX, deckTargetY)) {
        player.move = {
          kind: 'deck',
          startDeckX: player.deckX,
          startDeckY: player.deckY,
          targetDeckX: deckTargetX,
          targetDeckY: deckTargetY,
          duration: 1 / Math.max(player.speed, 0.1),
          elapsed: 0
        };
        return;
      }

      if (this.isWithinBounds(worldTargetX, worldTargetY) && this.isWalkable(this.tileAt(worldTargetX, worldTargetY))) {
        player.move = {
          kind: 'disembark',
          startDeckX: player.deckX,
          startDeckY: player.deckY,
          targetX: worldTargetX,
          targetY: worldTargetY,
          duration: 1 / Math.max(player.speed, 0.1),
          elapsed: 0
        };
      }
    }
  }

  tryDisembark(player) {
    if (player.plane !== 'ship') return;

    const worldX = Math.round(this.ship.renderX) + player.deckX;
    const worldY = Math.round(this.ship.renderY) + player.deckY + 1;

    if (this.isWithinBounds(worldX, worldY) && this.isWalkable(this.tileAt(worldX, worldY))) {
      player.move = {
        kind: 'disembark',
        startDeckX: player.deckX,
        startDeckY: player.deckY,
        targetX: worldX,
        targetY: worldY,
        duration: 1 / Math.max(player.speed, 0.1),
        elapsed: 0
      };
    }
  }

  tick() {
    const now = Date.now();
    const deltaSeconds = (now - this.lastTickAt) / 1000;
    this.lastTickAt = now;

    this.updateShip(deltaSeconds);
    this.updatePlayers(deltaSeconds);

    if (!this.ship.movement) {
      this.scheduleShipMovement();
    }

    if (now - this.lastBroadcastAt >= this.broadcastIntervalMs) {
      this.broadcastWorldState();
      this.lastBroadcastAt = now;
    }

    this.worldTick += 1;
  }

  updateShip(deltaSeconds) {
    const movement = this.ship.movement;
    if (!movement) {
      this.ship.renderX = this.ship.x;
      this.ship.renderY = this.ship.y;
      return;
    }

    movement.elapsed += deltaSeconds * this.ship.speed;
    const progress = Math.min(1, movement.elapsed / movement.duration);

    this.ship.renderX = movement.startX + (movement.targetX - movement.startX) * progress;
    this.ship.renderY = movement.startY + (movement.targetY - movement.startY) * progress;

    if (progress >= 1) {
      this.ship.x = movement.targetX;
      this.ship.y = movement.targetY;
      this.ship.renderX = this.ship.x;
      this.ship.renderY = this.ship.y;
      this.ship.movement = null;
      this.scheduleShipMovement();
    }
  }

  scheduleShipMovement() {
    if (this.ship.movement) return;

    let target;
    if (this.ship.mode === 'manual') {
      if (this.ship.manualTarget) {
        target = this.ship.manualTarget;
        this.ship.manualTarget = null;
        if (!this.canPlaceShipAt(target.x, target.y)) {
          target = null;
        }
      } else {
        return;
      }
    } else {
      const waypoint = SHIP_AUTOPILOT_ROUTE[this.ship.autopilotIndex % SHIP_AUTOPILOT_ROUTE.length];
      this.ship.autopilotIndex = (this.ship.autopilotIndex + 1) % SHIP_AUTOPILOT_ROUTE.length;
      target = waypoint;
    }

    if (!target) return;

    if (!this.canPlaceShipAt(target.x, target.y)) {
      return;
    }

    const distanceTiles = Math.abs(target.x - this.ship.x) + Math.abs(target.y - this.ship.y);
    if (distanceTiles === 0) {
      return;
    }
    this.ship.movement = {
      startX: this.ship.x,
      startY: this.ship.y,
      targetX: target.x,
      targetY: target.y,
      duration: distanceTiles,
      elapsed: 0
    };
  }

  updatePlayers(deltaSeconds) {
    for (const player of this.players.values()) {
      if (player.move) {
        player.move.elapsed += deltaSeconds;
        const progress = Math.min(1, player.move.elapsed / player.move.duration);

        if (player.move.kind === 'ground') {
          player.renderX = player.move.startX + (player.move.targetX - player.move.startX) * progress;
          player.renderY = player.move.startY + (player.move.targetY - player.move.startY) * progress;

          if (progress >= 1) {
            player.x = player.move.targetX;
            player.y = player.move.targetY;
            player.renderX = player.x;
            player.renderY = player.y;
            if (player.move.boardDeck) {
              const deckCoord = this.worldToDeck(player.x, player.y);
              if (deckCoord) {
                player.plane = 'ship';
                player.deckX = deckCoord.x;
                player.deckY = deckCoord.y;
              }
            }
            player.move = null;
          }
        } else if (player.move.kind === 'deck') {
          const deckX = player.move.startDeckX + (player.move.targetDeckX - player.move.startDeckX) * progress;
          const deckY = player.move.startDeckY + (player.move.targetDeckY - player.move.startDeckY) * progress;
          player.renderX = this.ship.renderX + deckX;
          player.renderY = this.ship.renderY + deckY;

          if (progress >= 1) {
            player.deckX = player.move.targetDeckX;
            player.deckY = player.move.targetDeckY;
            player.renderX = this.ship.renderX + player.deckX;
            player.renderY = this.ship.renderY + player.deckY;
            player.move = null;
          }
        } else if (player.move.kind === 'disembark') {
          player.renderX = this.ship.renderX + player.move.startDeckX + (player.move.targetX - (this.ship.renderX + player.move.startDeckX)) * progress;
          player.renderY = this.ship.renderY + player.move.startDeckY + (player.move.targetY - (this.ship.renderY + player.move.startDeckY)) * progress;

          if (progress >= 1) {
            player.plane = 'ground';
            player.deckX = null;
            player.deckY = null;
            player.x = player.move.targetX;
            player.y = player.move.targetY;
            player.renderX = player.x;
            player.renderY = player.y;
            player.move = null;
          }
        }
      } else {
        if (player.plane === 'ship') {
          player.renderX = this.ship.renderX + player.deckX;
          player.renderY = this.ship.renderY + player.deckY;
        } else {
          player.renderX = player.x;
          player.renderY = player.y;
        }
      }
    }
  }

  broadcastWorldState(force = false) {
    if (!this.worldStreamId) return;
    if (!force && this.players.size === 0) return;

    const payload = {
      type: 'world-state',
      tick: this.worldTick,
      terrain: {
        width: TERRAIN_WIDTH,
        height: TERRAIN_HEIGHT,
        tiles: TERRAIN_LAYOUT,
        legend: {
          W: 'water',
          G: 'ground',
          D: 'dock'
        }
      },
      players: Array.from(this.players.values()).map((player) => ({
        id: player.id,
        displayName: player.displayName,
        type: player.type,
        plane: player.plane,
        x: Number(player.renderX.toFixed(3)),
        y: Number(player.renderY.toFixed(3)),
        deck: player.plane === 'ship' ? { x: player.deckX, y: player.deckY } : null,
        speed: player.speed
      })),
      ship: {
        id: this.ship.id,
        x: Number(this.ship.renderX.toFixed(3)),
        y: Number(this.ship.renderY.toFixed(3)),
        deckLayout: this.ship.deckLayout,
        deckWidth: this.ship.deckLayout[0].length,
        deckHeight: this.ship.deckLayout.length,
        mode: this.ship.mode,
        nextWaypoint: this.ship.mode === 'autopilot'
          ? SHIP_AUTOPILOT_ROUTE[this.ship.autopilotIndex % SHIP_AUTOPILOT_ROUTE.length]
          : this.ship.manualTarget
      }
    };

    this.participant.sendStreamData(this.worldStreamId, JSON.stringify(payload));
  }

  isWithinBounds(x, y) {
    return x >= 0 && y >= 0 && x < TERRAIN_WIDTH && y < TERRAIN_HEIGHT;
  }

  tileAt(x, y) {
    if (!this.isWithinBounds(x, y)) return 'W';
    return TERRAIN_LAYOUT[y][x];
  }

  isWalkable(tile) {
    if (!tile) return false;
    return tile === 'G' || tile === 'D';
  }

  isDeckTile(x, y) {
    const deck = this.worldToDeck(x, y);
    if (!deck) return false;
    return this.isDeckRelative(deck.x, deck.y);
  }

  worldToDeck(x, y) {
    const deckX = x - Math.round(this.ship.renderX);
    const deckY = y - Math.round(this.ship.renderY);
    if (!this.isDeckRelative(deckX, deckY)) {
      return null;
    }
    return { x: deckX, y: deckY };
  }

  isDeckRelative(x, y) {
    if (y < 0 || y >= this.ship.deckLayout.length) return false;
    const row = this.ship.deckLayout[y];
    if (x < 0 || x >= row.length) return false;
    return row[x] === 'S';
  }

  canPlaceShipAt(x, y) {
    for (let dy = 0; dy < this.ship.deckLayout.length; dy += 1) {
      for (let dx = 0; dx < this.ship.deckLayout[dy].length; dx += 1) {
        if (this.ship.deckLayout[dy][dx] !== 'S') continue;
        const worldX = x + dx;
        const worldY = y + dy;
        if (!this.isWithinBounds(worldX, worldY)) return false;
        const tile = this.tileAt(worldX, worldY);
        if (!(tile === 'W' || tile === 'D')) {
          return false;
        }
      }
    }
    return true;
  }
}

async function main() {
  const options = parseArgs();
  const participant = new MEWParticipant({
    gateway: options.gateway,
    space: options.space,
    token: options.token,
    participant_id: options.participantId,
    reconnect: true
  });

  const world = new HarborWorld(participant);
  await world.start();
}

main().catch((error) => {
  console.error('Harbor master failed to start:', error);
  process.exit(1);
});
