# Spec: Default Chat Targeting in MEW CLI

Status: Draft
Last Updated: 2025-01-17
Authors: MEW Protocol Team
Related Docs:
- MEW Protocol v0.4 (spec/protocol/v0.4/SPEC.md)
- MEW CLI Specification (spec/cli/SPEC.md)

## 1. Summary

Provide a configurable way to automatically set the `to` field for chat envelopes originating from the CLI participant (typically the human) so plain-text input is addressed to a specific participant (e.g., `mew`) without requiring an explicit classifier or manual targeting each time. The feature is opt-in via space.yaml and can be toggled at runtime.

## 2. Motivation

- Reduce latency and cognitive load in the common case where the human primarily collaborates with a single agent (e.g., coder template: human → mew).
- Avoid unnecessary broadcast chatter and downstream filtering when a single recipient is intended.
- Preserve protocol correctness: MEW v0.4 allows broadcast by omitting `to`; this feature simply pre-fills `to` where appropriate.

## 3. Non-Goals

- Not a routing policy inside the gateway; this is a CLI-side convenience for composing envelopes.
- Not a hard authorization or delivery guarantee; standard capability enforcement and routing still apply.
- Not a replacement for multi-target addressing; users can still explicitly set `to` when needed.

## 4. Configuration Schema (space.yaml)

Introduce an optional per-participant configuration to specify default targets by message kind:

```
participants:
  <participant-id>:
    # ...existing fields...
    default_to:
      chat: ["mew"]
```

Notes:
- Keys under `default_to` are MEW kinds. This spec only defines behavior for `chat` initially; future kinds MAY be added.
- Values are arrays of logical participant names as declared in space configuration (e.g., `mew`, `mcp-fs-bridge`). Gateway performs logical→runtime ID resolution per Protocol §3.6.4.
- Omission means "no default" (maintain broadcast unless the user explicitly targets).

Optional global defaults (lowest precedence) may be provided under `defaults`:

```
defaults:
  routing:
    default_to:
      chat: ["mew"]
```

Precedence is described in §7.

## 5. CLI Behavior Changes

### 5.1 Input Wrapping

Per CLI spec, the interactive client wraps plain text as a `chat` envelope. With this feature enabled:
- When the local participant sends plain text (no explicit JSON), the CLI sets `to` to the configured `default_to.chat` list if present.
- When sending valid JSON that is a `chat` envelope and omits `to`, the CLI MAY apply the same default. If the JSON already contains a `to`, it is respected.

### 5.2 FIFO Mode

In FIFO mode, the same rules apply when the CLI composes envelopes from simplified inputs. For fully formed envelopes arriving on FIFO, the CLI does not mutate `to` unless it is missing and the envelope `kind` is `chat` and the sender is the CLI participant; then the default MAY be applied.

### 5.3 Advanced UI and Debug UI

Both interactive modes follow identical targeting rules. The UI should surface the active target (see §6) so operators understand where messages go.

## 6. Runtime Controls (Slash Commands)

Add session-scoped controls:

- `/target <participant...>`: Set an in-session override of default chat targets (one or more). Example: `/target mew`.
- `/target none`: Clear override and revert to config-based behavior.
- `/target show`: Display current effective target and source (override vs config vs none).

Behavior:
- Overrides apply only to the current CLI session and only for `chat` envelopes.
- Overrides take precedence over space.yaml defaults (see §7).
- Overrides do not modify space.yaml.

## 7. Precedence Rules

When composing a `chat` envelope from the CLI participant, the CLI determines `to` using the following order:

1. Explicit `to` present in user-provided JSON envelope → use as-is.
2. Session override set via `/target` → use override.
3. Participant-level default in `participants.<id>.default_to.chat` → use list.
4. Global default in `defaults.routing.default_to.chat` → use list.
5. Otherwise → omit `to` (broadcast).

If the resolved list is empty, the CLI omits `to`.

## 8. Failure Modes and Fallbacks

- Target name not present in current participant list: send anyway; gateway performs name→runtime resolution when possible. If no runtime participant matches, delivery will naturally produce no recipients. UI SHOULD warn once per target per session.
- Multiple targets: the CLI sets `to` to all listed targets; normal fan-out applies.
- Capability violations: unchanged; gateway will enforce as usual.

## 9. Backward Compatibility

- Default behavior is unchanged when no config or override is present.
- Existing spaces function without modification.
- The new keys are ignored by prior CLI versions.

## 10. Template Updates (Recommended)

For the coder-agent template, set a sensible default so plain text routes to `mew`:

```
participants:
  human:
    default_to:
      chat: ["mew"]
```

This mirrors the common workflow in that template while remaining opt-in for other spaces.

## 11. Minimal Implementation Plan

- Schema:
  - Extend space.yaml loader to read `participants.*.default_to.chat` and `defaults.routing.default_to.chat`.
- CLI Input Pipeline:
  - After building the base envelope for plain text or simplified JSON, apply precedence rules (§7) to set `to`.
  - Respect explicit `to` in user-provided JSON.
- Slash Commands:
  - Implement `/target` with subcommands: value list, `none`, `show`.
  - Persist only in memory for the session.
  - Reflect current effective target in the status/board area of the advanced UI.
- Telemetry/Logs:
  - Optionally annotate local logs with the decision path (override vs config vs none) to aid debugging.

## 12. Test Plan

- Unit tests for precedence resolution (explicit > override > participant default > global default > none).
- Interactive mode:
  - With coder template defaults, sending plain text creates `chat` with `to: ["mew"]`.
  - `/target none` clears override and reverts to config-based behavior.
  - `/target mew mcp-fs-bridge` targets both.
  - JSON envelope with explicit `to` is not mutated.
- FIFO mode:
  - Simplified input acquires default `to`.
  - Fully formed envelope with missing `to` remains broadcast unless local composition path applies and policy allows applying default.
- Negative:
  - Unknown target names warn once; messages still sent (no crash).

## 13. Security Considerations

- This is a client-side composition aid; capability enforcement remains server-side (Protocol §4).
- Explicit `to` in user-provided JSON is always respected to avoid unexpected redirection.
- UI makes the effective target visible to reduce operator error.

## 14. Future Extensions

- Kind patterning (e.g., defaults for `mcp/request` by `payload.method`).
- Context-aware targeting (e.g., stickiness per conversation thread).
- Per-space operator commands to update defaults at runtime and persist changes to space.yaml (with confirmation flow).
