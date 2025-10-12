import readline from 'node:readline';

import {
  IsometricWorld,
  SimplePatrolAgent,
  createDefaultWorld,
} from '../game/isometric/IsometricWorld.js';
import type { PlayerState, ShipState, Vector2 } from '../game/isometric/types.js';

interface MCPRequest {
  id?: number | string;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  data: unknown;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    required?: string[];
    properties: Record<string, unknown>;
    additionalProperties: boolean;
  };
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_world_state',
    description: 'Return the current players, ships, and relationships inside the isometric world.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'request_player_movement',
    description: 'Queue a player to walk toward a target tile respecting their speed.',
    inputSchema: {
      type: 'object',
      required: ['playerId', 'x', 'y'],
      properties: {
        playerId: {
          type: 'string',
          description: 'Identifier of the player to move.',
        },
        x: {
          type: 'number',
          description: 'Target tile X coordinate.',
        },
        y: {
          type: 'number',
          description: 'Target tile Y coordinate.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_ship_heading',
    description: 'Update a ship velocity vector. Values are clamped to the ship speed limit.',
    inputSchema: {
      type: 'object',
      required: ['shipId', 'headingX', 'headingY'],
      properties: {
        shipId: {
          type: 'string',
          description: 'Identifier of the ship to steer.',
        },
        headingX: {
          type: 'number',
          description: 'Desired X velocity component in tiles per second.',
        },
        headingY: {
          type: 'number',
          description: 'Desired Y velocity component in tiles per second.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'board_ship',
    description: 'Place a player onto a ship deck using optional relative coordinates.',
    inputSchema: {
      type: 'object',
      required: ['playerId', 'shipId'],
      properties: {
        playerId: {
          type: 'string',
          description: 'Identifier of the player to board.',
        },
        shipId: {
          type: 'string',
          description: 'Identifier of the ship to board.',
        },
        deckX: {
          type: 'number',
          description: 'Optional deck-relative X coordinate.',
        },
        deckY: {
          type: 'number',
          description: 'Optional deck-relative Y coordinate.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'disembark',
    description: 'Remove a player from whichever ship they are currently aboard.',
    inputSchema: {
      type: 'object',
      required: ['playerId'],
      properties: {
        playerId: {
          type: 'string',
          description: 'Identifier of the player to disembark.',
        },
      },
      additionalProperties: false,
    },
  },
];

const TICK_INTERVAL_MS = 200;

const world: IsometricWorld = createDefaultWorld();

const spawnPosition = (index: number, y: number): Vector2 => ({ x: index * 2, y });

for (let index = 0; index < 4; index += 1) {
  world.spawnPlayer({
    id: `human-${index + 1}`,
    displayName: `Human ${index + 1}`,
    playerTypeId: 'human',
    position: spawnPosition(index, 0),
  });
}

for (let index = 0; index < 4; index += 1) {
  const agent = world.spawnPlayer({
    id: `agent-${index + 1}`,
    displayName: `MEW Agent ${index + 1}`,
    playerTypeId: 'mew-agent',
    position: spawnPosition(index, 2),
    isAgent: true,
  });

  const patrol = new SimplePatrolAgent(agent.id, [
    { x: index * 2, y: 2 },
    { x: index * 2 + 1, y: 3 },
    { x: index * 2, y: 4 },
    { x: index * 2 - 1, y: 3 },
  ]);
  world.attachAgentController(patrol);
}

const auroraSkiff = world.spawnShip({
  id: 'aurora-skiff',
  displayName: 'Aurora Skiff',
  position: { x: 0, y: -2 },
  maxSpeedTilesPerSecond: 2,
});

world.setShipVelocity(auroraSkiff.id, { x: 0.5, y: 0 });

let initialized = false;
const notificationQueue: Array<{ method: string; params: unknown }> = [];

const serializeVector = (vector: Vector2 | undefined | null): Vector2 | null => {
  if (!vector) {
    return null;
  }
  return { x: vector.x, y: vector.y };
};

const serializePlayer = (player: PlayerState) => ({
  id: player.id,
  displayName: player.displayName,
  isAgent: player.isAgent,
  position: serializeVector(player.position),
  velocity: serializeVector(player.velocity),
  playerType: {
    id: player.type.id,
    displayName: player.type.displayName,
    maxSpeedTilesPerSecond: player.type.maxSpeedTilesPerSecond,
    spriteKey: player.type.spriteKey,
    abilities: [...player.type.abilities],
  },
  boardedShipId: player.boardedShipId ?? null,
  relativePosition: serializeVector(player.relativePosition),
});

const serializeShip = (ship: ShipState) => ({
  id: ship.id,
  displayName: ship.displayName,
  position: serializeVector(ship.position),
  velocity: serializeVector(ship.velocity),
  maxSpeedTilesPerSecond: ship.maxSpeedTilesPerSecond,
  boardedPlayers: Object.fromEntries(
    Object.entries(ship.boardedPlayers).map(([playerId, relative]) => [playerId, serializeVector(relative)]),
  ),
});

const currentSnapshot = () => {
  const snapshot = world.snapshot();
  return {
    players: snapshot.players.map(serializePlayer),
    ships: snapshot.ships.map(serializeShip),
    timestamp: new Date().toISOString(),
  };
};

const sendMessage = (message: unknown) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const queueOrSendNotification = (method: string, params: unknown) => {
  if (!initialized) {
    notificationQueue.push({ method, params });
    return;
  }
  sendMessage({ method, params });
};

world.on('player-joined', ({ player }) => {
  queueOrSendNotification('isometric/player-joined', {
    player: serializePlayer(player),
  });
});

world.on('player-moved', ({ player }) => {
  queueOrSendNotification('isometric/player-moved', {
    player: serializePlayer(player),
  });
});

world.on('player-left', ({ playerId }) => {
  queueOrSendNotification('isometric/player-left', { playerId });
});

world.on('ship-moved', ({ ship }) => {
  queueOrSendNotification('isometric/ship-moved', {
    ship: serializeShip(ship),
  });
});

world.on('ship-updated', ({ ship }) => {
  queueOrSendNotification('isometric/ship-updated', {
    ship: serializeShip(ship),
  });
});

let lastTick = Date.now();
const tickTimer = setInterval(() => {
  const now = Date.now();
  const delta = now - lastTick;
  lastTick = now;
  world.tick(delta);
}, TICK_INTERVAL_MS);

const sendResponse = (id: number | string, result: unknown) => {
  sendMessage({
    jsonrpc: '2.0',
    id,
    result,
  });
};

const sendError = (id: number | string, code: number, message: string) => {
  sendMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  });
};

const parseVector = (valueX: unknown, valueY: unknown): Vector2 | null => {
  if (typeof valueX !== 'number' || Number.isNaN(valueX) || typeof valueY !== 'number' || Number.isNaN(valueY)) {
    return null;
  }
  return { x: valueX, y: valueY };
};

const handleToolsCall = (request: MCPRequest): ToolResult => {
  const toolName = typeof request.params?.name === 'string' ? request.params.name : undefined;
  if (!toolName) {
    throw { code: -32602, message: 'tools/call requires a tool name' };
  }

  const args = request.params?.arguments ?? {};

  switch (toolName) {
    case 'get_world_state': {
      return {
        content: [
          {
            type: 'text',
            text: 'Streaming the latest isometric world snapshot.',
          },
        ],
        data: currentSnapshot(),
      };
    }
    case 'request_player_movement': {
      const playerId = typeof args.playerId === 'string' ? args.playerId : undefined;
      const vector = parseVector(args.x, args.y);

      if (!playerId || !vector) {
        throw { code: -32602, message: 'request_player_movement requires playerId, x, and y numbers' };
      }

      world.requestMovement({ id: playerId, target: vector });
      return {
        content: [
          {
            type: 'text',
            text: `Queued ${playerId} to walk toward (${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}).`,
          },
        ],
        data: {
          playerId,
          target: vector,
        },
      };
    }
    case 'set_ship_heading': {
      const shipId = typeof args.shipId === 'string' ? args.shipId : undefined;
      const vector = parseVector(args.headingX, args.headingY);
      if (!shipId || !vector) {
        throw { code: -32602, message: 'set_ship_heading requires shipId, headingX, and headingY numbers' };
      }

      const ship = world.getShip(shipId);
      if (!ship) {
        throw { code: -32602, message: `Unknown ship: ${shipId}` };
      }

      world.setShipVelocity(shipId, vector);
      return {
        content: [
          {
            type: 'text',
            text: `Adjusted ${ship.displayName} velocity toward (${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}).`,
          },
        ],
        data: {
          shipId,
          heading: serializeVector(world.getShip(shipId)?.velocity) ?? { x: 0, y: 0 },
        },
      };
    }
    case 'board_ship': {
      const playerId = typeof args.playerId === 'string' ? args.playerId : undefined;
      const shipId = typeof args.shipId === 'string' ? args.shipId : undefined;
      if (!playerId || !shipId) {
        throw { code: -32602, message: 'board_ship requires playerId and shipId' };
      }

      const deckVector = parseVector(args.deckX, args.deckY) ?? undefined;
      world.boardShip(playerId, shipId, deckVector ?? undefined);

      return {
        content: [
          {
            type: 'text',
            text: `Boarded ${playerId} onto ${shipId}${deckVector ? ` at (${deckVector.x.toFixed(2)}, ${deckVector.y.toFixed(2)})` : ''}.`,
          },
        ],
        data: {
          playerId,
          shipId,
          deckPosition: deckVector ?? null,
        },
      };
    }
    case 'disembark': {
      const playerId = typeof args.playerId === 'string' ? args.playerId : undefined;
      if (!playerId) {
        throw { code: -32602, message: 'disembark requires playerId' };
      }

      world.disembarkShip(playerId);
      return {
        content: [
          {
            type: 'text',
            text: `Disembarked ${playerId} from their current ship (if any).`,
          },
        ],
        data: {
          playerId,
        },
      };
    }
    default:
      throw { code: -32601, message: `Unknown tool: ${toolName}` };
  }
};

const handleRequest = (request: MCPRequest) => {
  const { id, method } = request;

  try {
    if (method === 'initialize') {
      initialized = true;
      const result = {
        protocolVersion: '0.1.0',
        serverInfo: {
          name: 'isometric-fleet',
          version: '0.1.0',
          description: 'Simulated isometric world with controllable ship and patrol agents.',
        },
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
      };
      sendResponse(id!, result);

      // Flush notifications gathered before initialization.
      while (notificationQueue.length > 0) {
        const message = notificationQueue.shift();
        if (message) {
          sendMessage(message);
        }
      }

      queueOrSendNotification('isometric/world-snapshot', currentSnapshot());
      return;
    }

    if (method === 'tools/list') {
      sendResponse(id!, { tools: TOOL_DEFINITIONS });
      return;
    }

    if (method === 'tools/call') {
      const result = handleToolsCall(request);
      sendResponse(id!, result);
      return;
    }

    if (method === 'shutdown') {
      sendResponse(id!, {});
      clearInterval(tickTimer);
      process.exit(0);
      return;
    }

    throw { code: -32601, message: `Unknown method: ${method}` };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'number'
    ) {
      sendError(id!, (error as { code: number }).code, (error as { message?: string }).message || 'Error');
    } else {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Internal error';
      sendError(id!, -32603, message);
    }
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let message: MCPRequest;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`Failed to parse MCP request: ${errMsg}\n`);
    return;
  }

  if (message.id !== undefined && message.method) {
    handleRequest(message);
  }
});

process.on('SIGINT', () => {
  clearInterval(tickTimer);
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearInterval(tickTimer);
  process.exit(0);
});
