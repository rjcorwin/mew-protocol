import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameWorld } from '../shared/gameLogic.js';
import { EVENTS, GAME_CONFIG } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(join(__dirname, '../client')));

const gameWorld = new GameWorld();

gameWorld.addShip(1000, 1000);
gameWorld.addShip(2000, 2000);
gameWorld.addShip(3000, 1500);

const UPDATE_RATE = 1000 / 60;
setInterval(() => {
  gameWorld.update();
  io.emit(EVENTS.WORLD_STATE, gameWorld.serialize());
}, UPDATE_RATE);

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  const spawnX = Math.random() * 2000 + 500;
  const spawnY = Math.random() * 2000 + 500;
  const player = gameWorld.addPlayer(socket.id, `Player_${socket.id.slice(0, 4)}`, spawnX, spawnY);

  socket.emit(EVENTS.PLAYER_JOIN, {
    playerId: socket.id,
    worldState: gameWorld.serialize()
  });

  socket.broadcast.emit(EVENTS.PLAYER_UPDATE, player.serialize());

  socket.on(EVENTS.PLAYER_MOVE, (data) => {
    const player = gameWorld.players.get(socket.id);
    if (player && !player.onShip && !player.isDashing) {
      player.vx = data.vx * GAME_CONFIG.PLAYER_SPEED;
      player.vy = data.vy * GAME_CONFIG.PLAYER_SPEED;
      player.rotation = data.rotation || player.rotation;
    }
  });

  socket.on(EVENTS.PLAYER_DASH, (data) => {
    const player = gameWorld.players.get(socket.id);
    if (player && !player.onShip) {
      if (player.dash(data.direction)) {
        io.emit(EVENTS.PLAYER_UPDATE, player.serialize());
      }
    }
  });

  socket.on(EVENTS.PLAYER_ATTACK, (data) => {
    const player = gameWorld.players.get(socket.id);
    if (player && !player.onShip) {
      if (data.type === 'melee') {
        const hits = gameWorld.performMeleeAttack(socket.id);
        if (hits.length > 0) {
          io.emit(EVENTS.DAMAGE, { attacker: socket.id, targets: hits, type: 'melee' });
        }
      } else if (data.type === 'projectile') {
        const projectile = gameWorld.fireProjectile(socket.id, data.direction);
        if (projectile) {
          io.emit(EVENTS.PROJECTILE_FIRE, projectile.serialize());
        }
      }
    }
  });

  socket.on(EVENTS.SHIP_UPDATE, (data) => {
    const player = gameWorld.players.get(socket.id);
    if (player && player.shipId) {
      const ship = gameWorld.ships.get(player.shipId);
      if (ship) {
        if (data.action === 'sails') {
          ship.setSails(data.value);
        } else if (data.action === 'anchor') {
          ship.anchor = data.value;
        } else if (data.action === 'turn') {
          ship.turn(data.direction, 1/60);
        }
      }
    }
  });

  socket.on('board-ship', (shipId) => {
    const player = gameWorld.players.get(socket.id);
    const ship = gameWorld.ships.get(shipId);
    if (player && ship) {
      const distance = Math.sqrt(
        Math.pow(player.x - ship.x, 2) + 
        Math.pow(player.y - ship.y, 2)
      );
      
      if (distance < 100) {
        player.onShip = true;
        player.shipId = shipId;
        ship.addCrew(socket.id);
      }
    }
  });

  socket.on('leave-ship', () => {
    const player = gameWorld.players.get(socket.id);
    if (player && player.shipId) {
      const ship = gameWorld.ships.get(player.shipId);
      if (ship) {
        ship.removeCrew(socket.id);
        player.onShip = false;
        player.shipId = null;
      }
    }
  });
  
  socket.on('spawn-custom-ship', (shipData) => {
    const ship = gameWorld.addShip(shipData.x, shipData.y);
    io.emit(EVENTS.WORLD_STATE, gameWorld.serialize());
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    gameWorld.removePlayer(socket.id);
    socket.broadcast.emit(EVENTS.PLAYER_LEAVE, socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});