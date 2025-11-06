import { MEWClient } from '@mew-protocol/mew/client';
import { ConnectionConfig } from './types.js';
import { GameScene } from './game/GameScene.js';
import Phaser from 'phaser';

let client: MEWClient | null = null;
let game: Phaser.Game | null = null;

// Get DOM elements
const connectionScreen = document.getElementById('connection-screen') as HTMLDivElement;
const connectionForm = document.getElementById('connection-form') as HTMLFormElement;
const gameContainer = document.getElementById('game-container') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Handle form submission
connectionForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const config: ConnectionConfig = {
    gatewayUrl: (document.getElementById('gateway-url') as HTMLInputElement).value,
    spaceName: (document.getElementById('space-name') as HTMLInputElement).value,
    username: (document.getElementById('username') as HTMLInputElement).value,
    token: (document.getElementById('token') as HTMLInputElement).value,
  };

  try {
    await connectToSpace(config);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Connection failed');
  }
});

async function connectToSpace(config: ConnectionConfig) {
  statusDiv.textContent = 'Connecting...';
  errorMessage.style.display = 'none';

  // Create MEW client
  client = new MEWClient({
    gateway: config.gatewayUrl,
    space: config.spaceName,
    token: config.token,
    participant_id: config.username,
  });

  // Set up event handlers
  client.onError((error) => {
    showError(error.message);
  });

  client.onWelcome((data) => {
    statusDiv.textContent = 'Connected! Starting game...';
    setTimeout(() => {
      startGame(config);
    }, 500);
  });

  // Connect to gateway
  await client.connect();
}

function startGame(config: ConnectionConfig) {
  if (!client) {
    showError('No client connection');
    return;
  }

  // Hide connection screen, show game
  connectionScreen.style.display = 'none';
  gameContainer.style.display = 'block';

  // Initialize Phaser game
  const phaserConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d5016',
    scene: [GameScene],
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      gamepad: true,
    },
  };

  game = new Phaser.Game(phaserConfig);

  // Pass client and config to game scene
  game.registry.set('mewClient', client);
  game.registry.set('playerId', config.username);
}

function showError(message: string) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  statusDiv.textContent = '';
}

// Handle window resize
window.addEventListener('resize', () => {
  if (game) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});
