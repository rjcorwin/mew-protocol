#!/usr/bin/env node

/**
 * Ship MCP Server Entry Point
 *
 * Starts a ship server with configuration from environment variables or defaults.
 * Also connects ship to MEW space and broadcasts position updates.
 */

import { ShipServer } from './ShipServer.js';
import { ShipParticipant } from './ShipParticipant.js';
import { MEWClient } from '../../client/MEWClient.js';
import { ShipConfig } from './types.js';
import fs from 'fs';
import path from 'path';

// Parse configuration from environment or use defaults
const participantId = process.env.SHIP_ID || 'ship1';
const spaceName = process.env.SPACE_NAME || 'mew-world';
const gatewayUrl = process.env.GATEWAY_URL || 'ws://localhost:8080';

// Read token from file
const tokenPath = process.env.TOKEN_PATH || `.mew/tokens/${participantId}.token`;
let token: string;

try {
  token = fs.readFileSync(tokenPath, 'utf-8').trim();
} catch (error) {
  console.error(`Failed to read token from ${tokenPath}`);
  console.error('Set TOKEN_PATH environment variable or create token file');
  process.exit(1);
}

const shipConfig: ShipConfig = {
  participantId,
  initialPosition: {
    x: parseFloat(process.env.SHIP_START_X || '0'),
    y: parseFloat(process.env.SHIP_START_Y || '640'), // Moved up ~10 tiles (160 pixels)
  },
  initialHeading: (process.env.SHIP_START_HEADING || 'south') as any,
  wheelPosition: {
    x: -54, // Stern (back) - ship local coordinates, negative X when facing east
    y: 0, // Centered on ship's beam
  },
  sailsPosition: {
    x: 44, // Bow (front) - ship local coordinates, positive X when facing east
    y: 0, // Centered on ship's beam
  },
  cannonPositions: {
    port: [
      { x: -10, y: -24 }, // Mid-ship port cannon
      { x: 20, y: -24 },  // Forward port cannon
    ],
    starboard: [
      { x: -10, y: 24 },  // Mid-ship starboard cannon
      { x: 20, y: 24 },   // Forward starboard cannon
    ],
  },
  deckLength: 128, // Ship length (bow to stern) - extends along ship's local X-axis
  deckBeam: 48, // Ship beam (port to starboard) - extends along ship's local Y-axis
  speedValues: {
    0: 0, // Stopped
    1: 25, // Slow (pixels per second)
    2: 50, // Medium
    3: 75, // Fast
  },
  maxHealth: 100,
  cannonCooldownMs: 4000, // 4 seconds
};

// Create ship server
const server = new ShipServer(shipConfig);

// Create MEW client
const client = new MEWClient({
  participant_id: participantId,
  gateway: gatewayUrl,
  space: spaceName,
  token: token,
});

// Create ship participant (integrates MCP server with MEW protocol)
const participant = new ShipParticipant(client, server, {
  gatewayUrl,
  spaceName,
  participantId,
  token,
  updateRate: 10, // 10 position updates per second
});

// Start everything
async function start() {
  try {
    // Initialize ship
    server.start();

    // Start physics loop
    server.startPhysics(60);

    // Connect to MEW space
    await participant.connect();

    // Start broadcasting position
    participant.startBroadcasting();

    console.log('Ship is ready!');
  } catch (error) {
    console.error('Failed to start ship:', error);
    process.exit(1);
  }
}

// Handle shutdown
async function shutdown() {
  console.log('\nShutting down ship...');
  participant.stopBroadcasting();
  server.stopPhysics();
  await participant.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the ship
start();
