# MEW Protocol v0.4 Migration Notes

The repository now references the v0.4 protocol specification. The following implementation gaps remain and should be addressed in follow-up work before claiming full compliance with the v0.4 MEW Protocol.

## CLI
- The built-in `client connect` and `agent start` workflows still send a legacy `{ type: 'join' }` handshake instead of a v0.4 MEW envelope. The gateway continues to translate this legacy format, but participants should emit full envelopes going forward.
- `gateway` back-fills envelope fields (protocol, id, timestamps) when participants omit them. Under the v0.4 spec every message on the wire should already be a complete envelope.
- The note-taker template agent uses the rejected `system/join` message kind. A compliant join/authorization sequence needs to be defined for v0.4.

## SDK
- The shared `Envelope` type still allows `correlation_id` to be a single string for backward compatibility, whereas v0.4 requires an array of strings. Client code should emit arrays once the ecosystem is ready.

If additional incompatibilities are discovered while adopting the v0.4 protocol, add them here so the work can be prioritized.
