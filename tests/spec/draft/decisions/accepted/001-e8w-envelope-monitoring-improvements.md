# ADR-E8W: Test Scenario Envelope Monitoring Improvements

**Status:** Accepted
**Date:** 2025-09-28
**Incorporation:** Complete

## Context

Test scenarios currently monitor MEW Protocol envelopes through participant-side output logs, while the CLI now provides comprehensive gateway-level envelope logging (as of v0.5.0):

**Current Test Approach:**
1. **Participant output logs**: Each participant writes received messages to dedicated log files (e.g., `test-client-output.log`, `coordinator-output.log`)
2. **Log file parsing**: Test scripts use `grep` and shell utilities to search for expected patterns in these log files
3. **Correlation ID tracking**: Tests send messages with unique IDs and search logs for responses with matching correlation IDs

**New Gateway Capability (Available):**
4. **Gateway envelope logging**: Dual-log architecture with structured JSON Lines format
   - **Envelope History** (`.mew/logs/envelope-history.jsonl`) - Message flow, delivery, failures
   - **Capability Decisions** (`.mew/logs/capability-decisions.jsonl`) - Routing decisions, capability checks

### Current Limitations

**With Participant-Only Monitoring:**
- **Inconsistent monitoring**: Each scenario implements its own log parsing logic
- **Limited envelope visibility**: Only participant-side logs are examined, not gateway-level envelope routing
- **No structured envelope inspection**: Raw text searching rather than JSON-aware envelope analysis
- **Missing envelope metadata**: Cannot easily inspect envelope headers, routing, or protocol-level details
- **Poor debugging experience**: When tests fail, difficult to trace envelope flow through the system
- **No envelope sequence validation**: Cannot verify message ordering or detect lost envelopes

**Opportunity with Gateway Logging:**
- **Available but not utilized**: Gateway logs provide complete envelope flow and capability decisions
- **No standardized integration**: Test scenarios don't systematically use gateway logs
- **Dual maintenance**: Tests maintain both participant log parsing and could leverage gateway logs

### Why This Decision Needs to be Made

With gateway envelope logging now available, test scenarios should leverage this comprehensive visibility rather than relying solely on participant-side logs. This will provide better debugging, more reliable test assertions, and standardized envelope monitoring across all scenarios.

## Options Considered

### Option 1: Continue Participant-Only Monitoring (Status Quo)

Keep the current approach of monitoring only participant-side logs.

**Implementation:**
- Maintain existing participant output log parsing
- Improve consistency across scenarios with shared utilities
- Enhance correlation ID tracking and validation

**Pros:**
- No changes required to existing test scenarios
- Familiar approach for test maintainers
- Participant logs provide application-level context

**Cons:**
- Limited visibility into gateway routing decisions
- Cannot validate capability matching logic
- Missing envelope metadata and timing information
- Inconsistent monitoring across scenarios

### Option 2: Gateway Logs as Primary Monitor

Transition test scenarios to use gateway envelope logs as the primary monitoring approach.

**Implementation:**
- Standardize test scenarios to use `.mew/logs/envelope-history.jsonl` and `.mew/logs/capability-decisions.jsonl`
- Create shared test utilities for gateway log parsing
- Maintain participant logs only for application-specific validation

**Pros:**
- **Complete envelope visibility** - Full gateway-level routing and capability decisions
- **Structured data** - JSON Lines format perfect for programmatic analysis
- **Already available** - No gateway changes required, enabled by default
- **Consistent across scenarios** - Same log format and utilities everywhere
- **Rich debugging** - When tests fail, complete envelope flow context available

**Cons:**
- Requires updating existing test scenarios
- Learning curve for test maintainers
- Need to develop shared parsing utilities

### Option 3: Hybrid Approach with Gateway Priority

Use gateway logs for envelope flow validation while keeping participant logs for application behavior.

**Implementation:**
- Use gateway logs for envelope routing, delivery, and capability decisions
- Keep participant logs for application-specific behavior validation
- Create correlation utilities to link gateway events with participant responses

**Pros:**
- **Best of both worlds** - Protocol-level and application-level visibility
- **Gradual migration** - Can transition scenarios incrementally
- **Comprehensive coverage** - Both system and application validation
- **Flexible testing** - Different scenarios can emphasize different aspects

**Cons:**
- More complex test scenarios with dual log management
- Potential for inconsistency between log sources
- Higher maintenance overhead

### Option 4: Enhanced Test Framework with Gateway Integration

Create comprehensive test utilities that leverage gateway logs with additional testing capabilities.

**Implementation:**
- Build test assertion DSL that uses gateway logs as data source
- Add envelope sequence validation and timing analysis
- Include test scenario templates with pre-built gateway log integration
- Provide debugging tools for envelope flow visualization

**Pros:**
- **Future-proof** - Rich testing capabilities for evolving protocol
- **Developer-friendly** - High-level assertions hide complexity
- **Standardized** - Consistent testing patterns across all scenarios
- **Advanced capabilities** - Sequence validation, timing analysis, flow debugging

**Cons:**
- Significant implementation effort
- Complex framework to maintain
- May be over-engineered for current needs
- Higher learning curve for test development

## Decision

**Option 3: Hybrid Approach with Gateway Priority** is recommended as the best balance of leveraging new gateway capabilities while maintaining existing test infrastructure.

### Implementation Details

#### Phase 1: Shared Gateway Log Utilities

Create standardized test utilities for gateway log parsing and validation:

1. **Test Helper Library** (`tests/lib/gateway-logs.sh`)
   ```bash
   # Envelope monitoring functions
   wait_for_envelope() {
     local envelope_id="$1"
     timeout 30 bash -c "until grep -q '\"id\":\"$envelope_id\"' .mew/logs/envelope-history.jsonl; do sleep 0.1; done"
   }

   assert_envelope_delivered() {
     local envelope_id="$1" participant="$2"
     grep -q "\"event\":\"delivered\".*\"id\":\"$envelope_id\".*\"participant\":\"$participant\"" .mew/logs/envelope-history.jsonl
   }

   assert_capability_granted() {
     local participant="$1" capability="$2"
     grep -q "\"result\":\"allowed\".*\"participant\":\"$participant\".*\"required_capability\":\"$capability\"" .mew/logs/capability-decisions.jsonl
   }

   get_envelope_routing_decision() {
     local envelope_id="$1"
     jq -r "select(.envelope_id == \"$envelope_id\" and .event == \"routing_decision\") | .details" .mew/logs/capability-decisions.jsonl
   }
   ```

2. **Enhanced Test Environment Setup**
   ```bash
   # In setup.sh
   source ../lib/gateway-logs.sh

   # Gateway logging enabled by default, no configuration needed
   # Logs available at:
   #   ${WORKSPACE_DIR}/.mew/logs/envelope-history.jsonl
   #   ${WORKSPACE_DIR}/.mew/logs/capability-decisions.jsonl
   ```

#### Phase 2: Scenario Integration

Update test scenarios to use both gateway and participant logs strategically:

1. **Protocol-level validation** - Use gateway logs for envelope routing, delivery, capability decisions
2. **Application-level validation** - Use participant logs for business logic, content validation
3. **Correlation** - Link envelope IDs between gateway events and participant responses

#### Phase 3: Migration Pattern

**For new scenarios:**
- Use gateway logs as primary monitoring approach
- Add participant logs only for application-specific validation

**For existing scenarios:**
- Add gateway log assertions alongside existing participant log checks
- Gradually migrate critical assertions to use gateway logs
- Maintain participant logs for backward compatibility and application context

### Gateway Log Integration Examples

**Envelope Flow Validation:**
```bash
# Send test message
envelope_id=$(generate_envelope_id)
send_test_message "$envelope_id" "Hello agent"

# Validate gateway routing and delivery
wait_for_envelope "$envelope_id"
assert_envelope_delivered "$envelope_id" "agent"
assert_capability_granted "agent" "chat"

# Validate participant response (existing approach)
wait_for_pattern "${OUTPUT_LOG}" "Echo: Hello agent"
```

**Capability Decision Testing:**
```bash
# Test capability denial
send_restricted_message "$envelope_id" "agent"
assert_capability_denied "agent" "restricted-capability" "no_grant"

# Test capability grant workflow
send_capability_request "agent" "mcp/request"
assert_capability_granted "agent" "mcp/request"
```

## Consequences

### Positive
- **Leverage existing capability** - Gateway logs already available, no additional implementation
- **Enhanced test coverage** - Protocol-level validation alongside application-level checks
- **Gradual migration path** - Can update scenarios incrementally without breaking changes
- **Comprehensive debugging** - When tests fail, complete envelope flow and capability context
- **Standardized utilities** - Shared test helpers reduce maintenance across scenarios
- **Future-proof foundation** - Ready for advanced protocol testing as MEW evolves

### Negative
- **Dual log management** - Need to coordinate between gateway and participant logs
- **Initial setup effort** - Creating shared utilities and updating scenarios
- **Learning curve** - Test maintainers need to understand gateway log formats
- **Potential inconsistency** - Risk of divergence between gateway and participant log assertions