import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { GameScene } from './scenes/GameScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1024,
  height: 768,
  scene: [PreloadScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  render: {
    pixelArt: false,
    antialias: true
  }
};

const game = new Phaser.Game(config);

const socket = io('http://localhost:3001');

game.socket = socket;

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});