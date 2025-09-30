# ADR-sac: Slash Command Parameter Autocomplete Architecture

**Status:** Proposed
**Date:** 2025-02-14
**Incorporation:** Not Incorporated

## Context

The advanced interactive CLI currently exposes slash commands through a static array that only supports fuzzy matching on the
full command string.【F:cli/src/ui/utils/slashCommands.ts†L5-L88】【F:cli/src/ui/utils/slashCommands.ts†L128-L164】 Once the user
accepts a suggestion, the CLI inserts the command template verbatim and leaves the operator to fill in every argument manually.
This approach breaks down for the new class of envelope-driven commands the CLI must support:

- MEW envelopes contain hierarchical payloads with required, optional, and nested parameters that vary by `kind` and
  method.【F:spec/v0.4/SPEC.md†L1-L120】
- The CLI must surface a generic `/envelope` command capable of walking an operator through building any MEW envelope, including
  `mcp/request` → `tool/call` flows where the valid tool list depends on the currently targeted participant and the active
  workspace session state.
- The CLI already tracks participants, capabilities, and tool inventories in memory while rendering the advanced UI (per ADR-007
  and ADR-011), but the existing slash command subsystem cannot query this data because it only handles plain strings.

We need an extensible design that allows static commands to be described declaratively while letting individual arguments hook
into dynamic data sources (participants, tools, proposal IDs, stream handles, etc.). The architecture must support future message
kinds without forcing a rewrite of the autocomplete engine.

## Options Considered

### Option 1: Command Schema Tree with Dynamic Resolvers (Proposed)

Define each slash command as a tree of tokens. Literal tokens (e.g., `/envelope`, `kind=`) map to static strings; parameter
nodes describe required/optional arguments and point at resolver functions that can synchronously or asynchronously produce
suggestions. Resolvers receive the current CLI state (selected participant, cached capability map, live registry of tools from
system/presence and capability grants) so they can surface dynamic completions. The schema tree supports nested groups to
represent envelope payload structure (e.g., `payload.method` → `tool/call` → `payload.name`).

**Pros:**
- ✅ Single abstraction handles both static strings and dynamic parameters, so the `/envelope` command can branch based on prior
  selections (kind → method → tool → arguments) without bespoke code paths.
- ✅ Encourages reuse: other commands can reference the same resolver (e.g., any argument needing a participant ID shares the
  `resolveParticipants` hook).
- ✅ Schema data can double as documentation for `/help` and future interactive forms.
- ✅ Supports asynchronous lookups (e.g., fetch updated tool list) while keeping the UI responsive via promise-based resolvers.

**Cons:**
- ❌ Requires refactoring the autocomplete engine to operate on token streams instead of single-string fuzzy matches.
- ❌ Needs bridging glue between Ink components and the resolver registry to pipe live CLI state into autocomplete.
- ❌ Additional upfront complexity—command definitions become structured JSON/TS objects instead of a simple array.

### Option 2: Incremental Enhancements to Existing Fuzzy Matcher

Keep the current flat list but allow templates to embed tagged placeholders (e.g., `/status <participant:dynamic>`). When the
user navigates into a placeholder, run a resolver to show context-aware completions. Matching remains string-based: the fuzzy
search only finds the command prefix; parameter suggestions are bolted on afterward.

**Pros:**
- ✅ Minimal rewrite; current fuzzy search remains intact for command discovery.
- ✅ Lower initial effort for retrofitting participant/tool suggestions into a few commands.
- ✅ Existing UI wiring (EnhancedInput) needs fewer changes.

**Cons:**
- ❌ Difficult to express branching flows like `/envelope` where later arguments depend on earlier choices and may change the
  rest of the template entirely.
- ❌ Placeholder parsing becomes brittle, especially for nested payloads (`payload.tool.arguments.name`).
- ❌ Hard to reuse metadata for other surfaces (help screens, validation) because structure lives inside strings.
- ❌ Async lookups complicate keyboard navigation because the placeholder parser must manage promise lifecycles manually.

### Option 3: In-Command Interactive Wizard

Trigger a mini form/wizard when a command like `/envelope` is selected. Instead of inline autocomplete, the CLI opens a dialog
that walks the operator through each parameter with dedicated prompts, using the existing command list solely for entry-point
selection.

**Pros:**
- ✅ Maximum flexibility for complex envelopes—can present bespoke UI per message type.
- ✅ Avoids rewriting the slash autocomplete engine beyond launching the wizard.
- ✅ Naturally accommodates validation and preview before submission.

**Cons:**
- ❌ Breaks the inline typing workflow established in ADR-010/011; users must switch interaction modes for complex commands.
- ❌ Requires a second UI subsystem (dialog manager) with its own navigation, history, and error handling.
- ❌ Harder to scale across many commands; every new envelope path demands a new wizard script.
- ❌ Doesn’t help simpler commands that still need inline dynamic completions (e.g., `/pause <participant>`).

## Decision (Proposed)

Adopt **Option 1 (Command Schema Tree with Dynamic Resolvers)** as the guiding architecture. This keeps the inline typing
experience while unlocking dynamic suggestions at any position in the command. We will:

1. Replace the current array-based metadata with a typed command schema registry.
2. Update the autocomplete engine to tokenize user input, traverse the schema, and merge literal + resolver suggestions based on
   the cursor location.
3. Introduce a resolver registry so command definitions can declare their dependencies (participants, tools, capability filters,
   proposal IDs, etc.) without reaching directly into UI state objects.
4. Back the generic `/envelope` command with nested schema nodes that mirror MEW envelope structure and delegate to resolver
   plugins for dynamic sections (participant selection, tool discovery, context IDs, etc.).
5. Expose the same schema metadata to `/help` so documentation stays synchronized with the autocomplete experience.

This ADR remains proposed until we validate the schema shape against upcoming envelope flows and ensure it doesn’t conflict with
other UI refactors.

## Consequences

- Engineering work shifts toward defining reusable resolver interfaces and bridging CLI state into the autocomplete layer.
- Command authors get a clear extension point: add a schema node + resolver instead of editing fuzzy string lists.
- We must create migration tooling (or manual steps) to translate existing commands (`/pause`, `/stream request`, etc.) into the
  schema format without regressing UX.
- Future ADRs covering UI validation or command palettes can build on the schema registry, reducing duplication.

## Open Questions

1. What is the minimal resolver API surface that still supports async lookups and caching for large tool catalogs?
2. How do we version command schemas so plugins can extend them without mutating core definitions directly?
3. Can the schema support contextual defaults (e.g., pre-selecting the participant currently focused in the signal board)?
4. How will error handling surface when a resolver fails (tool list fetch timeout, missing permissions, etc.)?
