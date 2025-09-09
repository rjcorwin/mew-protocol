import Phaser from 'phaser';

class MapEditorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapEditorScene' });
    this.drawMode = 'land';
    this.brushSize = 20;
    this.opacity = 0.5;
    this.isDrawing = false;
    this.boundaries = [];
    this.ships = [];
    this.showBoundaries = true;
    this.mapImage = null;
  }

  create() {
    this.graphics = this.add.graphics();
    this.boundaryGraphics = this.add.graphics();
    this.shipContainer = this.add.container();
    
    this.cameras.main.setBackgroundColor('#1a1a2e');
    
    this.setupInputHandlers();
    this.setupUIListeners();
    
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    
    this.input.keyboard.on('keydown-SPACE', () => {
      this.showBoundaries = !this.showBoundaries;
      this.updateDisplay();
    });
  }

  setupInputHandlers() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoom = this.cameras.main.zoom;
      if (deltaY > 0) {
        this.cameras.main.setZoom(Math.max(0.25, zoom - 0.1));
      } else {
        this.cameras.main.setZoom(Math.min(4, zoom + 0.1));
      }
    });
    
    const cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown', (event) => {
      const cam = this.cameras.main;
      const moveSpeed = 10;
      
      switch(event.key) {
        case 'ArrowLeft':
          cam.scrollX -= moveSpeed;
          break;
        case 'ArrowRight':
          cam.scrollX += moveSpeed;
          break;
        case 'ArrowUp':
          cam.scrollY -= moveSpeed;
          break;
        case 'ArrowDown':
          cam.scrollY += moveSpeed;
          break;
      }
    });
  }

  setupUIListeners() {
    document.getElementById('map-upload').addEventListener('change', (e) => {
      this.loadMapImage(e.target.files[0]);
    });
    
    document.getElementById('brush-size').addEventListener('input', (e) => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById('brush-size-display').textContent = this.brushSize;
    });
    
    document.getElementById('opacity').addEventListener('input', (e) => {
      this.opacity = parseInt(e.target.value) / 100;
      document.getElementById('opacity-display').textContent = e.target.value + '%';
    });
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.drawMode = e.target.id.replace('mode-', '');
      });
    });
    
    document.getElementById('clear-boundaries').addEventListener('click', () => {
      this.boundaries = [];
      this.updateDisplay();
    });
    
    document.getElementById('clear-ships').addEventListener('click', () => {
      this.ships = [];
      this.shipContainer.removeAll(true);
      this.updateShipCount();
    });
    
    document.getElementById('toggle-view').addEventListener('click', () => {
      this.showBoundaries = !this.showBoundaries;
      this.updateDisplay();
    });
    
    document.getElementById('export-map').addEventListener('click', () => {
      this.exportMapData();
    });
    
    document.getElementById('import-map').addEventListener('click', () => {
      const data = document.getElementById('json-output').value;
      if (data) {
        this.importMapData(JSON.parse(data));
      }
    });
    
    document.getElementById('copy-json').addEventListener('click', () => {
      const textarea = document.getElementById('json-output');
      textarea.select();
      document.execCommand('copy');
    });
    
    document.getElementById('play-map').addEventListener('click', () => {
      this.launchGameWithMap();
    });
  }

  loadMapImage(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const key = 'custom-map';
      
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      
      this.load.image(key, e.target.result);
      this.load.once('complete', () => {
        if (this.mapImage) {
          this.mapImage.destroy();
        }
        
        this.mapImage = this.add.image(0, 0, key);
        this.mapImage.setOrigin(0, 0);
        this.mapImage.setDepth(-1);
        
        const bounds = this.mapImage.getBounds();
        this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
        
        this.boundaries = [];
        this.ships = [];
        this.shipContainer.removeAll(true);
        this.updateDisplay();
      });
      this.load.start();
    };
    reader.readAsDataURL(file);
  }

  onPointerDown(pointer) {
    if (this.drawMode === 'ship') {
      this.placeShip(pointer.worldX, pointer.worldY);
    } else {
      this.isDrawing = true;
      this.drawAt(pointer.worldX, pointer.worldY);
    }
  }

  onPointerMove(pointer) {
    document.getElementById('mouse-x').textContent = Math.round(pointer.worldX);
    document.getElementById('mouse-y').textContent = Math.round(pointer.worldY);
    
    if (this.isDrawing && this.drawMode !== 'ship') {
      this.drawAt(pointer.worldX, pointer.worldY);
    }
  }

  onPointerUp() {
    this.isDrawing = false;
  }

  drawAt(x, y) {
    const boundary = {
      x: Math.round(x),
      y: Math.round(y),
      radius: this.brushSize,
      type: this.drawMode === 'water' ? 'water' : this.drawMode === 'land' ? 'land' : 'erase'
    };
    
    if (this.drawMode === 'erase') {
      this.boundaries = this.boundaries.filter(b => {
        const dist = Math.sqrt(Math.pow(b.x - x, 2) + Math.pow(b.y - y, 2));
        return dist > this.brushSize;
      });
    } else {
      this.boundaries.push(boundary);
    }
    
    this.updateDisplay();
  }

  placeShip(x, y) {
    const ship = {
      x: Math.round(x),
      y: Math.round(y),
      id: `ship_${Date.now()}`
    };
    
    this.ships.push(ship);
    
    const shipGraphics = this.add.graphics();
    shipGraphics.fillStyle(0x8b4513);
    shipGraphics.beginPath();
    shipGraphics.moveTo(0, -20);
    shipGraphics.lineTo(28, 0);
    shipGraphics.lineTo(23, 20);
    shipGraphics.lineTo(-23, 20);
    shipGraphics.lineTo(-28, 0);
    shipGraphics.closePath();
    shipGraphics.fill();
    
    shipGraphics.fillStyle(0xffffff);
    shipGraphics.beginPath();
    shipGraphics.moveTo(2, -8);
    shipGraphics.lineTo(16, -2);
    shipGraphics.lineTo(2, 4);
    shipGraphics.closePath();
    shipGraphics.fill();
    
    const shipSprite = this.add.container(x, y, [shipGraphics]);
    shipSprite.setData('id', ship.id);
    this.shipContainer.add(shipSprite);
    
    this.updateShipCount();
  }

  updateDisplay() {
    this.boundaryGraphics.clear();
    
    if (!this.showBoundaries && this.mapImage) {
      this.mapImage.setAlpha(1);
      return;
    }
    
    if (this.mapImage) {
      this.mapImage.setAlpha(0.3);
    }
    
    this.boundaries.forEach(boundary => {
      if (boundary.type === 'water') {
        this.boundaryGraphics.fillStyle(0x2980b9, this.opacity);
      } else if (boundary.type === 'land') {
        this.boundaryGraphics.fillStyle(0x27ae60, this.opacity);
      }
      this.boundaryGraphics.fillCircle(boundary.x, boundary.y, boundary.radius);
    });
  }

  updateShipCount() {
    document.getElementById('ship-count').textContent = this.ships.length;
  }

  exportMapData() {
    const mapData = {
      boundaries: this.boundaries,
      ships: this.ships,
      imageData: this.mapImage ? this.textures.get('custom-map').getSourceImage().src : null,
      metadata: {
        created: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    const json = JSON.stringify(mapData, null, 2);
    document.getElementById('json-output').value = json;
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${Date.now()}.json`;
    a.click();
  }

  importMapData(data) {
    this.boundaries = data.boundaries || [];
    this.ships = data.ships || [];
    
    if (data.imageData) {
      const img = new Image();
      img.onload = () => {
        const key = 'custom-map';
        if (this.textures.exists(key)) {
          this.textures.remove(key);
        }
        this.textures.addImage(key, img);
        
        if (this.mapImage) {
          this.mapImage.destroy();
        }
        
        this.mapImage = this.add.image(0, 0, key);
        this.mapImage.setOrigin(0, 0);
        this.mapImage.setDepth(-1);
        
        const bounds = this.mapImage.getBounds();
        this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
        
        this.updateDisplay();
      };
      img.src = data.imageData;
    }
    
    this.shipContainer.removeAll(true);
    this.ships.forEach(ship => {
      const shipGraphics = this.add.graphics();
      shipGraphics.fillStyle(0x8b4513);
      shipGraphics.beginPath();
      shipGraphics.moveTo(0, -20);
      shipGraphics.lineTo(28, 0);
      shipGraphics.lineTo(23, 20);
      shipGraphics.lineTo(-23, 20);
      shipGraphics.lineTo(-28, 0);
      shipGraphics.closePath();
      shipGraphics.fill();
      
      shipGraphics.fillStyle(0xffffff);
      shipGraphics.beginPath();
      shipGraphics.moveTo(2, -8);
      shipGraphics.lineTo(16, -2);
      shipGraphics.lineTo(2, 4);
      shipGraphics.closePath();
      shipGraphics.fill();
      
      const shipSprite = this.add.container(ship.x, ship.y, [shipGraphics]);
      shipSprite.setData('id', ship.id);
      this.shipContainer.add(shipSprite);
    });
    
    this.updateDisplay();
    this.updateShipCount();
  }

  launchGameWithMap() {
    const mapData = {
      boundaries: this.boundaries,
      ships: this.ships,
      imageData: this.mapImage ? this.textures.get('custom-map').getSourceImage().src : null
    };
    
    localStorage.setItem('customMap', JSON.stringify(mapData));
    window.location.href = '/index.html?customMap=true';
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'editor-container',
  width: window.innerWidth - 300,
  height: window.innerHeight,
  scene: MapEditorScene,
  backgroundColor: '#1a1a2e'
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth - 300, window.innerHeight);
});