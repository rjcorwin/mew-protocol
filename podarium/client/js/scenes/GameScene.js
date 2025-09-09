import Phaser from 'phaser';
import { EVENTS, GAME_CONFIG } from '../../../shared/constants.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.keys = null;
    this.socket = null;
  }

  create() {
    this.socket = this.game.socket;
    this.boundaries = [];
    this.players = new Map();
    this.ships = new Map();
    this.projectiles = new Map();
    this.localPlayer = null;
    
    this.setupControls();
    this.setupSocketListeners();
    this.setupCamera();
    this.setupWorld();
  }

  setupWorld() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasCustomMap = urlParams.get('customMap') === 'true';
    
    if (hasCustomMap) {
      const mapData = JSON.parse(localStorage.getItem('customMap') || '{}');
      this.loadCustomMap(mapData);
    } else {
      this.loadDefaultMap();
    }
  }
  
  loadDefaultMap() {
    const worldWidth = GAME_CONFIG.WORLD_WIDTH;
    const worldHeight = GAME_CONFIG.WORLD_HEIGHT;
    
    for (let x = 0; x < worldWidth; x += 64) {
      for (let y = 0; y < worldHeight; y += 32) {
        const tile = this.add.image(x, y, 'water-tile');
        tile.setOrigin(0, 0);
        tile.setDepth(0);
      }
    }
    
    this.createIsland(1000, 1000, 200, 150);
    this.createIsland(3000, 2000, 150, 200);
    this.createIsland(2000, 3500, 250, 180);
  }
  
  loadCustomMap(mapData) {
    if (mapData.imageData) {
      // Load the custom map image
      this.load.image('custom-map-bg', mapData.imageData);
      this.load.once('complete', () => {
        const mapBg = this.add.image(0, 0, 'custom-map-bg');
        mapBg.setOrigin(0, 0);
        mapBg.setDepth(0);
        
        // Set camera bounds based on image size
        const bounds = mapBg.getBounds();
        this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
        
        if (mapData.boundaries) {
          this.boundaries = mapData.boundaries;
          this.renderBoundaries();
        }
        
        // Re-render any existing players
        this.players.forEach((player, id) => {
          if (player.container) {
            player.container.setDepth(100);
          }
        });
        
        if (mapData.ships) {
          // Wait a bit for connection to establish before spawning ships
          this.time.delayedCall(500, () => {
            mapData.ships.forEach(ship => {
              this.socket.emit('spawn-custom-ship', ship);
            });
          });
        }
      });
      this.load.start();
    } else {
      this.loadDefaultMap();
    }
  }
  
  renderBoundaries() {
    if (!this.boundaryGraphics) {
      this.boundaryGraphics = this.add.graphics();
      this.boundaryGraphics.setDepth(2);
    }
    
    this.boundaryGraphics.clear();
    
    // Optional: visualize boundaries for debugging
    if (this.game.config.debug) {
      this.boundaries.forEach(boundary => {
        if (boundary.type === 'water') {
          this.boundaryGraphics.fillStyle(0x2980b9, 0.2);
        } else if (boundary.type === 'land') {
          this.boundaryGraphics.fillStyle(0x27ae60, 0.2);
        }
        this.boundaryGraphics.fillCircle(boundary.x, boundary.y, boundary.radius);
      });
    }
  }

  createIsland(x, y, width, height) {
    for (let ix = 0; ix < width; ix += 64) {
      for (let iy = 0; iy < height; iy += 32) {
        const tile = this.add.image(x + ix, y + iy, 'island-tile');
        tile.setOrigin(0, 0);
        tile.setDepth(1);
      }
    }
  }

  setupControls() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      board: 'E',
      sailsUp: 'Q',
      sailsDown: 'R',
      anchor: 'SPACE',
      turnLeft: 'LEFT',
      turnRight: 'RIGHT',
      dash: 'SHIFT',
      attack: 'J',
      shoot: 'K'
    });
    
    this.dashCooldownBar = this.add.graphics();
    this.dashCooldownBar.setDepth(1000);
    this.dashCooldownBar.setScrollFactor(0);
    
    this.attackEffects = this.add.group();
    this.projectileSprites = new Map();
    this.dashTrails = this.add.group();
  }

  setupCamera() {
    // Default camera setup - will be overridden if custom map is loaded
    this.cameras.main.setBounds(0, 0, GAME_CONFIG.WORLD_WIDTH, GAME_CONFIG.WORLD_HEIGHT);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor('#2980b9');
  }

  setupSocketListeners() {
    this.socket.on(EVENTS.PLAYER_JOIN, (data) => {
      console.log('Player joined event received:', data.playerId);
      this.localPlayer = {
        id: data.playerId,
        sprite: null
      };
      this.handleWorldState(data.worldState);
    });

    this.socket.on(EVENTS.WORLD_STATE, (worldState) => {
      this.handleWorldState(worldState);
    });

    this.socket.on(EVENTS.PLAYER_LEAVE, (playerId) => {
      this.removePlayer(playerId);
    });
  }

  handleWorldState(worldState) {
    worldState.players.forEach(playerData => {
      if (this.players.has(playerData.id)) {
        this.updatePlayer(playerData);
      } else {
        this.createPlayer(playerData);
      }
    });
    
    this.players.forEach((player, id) => {
      if (!worldState.players.find(p => p.id === id)) {
        this.removePlayer(id);
      }
    });

    worldState.ships.forEach(shipData => {
      if (this.ships.has(shipData.id)) {
        this.updateShip(shipData);
      } else {
        this.createShip(shipData);
      }
    });
    
    worldState.projectiles?.forEach(projData => {
      if (!this.projectileSprites.has(projData.id)) {
        const sprite = this.add.sprite(projData.x, projData.y, 'cannonball');
        sprite.setDepth(80);
        this.projectileSprites.set(projData.id, sprite);
      } else {
        const sprite = this.projectileSprites.get(projData.id);
        sprite.x = projData.x;
        sprite.y = projData.y;
      }
    });
    
    this.projectileSprites.forEach((sprite, id) => {
      if (!worldState.projectiles?.find(p => p.id === id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    });

    this.updateUI();
  }

  createPlayer(playerData) {
    console.log('Creating player:', playerData.id, 'at', playerData.x, playerData.y);
    
    const container = this.add.container(playerData.x, playerData.y);
    const sprite = this.add.sprite(0, 0, 'player');
    const nameText = this.add.text(0, -30, playerData.name, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    });
    nameText.setOrigin(0.5);
    
    const healthBar = this.add.graphics();
    
    container.add([sprite, nameText, healthBar]);
    container.setDepth(100);
    
    this.players.set(playerData.id, {
      container,
      sprite,
      nameText,
      healthBar,
      data: playerData
    });

    if (this.localPlayer && playerData.id === this.localPlayer.id) {
      console.log('Setting up camera follow for local player');
      this.localPlayer.sprite = container;
      this.cameras.main.startFollow(container);
      this.cameras.main.setZoom(1);
    }
  }

  updatePlayer(playerData) {
    const player = this.players.get(playerData.id);
    if (player) {
      player.container.x = playerData.x;
      player.container.y = playerData.y;
      player.sprite.rotation = playerData.rotation;
      
      if (playerData.isDashing && !player.data.isDashing) {
        this.createDashTrail(playerData.x, playerData.y, playerData.rotation);
      }
      
      if (playerData.invulnerable) {
        player.sprite.setAlpha(0.5 + Math.sin(this.time.now * 0.01) * 0.3);
      } else {
        player.sprite.setAlpha(1);
      }
      
      const healthBar = player.healthBar;
      if (healthBar) {
        healthBar.clear();
        healthBar.fillStyle(0x000000, 0.5);
        healthBar.fillRect(-20, -45, 40, 4);
        healthBar.fillStyle(0xff0000, 1);
        healthBar.fillRect(-20, -45, (playerData.health / playerData.maxHealth) * 40, 4);
        healthBar.fillStyle(0x00ff88, 0.8);
        healthBar.fillRect(-20, -50, (playerData.stamina / 100) * 40, 3);
      }
      
      player.data = playerData;
    }
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.container.destroy();
      this.players.delete(playerId);
    }
  }

  createShip(shipData) {
    const container = this.add.container(shipData.x, shipData.y);
    const sprite = this.add.sprite(0, 0, 'ship');
    container.add(sprite);
    container.setDepth(50);
    
    this.ships.set(shipData.id, {
      container,
      sprite,
      data: shipData
    });
  }

  updateShip(shipData) {
    const ship = this.ships.get(shipData.id);
    if (ship) {
      ship.container.x = shipData.x;
      ship.container.y = shipData.y;
      ship.container.rotation = shipData.rotation;
      ship.data = shipData;
    }
  }

  update() {
    this.handleInput();
  }

  handleInput() {
    if (!this.localPlayer || !this.localPlayer.sprite) return;

    const localPlayerData = this.players.get(this.localPlayer.id);
    if (!localPlayerData) return;

    if (!localPlayerData.data.onShip) {
      let vx = 0;
      let vy = 0;

      if (this.keys.up.isDown) vy = -1;
      if (this.keys.down.isDown) vy = 1;
      if (this.keys.left.isDown) vx = -1;
      if (this.keys.right.isDown) vx = 1;
      
      if (this.boundaries && this.boundaries.length > 0) {
        const nextX = localPlayerData.data.x + vx * 5;
        const nextY = localPlayerData.data.y + vy * 5;
        if (!this.canMoveTo(nextX, nextY)) {
          vx = 0;
          vy = 0;
        }
      }

      if (vx !== 0 || vy !== 0) {
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        vx /= magnitude;
        vy /= magnitude;
        
        const rotation = Math.atan2(vy, vx);
        
        this.socket.emit(EVENTS.PLAYER_MOVE, { vx, vy, rotation });
      } else {
        this.socket.emit(EVENTS.PLAYER_MOVE, { vx: 0, vy: 0 });
      }
      
      if (Phaser.Input.Keyboard.JustDown(this.keys.dash)) {
        const direction = localPlayerData.data.rotation || Math.atan2(vy, vx);
        this.socket.emit(EVENTS.PLAYER_DASH, { direction });
      }
      
      if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) {
        this.socket.emit(EVENTS.PLAYER_ATTACK, { type: 'melee' });
        this.createSlashEffect(localPlayerData.data.x, localPlayerData.data.y, localPlayerData.data.rotation);
      }
      
      if (Phaser.Input.Keyboard.JustDown(this.keys.shoot)) {
        const direction = localPlayerData.data.rotation;
        this.socket.emit(EVENTS.PLAYER_ATTACK, { type: 'projectile', direction });
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.board)) {
        const nearestShip = this.findNearestShip();
        if (nearestShip) {
          this.socket.emit('board-ship', nearestShip.data.id);
        }
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.keys.board)) {
        this.socket.emit('leave-ship');
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.sailsUp)) {
        this.socket.emit(EVENTS.SHIP_UPDATE, { action: 'sails', value: 1 });
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.sailsDown)) {
        this.socket.emit(EVENTS.SHIP_UPDATE, { action: 'sails', value: 0 });
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.anchor)) {
        const ship = this.ships.get(localPlayerData.data.shipId);
        if (ship) {
          this.socket.emit(EVENTS.SHIP_UPDATE, { 
            action: 'anchor', 
            value: !ship.data.anchor 
          });
        }
      }

      if (this.keys.turnLeft.isDown) {
        this.socket.emit(EVENTS.SHIP_UPDATE, { action: 'turn', direction: -1 });
      }
      if (this.keys.turnRight.isDown) {
        this.socket.emit(EVENTS.SHIP_UPDATE, { action: 'turn', direction: 1 });
      }
    }
  }

  findNearestShip() {
    const localPlayerData = this.players.get(this.localPlayer.id);
    if (!localPlayerData) return null;

    let nearestShip = null;
    let minDistance = 100;

    this.ships.forEach(ship => {
      const distance = Math.sqrt(
        Math.pow(localPlayerData.data.x - ship.data.x, 2) +
        Math.pow(localPlayerData.data.y - ship.data.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestShip = ship;
      }
    });

    return nearestShip;
  }

  createSlashEffect(x, y, rotation) {
    const slash = this.add.sprite(x, y, 'slash-effect');
    slash.setRotation(rotation);
    slash.setDepth(150);
    slash.setAlpha(0.8);
    
    this.tweens.add({
      targets: slash,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 200,
      onComplete: () => slash.destroy()
    });
  }
  
  createDashTrail(x, y, rotation) {
    const trail = this.add.sprite(x, y, 'dash-trail');
    trail.setRotation(rotation);
    trail.setDepth(90);
    trail.setAlpha(0.6);
    
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleY: 0.1,
      duration: 300,
      onComplete: () => trail.destroy()
    });
  }

  canMoveTo(x, y) {
    if (!this.boundaries || this.boundaries.length === 0) return true;
    
    for (let boundary of this.boundaries) {
      const dist = Math.sqrt(Math.pow(x - boundary.x, 2) + Math.pow(y - boundary.y, 2));
      if (dist <= boundary.radius) {
        return boundary.type === 'land';
      }
    }
    return false;
  }

  updateUI() {
    const localPlayerData = this.players.get(this.localPlayer?.id);
    if (localPlayerData) {
      document.getElementById('health').textContent = `${localPlayerData.data.health}/${localPlayerData.data.maxHealth}`;
      document.getElementById('position').textContent = 
        `${Math.round(localPlayerData.data.x)}, ${Math.round(localPlayerData.data.y)}`;
      
      const staminaBar = document.getElementById('stamina');
      if (!staminaBar) {
        const statDiv = document.createElement('div');
        statDiv.className = 'stat';
        statDiv.innerHTML = 'Stamina: <span id="stamina">100</span>';
        document.getElementById('ui-overlay').appendChild(statDiv);
      } else {
        staminaBar.textContent = Math.round(localPlayerData.data.stamina);
      }
      
      if (localPlayerData.data.onShip) {
        const ship = this.ships.get(localPlayerData.data.shipId);
        if (ship) {
          document.getElementById('ship-status').textContent = 
            `On Ship (Sails: ${Math.round(ship.data.sails * 100)}%, Anchor: ${ship.data.anchor ? 'Down' : 'Up'})`;
        }
      } else {
        document.getElementById('ship-status').textContent = 'On Foot';
      }
    }
  }
}