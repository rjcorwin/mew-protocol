# Decision Record: p7l-plane-support

**Status:** Accepted

## Summary

We will generalise the transport lifecycle manager so it can represent both ships and planes, track altitude, and expose transport-kind-specific tool names. The shared movement stream payload now conveys a `platformKind` so clients can distinguish vehicles without additional envelopes. The MEW World template will spawn a default plane participant for experimentation alongside the ship.

## Rationale

- Sharing the same lifecycle manager avoids duplicate implementations and keeps tests consistent across transport types.
- Plane-focused tool aliases (`set_flight_heading`, `set_altitude`) make prompts and human operation clearer without complicating the JSON payloads.
- Encoding `platformKind` directly in the stream payload is cheaper than relying on naming conventions or secondary metadata streams.

## Consequences

- Specs and docs gain explicit references to planes, altitude tracking, and the extended movement frame format.
- Vitest suites must cover both ship and plane scenarios so regressions are caught early.
- Future transports (e.g., airships, trains) can build on the same infrastructure with new tool aliases and configuration presets.
