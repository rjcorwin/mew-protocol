# TODO

## MVP
- [x] [TD4] `mew init [space template]` command
    - [x] [TD4.1] `mew` by itself launches init if not init'ed, other wise it's up with interactive. if not init'ed, prompts user to pick template, then launches on choice. Space templates for common patterns (see demos/coder-agent for first template). Ok if just one template for now.
* [ ] Better fulfill UX: CUrrently results in showing an "a" in the input box every time you accept.
* [x] Better formatting for thinking (shows thoughts)
* [x] Better formatting for all messages in general
- [x] [TD6] publish all npm packages
- [x] docs: Protocol comparison

## Fast Follow
* [ ] mew detects mew installed in space, uses that
* [ ] Clean up CLAUDE.md file (incorporate testing)
* [ ] Support for arrow back and new line (shift-Return) in CLI input
* [ ] set a default to for participants in space config (for faster resolution)
* [ ] SPEC cleanup
* [ ] Repo cleanup
* [ ] Add --no-install flag to `mew init` for development workflow (prevents npm install during init when using workspaces)
* [ ] Another option that is "accept and don't ask again" which results in modifying the capabilities for that participant to do that kind of operation again. The thing is not every operation will be the same so it's hard to infer what the "don't ask again" really means. So... ADR for this. But we can also start with an implementation that is literally the MCP request, and we ADR about how to generalize the "do not ask again". 
    * [ ] When a participant grants, and system responds with accepted, then receiver of grant must update it's knowledge of grant so it no longer propsoses when it doesn't have to.


## CLI
* [ ] CLI: some kind of prompt template support (what would we need? environment variables?)
* [ ] CLI: ensure CLI client uses MEWParticipant/MEWClient
* [ ] CLI: joining a session mid reasoning cycle doesn't display who is reasoning
* [ ] CLI: Some kind of hook system so folks can decide what command to run "say hi" when an proposal is up
* [ ] CLI: reconcile cli gateway and sdk gateway
* [ ] CLI: Spaces will break on version changes. Could make mew version/deps a dep of the space so they can be upgraded.

## SDK
* [?] SDK: consider having types package built out first and incorporated into sdk spec
* [?] SKD: get tests up to bridge to pass
* [?] SDK Update bridge with refactored sdk

## MEW Protocol
* [ ] MEW: MEW Protocol ADR for [interruption](spec/v0.3/decisions/proposed/001-r5x-reasoning-interruption.md)
- [ ] MEW: [TD5] MEW Protocol spec: Support for streams in mew protocol (see proposed ADR)
* [ ] MEW: Context scoping
