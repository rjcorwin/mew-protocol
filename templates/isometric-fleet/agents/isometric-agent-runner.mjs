#!/usr/bin/env node

import process from 'process';
import { MobileMEWAgent } from '@mew-protocol/mew/agent';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    gateway: process.env.MEW_GATEWAY || 'ws://localhost:8080',
    space: process.env.MEW_SPACE || 'isometric-fleet',
    token: process.env.MEW_TOKEN || 'agent-token',
    id: process.env.MEW_PARTICIPANT_ID || 'mew-agent',
    name: process.env.AGENT_NAME,
    playerType: process.env.AGENT_PLAYER_TYPE || 'mew-agent',
    speed: process.env.AGENT_SPEED ? Number(process.env.AGENT_SPEED) : 1.6,
    stayOnGround: process.env.AGENT_STAY_ON_GROUND === 'true'
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
      case '--id':
      case '-i':
        options.id = args[++i];
        break;
      case '--name':
        options.name = args[++i];
        break;
      case '--player-type':
        options.playerType = args[++i];
        break;
      case '--speed':
        options.speed = Number(args[++i]);
        break;
      case '--stay-on-ground':
        options.stayOnGround = true;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(options.speed) || options.speed <= 0.1) {
    options.speed = 1.6;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  const agent = new MobileMEWAgent({
    gateway: options.gateway,
    space: options.space,
    token: options.token,
    participant_id: options.id,
    name: options.name || options.id,
    autoRespond: false,
    mockLLM: true,
    movement: {
      displayName: options.name || options.id,
      playerType: options.playerType,
      speedTilesPerSecond: options.speed,
      stayOnGround: options.stayOnGround
    }
  });

  await agent.start();

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start mobile MEW agent:', error);
  process.exit(1);
});
