# Integration Plan

## Objectives
- Keep the protocol, SDK, and CLI specifications aligned around the new envelope kinds (chat acknowledgements/cancellations,
  participant controls, reasoning cancellation, and stream lifecycle events).
- Ship working TypeScript SDK support (types, client, participant, agent) for the new envelopes with telemetry utilities and
  stream helpers.
- Deliver a cohesive Ink CLI experience that exercises the new protocol surface area while collaborating with the coder template
  agent.

## Current Status
- **Specs**: Core protocol draft documents chat/acknowledge, chat/cancel, reasoning/cancel, expanded participant controls, and
  stream framing. SDK and CLI drafts were updated to describe helper APIs, UI affordances, and command shortcuts.
- **SDK**: Type definitions, `MEWClient`, `MEWParticipant`, and `MEWAgent` understand the new envelopes, maintain pause/status
  telemetry, and request or emit streams alongside proactive status broadcasts.
- **CLI**: Advanced interactive UI renders a signal board (pending acknowledgements, status summaries, pause banner, stream
  monitor), exposes participant control commands, and surfaces reasoning cancellation guidance. Command handling aligns with the
  updated specs.

## Outstanding Gaps
- Automated test coverage for participant pause/forget/status flows and stream frame handling is still missing in the SDK.
- The Ink CLI needs regression tests (or scripted walkthroughs) to validate the new commands, ack queue behaviour, and stream
  previews.
- Coder template end-to-end validation with the new agent features (streamed reasoning, participant controls) remains manual.
- Gateway/template documentation has not been refreshed to mention the new CLI shortcuts or telemetry expectations.

## Phased Roadmap
1. **Phase 1 – Spec Cohesion & SDK Telemetry**
   - Backfill unit tests for `MEWParticipant` context tracking, pause enforcement, and stream bookkeeping.
   - Document envelope examples in SDK README snippets and ensure changelog coverage.
   - Verify protocol draft examples compile against the latest TypeScript types.
2. **Phase 2 – CLI Experience Hardening**
   - Add integration tests (or scripted smoke tests) for `/ack`, `/cancel`, `/status`, and `/stream` commands.
   - Polish Ink layouts (reasoning card placement, pause timer rendering, scrollback behaviour after confirmations).
   - Wire CLI help text into docs and tutorial content.
3. **Phase 3 – Template & Agent Validation**
   - Run the coder template against a live gateway, exercising pause/forget/restart flows and streamed reasoning output.
   - Capture manual QA notes and automate critical flows where possible.
   - Update template documentation to instruct operators on new controls and telemetry signals.

## Testing & Verification Strategy
- Use workspace builds (`npm run build --workspace=@mew-protocol/types|client|participant|agent`) to guarantee TypeScript
  compatibility after every spec or SDK change.
- Introduce targeted Vitest suites for stream frame parsing and participant control enforcement.
- Script CLI walkthroughs (e.g., via `expect` or Ink testing utilities) to assert command output and signal board updates.
- Maintain a manual smoke checklist for template-driven sessions until automated coverage is in place.
