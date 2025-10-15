#!/usr/bin/env node

/**
 * Ship Server for MEW World
 *
 * Represents a ship entity with interactive control points.
 * Players can grab the steering wheel or sail ropes to control the ship.
 *
 * Note: This is NOT an MCP server - it's a ship state manager.
 * Control messages come via MEW protocol, not MCP stdio.
 */

import {
  ShipState,
  ShipConfig,
  ShipHeading,
  SpeedLevel,
  Position,
  Velocity,
} from './types.js';

/**
 * Calculate velocity vector from heading and speed
 */
function calculateVelocity(heading: ShipHeading, speed: number): Velocity {
  const angles: Record<ShipHeading, number> = {
    east: 0,
    southeast: Math.PI / 4,
    south: Math.PI / 2,
    southwest: (3 * Math.PI) / 4,
    west: Math.PI,
    northwest: (5 * Math.PI) / 4,
    north: (3 * Math.PI) / 2,
    northeast: (7 * Math.PI) / 4,
  };

  const angle = angles[heading];
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };
}

export class ShipServer {
  private state: ShipState;
  private config: ShipConfig;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(config: ShipConfig) {
    this.config = config;

    // Initialize ship state
    this.state = {
      participantId: config.participantId,
      position: { ...config.initialPosition },
      heading: config.initialHeading,
      speedLevel: 0, // Start stopped
      velocity: { x: 0, y: 0 },
      passengers: [],
      controlPoints: {
        wheel: {
          type: 'wheel',
          relativePosition: { ...config.wheelPosition },
          controlledBy: null,
        },
        sails: {
          type: 'sails',
          relativePosition: { ...config.sailsPosition },
          controlledBy: null,
        },
      },
      deckBoundary: {
        width: config.deckWidth,
        height: config.deckHeight,
      },
    };
  }

  private setHeading(heading: ShipHeading) {
    this.state.heading = heading;
    this.updateVelocity();
    this.logState('Heading changed');
  }

  private setSpeed(speedLevel: SpeedLevel) {
    this.state.speedLevel = speedLevel;
    this.updateVelocity();
    this.logState('Speed changed');
  }

  private updateVelocity() {
    const speed = this.config.speedValues[this.state.speedLevel];
    this.state.velocity = calculateVelocity(this.state.heading, speed);
  }

  private grabControl(participantId: string, controlPoint: 'wheel' | 'sails') {
    const control = this.state.controlPoints[controlPoint];
    if (control.controlledBy) {
      console.error(`${controlPoint} already controlled by ${control.controlledBy}`);
      return;
    }
    control.controlledBy = participantId;
    console.log(`${participantId} grabbed ${controlPoint}`);
  }

  private releaseControl(participantId: string) {
    // Release any control point this player is holding
    for (const controlPoint of Object.values(this.state.controlPoints)) {
      if (controlPoint.controlledBy === participantId) {
        console.log(`${participantId} released ${controlPoint.type}`);
        controlPoint.controlledBy = null;
      }
    }
  }

  private updatePhysics(deltaTime: number) {
    // Update position based on velocity
    if (this.state.speedLevel > 0) {
      this.state.position.x += this.state.velocity.x * deltaTime;
      this.state.position.y += this.state.velocity.y * deltaTime;
    }
  }

  private logState(context: string) {
    console.log(`[Ship ${this.config.participantId}] ${context}:`);
    console.log(`  Position: (${this.state.position.x.toFixed(1)}, ${this.state.position.y.toFixed(1)})`);
    console.log(`  Heading: ${this.state.heading}`);
    console.log(`  Speed: ${this.state.speedLevel} (${this.config.speedValues[this.state.speedLevel]} px/s)`);
    console.log(`  Velocity: (${this.state.velocity.x.toFixed(1)}, ${this.state.velocity.y.toFixed(1)})`);
  }

  /**
   * Start physics update loop
   */
  startPhysics(tickRate: number = 60) {
    const deltaTime = 1 / tickRate; // Time per frame in seconds

    this.updateInterval = setInterval(() => {
      this.updatePhysics(deltaTime);
    }, (1000 / tickRate));

    console.log(`Ship physics started at ${tickRate} Hz`);
  }

  /**
   * Stop physics update loop
   */
  stopPhysics() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Ship physics stopped');
    }
  }

  /**
   * Initialize ship (called on startup)
   */
  start() {
    console.log(`Ship server started: ${this.config.participantId}`);
    this.logState('Initial state');
  }

  /**
   * Get current ship state
   */
  getState(): ShipState {
    return { ...this.state };
  }

  /**
   * Public methods for control (called via MEW protocol messages)
   */

  public grabControlPublic(participantId: string, controlPoint: 'wheel' | 'sails') {
    this.grabControl(participantId, controlPoint);
  }

  public releaseControlPublic(participantId: string) {
    this.releaseControl(participantId);
  }

  public steer(playerId: string, direction: 'left' | 'right') {
    // Verify player controls the wheel
    if (this.state.controlPoints.wheel.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot steer - not controlling wheel`);
      return;
    }

    // Rotate heading by one step (8 directions, circular)
    const headings: ShipHeading[] = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ];

    const currentIndex = headings.indexOf(this.state.heading);
    const delta = direction === 'left' ? -1 : 1;
    const newIndex = (currentIndex + delta + headings.length) % headings.length;

    this.setHeading(headings[newIndex]);
  }

  public adjustSails(playerId: string, adjustment: 'up' | 'down') {
    // Verify player controls the sails
    if (this.state.controlPoints.sails.controlledBy !== playerId) {
      console.error(`Player ${playerId} cannot adjust sails - not controlling sails`);
      return;
    }

    // Adjust speed level (clamped 0-3)
    const delta = adjustment === 'up' ? 1 : -1;
    const newSpeed = Math.max(0, Math.min(3, this.state.speedLevel + delta)) as SpeedLevel;

    this.setSpeed(newSpeed);
  }
}
