# TODO

## ADR Implementation Tasks

- [x] h2n-1: Update ADR-h2n to select Option 2 (Always Array) with decision rationale
- [x] h2n-2: Add workflow context and Go compatibility reasoning to ADR-h2n
- [x] d4n-1: Review ADR-d4n for arbitrary participant configuration support
- [x] d4n-2: Ensure ADR-d4n supports workflow engine configuration (DAG structure, runtime config)
- [x] readme-1: Update proposed ADRs README with ADR-h2n entry

## Implementation Priority Order

- [ ] impl-1: Implement core protocol (ADRs x7k, m3p, q8f)
- [ ] impl-2: Implement basic operations (ADR v2c - proposals and lifecycle)  
- [ ] impl-3: Implement correlation (ADR h2n - array correlation IDs)
- [ ] impl-4: Implement space management (ADRs d4n, g7r - config and delegation)
- [ ] impl-5: Implement reasoning transparency (ADRs t8k, k9j, p4m)

## Future ADR Considerations

- [ ] adr-err: Create ADR for error handling patterns
- [ ] adr-order: Create ADR for message ordering guarantees
- [ ] adr-workflow: Document workflow patterns separately from protocol spec

## Original Tasks

- [ ] make way through draft accepted adrs rewriting them in order.

- [ ] a2a support in bridge
- [ ] Consider having an orchestrator role for pods. Simplifies the user experience and could provide some workflow constraints to how Orchestrator agent operates.

- [ ] Finish reviewing the change to make tool part of kind.
- [ ] Finalize the MCPx v0.1 spec.
    - Wondering about the recommended server endpoints related to capabilities, how to pervent capability escalation. Might not be part of spec, but part of our gatway spec.
    - Other parts of the spec
- [ ] Update all packages for v0.1 (revert the changes for unreleased version?)
- [ ] An MCPx types package
- [ ] Add `mcpx-topic-to-mcp-server` mode to bridge.
- [ ] Reorganize packages (into sdk and agents directories?)

- [ ] multi-topic agent

- [ ] confirm UX in cli
- [ ] consider `proposeTo` and `mcp/reject`

- [ ] Investigate the occasional `cancel` messages we're seeing from `openai-agent`. 
    - Hallucinating tools?
- [ ] In blessed CLI, are we really getting ALL envelopes when in debug mode?
- [ ] In blessed CLI, scroll issues (hot keys for scroll up/down?)

- [ ] MCPx Studio Web UI (other name ideas: Brig, Orchestrium, Collaborium, Vibeland, MCPorium, xor)
    - [ ] managing the MCPx Gateway users and capabilities
    - [ ] managing agents (create, edit, shutdown, delete, dashboard)
    - [ ] Browser-based channel client (share screen, TTS, WebRTC-based cam/audio share, channel switching, channel discovery)


## asdf

- [ ] Support for elicitation in the client so the sytem agent can configure new agents (see modelcontextprotocol/docs/specification/2025-06-18/client/elicitation.mdx)
- [ ] Artifacts Side Car app for web based artifact interaction (cam feeds, formatted docs, images, audio player, video player)