# ADR-001: Tool Namespacing Strategy

## Status
Proposed

## Context
When the bridge operates in `mcpx-topic-to-mcp-server` mode, it aggregates tools from multiple participants in an MCPx topic and exposes them to a local MCP client. Multiple participants may expose tools with identical names (e.g., multiple agents might have a `search` or `read` tool), creating naming conflicts.

## Decision Drivers
- Prevent tool name collisions
- Maintain clarity about tool origin
- Support intuitive tool discovery
- Enable flexible configuration
- Preserve compatibility with MCP clients

## Considered Options

### Option 1: Prefix with Participant ID
Tools are prefixed with the participant's ID followed by an underscore.

**Example:**
- `calculator_agent_add`
- `documents_agent_read`
- `assistant_bot_search`

**Pros:**
- Unambiguous origin identification
- Simple implementation
- No conflicts guaranteed

**Cons:**
- Verbose tool names
- Participant IDs may be UUIDs or random strings, making names unwieldy
- Poor readability in client UIs

### Option 2: Dot Notation Namespacing
Tools use dot notation with participant ID or friendly name.

**Example:**
- `calculator.add`
- `documents.read`
- `assistant.search`

**Pros:**
- Clean, hierarchical structure
- Familiar pattern (similar to module systems)
- Good readability

**Cons:**
- Some MCP clients might not handle dots well in tool names
- Requires validation that participant IDs work as namespace prefixes

### Option 3: Configurable Friendly Names
Allow configuration of friendly names for participants.

**Example configuration:**
```json
{
  "participantAliases": {
    "calculator-agent-x7k2": "calc",
    "document-server-9m3p": "docs"
  }
}
```

**Results in:**
- `calc.add`
- `docs.read`

**Pros:**
- Human-readable names
- Flexible naming
- Better UX in client tools

**Cons:**
- Requires configuration
- Manual mapping maintenance
- Potential for misconfiguration

### Option 4: First-Come-First-Served (No Namespacing)
First participant to expose a tool name wins; subsequent identical names are ignored or suffixed with numbers.

**Example:**
- `search` (from first participant)
- `search_2` (from second participant)
- `search_3` (from third participant)

**Pros:**
- Simple tool names when no conflicts
- Minimal configuration

**Cons:**
- Non-deterministic behavior
- Tool availability depends on join order
- Confusing for users

### Option 5: Smart Namespacing
Only namespace when conflicts exist; use bare names when unique.

**Example:**
- `add` (if only calculator has it)
- `calculator.search` and `documents.search` (when both have search)

**Pros:**
- Optimal naming - simple when possible
- Good UX for non-conflicting tools

**Cons:**
- Complex implementation
- Tool names can change as participants join/leave
- Unpredictable client experience

## Decision

Implement **Option 2 (Dot Notation)** as the default strategy, with **Option 3 (Configurable Friendly Names)** as an enhancement.

The implementation will:
1. Default to dot notation with participant IDs
2. Allow optional alias configuration for friendly names
3. Provide a configuration flag to disable namespacing entirely (at user's risk)

## Implementation Details

```typescript
interface NamespacingConfig {
  strategy: 'dot' | 'prefix' | 'none';
  aliases?: Record<string, string>;  // participantId -> friendlyName
  conflictResolution?: 'error' | 'suffix' | 'skip';
}
```

Default configuration:
```json
{
  "strategy": "dot",
  "conflictResolution": "error"
}
```

## Consequences

### Positive
- Clear tool organization
- Predictable naming
- Extensible for future enhancements
- Good balance of simplicity and flexibility

### Negative
- Requires clients to handle dot notation in tool names
- Additional configuration complexity when using aliases
- Slightly longer tool names than raw names

### Neutral
- Documentation needed for configuration options
- Migration path needed if strategy changes

## Notes
Future enhancement could add regex-based filtering to exclude certain participants or tools from aggregation entirely.