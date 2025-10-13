# Proposal p7l-plane-support: Fixed-Wing Transport Support for MEW World

## Problem Statement

With the ship MCP server in place, the next milestone in the implementation plan introduces airborne transports. We need to extend the transport lifecycle so it can represent planes that climb, cruise at altitude, and carry passengers across the map using different MCP controls. Plane participants must share the same boarding semantics as ships while exposing aviation-themed tools (`set_flight_heading`, `set_flight_speed`, `set_altitude`) and reporting altitude through the movement stream so clients render and simulate correctly.

## Goals

- Parameterise the lifecycle manager so it handles both `ship` and `plane` transport kinds.
- Track altitude in the transport state and expose it via MCP queries and movement frames.
- Provide plane-specific tool aliases so agents can issue natural commands.
- Ensure `report_player_position` works for planes without duplicating logic, including boarding margin checks.
- Update the MEW World template to spin up a default plane participant for testing.

## Non-Goals

- Implement take-off/landing runways or aerodynamic drag—the plane moves using the same heading/speed mechanics as ships for now.
- Add dedicated plane sprites to the client (visual polish remains future work).
- Model pressurisation or altitude-limited boarding; all players can board if they reach the platform footprint.

## Proposed Design

1. Extend `TransportLifecycleManager` with an optional `altitude` channel and expose setters/getters conditioned on the `plane` kind.
2. Update the movement stream encoder to include a `platformKind` tag alongside the existing `platformRef`, enabling clients to distinguish ships from planes.
3. Expand the MCP transport entry point so it accepts `--kind plane` (defaulting to `ship` if omitted). The server registers the following plane-specific tools in addition to shared lifecycle hooks:
   - `set_flight_heading`
   - `set_flight_speed`
   - `set_altitude`
   - `get_plane_position`
4. Add Vitest coverage to simulate a passenger boarding a plane, being carried while altitude changes, and disembarking once they step off the fuselage footprint.
5. Document the new tools and the `platformKind` field in the MEW World spec so clients and agents know how to react.

## Risks

- Introducing altitude without 3D rendering may confuse clients. We mitigate this by keeping altitude data optional and defaulting to `0` when not used.
- More tool aliases could overwhelm LLM prompts. The server will only advertise the subset relevant to its configured kind.

## Success Metrics

- `TransportLifecycleManager` passes shared lifecycle tests for both ships and planes.
- Running `mew mcp plane` starts a transport server advertising the correct tool set.
- Movement stream frames include `platformKind: "plane"` when appropriate.
