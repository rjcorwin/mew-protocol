import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    this.createLoadingBar();
    
    this.generateTextures();
  }

  createLoadingBar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px monospace',
      color: '#ffffff'
    });
    loadingText.setOrigin(0.5, 0.5);
    
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });
    
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  generateTextures() {
    this.load.on('complete', () => {
      this.generateWaterTile();
      this.generateIslandTile();
      this.generateShipSprite();
      this.generatePlayerSprite();
      this.generateCannonball();
      this.generateSlashEffect();
      this.generateDashTrail();
    });
    
    this.load.start();
  }

  generateWaterTile() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x2980b9);
    graphics.fillRect(0, 0, 64, 32);
    graphics.fillStyle(0x3498db);
    graphics.fillRect(2, 2, 60, 28);
    graphics.generateTexture('water-tile', 64, 32);
    graphics.destroy();
  }

  generateIslandTile() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xf4d03f);
    graphics.fillRect(0, 0, 64, 32);
    graphics.fillStyle(0x27ae60);
    graphics.fillRect(4, 4, 56, 24);
    graphics.generateTexture('island-tile', 64, 32);
    graphics.destroy();
  }

  generateShipSprite() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x8b4513);
    graphics.beginPath();
    graphics.moveTo(32, 0);
    graphics.lineTo(60, 20);
    graphics.lineTo(50, 40);
    graphics.lineTo(14, 40);
    graphics.lineTo(4, 20);
    graphics.closePath();
    graphics.fill();
    
    graphics.fillStyle(0x654321);
    graphics.fillRect(30, 10, 4, 20);
    
    graphics.fillStyle(0xffffff);
    graphics.beginPath();
    graphics.moveTo(34, 12);
    graphics.lineTo(48, 18);
    graphics.lineTo(34, 24);
    graphics.closePath();
    graphics.fill();
    
    graphics.generateTexture('ship', 64, 40);
    graphics.destroy();
  }

  generatePlayerSprite() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xfdbcb4);
    graphics.fillCircle(16, 12, 6);
    graphics.fillStyle(0x1e3a8a);
    graphics.fillRect(10, 18, 12, 14);
    graphics.fillStyle(0x000000);
    graphics.fillRect(8, 30, 4, 8);
    graphics.fillRect(20, 30, 4, 8);
    graphics.generateTexture('player', 32, 40);
    graphics.destroy();
  }

  generateCannonball() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x2c3e50);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('cannonball', 8, 8);
    graphics.destroy();
  }

  generateSlashEffect() {
    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0x00ff88, 0.8);
    graphics.beginPath();
    graphics.arc(0, 0, 30, -Math.PI/4, Math.PI/4, false);
    graphics.strokePath();
    graphics.generateTexture('slash-effect', 60, 60);
    graphics.destroy();
  }

  generateDashTrail() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff88, 0.8);
    graphics.fillRect(0, 0, 24, 6);
    graphics.fillStyle(0x00ff88, 0.4);
    graphics.fillRect(24, 0, 8, 6);
    graphics.generateTexture('dash-trail', 32, 6);
    graphics.destroy();
  }

  create() {
    this.scene.start('GameScene');
  }
}