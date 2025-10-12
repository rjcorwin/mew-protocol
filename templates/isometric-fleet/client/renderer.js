import Phaser from 'phaser';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

class HarborScene extends Phaser.Scene {
  constructor() {
    super('HarborScene');
    this.worldState = null;
    this.tileGraphics = null;
    this.shipGraphics = null;
    this.playersLayer = null;
    this.playerSprites = new Map();
    this.terrainSignature = null;
    this.originX = 0;
    this.originY = 0;
    this.localParticipantId = null;
  }

  create() {
    const { width, height } = this.game.scale.gameSize;
    this.originX = width / 2;
    this.originY = 140;

    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setDepth(1);
    this.shipGraphics = this.add.graphics();
    this.shipGraphics.setDepth(2);
    this.playersLayer = this.add.container(0, 0);
    this.playersLayer.setDepth(3);
    this.cameras.main.setBackgroundColor('#0f172a');
  }

  setLocalParticipant(id) {
    this.localParticipantId = id;
    this.updatePlayers();
  }

  setWorldState(worldState) {
    this.worldState = worldState;
    this.drawTerrain();
    this.drawShip();
    this.updatePlayers();
  }

  worldToIso(x, y) {
    const isoX = (x - y) * (TILE_WIDTH / 2);
    const isoY = (x + y) * (TILE_HEIGHT / 2);
    return { x: isoX, y: isoY };
  }

  drawDiamond(graphics, centerX, centerY, width, height, color, alpha = 1) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(centerX, centerY - halfHeight);
    graphics.lineTo(centerX + halfWidth, centerY);
    graphics.lineTo(centerX, centerY + halfHeight);
    graphics.lineTo(centerX - halfWidth, centerY);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(1, 0x0f172a, 0.35);
    graphics.strokePath();
  }

  drawTerrain() {
    if (!this.worldState) return;
    const { width, height, tiles } = this.worldState.terrain;
    if (!width || !height) {
      this.terrainSignature = null;
      this.tileGraphics.clear();
      return;
    }
    const signature = tiles.join('');
    if (signature === this.terrainSignature) return;
    this.terrainSignature = signature;

    this.tileGraphics.clear();
    const colors = {
      W: 0x1d4ed8,
      G: 0x16a34a,
      D: 0xf59e0b
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = tiles[y][x];
        const { x: isoX, y: isoY } = this.worldToIso(x, y);
        const screenX = this.originX + isoX;
        const screenY = this.originY + isoY;
        const color = colors[cell] || 0x64748b;
        const alpha = cell === 'W' ? 0.85 : 1;
        this.drawDiamond(this.tileGraphics, screenX, screenY, TILE_WIDTH, TILE_HEIGHT, color, alpha);
      }
    }
  }

  drawShip() {
    if (!this.shipGraphics) return;
    this.shipGraphics.clear();
    if (!this.worldState?.ship) return;

    const ship = this.worldState.ship;
    for (let dy = 0; dy < ship.deckLayout.length; dy += 1) {
      const row = ship.deckLayout[dy];
      for (let dx = 0; dx < row.length; dx += 1) {
        if (row[dx] !== 'S') continue;
        const { x: isoX, y: isoY } = this.worldToIso(ship.x + dx, ship.y + dy);
        const screenX = this.originX + isoX;
        const screenY = this.originY + isoY;
        this.drawDiamond(this.shipGraphics, screenX, screenY, TILE_WIDTH, TILE_HEIGHT, 0xeab308, 0.9);
      }
    }
  }

  ensurePlayerSprite(player) {
    if (this.playerSprites.has(player.id)) {
      return this.playerSprites.get(player.id);
    }

    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, -4, 26, 12, 0x000000, 0.35);
    const bodyColor = player.type === 'human' ? 0x38bdf8 : 0xc084fc;
    const body = this.add.ellipse(0, -14, 20, 28, bodyColor, 0.95);
    body.setStrokeStyle(2, 0x0f172a, 0.6);
    const label = this.add.text(0, -40, player.displayName || player.id, {
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      color: '#e2e8f0'
    });
    label.setOrigin(0.5, 0.5);

    container.add([shadow, body, label]);
    container.setDepth(10);
    container.meta = { body, label };
    this.playersLayer.add(container);
    this.playerSprites.set(player.id, container);
    return container;
  }

  updatePlayers() {
    if (!this.worldState) return;
    const seen = new Set();
    for (const player of this.worldState.players) {
      const sprite = this.ensurePlayerSprite(player);
      const { x: isoX, y: isoY } = this.worldToIso(player.x, player.y);
      sprite.x = this.originX + isoX;
      sprite.y = this.originY + isoY;
      if (sprite.meta?.label) {
        sprite.meta.label.setText(player.displayName || player.id);
      }
      if (sprite.meta?.body) {
        if (player.id === this.localParticipantId) {
          sprite.meta.body.setFillStyle(0xfde68a, 0.95);
        } else {
          const defaultColor = player.type === 'human' ? 0x38bdf8 : 0xc084fc;
          sprite.meta.body.setFillStyle(defaultColor, 0.95);
        }
      }
      seen.add(player.id);
    }

    for (const [id, sprite] of this.playerSprites.entries()) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.playerSprites.delete(id);
      }
    }
  }
}

const state = {
  connected: false,
  participantId: null,
  lastMoveAt: 0,
  scene: null
};

const statusBar = document.getElementById('status-bar');
const overlay = document.getElementById('overlay-message');
const form = document.getElementById('connect-panel');
const disconnectButton = document.getElementById('disconnect');
const connectButton = document.getElementById('connect');

function buildGateway(baseUrl, port) {
  let urlString = baseUrl.trim();
  if (!/^wss?:\/\//i.test(urlString)) {
    urlString = `ws://${urlString}`;
  }
  try {
    const url = new URL(urlString);
    if (port) {
      url.port = String(port);
    }
    return url.toString();
  } catch (error) {
    return urlString;
  }
}

function updateStatus(message) {
  statusBar.textContent = message;
}

function setOverlay(message) {
  overlay.textContent = message || '';
  overlay.style.display = message ? 'flex' : 'none';
}

function handleConnectionState(payload) {
  switch (payload.state) {
    case 'connecting':
      updateStatus('Connecting to gateway…');
      break;
    case 'ready':
      updateStatus('Connected. Awaiting world stream…');
      break;
    case 'world-stream':
      updateStatus('Receiving world updates');
      setOverlay('');
      break;
    default:
      updateStatus(`Status: ${payload.state}`);
  }
}

function initializePhaser() {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight - 160,
    backgroundColor: '#0f172a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  const game = new Phaser.Game(config);
  game.scene.add('HarborScene', HarborScene, true);
  state.scene = game.scene.getScene('HarborScene');
}

function subscribeEvents() {
  window.mewBridge.onWorldState((worldState) => {
    if (!state.connected) return;
    if (state.scene) {
      state.scene.setWorldState(worldState);
      if (state.participantId) {
        state.scene.setLocalParticipant(state.participantId);
      }
    }
    setOverlay('');
  });

  window.mewBridge.onConnectionState((payload) => {
    handleConnectionState(payload);
  });

  window.mewBridge.onError((payload) => {
    updateStatus(`Error: ${payload.message}`);
  });
}

function connect(config) {
  state.connected = true;
  state.participantId = config.participantId;
  connectButton.disabled = true;
  form.querySelectorAll('input').forEach((input) => input.setAttribute('disabled', 'disabled'));
  window.mewBridge.connect(config);
  updateStatus('Connecting to gateway…');
  setOverlay('');
}

function disconnect() {
  if (!state.connected) return;
  state.connected = false;
  state.participantId = null;
  state.lastMoveAt = 0;
  window.mewBridge.disconnect();
  connectButton.disabled = false;
  form.querySelectorAll('input').forEach((input) => input.removeAttribute('disabled'));
  updateStatus('Disconnected');
  setOverlay('Connect to render the harbor.');
  if (state.scene) {
    state.scene.setWorldState({
      terrain: { width: 0, height: 0, tiles: [] },
      players: [],
      ship: null
    });
    state.scene.playerSprites.forEach((sprite) => sprite.destroy());
    state.scene.playerSprites.clear();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const gatewayInput = data.get('gateway');
  const port = data.get('port');
  const gateway = buildGateway(gatewayInput, port);
  const config = {
    gateway,
    space: data.get('space'),
    token: data.get('token'),
    participantId: data.get('participant'),
    username: data.get('username')
  };
  connect(config);
});

disconnectButton.addEventListener('click', () => {
  disconnect();
});

const keyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right'
};

window.addEventListener('keydown', (event) => {
  if (!state.connected) return;
  const direction = keyMap[event.key];
  if (direction) {
    event.preventDefault();
    const now = Date.now();
    if (now - state.lastMoveAt > 130) {
      window.mewBridge.sendMove({ type: 'move', direction });
      state.lastMoveAt = now;
    }
  }
  if (event.key === 'b' || event.key === 'B') {
    window.mewBridge.sendMove({ type: 'disembark' });
  }
});

initializePhaser();
subscribeEvents();
setOverlay('Connect to render the harbor.');
updateStatus('Disconnected');
