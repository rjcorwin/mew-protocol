# Development Spaces

This directory contains development and example spaces for testing MEW Protocol with local packages.

## Usage

Create development spaces here to automatically use local packages via npm workspaces:

```bash
cd spaces/
mkdir my-space
cd my-space
../../cli/bin/mew.js space init .
```

## How it Works

- Spaces created here automatically use local `@mew-protocol/*` packages
- No need to publish packages or use npm link
- Changes to SDK code are immediately available to spaces
- The `.mew/` subdirectory contains runtime configuration and is managed by the CLI

## Notes

- This directory is gitignored - spaces here are for local development only
- For test scenarios with automated checks, use the `tests/` directory instead
- Run `npm install` at the monorepo root after creating new spaces
