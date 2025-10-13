import { MEWClient } from '@mew-protocol/mew/client';
import type { ClientOptions } from '@mew-protocol/mew/client';
import { PositionStreamManager } from '../network/PositionStreamManager.js';
import { encodeMovementFrame } from '../network/movement-stream.js';
import { PositionUpdate } from '../types.js';

export interface HeadlessSimulationOptions {
  gateway: string;
  space: string;
  participantId: string;
  token: string;
  durationMs?: number;
  intervalMs?: number;
  radius?: number;
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

export async function runHeadlessSimulation(options: HeadlessSimulationOptions): Promise<void> {
  const clientOptions: ClientOptions = {
    gateway: options.gateway,
    space: options.space,
    token: options.token,
    participant_id: options.participantId,
    reconnect: false,
  };

  const client = new MEWClient(clientOptions);
  await client.connect();
  await waitForWelcome(client);

  const streamManager = new PositionStreamManager(client, options.participantId);
  const streamId = await streamManager.ensureLocalStream();

  console.log(`Headless simulation joined ${options.space} as ${options.participantId}`);
  console.log(`Position stream established: ${streamId}`);

  client.onStreamData((frame) => {
    const update = streamManager.parseFrame(frame);
    if (!update || update.participantId === options.participantId) {
      return;
    }

    console.log(
      `[remote:${update.participantId}] world=(${update.worldCoords.x.toFixed(1)}, ${update.worldCoords.y.toFixed(1)}) tiles=(${update.tileCoords.x}, ${update.tileCoords.y})`,
    );
  });

  const intervalMs = options.intervalMs ?? 100;
  const durationMs = options.durationMs ?? 5000;
  const radius = options.radius ?? 120;
  const origin = { x: 400, y: 300 };
  const startTime = Date.now();

  const interval = setInterval(() => {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const angle = elapsedSeconds * Math.PI * 0.5;
    const worldX = origin.x + Math.cos(angle) * radius;
    const worldY = origin.y + Math.sin(angle) * radius;

    const update: PositionUpdate = {
      participantId: options.participantId,
      worldCoords: { x: worldX, y: worldY },
      tileCoords: {
        x: Math.floor(worldX / 64),
        y: Math.floor(worldY / 32),
      },
      velocity: {
        x: Math.cos(angle) * radius * (Math.PI * 0.5),
        y: Math.sin(angle) * radius * (Math.PI * 0.5),
      },
      timestamp: Date.now(),
      platformRef: null,
    };

    const payload = encodeMovementFrame({
      participantId: update.participantId,
      timestamp: update.timestamp,
      world: update.worldCoords,
      tile: update.tileCoords,
      velocity: update.velocity,
      platformRef: update.platformRef,
    });

    client.sendStreamData(streamId, payload);
  }, intervalMs);

  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
  clearInterval(interval);

  console.log('Headless simulation complete. Disconnecting...');
  client.disconnect();
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

function printUsage(): void {
  console.log(`Usage: node dist/headless/headless-simulation.js \
  --gateway ws://localhost:8080 \
  --space mew-world \
  --participant player1 \
  --token <token> [--duration 5000] [--interval 100] [--radius 120]`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));

  const gateway = args.gateway;
  const space = args.space;
  const participant = args.participant;
  const token = args.token;

  if (!gateway || !space || !participant || !token) {
    printUsage();
    process.exit(1);
  }

  const duration = args.duration ? Number.parseInt(args.duration, 10) : undefined;
  const interval = args.interval ? Number.parseInt(args.interval, 10) : undefined;
  const radius = args.radius ? Number.parseInt(args.radius, 10) : undefined;

  runHeadlessSimulation({
    gateway,
    space,
    participantId: participant,
    token,
    durationMs: duration,
    intervalMs: interval,
    radius,
  }).catch((error) => {
    console.error('Headless simulation failed:', error);
    process.exit(1);
  });
}
