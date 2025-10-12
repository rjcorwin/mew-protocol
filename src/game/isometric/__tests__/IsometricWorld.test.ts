import { describe, expect, it } from 'vitest';

import {
  IsometricWorld,
  SimplePatrolAgent,
  buildFourByFourCrew,
  createDefaultWorld,
  createDemoShip,
} from '../IsometricWorld.js';

const advanceWorld = (world: IsometricWorld, iterations: number, deltaMs: number) => {
  for (let i = 0; i < iterations; i += 1) {
    world.tick(deltaMs);
  }
};

describe('IsometricWorld', () => {
  it('spawns players and emits events on join and movement', () => {
    const world = createDefaultWorld();
    const joined: string[] = [];
    const moved: string[] = [];

    world.on('player-joined', ({ player }) => joined.push(player.id));
    world.on('player-moved', ({ player }) => moved.push(player.id));

    const player = world.spawnPlayer({
      displayName: 'Tester',
      playerTypeId: 'human',
    });

    expect(joined).toContain(player.id);

    world.requestMovement({ id: player.id, target: { x: 3, y: 0 } });
    advanceWorld(world, 10, 100);

    expect(moved).toContain(player.id);
    const snapshot = world.snapshot();
    const savedPlayer = snapshot.players.find((item) => item.id === player.id);
    expect(savedPlayer?.position.x ?? 0).toBeGreaterThan(0);
  });

  it('attaches patrol agents that walk their paths respecting speed', () => {
    const world = createDefaultWorld();
    const player = world.spawnPlayer({
      displayName: 'Agent',
      playerTypeId: 'mew-agent',
      isAgent: true,
    });

    const agent = new SimplePatrolAgent(player.id, [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);

    world.attachAgentController(agent);

    advanceWorld(world, 20, 100);

    const snapshot = world.snapshot();
    const savedPlayer = snapshot.players.find((item) => item.id === player.id);
    expect(savedPlayer?.position.x).toBeGreaterThan(0);
    const maxDistancePerSecond = player.type.maxSpeedTilesPerSecond * 2;
    expect(Math.abs(savedPlayer?.velocity.x ?? 0)).toBeLessThanOrEqual(maxDistancePerSecond);
  });

  it('keeps boarded players in sync with ships', () => {
    const world = createDefaultWorld();
    const { humans } = buildFourByFourCrew(world);
    const ship = createDemoShip(world, 'Test Vessel');

    const passenger = humans[0];
    world.boardShip(passenger.id, ship.id, { x: 0, y: 0 });

    advanceWorld(world, 30, 100);

    const snapshot = world.snapshot();
    const savedShip = snapshot.ships.find((item) => item.id === ship.id);
    expect(savedShip?.position.x ?? 0).toBeGreaterThan(0);

    const savedPassenger = snapshot.players.find((item) => item.id === passenger.id);
    expect(savedPassenger?.position.x ?? 0).toBeGreaterThan(0);
    expect(savedPassenger?.boardedShipId).toBe(ship.id);
  });

  it('builds a four by four crew with deterministic identifiers', () => {
    const world = createDefaultWorld();
    const { humans, agents } = buildFourByFourCrew(world);

    expect(humans).toHaveLength(4);
    expect(agents).toHaveLength(4);

    const snapshot = world.snapshot();
    expect(snapshot.players).toHaveLength(8);
  });
});
