# 🤖 Agent Quick Reference - MEW Protocol

## Critical Docs (READ FIRST AND UPDATE AFTER COMPLETING WORK)
- MEW Protocol: spec/protocol/SPEC.md (v0.4)
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
│   ├── protocol/          # Protocol spec (v0.4)
│   │   ├── SPEC.md
│   │   ├── proposals/     # All proposals
│   │   └── rejected/      # Rejected proposals
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

## Development Workflow
1. Read existing patterns before implementing
2. Update types first (`src/types/`), then implementations
3. Test with end-to-end scenarios in `e2e/scenario-*/`
4. Check TypeScript errors: `npm run lint`
5. Rebuild after changes: `npm run build`

## Spec-Driven Development (IMPORTANT!)

When making changes, follow the workflow in `CONTRIBUTING.md`:

1. **Start with CHANGELOG** - Add entry to `CHANGELOG.md` "Next" section
2. **Create proposal** - Document in `spec/<area>/proposals/XXX-name/`
   - Use 3-char alphanumeric code: `a7z`, `k3p`, `m9w` (avoid 001, 002, or bat, tok)
   - Each proposal contains: `proposal.md`, `research.md`, `decision-XXX-name.md` files
   - `<area>` = protocol, cli, sdk, or bridge
3. **Incorporate into specs** - Update main spec docs, mark CHANGELOG as needing implementation
4. **Create implementation plan** (if complex) - `spec/integration-plans/XXX-name.md`
5. **Implement code** - Write code, tests, examples; update CHANGELOG status
6. **Submit PR** - Include proposals, spec updates, code, tests, CHANGELOG

**Key points:**
- Proposals stay in `proposals/` permanently (status tracked in CHANGELOG)
- Specs and code developed together in same PR
- All changes must update relevant specs
- If you code first, backfill proposal/spec/CHANGELOG before opening PR
- See `CONTRIBUTING.md` for full workflow details

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

**All changes must follow the spec-driven workflow above.** Quick reference:

1. **New features/protocol changes**:
   - Create proposal in `spec/<area>/proposals/XXX-name/`
   - Update specs, add to CHANGELOG
   - Implement: types → implementations → tests

2. **Bug fixes**:
   - If trivial: Write failing test → fix → verify
   - If significant: Create proposal documenting the issue and fix

## Documentation
- Main docs hub: `docs/README.md`
- Development: `docs/development.md`
- Testing: `docs/testing.md`
- Templates: `docs/templates.md`
- Releasing: `docs/releasing.md`
## Specs Navigation
- All specs: `spec/README.md`
- Protocol (v0.4): `spec/protocol/SPEC.md`
- CLI spec: `spec/cli/SPEC.md`
- SDK spec: `spec/sdk/SPEC.md`
- Bridge spec: `spec/bridge/SPEC.md`

When in doubt, the specification is the source of truth!
