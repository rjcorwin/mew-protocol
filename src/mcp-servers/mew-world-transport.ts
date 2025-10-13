#!/usr/bin/env node

import * as readline from 'readline';
import { EventEmitter } from 'events';
import { MEWClient } from '../client/MEWClient.js';
import type { ClientOptions } from '../client/MEWClient.js';
import type { Envelope } from '../types/index.js';

const POSITION_STREAM_DESCRIPTION = 'mew-world/positions';
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

export type TransportKind = 'ship' | 'plane';

export interface Vector3 {
  x: number;
  y: number;
  z?: number;
}

export interface TransportLifecycleConfig {
  id: string;
  kind: TransportKind;
  deck: {
    width: number;
    height: number;
  };
  boardingMargin?: number;
  initialPosition?: Vector3;
}

export interface TransportStateSnapshot {
  id: string;
  kind: TransportKind;
  position: Required<Vector3>;
  heading: number;
  speed: number;
  altitude: number;
}

export interface PassengerSnapshot {
  id: string;
  offset: Required<Vector3>;
  worldPosition: Required<Vector3>;
  boardedAt: number;
}

export type PlayerLifecycleEvent =
  | { status: 'boarded'; passenger: PassengerSnapshot }
  | { status: 'aboard'; passenger: PassengerSnapshot }
  | { status: 'disembarked'; passengerId: string; worldPosition: Required<Vector3> }
  | { status: 'ashore'; passengerId: string; worldPosition: Required<Vector3> };

interface PassengerState {
  id: string;
  offset: Required<Vector3>;
  boardedAt: number;
}

interface MovementFrame {
  participantId: string;
  timestamp: number;
  world: Required<Vector3>;
  tile: { x: number; y: number };
  velocity: { x: number; y: number };
  platformRef: string | null;
  platformKind: TransportKind | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normaliseHeading(degrees: number): number {
  const modulo = degrees % 360;
  return modulo < 0 ? modulo + 360 : modulo;
}

function ensureNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return value;
}

function encodeMovementFrame(frame: MovementFrame): string {
  const versionTag = '2';
  const fieldSeparator = '|';
  const vectorSeparator = ',';
  const nullSentinel = '~';

  const participantField = encodeURIComponent(frame.participantId);
  const timestampField = Math.round(frame.timestamp).toString(36);
  const encodeVector = (vector: { x: number; y: number }): string => {
    const formatScalar = (value: number): string => {
      if (!Number.isFinite(value)) {
        return '0';
      }
      const rounded = Math.round(value * 1000) / 1000;
      if (Number.isInteger(rounded)) {
        return rounded.toString();
      }
      return rounded
        .toFixed(3)
        .replace(/\.0+$/, '')
        .replace(/(\.\d*?)0+$/, '$1');
    };
    return `${formatScalar(vector.x)}${vectorSeparator}${formatScalar(vector.y)}`;
  };

  const platformField = frame.platformRef === null ? nullSentinel : encodeURIComponent(frame.platformRef);
  const kindField = frame.platformKind === null ? nullSentinel : encodeURIComponent(frame.platformKind);

  return [
    versionTag,
    participantField,
    timestampField,
    encodeVector({ x: frame.world.x, y: frame.world.y }),
    encodeVector(frame.tile),
    encodeVector(frame.velocity),
    platformField,
    kindField,
  ].join(fieldSeparator);
}

class TransportStreamPublisher extends EventEmitter {
  private pendingRequestId: string | null = null;
  private streamId: string | null = null;
  private awaitingStream: Promise<string> | null = null;
  private resolveStream: ((streamId: string) => void) | null = null;

  constructor(private client: MEWClient, private ownerId: string) {
    super();
    this.client.onMessage((envelope: Envelope) => this.handleEnvelope(envelope));
  }

  async ensureStream(): Promise<string> {
    if (this.streamId) {
      return this.streamId;
    }

    if (!this.awaitingStream) {
      const requestId = `${this.ownerId}-transport-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      this.pendingRequestId = requestId;
      this.client.send({
        id: requestId,
        kind: 'stream/request',
        to: ['gateway'],
        payload: {
          direction: 'bidirectional',
          description: POSITION_STREAM_DESCRIPTION,
        },
      });
      this.awaitingStream = new Promise<string>((resolve) => {
        this.resolveStream = resolve;
      });
    }

    return this.awaitingStream;
  }

  publish(frame: MovementFrame): void {
    if (!this.streamId) {
      return;
    }
    const payload = encodeMovementFrame(frame);
    this.client.sendStreamData(this.streamId, payload);
  }

  private handleEnvelope(envelope: Envelope): void {
    if (envelope.kind === 'stream/open') {
      const streamId = (envelope.payload as any)?.stream_id;
      const correlationIds = Array.isArray(envelope.correlation_id)
        ? envelope.correlation_id
        : envelope.correlation_id
        ? [envelope.correlation_id]
        : [];

      if (streamId && this.pendingRequestId && correlationIds.includes(this.pendingRequestId)) {
        this.streamId = streamId;
        this.pendingRequestId = null;
        if (this.resolveStream) {
          this.resolveStream(streamId);
          this.resolveStream = null;
          this.awaitingStream = null;
        }
      }
      return;
    }

    if (envelope.kind === 'stream/close') {
      const streamId = (envelope.payload as any)?.stream_id;
      if (streamId && streamId === this.streamId) {
        this.streamId = null;
        this.pendingRequestId = null;
        this.awaitingStream = null;
        this.resolveStream = null;
      }
    }
  }
}

export class TransportLifecycleManager {
  private readonly halfWidth: number;
  private readonly halfHeight: number;
  private readonly boardingMargin: number;
  private readonly passengers = new Map<string, PassengerState>();
  private position: Required<Vector3>;
  private headingDeg = 0;
  private speed = 0;
  private altitude = 0;

  constructor(private config: TransportLifecycleConfig) {
    this.halfWidth = config.deck.width / 2;
    this.halfHeight = config.deck.height / 2;
    this.boardingMargin = config.boardingMargin ?? 16;
    const initial = config.initialPosition ?? { x: 0, y: 0, z: 0 };
    this.position = {
      x: ensureNumber(initial.x, 0),
      y: ensureNumber(initial.y, 0),
      z: ensureNumber(initial.z, 0),
    };
    this.altitude = this.position.z;
  }

  setHeading(degrees: number): number {
    this.headingDeg = normaliseHeading(ensureNumber(degrees, 0));
    return this.headingDeg;
  }

  setSpeed(unitsPerSecond: number): number {
    const speed = ensureNumber(unitsPerSecond, 0);
    this.speed = speed < 0 ? 0 : speed;
    return this.speed;
  }

  setAltitude(altitude: number): number {
    if (this.config.kind !== 'plane') {
      return 0;
    }
    const value = ensureNumber(altitude, 0);
    this.altitude = value < 0 ? 0 : value;
    this.position.z = this.altitude;
    return this.altitude;
  }

  update(deltaMs: number): TransportStateSnapshot {
    const delta = Math.max(0, ensureNumber(deltaMs, 0));
    const deltaSeconds = delta / 1000;
    const headingRad = toRadians(this.headingDeg);
    const distance = this.speed * deltaSeconds;
    this.position.x += Math.cos(headingRad) * distance;
    this.position.y += Math.sin(headingRad) * distance;
    this.position.z = this.altitude;
    return this.getState();
  }

  getState(): TransportStateSnapshot {
    return {
      id: this.config.id,
      kind: this.config.kind,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      heading: this.headingDeg,
      speed: this.speed,
      altitude: this.altitude,
    };
  }

  getVelocity(): { x: number; y: number } {
    const headingRad = toRadians(this.headingDeg);
    return {
      x: Math.cos(headingRad) * this.speed,
      y: Math.sin(headingRad) * this.speed,
    };
  }

  getPassengers(): PassengerSnapshot[] {
    const state = this.getState();
    return Array.from(this.passengers.values()).map((passenger) => ({
      id: passenger.id,
      offset: passenger.offset,
      worldPosition: this.combine(state.position, passenger.offset),
      boardedAt: passenger.boardedAt,
    }));
  }

  getPassengerWorldPosition(passengerId: string): Required<Vector3> | null {
    const passenger = this.passengers.get(passengerId);
    if (!passenger) {
      return null;
    }
    return this.combine(this.getState().position, passenger.offset);
  }

  reportPlayerPosition(playerId: string, world: Vector3, timestamp = Date.now()): PlayerLifecycleEvent {
    const currentState = this.getState();
    const relative = {
      x: ensureNumber(world.x, currentState.position.x) - currentState.position.x,
      y: ensureNumber(world.y, currentState.position.y) - currentState.position.y,
      z: ensureNumber(world.z ?? currentState.position.z, currentState.position.z) - currentState.position.z,
    };

    const withinMargin =
      Math.abs(relative.x) <= this.halfWidth + this.boardingMargin &&
      Math.abs(relative.y) <= this.halfHeight + this.boardingMargin;

    const passenger = this.passengers.get(playerId);

    if (!passenger) {
      if (!withinMargin) {
        return {
          status: 'ashore',
          passengerId: playerId,
          worldPosition: this.normaliseWorld(world),
        };
      }

      const clampedOffset: Required<Vector3> = {
        x: clamp(relative.x, -this.halfWidth, this.halfWidth),
        y: clamp(relative.y, -this.halfHeight, this.halfHeight),
        z: 0,
      };
      const snapshot: PassengerSnapshot = {
        id: playerId,
        offset: clampedOffset,
        worldPosition: this.combine(currentState.position, clampedOffset),
        boardedAt: timestamp,
      };
      this.passengers.set(playerId, {
        id: playerId,
        offset: clampedOffset,
        boardedAt: timestamp,
      });
      return { status: 'boarded', passenger: snapshot };
    }

    const clamped: Required<Vector3> = {
      x: clamp(relative.x, -this.halfWidth, this.halfWidth),
      y: clamp(relative.y, -this.halfHeight, this.halfHeight),
      z: 0,
    };

    if (!withinMargin) {
      this.passengers.delete(playerId);
      return {
        status: 'disembarked',
        passengerId: playerId,
        worldPosition: this.normaliseWorld(world),
      };
    }

    passenger.offset = clamped;
    const snapshot: PassengerSnapshot = {
      id: passenger.id,
      offset: passenger.offset,
      worldPosition: this.combine(currentState.position, passenger.offset),
      boardedAt: passenger.boardedAt,
    };
    return { status: 'aboard', passenger: snapshot };
  }

  private combine(base: Required<Vector3>, offset: Required<Vector3>): Required<Vector3> {
    return {
      x: base.x + offset.x,
      y: base.y + offset.y,
      z: base.z + (offset.z ?? 0),
    };
  }

  private normaliseWorld(world: Vector3): Required<Vector3> {
    return {
      x: ensureNumber(world.x, 0),
      y: ensureNumber(world.y, 0),
      z: ensureNumber(world.z ?? 0, 0),
    };
  }
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

interface TransportServerOptions {
  id: string;
  kind: TransportKind;
  gateway?: string;
  space?: string;
  token?: string;
  deckWidth: number;
  deckHeight: number;
  boardingMargin: number;
  updateInterval: number;
}

class TransportServer {
  private lifecycle: TransportLifecycleManager;
  private toolDefinitions: ToolDefinition[];
  private client: MEWClient | null = null;
  private publisher: TransportStreamPublisher | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(private options: TransportServerOptions) {
    this.lifecycle = new TransportLifecycleManager({
      id: options.id,
      kind: options.kind,
      deck: {
        width: options.deckWidth,
        height: options.deckHeight,
      },
      boardingMargin: options.boardingMargin,
    });
    this.toolDefinitions = this.buildToolDefinitions(options.kind);
  }

  async start(): Promise<void> {
    if (this.options.gateway && this.options.space && this.options.token) {
      await this.connectToGateway();
    }

    this.updateTimer = setInterval(() => {
      const snapshot = this.lifecycle.update(this.options.updateInterval);
      if (this.publisher) {
        this.publisher.publish(this.createMovementFrame(snapshot));
      }
    }, this.options.updateInterval);
  }

  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  describe(): { kind: TransportKind; id: string } {
    return { kind: this.options.kind, id: this.options.id };
  }

  listTools(): { tools: ToolDefinition[] } {
    return { tools: this.toolDefinitions };
  }

  callTool(name: string, args: Record<string, unknown> | undefined): unknown {
    switch (name) {
      case 'set_sail_direction':
        return this.wrapHeadingResponse(this.lifecycle.setHeading(ensureNumber(args?.degrees, 0)));
      case 'set_sail_speed':
        return this.wrapSpeedResponse(this.lifecycle.setSpeed(ensureNumber(args?.speed, 0)));
      case 'get_ship_position':
        return this.lifecycle.getState();
      case 'get_passengers':
        return { passengers: this.lifecycle.getPassengers() };
      case 'report_player_position':
        return this.handleReport(args);
      case 'set_flight_heading':
        return this.wrapHeadingResponse(this.lifecycle.setHeading(ensureNumber(args?.degrees, 0)));
      case 'set_flight_speed':
        return this.wrapSpeedResponse(this.lifecycle.setSpeed(ensureNumber(args?.speed, 0)));
      case 'set_altitude':
        return { altitude: this.lifecycle.setAltitude(ensureNumber(args?.altitude, 0)) };
      case 'get_plane_position':
        return this.lifecycle.getState();
      default:
        throw { code: -32601, message: `Unknown tool: ${name}` };
    }
  }

  private wrapHeadingResponse(heading: number): { heading: number } {
    return { heading };
  }

  private wrapSpeedResponse(speed: number): { speed: number } {
    return { speed };
  }

  private handleReport(args: Record<string, unknown> | undefined): { event: PlayerLifecycleEvent } {
    const playerId = typeof args?.player_id === 'string' ? args.player_id : undefined;
    const world = args?.world as Vector3 | undefined;
    const timestamp = ensureNumber(args?.timestamp, Date.now());

    if (!playerId || !world) {
      throw { code: -32602, message: 'report_player_position requires player_id and world payload' };
    }

    const event = this.lifecycle.reportPlayerPosition(playerId, world, timestamp);
    return { event };
  }

  private async connectToGateway(): Promise<void> {
    const options: ClientOptions = {
      gateway: this.options.gateway!,
      space: this.options.space!,
      token: this.options.token!,
      participant_id: this.options.id,
      reconnect: false,
    };
    this.client = new MEWClient(options);
    await this.client.connect();
    await waitForWelcome(this.client);
    this.publisher = new TransportStreamPublisher(this.client, this.options.id);
    await this.publisher.ensureStream();
  }

  private createMovementFrame(snapshot: TransportStateSnapshot): MovementFrame {
    return {
      participantId: snapshot.id,
      timestamp: Date.now(),
      world: snapshot.position,
      tile: {
        x: Math.floor(snapshot.position.x / TILE_WIDTH),
        y: Math.floor(snapshot.position.y / TILE_HEIGHT),
      },
      velocity: this.lifecycle.getVelocity(),
      platformRef: snapshot.id,
      platformKind: snapshot.kind,
    };
  }

  private buildToolDefinitions(kind: TransportKind): ToolDefinition[] {
    const shared: ToolDefinition[] = [
      {
        name: 'get_passengers',
        description: 'List passengers currently aboard the transport',
        outputSchema: {
          type: 'object',
          properties: {
            passengers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  offset: {
                    type: 'object',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                      z: { type: 'number' },
                    },
                  },
                  worldPosition: {
                    type: 'object',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                      z: { type: 'number' },
                    },
                  },
                  boardedAt: { type: 'number' },
                },
              },
            },
          },
        },
      },
      {
        name: 'report_player_position',
        description: 'Update the transport lifecycle with a nearby player position',
        inputSchema: {
          type: 'object',
          required: ['player_id', 'world'],
          properties: {
            player_id: { type: 'string' },
            world: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' },
              },
            },
            timestamp: { type: 'number' },
          },
        },
      },
    ];

    if (kind === 'ship') {
      return [
        {
          name: 'set_sail_direction',
          description: 'Set the ship heading in degrees (0° = east)',
          inputSchema: {
            type: 'object',
            required: ['degrees'],
            properties: {
              degrees: { type: 'number' },
            },
          },
        },
        {
          name: 'set_sail_speed',
          description: 'Set the ship speed in pixels per second',
          inputSchema: {
            type: 'object',
            required: ['speed'],
            properties: {
              speed: { type: 'number' },
            },
          },
        },
        {
          name: 'get_ship_position',
          description: 'Return the latest ship position, heading, and speed',
        },
        ...shared,
      ];
    }

    return [
      {
        name: 'set_flight_heading',
        description: 'Set the plane heading in degrees (0° = east)',
        inputSchema: {
          type: 'object',
          required: ['degrees'],
          properties: {
            degrees: { type: 'number' },
          },
        },
      },
      {
        name: 'set_flight_speed',
        description: 'Set the plane speed in pixels per second',
        inputSchema: {
          type: 'object',
          required: ['speed'],
          properties: {
            speed: { type: 'number' },
          },
        },
      },
      {
        name: 'set_altitude',
        description: 'Adjust the plane altitude in pixels above sea level',
        inputSchema: {
          type: 'object',
          required: ['altitude'],
          properties: {
            altitude: { type: 'number' },
          },
        },
      },
      {
        name: 'get_plane_position',
        description: 'Return the latest plane position, heading, speed, and altitude',
      },
      ...shared,
    ];
  }
}

function waitForWelcome(client: MEWClient): Promise<void> {
  return new Promise((resolve, reject) => {
    const onWelcome = () => {
      client.off('error', onError);
      resolve();
    };
    const onError = (error: Error) => {
      client.off('welcome', onWelcome);
      reject(error);
    };
    client.once('welcome', onWelcome);
    client.on('error', onError);
  });
}

interface ParsedArgs {
  [key: string]: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

function createServerFromArgs(argv: string[]): TransportServer {
  const args = parseArgs(argv);
  const kind = (args.kind as TransportKind | undefined) ?? 'ship';
  const defaultId = kind === 'plane' ? 'plane1' : 'ship1';
  const server = new TransportServer({
    id: args.id ?? defaultId,
    kind,
    gateway: args.gateway,
    space: args.space,
    token: args.token,
    deckWidth: args.deckWidth ? Number(args.deckWidth) : kind === 'plane' ? 160 : 224,
    deckHeight: args.deckHeight ? Number(args.deckHeight) : kind === 'plane' ? 64 : 96,
    boardingMargin: args.margin ? Number(args.margin) : kind === 'plane' ? 16 : 24,
    updateInterval: args.interval ? Number(args.interval) : 100,
  });
  return server;
}

function sendResponse(id: number | string, result: unknown): void {
  const message = {
    jsonrpc: '2.0',
    id,
    result,
  };
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendError(id: number | string, code: number, message: string): void {
  const error = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };
  process.stdout.write(JSON.stringify(error) + '\n');
}

async function bootstrap(): Promise<void> {
  const server = createServerFromArgs(process.argv.slice(2));
  await server.start();

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

    let message: any;
    try {
      message = JSON.parse(trimmed);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      process.stderr.write(`Failed to parse MCP request: ${errMsg}\n`);
      return;
    }

    const { id, method } = message;

    try {
      if (method === 'initialize') {
        const info = server.describe();
        const result = {
          protocolVersion: '0.1.0',
          serverInfo: {
            name: `${info.kind}-transport`,
            version: '0.1.0',
            description: `MEW World ${info.kind} transport MCP server`,
          },
          capabilities: {
            tools: {
              listChanged: true,
            },
          },
        };
        sendResponse(id, result);
        return;
      }

      if (method === 'tools/list') {
        sendResponse(id, server.listTools());
        return;
      }

      if (method === 'tools/call') {
        const toolName = message.params?.name;
        if (!toolName || typeof toolName !== 'string') {
          throw { code: -32602, message: 'tools/call requires a tool name' };
        }
        const result = server.callTool(toolName, message.params?.arguments);
        sendResponse(id, result ?? {});
        return;
      }

      if (method === 'shutdown') {
        server.stop();
        sendResponse(id, {});
        process.exit(0);
        return;
      }

      throw { code: -32601, message: `Unknown method: ${method}` };
    } catch (error: any) {
      const code = typeof error?.code === 'number' ? error.code : -32603;
      const messageText = typeof error?.message === 'string' ? error.message : 'Internal error';
      sendError(id, code, messageText);
    }
  });

  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`Transport server failed to start: ${message}\n`);
    process.exit(1);
  });
}

