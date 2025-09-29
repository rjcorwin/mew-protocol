# @mew-protocol/mew

Unified MEW Protocol distribution that packages the SDK, CLI, TypeScript agent, and MCP bridge into a single npm package.

## Contents

- `mew` CLI with `space`, `agent`, `bridge`, `gateway`, and `token` subcommands
- SDK exports:
  - `@mew-protocol/mew/types`
  - `@mew-protocol/mew/client`
  - `@mew-protocol/mew/participant`
  - `@mew-protocol/mew/agent`
  - `@mew-protocol/mew/bridge`
  - `@mew-protocol/mew/capability-matcher`
- Built-in templates under `templates/`

## Development

```bash
# From repository root
npm install
npm run build --workspace packages/mew
```

The build emits compiled TypeScript sources to `dist/` and copies CLI/bin/templates assets alongside them.
