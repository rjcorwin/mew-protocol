# MEW World - Isometric Multiplayer Game

A multiplayer isometric game space built on MEW Protocol, where humans and AI agents can move around a 2D world, interact, and board ships together.

## Features

- **4 Human Players**: Connect multiple human players to the same game world
- **4 AI Agents**: Autonomous AI agents that can navigate and interact in the world
- **Real-time Position Sync**: All player movements synchronized via MEW protocol streams
- **Ship Support**: Players can board ships and sail together (coming soon)

## Quick Start

### Initialize a New Game Space

```bash
mew init game-isometric my-game-world
cd my-game-world
```

### Start the Space

```bash
mew space up
```

The gateway will start on port 8080 by default.

### Connect Players

Human players can connect to the space in several ways:

1. **Via Electron Client** (recommended for gameplay):
   - Launch the MEW World Electron client
   - Enter connection details:
     - URL: `ws://localhost:8080`
     - Space: `my-game-world`
     - Username: `player1`, `player2`, `player3`, or `player4`
     - Token: Found in `.mew/tokens/player1.token` (etc.)

2. **Via CLI** (for testing):
   ```bash
   mew space connect
   ```

3. **Via HTTP API** (for programmatic control):
   ```bash
   curl -X POST 'http://localhost:8080/participants/player1/messages?space=my-game-world' \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <player1-token>' \
     -d '{
       "protocol": "mew/v0.4",
       "id": "msg-1",
       "from": "player1",
       "to": ["agent1"],
       "kind": "chat",
       "payload": {"text": "Hello!", "format": "plain"}
     }'
   ```

### AI Agents

The 4 AI agents (`agent1`, `agent2`, `agent3`, `agent4`) start automatically with the space. They can:
- Explore the world autonomously
- Respond to chat messages from players
- Interact with MCP tools for movement

## Space Configuration

### Participants

- **player1, player2, player3, player4**: Human participants with full capabilities
- **agent1, agent2, agent3, agent4**: AI-powered game agents with movement capabilities

### Streams

- **player/position**: Real-time position synchronization for all participants
  - All players can publish and subscribe
  - Retains last 100 position updates

### Required Environment Variables

Set these before starting the space:

```bash
export OPENAI_API_KEY="your-api-key"  # For AI agents
```

Optional configuration:

```bash
export AGENT_BASE_URL="https://api.openai.com/v1"  # Default
export AGENT_MODEL="gpt-4o"  # Default AI model
```

## Position Stream Format

Position updates are published to the `player/position` stream with this format:

```json
{
  "participantId": "player1",
  "worldCoords": {"x": 100, "y": 200},
  "tileCoords": {"x": 10, "y": 20},
  "velocity": {"x": 0, "y": 0},
  "timestamp": 1234567890,
  "platformRef": null
}
```

## Development

See the [MEW World Specification](../../spec/mew-world/SPEC.md) for implementation details.

### Next Steps

1. Build the Electron client with Phaser 3 integration
2. Implement GameAgent base class for AI navigation
3. Add ship MCP server for movable platforms
4. Implement platform coordinate system for ship boarding

## Troubleshooting

### Agents not starting
- Check that `OPENAI_API_KEY` is set in your environment
- Verify the API key is valid and has credits

### Connection issues
- Ensure the gateway is running (`mew space status`)
- Check that the port (default 8080) is not in use
- Verify tokens exist in `.mew/tokens/` directory

### Position updates not syncing
- Confirm participants have `stream/publish` capability
- Check stream subscriptions are active
- View envelope history: `tail -f .mew/logs/envelope-history.jsonl`
