# ADR-SSC: CLI-Managed STDIO Shim Connector

**Status:** Proposed  
**Date:** 2025-09-17  
**Context:** MEW CLI Draft  
**Incorporation:** Not Incorporated

## Context

Several MEW participants (legacy MCP servers, lightweight tools, local agents) expose only stdin/stdout transports. The gateway currently expects each participant to connect directly over WebSocket (or another network transport) and does not manage external process lifecycles. Recent protocol work added stream lifecycle support, and we now need a straightforward way to connect stdio-only processes without expanding the gateway's responsibilities.

The CLI already orchestrates spaces via PM2: it launches the gateway, auto-start agents, and manages their lifecycles. Aligning with that pattern, we want the CLI to launch stdio-based participants and bridge them into the space. Today users must write ad-hoc scripts to proxy these processes over WebSocket, which is error-prone and inconsistent.

## Options Considered

### Option 1: Teach the Gateway to Manage STDIO Processes

**Pros:**
- Direct integration; fewer moving pieces for users.
- Gateway can supervise child processes and monitor health.

**Cons:**
- Bloats gateway scope (process management, logging, restarts).
- Harder to run in hosted environments where gateway and tools live on different machines.
- Increases security surface (gateway would spawn arbitrary binaries).

### Option 2: Require Users to Implement Their Own Shims

**Pros:**
- No new code in CLI or gateway.
- Maximum flexibility for integrators.

**Cons:**
- Every project rebuilds the same plumbing.
- Inconsistent behavior (capability enforcement, logging, retries).
- Higher barrier for onboarding stdio-only participants.

### Option 3: Provide a CLI-Managed STDIO Shim (Chosen)

**Pros:**
- Keeps gateway focused on routing/capabilities.
- Reuses existing PM2 orchestration in the CLI.
- Gives users a simple, consistent workflow for stdio-based participants.
- Works alongside WebSocket participants without change.

**Cons:**
- CLI becomes responsible for supervising shim processes.
- Additional component to monitor/debug (shim failures must be surfaced).

## Decision

Adopt Option 3. The CLI will ship a small “stdio shim” utility that:

- Spawns a target process (or connects to an already running one) and treats its stdin/stdout as a JSON-RPC transport.
- Maintains a persistent WebSocket connection to the gateway, forwarding envelopes between the child process and the space.
- Integrates with existing CLI space management (tokens, capabilities, logging, PM2 restart policies).

This keeps the gateway simple while enabling stdio-only tools to participate in MEW spaces transparently.

## Implementation Details

1. **Shim executable**
   - Command (e.g., `mew shim stdio-bridge`) that accepts parameters for gateway URL, space ID, participant ID, token, and the child command/args/environment.
   - Reads from the child’s stdout, frames messages via `Content-Length`, and forwards them over the WebSocket connection using standard MEW envelopes.
   - Delivers inbound MEW envelopes from the gateway to the child’s stdin.
   - Emits structured logs for lifecycle events (child exit, reconnects, malformed messages).

2. **Space configuration support**
   - Extend `space.yaml` to declare participants with `io: stdio` (or similar), command definition, env, and restart policy.
   - CLI `space up` auto-generates shim PM2 processes for these participants, mirroring the current auto_start logic.

3. **Lifecycle & reliability**
   - Shim detects child exit codes and reports them via gateway/system logs.
   - Respects PM2 restart policies defined in `space.yaml`.
   - Handles gateway reconnects (e.g., exponential backoff) without losing child connection if possible.

4. **Security/isolation**
   - CLI continues to control which binaries are executed via `space.yaml` (no gateway‑level spawning).
   - Tokens/capabilities for each participant are issued through existing CLI mechanisms.

## Consequences

### Positive
- Enables stdio-only MCP servers and local tools to join spaces without custom scripts.
- Gateway remains transport-agnostic and lightweight.
- Simplifies onboarding: users configure a participant once and let the CLI manage the bridge.
- Provides consistent logging and restart behavior via PM2.

### Negative
- Adds a new CLI component to maintain and test.
- Shim failures introduce another failure mode (must surface clearly to operators).
- Requires careful handling of stdout/stderr to avoid blocking or message framing issues.

## Follow-Up / Open Questions

- Define CLI UX (new flags, error messages, diagnostics) for shim processes.
- Decide how to surface shim health in `mew space status`.
- Evaluate whether the shim should support additional transports (named pipes, TCP sockets) for advanced scenarios.

