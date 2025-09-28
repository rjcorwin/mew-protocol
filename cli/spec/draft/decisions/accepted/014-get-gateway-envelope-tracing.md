# ADR-GET: Gateway Envelope Tracing and History

**Status:** Accepted
**Date:** 2025-09-28
**Incorporation:** Complete

## Context

The MEW CLI currently provides limited visibility into envelope flow for debugging and testing. Test scenarios rely on participant-side output logs parsed with grep, while the gateway acts as a "black box" for envelope routing, capability matching, and delivery decisions.

### Current Limitations

**Testing Challenges:**
- Test scenarios implement custom log parsing for each participant
- No visibility into gateway-level envelope routing decisions
- Difficult to debug capability matching failures
- Cannot validate envelope sequence or timing
- Limited troubleshooting when tests fail

**Development and Debugging:**
- No structured way to inspect envelope flow through the gateway
- Interactive terminal shows messages but not routing metadata
- Capability grant failures lack detailed context
- Performance bottlenecks difficult to identify

**Operational Needs:**
- No audit trail for envelope processing
- Cannot retrospectively analyze communication patterns
- Missing data for optimizing participant interactions
- No API to retrieve historical envelope data

### Why This Decision Needs to be Made

As MEW Protocol adoption grows, the need for comprehensive envelope visibility becomes critical for:
1. **Reliable testing** - Automated test validation of complex protocol interactions
2. **Effective debugging** - Understanding why envelopes are routed, blocked, or delayed
3. **Performance optimization** - Identifying bottlenecks in message processing
4. **Compliance and auditing** - Maintaining records of all communication
5. **API integration** - Enabling external tools to access envelope history

## Options Considered

### Option 1: Environment Variable Tracing

Add simple environment-based envelope tracing to the gateway.

**Implementation:**
- `ENVELOPE_TRACE=true` enables trace logging
- Gateway writes envelope events to `.mew/logs/envelope-trace.jsonl`
- JSON Lines format with one event per line
- Includes envelope routing decisions and timing

**Example trace entries:**
```json
{"timestamp":"2025-09-28T10:30:00.123Z","event":"envelope_received","envelope":{"kind":"chat","from":"human","to":["agent"],"payload":{"text":"hello"}},"metadata":{"source_ip":"127.0.0.1","connection_id":"conn-123"}}
{"timestamp":"2025-09-28T10:30:00.125Z","event":"capability_check","participant":"agent","required":"chat","granted":["chat","mcp/*"],"result":"allowed"}
{"timestamp":"2025-09-28T10:30:00.127Z","event":"envelope_delivered","envelope_id":"msg-456","participant":"agent","delivery_time_ms":4}
```

**Pros:**
- Simple implementation requiring minimal gateway changes
- Familiar environment variable pattern
- Direct file output suitable for grep/jq analysis
- Minimal performance impact when disabled
- Works with existing test infrastructure

**Cons:**
- No structured query capabilities
- File management and rotation not handled
- Limited to single trace format
- No real-time access to trace data
- Cannot retrieve historical data after restart

### Option 2: Gateway Envelope History API

Implement comprehensive envelope history with HTTP API access.

**Implementation:**
- Gateway maintains in-memory envelope history (configurable retention)
- HTTP API endpoints for querying envelope data
- Optional persistence to SQLite for longer retention
- Real-time WebSocket streaming of envelope events

**API endpoints:**
```bash
GET /api/envelopes?since=2025-09-28T10:00:00Z&participant=agent
GET /api/envelopes/{envelope_id}
GET /api/participants/{id}/envelopes?kind=chat
POST /api/envelope-stream (WebSocket upgrade)
```

**Response format:**
```json
{
  "envelopes": [
    {
      "id": "msg-456",
      "timestamp": "2025-09-28T10:30:00.123Z",
      "envelope": {"kind": "chat", "from": "human", "to": ["agent"], "payload": {"text": "hello"}},
      "routing": {
        "matched_participants": ["agent"],
        "capability_grants": [{"participant": "agent", "capability": "chat", "granted": true}],
        "delivery_results": [{"participant": "agent", "status": "delivered", "latency_ms": 4}]
      },
      "metadata": {
        "processing_time_ms": 5,
        "retry_count": 0,
        "source_connection": "conn-123"
      }
    }
  ],
  "total": 1,
  "has_more": false
}
```

**Pros:**
- Rich querying capabilities for debugging and analysis
- Real-time access to envelope events
- Structured data format suitable for tools and UIs
- Configurable retention and persistence options
- Enables advanced debugging and monitoring tools

**Cons:**
- Significant implementation complexity
- Memory usage for in-memory history
- Additional HTTP endpoints to maintain
- Potential security considerations for envelope access
- More complex configuration and deployment

### Option 3: Configurable Envelope Logging Framework

Create a flexible logging framework that supports multiple outputs and formats.

**Implementation:**
- Pluggable envelope loggers (file, API, WebSocket, etc.)
- Configuration via space.yaml or environment variables
- Multiple simultaneous loggers with different filters
- Built-in formatters for common use cases

**Configuration example:**
```yaml
# space.yaml
envelope_logging:
  enabled: true
  loggers:
    - type: file
      path: ".mew/logs/envelope-trace.jsonl"
      format: jsonlines
      filters: ["envelope_received", "envelope_delivered"]
    - type: http
      endpoint: "http://monitoring.example.com/api/envelopes"
      format: structured
      batch_size: 100
    - type: memory
      max_entries: 1000
      ttl_seconds: 3600
```

**Pros:**
- Highly configurable for different use cases
- Supports both simple file logging and advanced integrations
- Can be tailored per space requirements
- Extensible architecture for future logger types
- Separation of concerns between logging and gateway logic

**Cons:**
- Complex configuration model
- Over-engineering for basic testing needs
- Multiple code paths to maintain
- Potential performance impact with multiple loggers
- Higher learning curve for users

### Option 4: Dual-Log Architecture (Default Enabled)

Implement separate envelope history and capability decision logs, enabled by default with configurable disable options.

**Implementation:**
- Two complementary logs: envelope history and capability decisions
- Enabled by default for comprehensive visibility
- Environment variables and space.yaml configuration to disable
- Separate log files for different analysis needs

**Log Structure:**
```
.mew/logs/
├── envelope-history.jsonl     # All envelope events (enabled by default)
├── capability-decisions.jsonl # Routing and capability checks (enabled by default)
├── gateway.log               # Existing gateway operational logs
└── [participant-logs...]     # Existing participant logs
```

**Envelope History Log (`envelope-history.jsonl`):**
```json
{"timestamp":"2025-09-28T10:30:00.123Z","event":"received","id":"msg-456","envelope":{"kind":"chat","from":"human","to":["agent"],"payload":{"text":"hello"}},"metadata":{"connection_id":"conn-123","processing_time_ms":2}}
{"timestamp":"2025-09-28T10:30:00.127Z","event":"delivered","id":"msg-456","participant":"agent","status":"success","latency_ms":4}
{"timestamp":"2025-09-28T10:30:00.128Z","event":"failed","id":"msg-457","participant":"offline-agent","status":"no_connection","retry_scheduled":true}
```

**Capability Decisions Log (`capability-decisions.jsonl`):**
```json
{"timestamp":"2025-09-28T10:30:00.124Z","event":"capability_check","envelope_id":"msg-456","participant":"agent","required_capability":"chat","granted_capabilities":["chat","mcp/*"],"result":"allowed","source":"space_config"}
{"timestamp":"2025-09-28T10:30:00.125Z","event":"routing_decision","envelope_id":"msg-456","to_field":["agent","offline-agent"],"matched_participants":["agent"],"filtered_participants":[{"participant":"offline-agent","reason":"not_connected"}]}
{"timestamp":"2025-09-28T10:30:00.126Z","event":"capability_grant","participant":"agent","granted_capability":"mcp/request","pattern":{"kind":"mcp/request","payload":{"method":"tools/*"}},"source":"interactive_approval","expires_at":"2025-09-28T11:30:00.126Z"}
```

**Configuration Options:**
```bash
# Environment variables (can disable individual logs)
export ENVELOPE_HISTORY=false          # Disable envelope history log
export CAPABILITY_DECISIONS=false      # Disable capability decisions log
export GATEWAY_LOGGING=false           # Disable both logs
```

**Optional Space.yaml Configuration:**
```yaml
# space.yaml - minimal configuration (all optional)
gateway_logging:
  enabled: true                    # Default: true (master switch)
  envelope_history:
    enabled: true                  # Default: true
  capability_decisions:
    enabled: true                  # Default: true

# Fixed paths (not configurable in v1):
# - .mew/logs/envelope-history.jsonl
# - .mew/logs/capability-decisions.jsonl
```

**Basic Log Access (MVP):**
```bash
# Direct file access for testing and debugging
tail -f .mew/logs/envelope-history.jsonl
tail -f .mew/logs/capability-decisions.jsonl

# Test scenarios can use standard tools
grep '"participant":"agent"' .mew/logs/envelope-history.jsonl
jq '.event' .mew/logs/capability-decisions.jsonl

# No custom CLI commands needed for MVP
```

**Pros:**
- **Enabled by default** - Immediate visibility without configuration
- **Separation of concerns** - Different logs for different analysis needs
- **Comprehensive coverage** - Both envelope flow and gateway decisions
- **Configurable** - Can disable individual logs or all logging
- **Testing friendly** - Structured data perfect for test assertions
- **Debugging focused** - Capability decisions separate from message flow
- **Simple implementation** - Just append JSON lines to files
- **External rotation** - Users can use standard tools like logrotate

**Cons:**
- **Two log files** - Slightly more complex than single log
- **Default overhead** - Small performance impact even when not actively used
- **Storage usage** - Two files growing over time (no built-in rotation)
- **Coordination needed** - Related events split across files

### Option 5: Hybrid Approach with Growth Path

Start with simple tracing and evolve toward full history API.

**Phase 1: Basic Tracing (v0.5.0)**
- Environment variable `ENVELOPE_TRACE=true` enables file logging
- JSON Lines format to `.mew/logs/envelope-trace.jsonl`
- Include envelope routing and capability decisions
- Test utilities for parsing trace files

**Phase 2: Memory History (v0.6.0)**
- Add in-memory envelope history (1000 entries default)
- CLI command `mew space envelope-history` for queries
- Real-time envelope streaming in interactive terminal
- Configurable retention via space.yaml

**Phase 3: Full API (v0.7.0)**
- HTTP API endpoints for envelope queries
- Optional SQLite persistence for longer retention
- WebSocket streaming for real-time monitoring
- Integration with external monitoring tools

**Pros:**
- Immediate value with simple implementation
- Clear evolution path based on user feedback
- Each phase builds on the previous
- Allows learning from real usage patterns
- Manageable implementation complexity

**Cons:**
- Multiple implementation phases required
- Potential breaking changes between phases
- Users may rely on interim features
- Coordination required across releases

## Decision

**Option 4: Dual-Log Architecture (Default Enabled)** is recommended for providing immediate comprehensive visibility while maintaining simplicity and configurability.

### Implementation Details

#### Dual-Log Implementation (Target: v0.5.0)

**Gateway Changes:**
1. Add dual logging hooks to gateway processing pipeline
2. Enabled by default with environment and config overrides
3. Separate envelope history and capability decision tracking
4. Simple append-only logging to fixed paths

**Envelope History Log Format:**
```json
{
  "timestamp": "2025-09-28T10:30:00.123Z",
  "event": "received|delivered|failed|timeout",
  "id": "msg-456",
  "envelope": {
    "kind": "chat",
    "from": "human",
    "to": ["agent"],
    "payload": {"text": "hello"}
  },
  "metadata": {
    "connection_id": "conn-123",
    "processing_time_ms": 2,
    "retry_count": 0
  }
}
```

**Capability Decisions Log Format:**
```json
{
  "timestamp": "2025-09-28T10:30:00.124Z",
  "event": "capability_check|routing_decision|capability_grant|capability_revoke",
  "envelope_id": "msg-456",
  "participant": "agent",
  "details": {
    "required_capability": "chat",
    "granted_capabilities": ["chat", "mcp/*"],
    "result": "allowed|denied",
    "source": "space_config|interactive_approval|runtime_grant",
    "reason": "capability_match|no_connection|permission_denied"
  }
}
```

**Configuration Hierarchy:**
1. **Default**: Both logs enabled
2. **Environment variables**: `ENVELOPE_HISTORY=false`, `CAPABILITY_DECISIONS=false`, `GATEWAY_LOGGING=false`
3. **Space.yaml**: Basic enable/disable controls

**Standard Tool Integration:**
1. Logs use JSON Lines format compatible with standard Unix tools
2. Test scenarios can use `grep`, `jq`, `tail` for log analysis
3. No custom CLI commands required for MVP

**Test Helper Functions:**
```bash
# In test scripts
wait_for_envelope() { local id="$1"; grep -q "\"id\":\"$id\"" .mew/logs/envelope-history.jsonl; }
wait_for_capability_check() { local participant="$1" capability="$2"; grep -q "\"participant\":\"$participant\".*\"required_capability\":\"$capability\"" .mew/logs/capability-decisions.jsonl; }
assert_envelope_delivered() { local id="$1" participant="$2"; grep -q "\"event\":\"delivered\".*\"id\":\"$id\".*\"participant\":\"$participant\"" .mew/logs/envelope-history.jsonl; }
assert_capability_granted() { local participant="$1" capability="$2"; grep -q "\"result\":\"allowed\".*\"participant\":\"$participant\".*\"required_capability\":\"$capability\"" .mew/logs/capability-decisions.jsonl; }
```

### CLI Command Integration

**New CLI Commands:**
```bash
# View envelope history
mew space logs envelope-history [--follow] [--participant name] [--since timestamp] [--event type]

# View capability decisions
mew space logs capability-decisions [--follow] [--participant name] [--event type] [--result allowed|denied]

# Combined correlation view
mew space logs combined [--envelope-id msg-456] [--participant name]

# Configure logging
mew space config set gateway_logging.enabled false
mew space config set gateway_logging.envelope_history.enabled false
mew space config get gateway_logging
```

**Configuration via Space.yaml:**
```yaml
# space.yaml - minimal configuration (all optional)
gateway_logging:
  enabled: true                    # Default: true (master switch)
  envelope_history:
    enabled: true                  # Default: true
  capability_decisions:
    enabled: true                  # Default: true

# Fixed paths in v1 (users can handle rotation externally):
# - .mew/logs/envelope-history.jsonl
# - .mew/logs/capability-decisions.jsonl
```

**Environment Variable Overrides:**
```bash
# Disable individual logs
export ENVELOPE_HISTORY=false
export CAPABILITY_DECISIONS=false

# Disable all gateway logging
export GATEWAY_LOGGING=false
```

### Test Scenario Integration

**Updated Test Flow:**
1. Logging enabled by default - no setup required
2. Send test messages and operations
3. Use dual logs for comprehensive validation
4. Assert on envelope delivery and capability decisions separately
5. Correlate envelope IDs across both logs

**Example Test Integration:**
```bash
# In test setup.sh - no configuration needed, enabled by default
# Optional: customize paths if needed
# export ENVELOPE_HISTORY_PATH="${WORKSPACE_DIR}/logs/test-envelopes.jsonl"

# In test check.sh - use both logs
wait_for_envelope "msg-123"
wait_for_capability_check "agent" "chat"
assert_envelope_delivered "msg-123" "agent"
assert_capability_granted "agent" "chat"

# Correlation tests
envelope_id=$(generate_test_envelope_id)
send_test_message "$envelope_id"
wait_for_envelope "$envelope_id"
assert_capability_decisions_for_envelope "$envelope_id"
```

**Benefits for Test Scenarios:**
- **No configuration overhead** - Works out of the box
- **Separate concerns** - Test envelope flow vs capability logic independently
- **Rich debugging** - When tests fail, both logs provide complete context
- **Correlation support** - Track envelope decisions across both logs
- **Selective testing** - Can disable logs individually if not needed

## Consequences

### Positive
- **Default visibility** - Comprehensive logging enabled out of the box
- **Separation of concerns** - Envelope flow and capability decisions tracked separately
- **Enhanced testing** - Rich data for test assertions without configuration
- **Debugging excellence** - Complete gateway decision context when issues occur
- **Performance insights** - Timing data for envelope processing optimization
- **Audit trail** - Full record of envelope and capability events
- **Simple implementation** - Just append JSON lines to fixed file paths
- **External tooling** - Users can manage rotation with standard Unix tools

### Negative
- **Default overhead** - Small performance impact even when not actively analyzed
- **Storage usage** - Two log files growing in all spaces by default (no built-in rotation)
- **Dual file complexity** - Need to coordinate between two logs for correlation
- **Privacy considerations** - Full envelope content logged by default
- **Manual rotation** - Users must handle log rotation themselves