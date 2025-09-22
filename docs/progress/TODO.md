# TODO

## Integration Phases
- **Phase 1 – Spec Cohesion & SDK Telemetry**: Land protocol/SDK spec updates, finish participant control hooks, add status+stream coverage in unit tests.
- **Phase 2 – CLI Experience Hardening**: Polish Ink UI (ack queue, pause banner, stream list), document commands, add regression tests and fixtures.
- **Phase 3 – Template & Agent Validation**: Exercise coder template end-to-end with new participant controls, capture manual QA notes, expand automation around stream payloads.

## MVP
- [x] [TD4] `mew init [space template]` command
    - [x] [TD4.1] `mew` by itself launches init if not init'ed, other wise it's up with interactive. if not init'ed, prompts user to pick template, then launches on choice. Space templates for common patterns (see demos/coder-agent for first template). Ok if just one template for now.
* [x] Better fulfill UX: Fixed input focus issues, added arrow navigation (Phase 1 of ADR-009)
* [x] Better formatting for thinking (shows thoughts)
* [x] Better formatting for all messages in general
- [x] [TD6] publish all npm packages
- [x] docs: Protocol comparison

## Fast Follow

* [ ] After approval dialog, the input box is in the wrong location with lots of whitespace below it, not on the bottom.
* [ ] mew command, after initial init process, should connect not stop
* [ ] running mew in a space that is up should just connect
* [ ] some kind of race conidition happening where if mcp filsystem joins before coder, the coder doesn't know abou the tools. The race condition is not the problem, the issue is that the coder doesn't ask for the tools before reasoning. Note that it's reasonable for the coder agent to not ask for tools of a participant it has already asked and has tools for, unless that participant rejoins, then destroy cache of that participant's tools

### Approval Dialog Enhancements (ADR-009)

#### Phase 2: Tool-Specific Templates
* [ ] Implement template detection logic in `OperationConfirmation` component
* [ ] Create file operation templates:
    * [ ] `write_file` template with content preview
    * [ ] `read_file` template with access reason
    * [ ] `delete_file` template with warning
* [ ] Create command execution templates:
    * [ ] npm command template with package info
    * [ ] shell command template with risk assessment
    * [ ] git operation template
* [ ] Create network request template with URL/method/headers
* [ ] Add fallback to generic template for unknown operations
* [ ] Maintain consistent numbered list interaction across all templates

#### Phase 3: Capability Grants
* [ ] Add third option "Yes, allow X to Y" to approval dialog
* [ ] Implement `capability/grant` message sending on approval
* [ ] Track granted capabilities in participant state
* [ ] Skip approval prompts for granted operations
* [ ] Add grant management UI (show active grants, allow revocation)
* [ ] Implement `capability/grant-ack` handling
* [ ] Ensure grants are session-scoped (not persistent)
* [ ] Update participant capabilities dynamically based on grants

### Other Fast Follow Items
* [ ] mew detects mew installed in space, uses that
    * Check if .mew/node_modules/@mew-protocol/cli exists
    * If found, delegate to that version instead of global
    * Allows spaces to pin specific mew versions
* [ ] mew detects when running inside mew-protocol monorepo
    * Check if cwd is within mew-protocol repo (look for root package.json with name: "mew-protocol")
    * If found, use ./cli/bin/mew.js instead of global
    * Enables developers to always use local version when developing
    * Implementation: Check process.cwd() and traverse up looking for package.json
* [ ] Clean up CLAUDE.md file (incorporate testing)
* [ ] Support for arrow back and new line (shift-Return) in CLI input
* [ ] set a default to for participants in space config (for faster resolution)
* [ ] SPEC cleanup
* [ ] Repo cleanup
* [ ] Add --no-install flag to `mew init` for development workflow (prevents npm install during init when using workspaces)


## CLI
* [ ] CLI: some kind of prompt template support (what would we need? environment variables?)
* [ ] CLI: ensure CLI client uses MEWParticipant/MEWClient
* [ ] CLI: joining a session mid reasoning cycle doesn't display who is reasoning
* [ ] CLI: Some kind of hook system so folks can decide what command to run "say hi" when an proposal is up
* [ ] CLI: reconcile cli gateway and sdk gateway
* [ ] CLI: Spaces will break on version changes. Could make mew version/deps a dep of the space so they can be upgraded.
* [ ] Choosing a template currently being skipped

## SDK
* [?] SDK: consider having types package built out first and incorporated into sdk spec
* [?] SKD: get tests up to bridge to pass
* [?] SDK Update bridge with refactored sdk

## MEW Protocol
* [ ] MEW: MEW Protocol ADR for [interruption](spec/v0.3/decisions/proposed/001-r5x-reasoning-interruption.md)
- [ ] MEW: [TD5] MEW Protocol spec: Support for streams in mew protocol (see proposed ADR)
* [ ] MEW: Context scoping


## Agent
* [ ] Better context management with rolling history mode, compact at x point mode (configurable), token counting, etc. Needs an ADR(s).

## Docs
* [ ] Tutorial: How to create a space template
