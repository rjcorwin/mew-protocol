# 🤖 Agent Quick Reference - MEW Protocol

## Critical Docs (READ FIRST AND UPDATE AFTER COMPLETING WORK)
- MEW Protocol: spec/draft/SPEC.md
- SDK: sdk/spec/draft/SPEC.md
- CLI: cli/spec/draft/SPEC.md

## Repository Structure
```
sdk/typescript-sdk/    # Core packages
  types/              # @mew-protocol/types - Core types
  capability-matcher/ # Pattern matching
  client/            # WebSocket client
  participant/       # MCP participant
  agent/            # AI agent
  gateway/          # Gateway server
bridge/             # MCP-MEW bridge
cli/               # Command-line tool
tests/             # Integration tests (scenario-*)
spec/              # Protocol specs (v0.4=current, draft=next)
docs/              # Guides in architecture/, guides/, bugs/, progress/
```

## Package Dependencies
```
types → capability-matcher → participant → agent
     → client → participant
     → gateway
```

## Common Commands
```bash
npm install          # Setup
npm run build        # Build all (uses TypeScript project references)
npm run build:watch  # Dev mode
npm test            # Run tests
./tests/run-all-tests.sh  # All integration tests

# Use local CLI for testing (not global mew)
./cli/bin/mew.js space up
```

## Quick Testing Guide
```bash
# Create test space (from repo root)
cd tests && mkdir test-feature && cd test-feature
../../cli/bin/mew.js space init --template coder-agent .
cd ../.. && npm install  # Link local packages

# Start space
cd tests/test-feature
../../cli/bin/mew.js space up  # Default port 8080

# Send messages via HTTP API (replace test-feature with your folder name)
curl -X POST 'http://localhost:8080/participants/human/messages?space=test-feature' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer human-token' \
  -d '{"type": "chat", "content": "Hello"}'

# View logs (non-blocking for coding agents)
pm2 logs --nostream --lines 50     # Last 50 lines, exits immediately
pm2 logs gateway --nostream         # Gateway logs only, no streaming
pm2 logs coder --nostream --err     # Agent errors only
tail -n 100 ~/.pm2/logs/gateway-out.log  # Direct file access

# Check responses in curl (add -v for verbose)
curl -v -X POST ...  # Shows request/response headers

# Interactive mode (better for development)
../../cli/bin/mew.js space connect
# Paste JSON directly to send protocol messages
# Type normally for chat messages

# Clean up
../../cli/bin/mew.js space down
```

## Development Workflow
1. Read existing patterns before implementing
2. Update types first, then implementations
3. Test with local scenarios in `tests/scenario-*/`
4. Check TypeScript errors with `npm run lint`

## Key Files
- Protocol types: `sdk/typescript-sdk/types/src/protocol.ts`
- Message flow: See spec Section 3
- Test examples: `tests/scenario-*/`
- TODOs: `docs/progress/TODO.md`

## Important Rules
- DON'T modify `dist/` or `.tsbuildinfo` files
- DON'T use global CLI during dev
- DO follow TypeScript strict mode
- DO run relevant tests after changes
- DO update specs if changing protocol
- DO send stream/close when done with a stream (agents must clean up)

## Making Changes
1. **Protocol changes**: Update spec/draft → types → implementations → tests
2. **New features**: Check spec needs → implement → test → document
3. **Bug fixes**: Write failing test → fix → verify all tests pass

## Documentation
- Architecture: `docs/architecture/MONOREPO-ARCHITECTURE.md`
- Dev setup: `docs/guides/DEVELOPMENT.md`
- Testing: `docs/guides/TESTING.md`
- Spec writing: `docs/guides/SPEC-GUIDE.md`

When in doubt, the specification is the source of truth!