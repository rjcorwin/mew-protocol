# Isometric Fleet Template

The **Isometric Fleet** template bundles a Phaser/Electron client, a movement-aware MEW agent superclass, and a lightweight world server so teams can experiment with shared spatial coordination inside a MEW space. Four human slots and four MEW agents can walk around the harbor, board a ship, and watch their positions update in real time via protocol streams.

## What ships with the template

- **Electron desktop client** (`client/`) built with Phaser 3 that renders an isometric harbor map, exposes a connection form (gateway URL, port, username, token), and forwards keyboard input as movement commands over MEW streams.
- **World server** (`agents/isometric-world-server.mjs`) that manages terrain, player state, the autonomous ship, and exposes MCP tools for helm control.
- **Mobile MEW agent runner** (`agents/isometric-agent-runner.mjs`) powered by the new `MobileMEWAgent` superclass. Four AI crewmates wander the docks at the correct speed limits without any external LLM calls.
- **Space definition** (`space.yaml`) that wires together four human participants, four MEW agents, the world server, and ship control capabilities.

## Quick start

```bash
mew init isometric-fleet
cd isometric-fleet
mew space up
```

1. Start the space (`mew space up`).
2. Install the desktop client dependencies and launch the Electron app:
   ```bash
   cd client
   npm install
   npm start
   ```
3. Fill in the connection form with the gateway URL (defaults to `ws://localhost:PORT`), the port printed by `mew space up`, your participant token, desired username, and participant ID.
4. Use arrow keys or WASD to move. Step onto the ship’s deck to board—it will carry you as it sails. Press `B` to disembark when you’re adjacent to land.

## Ship control MCP tools

The harbor master exposes two MCP tools to orchestrate the ship:

| Tool | Description |
| ---- | ----------- |
| `ship.set_manual_target` | Provide a `{ "x": number, "y": number }` waypoint to steer the ship manually. |
| `ship.resume_autopilot` | Return to the default looped patrol route. |

Agents or humans with MCP permissions can call these tools to redirect the ship while passengers remain synchronized to the moving deck.

## AI crew

The template provisions four MEW agents (`mew-agent-1` through `mew-agent-4`). Each instance uses the exported `MobileMEWAgent` class to:

- Discover the world broadcast stream automatically
- Respect tile speed restrictions before issuing movement commands
- Randomly explore walkable terrain without requiring an API key (`mockLLM: true`)

You can subclass `MobileMEWAgent` in your own projects to plug in deterministic patrols or higher-level planning policies.

## Files of interest

- `agents/isometric-world-server.mjs` — maintains terrain, players, boarding logic, and ship physics
- `agents/isometric-agent-runner.mjs` — thin launcher for `MobileMEWAgent`
- `client/` — Electron project with Phaser renderer and keyboard handling
- `space.yaml` — eight participant slots plus world server configuration
- `template.json` — metadata so `mew init isometric-fleet` is discoverable

For a deeper walkthrough of controls and extension ideas, see the **Isometric Fleet** section in [`docs/templates.md`](../../docs/templates.md#isometric-fleet-template).
