# Research s3h-transport-server

## Prior Art

- **MMO vehicle systems** – Titles such as World of Warcraft and Final Fantasy XIV implement ferry-style transports that carry players between zones. They rely on server-side boarding radii and shared movement frames to avoid clients desynchronising when latency spikes.
- **Phaser moving platforms** – Phaser's arcade physics examples demonstrate attaching sprites to moving platforms by storing relative offsets and applying the parent's velocity each tick. Our lifecycle manager borrows the same concept without bringing in the physics engine.
- **MCP tool ergonomics** – Existing MCP servers (e.g., `cat-maze.ts`) rely on JSON-RPC messages flowing over STDIN/STDOUT, list their tools through `tools/list`, and keep payloads small to stay LLM-friendly. The ship server will follow that model.

## Validation Strategy

- Unit-test the lifecycle manager with Vitest to cover boarding, carriage during motion, and disembarking transitions.
- Exercise the MCP surface manually via `mew mcp ship` piping JSON requests to ensure deterministic tool responses.
- Pair the ship participant with the headless MEW World simulation to verify it publishes movement frames at the expected cadence once the bridge milestone wires everything together.

## Open Questions

- How should the ship behave when multiple players crowd the deck edges? For now we add a configurable buffer to avoid flapping; collision rules will be addressed later.
- Do we need dedicated MCP notifications for passenger events? The initial implementation can return the lifecycle event in the `report_player_position` response and leave real-time notifications for a future milestone if necessary.
