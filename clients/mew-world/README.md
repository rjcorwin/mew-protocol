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

## Headless Simulation (No Electron)

Useful for CI or remote servers where a display isn't available.

```bash
cd clients/mew-world
npm run headless -- \
  --gateway ws://localhost:8080 \
  --space mew-world \
  --participant player1 \
  --token "$(cat /path/to/.mew/tokens/player1.token)" \
  --duration 10000
```

- Builds the renderer, connects with `MEWClient`, and requests the shared position stream.
- Publishes circular movement updates at 10 Hz using `sendStreamData` with the compact movement stream format.
- Logs any remote frames that arrive so you can pair it with another headless process or a running Electron client.
- Optional flags: `--interval` (ms cadence) and `--radius` (movement distance) for stress scenarios.

## Architecture

- **Main Process** (`src/main.ts`): Electron window management
- **Renderer Process** (`src/renderer.ts`): Connection form and game initialization
- **Game Scene** (`src/game/GameScene.ts`): Phaser game logic, rendering, and networking
- **Types** (`src/types.ts`): TypeScript interfaces for position updates

## Network Protocol

Position updates are sent via MEW protocol streams as a pipe-delimited string that avoids JSON parsing overhead:

```
1|player1|l0xet8|412.5,296.25|6,9|42.1,-17.6|~
```

Fields:

1. `1` – payload version tag so we can evolve the format later
2. `player1` – participant ID that owns the stream (URL-encoded to avoid delimiter clashes)
3. `l0xet8` – timestamp encoded as base36 milliseconds since epoch
4. `412.5,296.25` – world coordinates trimmed to 3 decimal places
5. `6,9` – tile coordinates (integers)
6. `42.1,-17.6` – velocity vector
7. `~` – platform reference (tilde represents `null`; non-null values are URL-encoded)

Updates are published at 10 Hz (every 100ms) whenever the local player is moving, and decoded back into a `PositionUpdate` before rendering.

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
