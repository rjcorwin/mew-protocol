# @mew-protocol/mew

Unified distribution of the MEW Protocol (Multi-Entity Workspace Protocol) SDK,
command-line tooling, bridge runtime, and capability matcher. Installing this
package gives you the full stack required to develop, test, and operate MEW
spaces from a single dependency.

## What's included

- **CLI (`mew`)** – manage spaces, start gateways, initialise templates, and
  drive development scenarios directly from the terminal.
- **Agent runtime (`mew-agent`)** – reference TypeScript agent that connects to
  MEW gateways and executes workflows with OpenAI-compatible models.
- **Bridge runtime (`mew-bridge`)** – connect MCP servers to MEW spaces.
- **Participant base SDK** – build custom participants with capability
  management helpers.
- **Client SDK** – WebSocket client with reconnect logic and stream handling.
- **Capability matcher** – JSON-pattern matcher used by the participant and
  gateway.
- **Core protocol types** – strict TypeScript definitions for envelopes,
  payloads, and protocol constants.

## Install

```bash
npm install @mew-protocol/mew
```

### CLI usage

```bash
# Initialise a new space from bundled templates
npx --yes @mew-protocol/mew mew init coder-agent --name dev-space

# Start a space (gateway + configured participants)
node ./cli/bin/mew.js space up --port 8080

# Run the TypeScript agent against an existing gateway
npx --yes -p @mew-protocol/mew mew-agent --gateway ws://localhost:8080 --space dev --token agent-token

# Launch the MCP bridge binary
npx --yes -p @mew-protocol/mew mew-bridge --help
```

### Library usage

```ts
import { MEWClient } from '@mew-protocol/mew/client';
import { MEWParticipant } from '@mew-protocol/mew/participant';
import { MEWAgent } from '@mew-protocol/mew/agent';
import { PatternMatcher } from '@mew-protocol/mew/capability-matcher';
import { Envelope } from '@mew-protocol/mew/types';
```

## Building from source

```bash
npm install
npm run build --workspace @mew-protocol/mew
```

The build emits compiled TypeScript modules to `packages/mew/dist/` and copies
CLI assets, templates, and binaries. Use `npm run clean --workspace
@mew-protocol/mew` to reset the output directory.

## Directory structure

```
packages/mew/
  src/
    agent/                # TypeScript agent runtime
    bridge/               # MCP bridge implementation
    capability-matcher/   # JSON pattern matcher
    client/               # MEW WebSocket client
    participant/          # Participant SDK
    types/                # Protocol type definitions
    cli/                  # CLI implementation
    bin/                  # Runtime entry points (mew, mew-agent, mew-bridge)
    gateway/              # Gateway command wiring
  templates/              # Space templates bundled with the CLI
  config/                 # Example configuration files
  examples/               # Legacy examples and playgrounds
  dist/                   # Build output (generated)
```

## Tests

Run package-level smoke tests with:

```bash
npm test --workspace @mew-protocol/mew
```

Integration scenarios live in the repository root under `tests/` and are driven
by the workspace CLI wrapper at `cli/bin/mew.js`.
