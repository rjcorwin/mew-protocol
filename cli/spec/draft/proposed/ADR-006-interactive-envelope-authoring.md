# ADR-006: Interactive Envelope Authoring in the MEW Protocol CLI

## Status
Proposed

## Date
2025-09-21

## Context

The MEW Protocol CLI currently supports manual construction and submission of envelopes using either direct YAML/JSON or command-line arguments. While powerful, this process can be error-prone and unintuitive, especially for:

- Non-technical users (e.g., human reviewers or analysts)
- High-frequency use cases (e.g., streaming movement updates or chat events)
- Envelope types with deeply nested or dynamic payloads (e.g., `stream/open`, `tool/request`)

To support faster iteration, richer interactivity, and on-demand control of agents and streams, we propose adding an interactive CLI mode for envelope creation and review.

## Decision

We will implement an **interactive envelope authoring interface** within the MEW CLI using a text-based UI framework (e.g., [Ink](https://github.com/vadimdemedes/ink)). This feature will allow users to:

- Trigger envelope creation via keyboard shortcuts (e.g., `Ctrl+E`, `Ctrl+P`)
- Walk through a type-specific form to populate envelope fields
- Preview the final envelope JSON
- Send the envelope or save it as a draft

### Core Capabilities

- **Hotkey activation**:
  - `Ctrl+E`: Launch generic envelope editor
  - `Ctrl+P`: Shortcut for `message/propose` or `tool/request`

- **Type-aware forms**:
  - Envelope type is selected first
  - Form updates dynamically based on schema (from config)
  - Supports nested field editing (e.g. `schema`, `payload` objects)

- **Schema-driven configuration**:
  - Schema definitions are built into the CLI and reflect the official MEW Protocol spec
  - Each supported envelope type has a corresponding form definition derived from the protocol type system
  - Enables type-safe editing and validation at runtime without external config files

- **Draft handling**:
  - Drafts can be saved to `.mew/drafts/*.json`
  - CLI can list/load/edit previously saved drafts

## Consequences

### Pros
- Enables envelope construction with reduced errors
- Supports new UX for human-in-the-loop workflows
- Makes the CLI viable for power users and novices alike
- Allows fast iteration of complex envelope types (e.g., live streaming, proposal flows)

### Cons
- Increases CLI implementation complexity
- Requires consistent schema updates to reflect protocol changes
- Terminal-only; not yet accessible via GUI or web

## Alternatives Considered

- Static template generators (e.g., `mew gen stream/open`) — lacks dynamic interactivity
- Full GUI app — potentially overkill and inconsistent with terminal-first goals
- Read-only CLI preview — useful, but doesn't help with authoring

## Open Questions
- Should we allow multiple envelopes to be composed/sent in sequence?
- How will this interact with proposal approval/denial tools or gateways?
- Should we allow live editing of matchers within the CLI?

## Next Steps
- Define schema format for `envelope-forms.json`
- Build `EnvelopeEditor` component using Ink or similar
- Wire up hotkey handling and matcher trigger preview
- Add integration tests for form flow + envelope validation
