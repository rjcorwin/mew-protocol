# MEW World Client

Electron-based multiplayer isometric game client for MEW Protocol.

## Features

- **Connection Form**: Enter gateway URL, space name, username, and token
- **Isometric Rendering**: Phaser 3-powered isometric world
- **Real-time Multiplayer**: Position updates via MEW protocol streams
- **Smooth Interpolation**: Remote players move smoothly between updates

## Prerequisites

- Node.js 18+
- A running MEW space with the `mew-world` template

## Setup

From the repository root:

```bash
# Install dependencies (if not already done)
npm install

# Build the MEW protocol packages
npm run build

# Navigate to client directory
cd clients/mew-world

# Install client dependencies
npm install

# Build the client
npm run build

# Start the client
npm start
```

## Development

```bash
# Watch mode (rebuilds on file changes)
npm run dev
```

## How to Play

1. **Start a MEW World space**:
   ```bash
   cd /path/to/your/game/directory
   mew init mew-world
   mew space up
   ```

2. **Launch the client** (from `clients/mew-world`):
   ```bash
   npm start
   ```

3. **Connect to the space**:
   - Gateway URL: `ws://localhost:8080` (or your gateway URL)
   - Space Name: Your space name (e.g., `mew-world`)
   - Username: One of `player1`, `player2`, `player3`, or `player4`
   - Token: Found in `.mew/tokens/<username>.token` in your space directory

4. **Play**:
   - Use arrow keys to move around
   - See other players as red circles
   - Your player is green

## Multi-Player Testing

1. **Start a space**:
   ```bash
   cd /tmp
   mew init mew-world test-world
   cd test-world
   mew space up
   ```

2. **Get player tokens**:
   ```bash
   cat .mew/tokens/player1.token
   cat .mew/tokens/player2.token
   ```

3. **Launch multiple clients**:
   - Open 2+ instances of the Electron app
   - Each client connects as a different player (player1, player2, etc.)
   - Move around and see each other in real-time!

## Architecture

- **Main Process** (`src/main.ts`): Electron window management
- **Renderer Process** (`src/renderer.ts`): Connection form and game initialization
- **Game Scene** (`src/game/GameScene.ts`): Phaser game logic, rendering, and networking
- **Types** (`src/types.ts`): TypeScript interfaces for position updates

## Network Protocol

Position updates are sent via MEW protocol streams:

```typescript
{
  participantId: string;
  worldCoords: { x: number; y: number };
  tileCoords: { x: number; y: number };
  velocity: { x: number; y: number };
  timestamp: number;
  platformRef: string | null;
}
```

Updates are published at 10 Hz (every 100ms) when the player is moving.

## Troubleshooting

**"Not connected to gateway"**
- Ensure the MEW space is running (`mew space status`)
- Check the gateway URL is correct
- Verify the space name matches

**"Authentication failed"**
- Ensure you're using a valid token from `.mew/tokens/`
- Check that the username matches a participant in space.yaml

**Can't see other players**
- Ensure both clients are connected to the same space
- Check that stream capabilities are enabled in space.yaml
- Look for errors in the Electron DevTools console (View > Toggle Developer Tools)

## Future Enhancements

- Ships and movable platforms
- AI-controlled agents with navigation
- Collision detection
- Sprites and animations
- Sound effects
- Chat system
