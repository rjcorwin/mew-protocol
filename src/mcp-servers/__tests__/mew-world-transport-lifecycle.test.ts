import { describe, expect, it } from 'vitest';
import { TransportLifecycleManager, TransportLifecycleConfig, TransportKind } from '../mew-world-transport.js';

function createManager(kind: TransportKind, overrides: Partial<TransportLifecycleConfig> = {}) {
  const config: TransportLifecycleConfig = {
    id: kind === 'plane' ? 'plane1' : 'ship1',
    kind,
    deck: { width: overrides.deck?.width ?? 200, height: overrides.deck?.height ?? 80 },
    boardingMargin: overrides.boardingMargin ?? 20,
    initialPosition: overrides.initialPosition ?? { x: 0, y: 0, z: 0 },
  };
  return new TransportLifecycleManager(config);
}

describe('TransportLifecycleManager - ship', () => {
  it('boards, carries, and disembarks passengers while sailing', () => {
    const manager = createManager('ship');
    manager.setHeading(90);
    manager.setSpeed(50);

    const boardEvent = manager.reportPlayerPosition('player1', { x: 10, y: 0 });
    expect(boardEvent.status).toBe('boarded');
    expect(boardEvent.passenger?.offset).toMatchObject({ x: 10, y: 0, z: 0 });

    manager.update(1000); // 1 second at 50 px/sec northbound -> y + 50

    const carried = manager.getPassengerWorldPosition('player1');
    expect(carried).not.toBeNull();
    const carriedPosition = carried!;
    expect(carriedPosition.x).toBeCloseTo(10, 5);
    expect(carriedPosition).toMatchObject({ y: 50, z: 0 });

    const disembarkEvent = manager.reportPlayerPosition('player1', {
      x: manager.getState().position.x + 200,
      y: manager.getState().position.y,
    });
    expect(disembarkEvent.status).toBe('disembarked');
    expect(manager.getPassengerWorldPosition('player1')).toBeNull();
  });
});

describe('TransportLifecycleManager - plane', () => {
  it('tracks altitude and keeps passengers attached during flight', () => {
    const manager = createManager('plane', {
      deck: { width: 160, height: 60 },
      boardingMargin: 12,
    });

    manager.setHeading(0);
    manager.setSpeed(120);
    manager.setAltitude(200);

    const boardEvent = manager.reportPlayerPosition('player2', { x: 0, y: 0, z: 0 });
    expect(boardEvent.status).toBe('boarded');

    manager.update(500); // half-second forward
    manager.setAltitude(400);

    const state = manager.getState();
    expect(state.altitude).toBe(400);
    expect(state.position).toMatchObject({ x: 60, y: 0, z: 400 });

    const passengerPosition = manager.getPassengerWorldPosition('player2');
    expect(passengerPosition).not.toBeNull();
    expect(passengerPosition).toMatchObject({ x: 60, y: 0, z: 400 });

    const disembarkEvent = manager.reportPlayerPosition('player2', {
      x: state.position.x + 200,
      y: state.position.y + 200,
      z: 400,
    });
    expect(disembarkEvent.status).toBe('disembarked');
    expect(manager.getPassengerWorldPosition('player2')).toBeNull();
  });
});

describe('TransportLifecycleManager - ashore detection', () => {
  it('leaves players ashore when they never enter the boarding radius', () => {
    const manager = createManager('ship');
    const result = manager.reportPlayerPosition('spectator', { x: 500, y: 500 });
    expect(result.status).toBe('ashore');
    expect(manager.getPassengers()).toHaveLength(0);
  });
});
