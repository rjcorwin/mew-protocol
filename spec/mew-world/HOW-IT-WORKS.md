# How MEW World Works

This document explains the architecture and implementation details of MEW World, a multiplayer isometric game built on the MEW protocol.

## Architecture Overview

MEW World has three main components working together:

1. **MEW Gateway** - Central server running the protocol
2. **Space Configuration** - Defines who can join and what they can do
3. **Game Clients** - Electron apps that connect and play

```
┌─────────────┐         ┌─────────────┐
│  Player 1   │         │  Player 2   │
│   Client    │         │   Client    │
└──────┬──────┘         └──────┬──────┘
       │                       │
       │   WebSocket           │   WebSocket
       │   Messages            │   Messages
       └───────┐       ┐───────┘
               │       │
          ┌────▼───────▼────┐
          │   MEW Gateway   │
          │  (Port 8080)    │
          └─────────────────┘
```

## Step-by-Step: How It Works

### 1. Space Setup

First, you create a space using the template:

```bash
mew init mew-world
cd mew-world
mew space up
```

This creates `.mew/` directory with:
- `space.yaml` - Configuration defining 4 human slots (player1-4) and 4 AI slots (agent1-4)
- `tokens/` - Authentication tokens for each participant
- Gateway starts listening on port 8080

**Key part of space.yaml:**
```yaml
participants:
  player1:
    capabilities:
      - kind: "*"  # Can send/receive all message types

  player2:
    capabilities:
      - kind: "*"
```

### 2. Client Connection

When you launch the Electron app (`npm start` from `clients/mew-world/`):

**Connection Form** (`index.html` + `renderer.ts`):
```typescript
// User enters:
// - Gateway: ws://localhost:8080
// - Space: mew-world
// - Username: player1
// - Token: (from .mew/tokens/player1.token)

const client = new MEWClient({
  gateway: 'ws://localhost:8080',
  space: 'mew-world',
  token: 'abc123...',
  participant_id: 'player1'
});

await client.connect();
```

**What happens:**
1. WebSocket opens to gateway
2. Client sends authentication
3. Gateway validates token matches participant_id
4. Gateway sends `system/welcome` message
5. Client transitions to game view

### 3. Game Initialization

Once connected, Phaser game starts (`GameScene.ts`):

```typescript
create() {
  // Create isometric grid (visual only)
  this.createIsometricGround();

  // Create local player sprite (green circle)
  this.localPlayer = this.add.sprite(400, 300, 'player');
  this.localPlayer.setTint(0x00ff00); // Green = you

  // Set up arrow key controls
  this.cursors = this.input.keyboard!.createCursorKeys();

  // Subscribe to position updates from other players
  this.subscribeToPositionUpdates();
}
```

**Isometric grid rendering** (see `GameScene.ts:66-88`):
```typescript
// Converts grid coordinates to screen coordinates
for (let y = 0; y < 20; y++) {
  for (let x = 0; x < 20; x++) {
    const screenX = (x - y) * (TILE_WIDTH / 2);
    const screenY = (x + y) * (TILE_HEIGHT / 2);
    // Draws diamond-shaped tile at screenX, screenY
  }
}
```

This creates the diamond grid you see on screen.

### 4. Movement & Broadcasting

**Every frame (60 times per second)**, Phaser calls `update()`:

```typescript
update(time: number, delta: number) {
  // 1. Read arrow keys
  const velocity = new Phaser.Math.Vector2(0, 0);
  if (this.cursors.left?.isDown) velocity.x -= 1;
  if (this.cursors.right?.isDown) velocity.x += 1;
  if (this.cursors.up?.isDown) velocity.y -= 1;
  if (this.cursors.down?.isDown) velocity.y += 1;

  // 2. Normalize diagonal movement
  if (velocity.length() > 0) {
    velocity.normalize();
    velocity.scale(MOVE_SPEED * (delta / 1000));

    // 3. Move local player sprite
    this.localPlayer.x += velocity.x;
    this.localPlayer.y += velocity.y;
  }

  // 4. Broadcast position every 100ms (10 Hz)
  if (time - this.lastPositionUpdate > 100) {
    this.publishPosition(velocity);
    this.lastPositionUpdate = time;
  }
}
```

### 5. Position Broadcasting (The Key Part!)

This is where multiplayer magic happens (see `GameScene.ts:196-221`):

```typescript
private publishPosition(velocity: Phaser.Math.Vector2) {
  const update: PositionUpdate = {
    participantId: this.playerId,  // "player1"
    worldCoords: {
      x: this.localPlayer.x,  // Current pixel position
      y: this.localPlayer.y
    },
    tileCoords: {
      x: Math.floor(this.localPlayer.x / TILE_WIDTH),
      y: Math.floor(this.localPlayer.y / TILE_HEIGHT)
    },
    velocity: { x: velocity.x, y: velocity.y },
    timestamp: Date.now(),
    platformRef: null  // Future: for standing on ships
  };

  // CRITICAL: Broadcast to ALL participants
  this.client.send({
    kind: 'game/position',  // Custom message type
    to: [],                 // Empty = broadcast to everyone
    payload: update
  });
}
```

**What happens:**
1. Player 1 moves → sends `game/position` message
2. Gateway receives it
3. Gateway looks at `to: []` (empty array = broadcast)
4. Gateway sends message to ALL other participants
5. Player 2's client receives it

### 6. Receiving Remote Players

Every client listens for these messages (see `GameScene.ts:96-115`):

```typescript
private subscribeToPositionUpdates() {
  this.client.onMessage((envelope: any) => {
    if (envelope.kind === 'game/position') {
      const update: PositionUpdate = envelope.payload;

      // Ignore our own broadcasts
      if (update.participantId === this.playerId) {
        return;
      }

      // Create or update remote player sprite
      this.updateRemotePlayer(update);
    }
  });
}
```

**First time seeing a player** (see `GameScene.ts:117-147`):
```typescript
private updateRemotePlayer(update: PositionUpdate) {
  let player = this.remotePlayers.get(update.participantId);

  if (!player) {
    // Create new sprite for this remote player
    const sprite = this.add.sprite(
      update.worldCoords.x,
      update.worldCoords.y,
      'player'
    );
    sprite.setTint(0xff0000);  // Red = other players

    player = {
      id: update.participantId,
      sprite,
      targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
      lastUpdate: update.timestamp,
      velocity: update.velocity,
      platformRef: update.platformRef
    };

    this.remotePlayers.set(update.participantId, player);
    console.log(`Remote player joined: ${update.participantId}`);
  } else {
    // Update existing player's target position
    player.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
  }
}
```

### 7. Smooth Interpolation

Network updates arrive every 100ms, but we render at 60 FPS. To make movement smooth, we interpolate (see `GameScene.ts:182-193`):

```typescript
update(time: number, delta: number) {
  // ... local player movement ...

  // Interpolate remote players toward their target positions
  this.remotePlayers.forEach((player) => {
    const dx = player.targetPosition.x - player.sprite.x;
    const dy = player.targetPosition.y - player.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 1) {
      // Smoothly move toward target
      const factor = Math.min(1, (delta / 1000) * 5);
      player.sprite.x += dx * factor;
      player.sprite.y += dy * factor;
    }
  });
}
```

**Why this matters:**
- Player 2 sends position every 100ms
- Player 1 renders at 60 FPS (every 16ms)
- Without interpolation: Player 2 would "teleport" every 100ms (jittery)
- With interpolation: Player 2 smoothly glides between positions

## Visual Flow Diagram

```
Player 1 Press Arrow Key
         │
         ▼
Update local sprite position (immediate feedback)
         │
         ▼
Every 100ms: Broadcast position
         │
         ▼
    MEW Gateway
         │
         ├──────────┬──────────┐
         ▼          ▼          ▼
    Player 2   Player 3   Player 4
         │
         ▼
Receive position update
         │
         ▼
Update target position for Player 1's sprite
         │
         ▼
Every frame (60 FPS): Interpolate toward target
```

## Why Broadcast Instead of Streams?

The original buggy version used individual streams:

```typescript
// WRONG: Each player creates their own stream
this.client.send({
  kind: 'stream/request',
  to: ['gateway'],
  payload: { description: 'player-position' }
});
```

**Problem:** Player 1's stream ≠ Player 2's stream. They couldn't see each other!

**Solution:** Use broadcast messages with `to: []`:
- Single message type all clients listen for
- Gateway automatically routes to everyone
- Works regardless of join order
- Simpler than managing stream subscriptions

## Try It Yourself

1. **Terminal 1:**
```bash
cd /path/to/mew-protocol
cd clients/mew-world
npm run build
npm start
```

2. **Terminal 2:**
```bash
cd /path/to/mew-protocol
cd clients/mew-world
npm start  # Don't need to rebuild
```

3. **In first Electron window:**
   - Gateway: `ws://localhost:8080`
   - Space: `mew-world`
   - Username: `player1`
   - Token: (paste from `.mew/tokens/player1.token`)

4. **In second Electron window:**
   - Same gateway and space
   - Username: `player2`
   - Token: (paste from `.mew/tokens/player2.token`)

5. **Move around with arrow keys** - you'll see each other move in real-time!

## Key Concepts

### Client-Side Prediction
When you press an arrow key, your sprite moves immediately. You don't wait for the server to confirm. This gives instant feedback and makes the game feel responsive.

### Server Authority (Future)
Currently, the game trusts all clients. In a production game, the server would validate positions to prevent cheating. MEW World doesn't implement this yet since it's a collaborative demo.

### Dead Reckoning (Future)
If we lose contact with a player, we could predict their movement based on their last known velocity. Not implemented yet, but the `velocity` field in position updates enables this.

### Lag Compensation (Future)
When you see other players, you're seeing them slightly in the past (due to network latency). Advanced games compensate for this. MEW World uses simple interpolation instead.

## File Reference

- `spec/mew-world/SPEC.md` - Full specification
- `spec/mew-world/implementation-plan.md` - Development milestones
- `templates/mew-world/space.yaml` - Space configuration
- `clients/mew-world/src/renderer.ts` - Connection form
- `clients/mew-world/src/game/GameScene.ts` - Game logic
- `clients/mew-world/src/types.ts` - TypeScript interfaces
- `clients/mew-world/index.html` - UI layout

## Next Steps

See `implementation-plan.md` for upcoming features:
- **Milestone 3**: Ship MCP Server
- **Milestone 4**: Platform Coordinate System
- **Milestone 5**: Ship Movement & Collision
- **Milestone 6**: GameAgent Base Class
- **Milestone 7**: Polish & Performance
- **Milestone 8**: End-to-End Testing
