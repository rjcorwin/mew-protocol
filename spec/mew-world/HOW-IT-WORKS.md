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

// MEW World uses the standard MEWClient from the SDK
// Defined in: src/client/MEWClient.ts
import { MEWClient } from '@mew-protocol/mew/client';

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

  // Prepare position streaming helper
  this.positionStreamManager = new PositionStreamManager(this.client, this.playerId);
  this.initializePositionStream();

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

This is where multiplayer magic happens (see `GameScene.ts:196-221`). The helper `encodeMovementFrame` (defined in `network/movement-stream.ts`) turns a structured `PositionUpdate` into the compact string payload:

```typescript
private publishPosition(velocity: Phaser.Math.Vector2) {
  const streamId = this.positionStreamManager.getLocalStreamId();
  if (!streamId) {
    return; // Stream handshake not finished yet
  }

  const update: PositionUpdate = {
    participantId: this.playerId,
    worldCoords: {
      x: this.localPlayer.x,
      y: this.localPlayer.y
    },
    tileCoords: {
      x: Math.floor(this.localPlayer.x / TILE_WIDTH),
      y: Math.floor(this.localPlayer.y / TILE_HEIGHT)
    },
    velocity: { x: velocity.x, y: velocity.y },
    timestamp: Date.now(),
    platformRef: null
  };

  this.client.sendStreamData(
    streamId,
    encodeMovementFrame({
      participantId: update.participantId,
      timestamp: update.timestamp,
      world: update.worldCoords,
      tile: update.tileCoords,
      velocity: update.velocity,
      platformRef: update.platformRef,
    })
  );
}
```

**What happens:**
1. Player 1 moves → sends a compact movement frame on their stream (`#stream-42#1|player1|...`) where IDs/platform refs are URL-encoded to avoid delimiter collisions
2. Gateway verifies Player 1 owns `stream-42`
3. Gateway forwards the raw frame to EVERY participant in the space
4. Player 2 receives the frame, decodes the pipe-delimited payload, and converts it to a `PositionUpdate`
5. Remote sprites update instantly without polluting the envelope log

### 6. Receiving Remote Players

Every client listens for these messages (see `GameScene.ts:96-115`):

```typescript
private subscribeToPositionUpdates() {
  this.client.onStreamData((frame) => {
    const update = this.positionStreamManager.parseFrame(frame);

    if (!update || update.participantId === this.playerId) {
      return;
    }

    // Create or update remote player sprite
    this.updateRemotePlayer(update);
  });
}
```

`PositionStreamManager` keeps stream negotiation centralized. It records every `stream/request` and `stream/open` pair, exposes the local `stream_id`, and safely parses incoming frames before the game scene touches them.

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

## Why Streams Instead of Broadcast?

Broadcast envelopes were easy to prototype, but they came with heavy downsides:

- **10 Hz spam** in the shared envelope log made debugging other activity painful
- **Larger payloads** due to JSON metadata on every update (protocol, ids, timestamps)
- **No binary option** which prevented future sprite or animation syncing

Streams fix all three issues while staying within the spec’s lifecycle rules:

1. **Handshake** – each participant sends a `stream/request` with `description: "mew-world/positions"`
2. **Gateway reply** – everyone receives the `stream/open` for that request and stores the `stream_id`
3. **Raw frames** – players send `#stream-id#1|…` payloads without envelope wrappers
4. **Parsing** – `PositionStreamManager` validates the stream owner and converts the pipe-delimited frames back into `PositionUpdate` objects

Late joiners still succeed because `PositionStreamManager` records the owner when it sees the first valid payload, even if the original handshake happened before they connected.

Result: the envelope history stays clean, bandwidth drops, and the rendering loop consumes structured updates exactly as before.

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

## Headless Testing (No Electron Required)

Need to verify networking on CI or a server without a display? The headless harness exercises the same stream logic as the game scene:

```bash
cd clients/mew-world
npm run headless -- \
  --gateway ws://localhost:8080 \
  --space mew-world \
  --participant player1 \
  --token "$(cat /path/to/.mew/tokens/player1.token)" \
  --duration 15000
```

- Builds the client, connects with `MEWClient`, requests the position stream, and sends circular movement updates.
- Prints any remote player frames that arrive on the stream so you can pair it with another headless process or an Electron client.
- Accepts optional flags: `--interval` (ms between updates) and `--radius` (movement size) for stress testing.

Launch a second terminal with a different participant to confirm both sides exchange streamed updates without opening Electron windows.

## Key Concepts

### Client-Side Prediction
When you press an arrow key, your sprite moves immediately. You don't wait for the server to confirm. This gives instant feedback and makes the game feel responsive.

### Server Authority (Future)
Currently, the game trusts all clients. In a production game, the server would validate positions to prevent cheating. MEW World doesn't implement this yet since it's a collaborative demo.

### Dead Reckoning (Future)
If we lose contact with a player, we could predict their movement based on their last known velocity. Not implemented yet, but the `velocity` field in position updates enables this.

### Lag Compensation (Future)
When you see other players, you're seeing them slightly in the past (due to network latency). Advanced games compensate for this. MEW World uses simple interpolation instead.

## MEWClient: The Foundation

MEW World doesn't implement its own WebSocket client - it uses the **standard MEWClient from the MEW Protocol SDK**.

### Why This Matters

**MEWClient is generic and reusable:**
- Defined in `src/client/MEWClient.ts`
- Handles WebSocket connections, authentication, heartbeats, reconnection
- Used by all MEW applications: games, agents, bridges, CLI tools
- Applications just send/receive custom message types

**The abstraction layers:**
```
┌─────────────────────────────────────┐
│   MEW World Game Logic              │
│   (GameScene.ts)                    │
│   - Sends game/position messages    │
│   - Listens for game/position       │
└──────────────┬──────────────────────┘
               │ uses
┌──────────────▼──────────────────────┐
│   MEWClient (SDK)                   │
│   (src/client/MEWClient.ts)         │
│   - WebSocket management            │
│   - Protocol envelope handling      │
│   - Generic send/receive            │
└──────────────┬──────────────────────┘
               │ talks to
┌──────────────▼──────────────────────┐
│   MEW Gateway                       │
│   - Routes messages between clients │
│   - Validates capabilities          │
└─────────────────────────────────────┘
```

**Key MEWClient methods used by MEW World:**
- `send(envelope)` - Send any message type (MEW World sends `kind: 'game/position'`)
- `onMessage(handler)` - Listen for all incoming messages (MEW World filters for `kind: 'game/position'`)
- `onWelcome(handler)` - Know when connection succeeds
- `connect()` / `disconnect()` - Connection lifecycle

**Benefits:**
- MEW World doesn't need WebSocket expertise
- MEWClient doesn't need game logic
- Protocol upgrades benefit all applications
- Same pattern used by AI agents, MCP bridges, and other MEW apps

## File Reference

- `spec/mew-world/SPEC.md` - Full specification
- `spec/mew-world/implementation-plan.md` - Development milestones
- `templates/mew-world/space.yaml` - Space configuration
- `clients/mew-world/src/renderer.ts` - Connection form
- `clients/mew-world/src/game/GameScene.ts` - Game logic
- `clients/mew-world/src/types.ts` - TypeScript interfaces
- `clients/mew-world/index.html` - UI layout
- **`src/client/MEWClient.ts`** - SDK client used by MEW World

## Next Steps

See `implementation-plan.md` for upcoming features:
- **Milestone 3**: Ship MCP Server
- **Milestone 4**: Platform Coordinate System
- **Milestone 5**: Ship Movement & Collision
- **Milestone 6**: GameAgent Base Class
- **Milestone 7**: Polish & Performance
- **Milestone 8**: End-to-End Testing
