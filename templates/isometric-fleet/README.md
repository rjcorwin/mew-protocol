# Isometric Fleet Template

The **Isometric Fleet** template provisions a MEW space configured for the multiplayer Phaser + Electron client. It spawns four human participants and four MEW copilots who can coordinate movement using the movement stream provided by the new client SDK.

## Participants

- `human-1` &ndash; Helm
- `human-2` &ndash; Navigator
- `human-3` &ndash; Engineer
- `human-4` &ndash; Lookout
- `agent-1`..`agent-4` &ndash; MEW copilots ready to stream movement updates

All participants are granted access to the streaming capabilities required by the game client:

- `stream/request`
- `stream/open`
- `stream/close`

The agents inherit a configurable system prompt so you can tailor their behavior (for example, to run the built-in autopilot routines).

## Using the Template

```bash
mew init isometric-fleet
cd {{SPACE_NAME}}
mew space up
```

Once the gateway is running, launch the Electron client from this repository:

```bash
npm run build
npx electron ./dist/client/game/electron/main.js
```

Fill in the gateway URL, port, username (matching a participant such as `human-1`), and token from `.mew/tokens/<participant>.token` to join the flotilla.

## Ship Autopilot

The Phaser scene includes deck support for ships. You can broadcast ship position updates by creating a participant that sends `ship-update` frames over the movement stream using the exported `MovementStream` helper from `@mew-protocol/mew/client/game`.
