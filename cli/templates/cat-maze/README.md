# Cat Maze Cooperative Space Template

Guide a curious 🐈 through 10 handcrafted mazes using MCP tools. Humans can call the tools directly or invite the MEW agent to take over navigation.

## Features

- 🎮 **Stateful MCP server** that tracks the current maze level, cat position, and total moves
- 🧭 **Maze tools**: `view`, `up`, `down`, `left`, `right`, `restart`
- 🟫 **Emoji walls** that align visually with the 🐈 for clean board snapshots
- ◻️ **Walkable tiles** that keep pathing clear against the brown walls
- 🗣️ **Narrator companion** that relays move results and drops fresh `view` snapshots in chat
- 🤝 **Cooperative play** between human participants and the MEW agent
- 🧩 10 levels that escalate in difficulty from straight corridors to winding labyrinths

## Quick Start

```bash
# From the monorepo root
./cli/bin/mew.js space init --template cat-maze .
./cli/bin/mew.js space up
```

Once the space is running you can:

1. Use `./cli/bin/mew.js space connect` to join the chat.
2. Call MCP tools directly by sending a `tools/call` request (e.g., `{ "method": "tools/call", "params": { "name": "view" } }`).
3. Or ask the MEW agent to guide the cat (requires `AGENT_API_KEY`).

## Tool Reference

| Tool | Description |
| --- | --- |
| `view` | Show the current maze with the 🐈 and 🏁 positions plus progress stats |
| `up` | Attempt to move the cat one tile up |
| `down` | Attempt to move the cat one tile down |
| `left` | Attempt to move the cat one tile left |
| `right` | Attempt to move the cat one tile right |
| `restart` | Reset to level 1 and clear move counters |

Invalid moves keep the cat in place and report the wall you bumped into. Reaching the 🏁 advances to the next level automatically.

## Agent Tips

- Provide an `AGENT_API_KEY` if you want the MEW agent to play.
- You can pause the agent by saying something like "mew, let me take over".
- Ask for a `view` whenever the maze state feels unclear.

## Narrator Updates

A built-in narrator participant auto-starts with the space. Whenever someone moves (or restarts) the cat, it:

1. Echoes the move or restart narration back into chat.
2. Calls the `view` tool to capture the latest board state.
3. Shares the output in chat with a clear heading and progress counters.

This keeps everyone in the space aligned without manually requesting `view` after every move.

Have fun getting the kitty home! 🐾
