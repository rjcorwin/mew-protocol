import { GAME_CONFIG } from './constants.js';

export class GameObject {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
  }

  update(deltaTime) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.x = Math.max(0, Math.min(GAME_CONFIG.WORLD_WIDTH, this.x));
    this.y = Math.max(0, Math.min(GAME_CONFIG.WORLD_HEIGHT, this.y));
  }

  serialize() {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      rotation: this.rotation
    };
  }
}

export class Player extends GameObject {
  constructor(id, name, x, y) {
    super(x, y);
    this.id = id;
    this.name = name;
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = GAME_CONFIG.MAX_STAMINA;
    this.onShip = false;
    this.shipId = null;
    this.isDashing = false;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.attackCooldown = 0;
    this.invulnerable = false;
    this.invulnerableTime = 0;
  }

  dash(direction) {
    if (this.stamina >= GAME_CONFIG.DASH_STAMINA_COST && this.dashCooldown <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashTime = GAME_CONFIG.DASH_DURATION;
      this.dashCooldown = GAME_CONFIG.DASH_COOLDOWN;
      this.stamina -= GAME_CONFIG.DASH_STAMINA_COST;
      this.vx = Math.cos(direction) * GAME_CONFIG.DASH_SPEED;
      this.vy = Math.sin(direction) * GAME_CONFIG.DASH_SPEED;
      this.invulnerable = true;
      this.invulnerableTime = GAME_CONFIG.DASH_DURATION;
      return true;
    }
    return false;
  }

  attack() {
    if (this.stamina >= GAME_CONFIG.ATTACK_STAMINA_COST && this.attackCooldown <= 0) {
      this.attackCooldown = GAME_CONFIG.ATTACK_COOLDOWN;
      this.stamina -= GAME_CONFIG.ATTACK_STAMINA_COST;
      return true;
    }
    return false;
  }

  takeDamage(amount) {
    if (!this.invulnerable) {
      this.health = Math.max(0, this.health - amount);
      this.invulnerable = true;
      this.invulnerableTime = 500;
      return this.health <= 0;
    }
    return false;
  }

  update(deltaTime) {
    super.update(deltaTime);
    
    if (this.isDashing) {
      this.dashTime -= deltaTime * 1000;
      if (this.dashTime <= 0) {
        this.isDashing = false;
        this.vx = 0;
        this.vy = 0;
      }
    }
    
    if (this.dashCooldown > 0) {
      this.dashCooldown -= deltaTime * 1000;
    }
    
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime * 1000;
    }
    
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime * 1000;
      if (this.invulnerableTime <= 0) {
        this.invulnerable = false;
      }
    }
    
    this.stamina = Math.min(GAME_CONFIG.MAX_STAMINA, this.stamina + GAME_CONFIG.STAMINA_REGEN * deltaTime);
  }

  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      name: this.name,
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: this.stamina,
      onShip: this.onShip,
      shipId: this.shipId,
      isDashing: this.isDashing,
      invulnerable: this.invulnerable
    };
  }
}

export class Ship extends GameObject {
  constructor(id, x, y) {
    super(x, y);
    this.id = id;
    this.health = 200;
    this.sails = 0;
    this.anchor = true;
    this.cannons = [];
    this.crew = new Set();
  }

  addCrew(playerId) {
    this.crew.add(playerId);
  }

  removeCrew(playerId) {
    this.crew.delete(playerId);
  }

  setSails(level) {
    this.sails = Math.max(0, Math.min(1, level));
  }

  turn(direction, deltaTime) {
    if (!this.anchor && this.sails > 0) {
      this.rotation += direction * GAME_CONFIG.TURN_SPEED * deltaTime;
    }
  }

  update(deltaTime) {
    if (!this.anchor && this.sails > 0) {
      const speed = GAME_CONFIG.SHIP_SPEED * this.sails;
      this.vx = Math.cos(this.rotation) * speed;
      this.vy = Math.sin(this.rotation) * speed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
    super.update(deltaTime);
  }

  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      health: this.health,
      sails: this.sails,
      anchor: this.anchor,
      crew: Array.from(this.crew)
    };
  }
}

export class Projectile extends GameObject {
  constructor(id, owner, x, y, direction, speed = GAME_CONFIG.PROJECTILE_SPEED) {
    super(x, y);
    this.id = id;
    this.owner = owner;
    this.damage = GAME_CONFIG.PROJECTILE_DAMAGE;
    this.lifetime = 2000;
    this.vx = Math.cos(direction) * speed;
    this.vy = Math.sin(direction) * speed;
    this.rotation = direction;
  }

  update(deltaTime) {
    super.update(deltaTime);
    this.lifetime -= deltaTime * 1000;
  }

  serialize() {
    return {
      ...super.serialize(),
      id: this.id,
      owner: this.owner,
      lifetime: this.lifetime
    };
  }
}

export class GameWorld {
  constructor() {
    this.players = new Map();
    this.ships = new Map();
    this.projectiles = new Map();
    this.islands = [];
    this.lastUpdate = Date.now();
    this.projectileIdCounter = 0;
  }

  addPlayer(id, name, x, y) {
    const player = new Player(id, name, x, y);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (player && player.shipId) {
      const ship = this.ships.get(player.shipId);
      if (ship) {
        ship.removeCrew(id);
      }
    }
    this.players.delete(id);
  }

  addShip(x, y) {
    const id = `ship_${Date.now()}`;
    const ship = new Ship(id, x, y);
    this.ships.set(id, ship);
    return ship;
  }

  fireProjectile(playerId, direction) {
    const player = this.players.get(playerId);
    if (player) {
      const id = `proj_${this.projectileIdCounter++}`;
      const projectile = new Projectile(id, playerId, player.x, player.y, direction);
      this.projectiles.set(id, projectile);
      return projectile;
    }
    return null;
  }

  performMeleeAttack(playerId) {
    const attacker = this.players.get(playerId);
    if (!attacker || !attacker.attack()) return [];
    
    const hits = [];
    this.players.forEach((target, targetId) => {
      if (targetId !== playerId && !target.onShip) {
        const distance = Math.sqrt(
          Math.pow(attacker.x - target.x, 2) +
          Math.pow(attacker.y - target.y, 2)
        );
        
        if (distance <= GAME_CONFIG.ATTACK_RANGE) {
          const angleDiff = Math.abs(
            Math.atan2(target.y - attacker.y, target.x - attacker.x) - attacker.rotation
          );
          
          if (angleDiff < Math.PI / 3) {
            if (target.takeDamage(GAME_CONFIG.ATTACK_DAMAGE)) {
              this.respawnPlayer(targetId);
            }
            hits.push(targetId);
          }
        }
      }
    });
    return hits;
  }

  respawnPlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.x = Math.random() * 2000 + 500;
      player.y = Math.random() * 2000 + 500;
      player.health = player.maxHealth;
      player.stamina = GAME_CONFIG.MAX_STAMINA;
      player.onShip = false;
      player.shipId = null;
    }
  }

  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    this.players.forEach(player => {
      player.update(deltaTime);
    });

    this.ships.forEach(ship => {
      ship.update(deltaTime);
      ship.crew.forEach(playerId => {
        const player = this.players.get(playerId);
        if (player && player.onShip) {
          player.x = ship.x;
          player.y = ship.y;
        }
      });
    });

    this.projectiles.forEach((projectile, id) => {
      projectile.update(deltaTime);
      
      this.players.forEach((player, playerId) => {
        if (playerId !== projectile.owner && !player.onShip) {
          const distance = Math.sqrt(
            Math.pow(projectile.x - player.x, 2) +
            Math.pow(projectile.y - player.y, 2)
          );
          
          if (distance < 20) {
            if (player.takeDamage(projectile.damage)) {
              this.respawnPlayer(playerId);
            }
            this.projectiles.delete(id);
          }
        }
      });
      
      if (projectile.lifetime <= 0) {
        this.projectiles.delete(id);
      }
    });
  }

  serialize() {
    return {
      players: Array.from(this.players.values()).map(p => p.serialize()),
      ships: Array.from(this.ships.values()).map(s => s.serialize()),
      projectiles: Array.from(this.projectiles.values()).map(p => p.serialize())
    };
  }
}