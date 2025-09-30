# @mew-protocol/mew

This package bundles the entire MEW Protocol toolchain – the SDK libraries, CLI, and MCP bridge – into a single install.

## Contents

- **SDK modules**: Type definitions, WebSocket client, participant helpers, agent runtime, capability matcher, and MCP bridge utilities.
- **CLI**: The `mew` command-line interface plus shims for `mew-agent` and `mew-bridge`.
- **Templates**: Reference workspaces for cat maze, coder agent, and note-taker scenarios.

## Scripts

Run from the repository root:

```bash
npm run build           # Compile TypeScript and copy CLI assets
npm run clean           # Remove build output
```

The CLI wrapper at `cli/bin/mew.js` forwards to this package, so existing developer workflows continue to work.
