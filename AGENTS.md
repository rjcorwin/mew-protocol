# 🤖 Agent Quick Reference - MEW Protocol

## Critical Docs (READ FIRST)
- **spec/v0.3/SPEC.md** - Current protocol specification
- **spec/draft/SPEC.md** - Upcoming changes

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
spec/              # Protocol specs (v0.3=current, draft=next)
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