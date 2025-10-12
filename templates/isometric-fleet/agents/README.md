# Aurora Skiff MCP Bridge

The default template launches the built-in `isometric-fleet` MCP server, so you do not need to add any custom files here to get started. The folder is left intentionally empty so you can swap in your own MCP implementation later—just place the server entry point in this directory and update `space.yaml` to point the `aurora-skiff` participant at it.

Ideas for extensions:

- Add a helm AI that adjusts the ship heading based on wind conditions
- Provide specialized tools that hand out quests or track cargo manifests
- Introduce additional vehicles and control panels for each one
