# TODO

## ADR Implementation Tasks

- [x] h2n-1: Update ADR-h2n to select Option 2 (Always Array) with decision rationale
- [x] h2n-2: Add workflow context and Go compatibility reasoning to ADR-h2n
- [x] d4n-1: Review ADR-d4n for arbitrary participant configuration support
- [x] d4n-2: Ensure ADR-d4n supports workflow engine configuration (DAG structure, runtime config)
- [x] readme-1: Update proposed ADRs README with ADR-h2n entry

## Implementation Priority Order

- [x] impl-1: Implement core protocol (ADRs x7k, m3p, q8f)
- [x] impl-1.5: Standardize property naming convention (ADR j3k)
- [x] impl-2: Implement basic operations (ADR v2c - proposals and lifecycle)
- [x] impl-3: Implement correlation (ADR h2n - array correlation IDs)
- [x] impl-4: Implement reasoning transparency and sub-context (ADRs t8k, k9j, p4m)
- [x] impl-5: Implement space management (ADRs g7r - delegation)
- [x] review-1: Editor review of draft spec and accept proposals
- [ ] impl-6: Implement space management (ADRs d4n - config)
- [ ] review-2: Editor review of draft spec and accept proposals

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