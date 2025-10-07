# 🤖 Agent Quick Reference - MEW Protocol

## Critical Docs (READ FIRST AND UPDATE AFTER COMPLETING WORK)
- MEW Protocol: spec/protocol/v0.4/SPEC.md (current stable)
- Protocol Draft: spec/protocol/draft/SPEC.md (next version)
- CLI Spec: spec/cli/SPEC.md
- SDK Spec: spec/sdk/SPEC.md
- Bridge Spec: spec/bridge/SPEC.md

## Repository Structure
```
mew-protocol/
├── src/                    # Source code
│   ├── cli/               # Command-line interface
│   ├── gateway/           # Gateway server
│   ├── client/            # WebSocket client
│   ├── participant/       # MCP participant
│   ├── agent/             # AI agent
│   ├── bridge/            # MCP-MEW bridge
│   ├── capability-matcher/# Pattern matching
│   ├── mcp-servers/       # Built-in MCP servers
│   └── types/             # TypeScript types
├── dist/                   # Compiled output
├── e2e/                    # End-to-end test scenarios
├── spec/                   # All specifications
│   ├── protocol/          # Protocol spec (v0.4, draft)
│   ├── cli/               # CLI spec
│   ├── sdk/               # SDK spec
│   └── bridge/            # Bridge spec
├── templates/              # Space templates
└── docs/                   # Documentation
```

## Common Commands
```bash
npm install          # Setup
npm run build        # Build all
npm run build:watch  # Watch mode for development
npm test            # Run tests
./e2e/run-all-tests.sh  # All end-to-end tests

# Use global mew for testing (after npm link)
npm link            # Link global mew command
mew space up        # Use linked version
```

## Quick Testing Guide
```bash
# Create test space
mkdir test-feature
cd test-feature
mew init coder-agent

# Start space
mew space up  # Default port 8080

# Send messages via HTTP API
curl -X POST 'http://localhost:8080/participants/human/messages?space=test-feature' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{
    "protocol": "mew/v0.4",
    "id": "msg-1",
    "from": "human",
    "to": ["mew"],
    "kind": "chat",
    "payload": {"text": "Hello", "format": "plain"}
  }'

# View logs (non-blocking)
pm2 logs --nostream --lines 50
tail -f .mew/logs/envelope-history.jsonl
tail -f logs/gateway.log

# Interactive mode
mew space connect
# Paste JSON to send protocol messages
# Type normally for chat messages

# Clean up
mew space down
```

## Verifying CLI UI Changes (Coding Agents)

**⚠️ CRITICAL for one-terminal environments:** Must use screen to run `mew space up --interactive` in background.

**Screen Version Requirements:**
- macOS ships with v4.0.3 (broken hardcopy)
- Need v5.0.1+ for `screen -X hardcopy` to work
- Install: `brew install screen` then restart shell

**Two capture methods once screen is running:**

### Method 1: Screen Hardcopy (Requires v5.0.1+)
```bash
# MUST verify version first!
screen -v  # Must show "5.0.1+" not "4.00.03"

cd spaces/my-test
screen -dmS test bash -c "mew space up --interactive"
sleep 6
screen -S test -X hardcopy ./tmp/output.txt
cat ./tmp/output.txt
screen -S test -X quit && mew space down
```

### Method 2: Control Plane (Works with any screen version)
```bash
# Use if stuck with screen v4.0.3
cd spaces/my-test
screen -dmS test bash -c "mew space up --interactive --control-port 9999"
sleep 6
curl -s http://localhost:9999/control/screen | jq -r '.plain'
curl -s http://localhost:9999/control/state | jq '.messages'
screen -S test -X quit && mew space down
```

**Bottom line:** Screen v5.0.1+ = one command. Screen v4.0.3 = need control plane for capture.

See `docs/development.md` for full details.

## Interactive UI Navigation

When connected to a space with `mew space connect` or `mew space up --interactive`, you can use **vim-style navigation** to browse message history:

### Entering Navigation Mode
- Press `j` or `k` when the input is empty to enter navigation mode
- Status bar shows: `Navigate (N/Total) - ↵ to exit`

### Navigation Keys
- `j` or `↓` - Move down to next message
- `k` or `↑` - Move up to previous message
- `g` - Jump to first message
- `G` - Jump to last message
- `i` - Exit navigation mode and return to input

### Visual Indicators
- `▶` appears next to the focused message
- Status bar shows current position (e.g., `Navigate (5/15)`)
- Only 5 messages displayed at a time (centered on focused message)

### Implementation Details
- **File:** `src/cli/utils/advanced-interactive-ui.ts`
- **Window size:** 5 messages (ensures all content fits on screen)
- **Focus system:** Uses Ink's `useFocus` + `useFocusManager` with programmatic focus control
- **Viewport:** Sliding window centered on focused message (vim-style scrolling)

See `docs/development.md` sections on "Verifying CLI UI Changes" for testing navigation programmatically.

## Development Workflow
1. Read existing patterns before implementing
2. Update types first (`src/types/`), then implementations
3. Test with end-to-end scenarios in `e2e/scenario-*/`
4. Check TypeScript errors: `npm run lint`
5. Rebuild after changes: `npm run build`

## Key Files
- Protocol types: `src/types/protocol.ts`
- Gateway: `src/cli/commands/gateway.ts`
- Agent: `src/agent/MEWAgent.ts`
- Client: `src/client/MEWClient.ts`
- Test examples: `e2e/scenario-*/`

## Important Rules
- DON'T modify `dist/` or `.tsbuildinfo` files directly
- DON'T commit without running tests
- DO follow TypeScript strict mode
- DO run `npm run build` after changes
- DO update specs if changing protocol

## Making Changes
1. **Protocol changes**: Update spec/protocol/draft/ → src/types/ → implementations → tests
2. **New features**: Check spec → implement → test → document
3. **Bug fixes**: Write failing test → fix → verify all tests pass

## Documentation
- Main docs hub: `docs/README.md`
- Development: `docs/development.md`
- Testing: `docs/testing.md`
- Templates: `docs/templates.md`
- Releasing: `docs/releasing.md`
- Spec guide: `docs/guides/SPEC-GUIDE.md`

## Specs Navigation
- All specs: `spec/README.md`
- Protocol v0.4 (stable): `spec/protocol/v0.4/SPEC.md`
- Protocol draft (next): `spec/protocol/draft/SPEC.md`
- CLI spec: `spec/cli/SPEC.md`
- SDK spec: `spec/sdk/SPEC.md`
- Bridge spec: `spec/bridge/SPEC.md`

When in doubt, the specification is the source of truth!
