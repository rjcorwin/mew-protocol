# Message Formatters Inventory

## Overview

This document inventories which MEW protocol messages have dedicated formatters in the CLI and which don't. Formatters provide enhanced display formatting for specific message types in the interactive terminal UI.

## Message Kinds with Formatters

### ✅ Implemented Formatters

#### `chat`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1900)
- **Formatting**:
  - Shows text content directly
  - Full-width separators (top/bottom borders) for visual distinction
  - Filled diamond (◆) prefix
  - Theme-aware colors

#### `chat/acknowledge`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~2544)
- **Formatting**:
  - Checkmark (✓) prefix
  - Shows status field from payload (e.g., "processing", "received", "seen")
  - Example: `✓ processing` or `✓ received`
  - Note: Per spec, payload only contains `status` field; correlation_id (in envelope) references acknowledged message

#### `mcp/request` and `mcp/proposal`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1920)
- **Formatting**:
  - Shows method and tool name
  - Arguments preview
  - Special handling for `tools/call` with tool-specific formatters

#### `mcp/response`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1940)
- **Formatting**:
  - Handles result content arrays (shows first text item)
  - Object results with key summary
  - String results with path tail-end display
  - Error messages

#### `reasoning/thought`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1900)
- **Formatting**:
  - Special cyan color for reasoning text
  - Magenta color for action field
  - Indented display with wrap

#### `reasoning/start` & `reasoning/conclusion`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1960)
- **Formatting**:
  - Prefixes: ◇ for start, ◆ for conclusion
  - Message preview (truncated to 120 chars)

#### `stream/request`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~2642)
- **Formatting**:
  - Shows direction (upload/download)
  - Shows description if present
  - Shows expected size in MB if present
  - Example: `upload stream "reasoning:reason-123"` or `download stream (5.2MB)`

#### `stream/open`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~2649)
- **Formatting**:
  - Shows stream ID and encoding
  - Example: `opened stream-4 [text]` or `opened stream-42 [binary]`

#### `stream/close`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~2655)
- **Formatting**:
  - Shows stream ID (if present) and reason
  - Example: `stream-4 complete` or `cancelled`

#### `system/help`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1970)
- **Formatting**:
  - Multi-line display with proper indentation
  - Section titles highlighted
  - Line-by-line rendering

#### `system/info`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~2565)
- **Formatting**:
  - Shows text content directly
  - Example: `Stream closed (complete)`

#### `system/welcome`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~2569)
- **Formatting**:
  - Shows your participant ID, capability count, and other participants
  - Example: `connected as participant-123 (2 capabilities) • 2 other participants: mew, mcp-fs-bridge`
  - Concise format to avoid bloat (per spec recommendation)

### 🛠️ Tool-Specific Formatters

The advanced UI includes a pluggable tool formatter system for `mcp/proposal` messages:

#### `write_file`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1300)
- **Formatting**:
  - Shows file path
  - Line count
  - Content preview with first/last 5 lines
  - Diff-style display with + prefix

#### `edit_file`
- **Location**: `src/cli/utils/advanced-interactive-ui.ts` (line ~1350)
- **Formatting**:
  - Shows file path
  - Side-by-side diff with old/new lines
  - Red for removed lines, green for added lines
  - Handles multiple edits

## Message Kinds Without Formatters

### ❌ Basic JSON Display

These message types fall back to generic JSON preview in `getPayloadPreview()`:

#### `system/*` (except `help`, `info`, `welcome`)
- `system/heartbeat`
- `system/error`
- `system/presence`
- **Current behavior**: Generic object preview showing first 2-3 keys

#### `participant/*`
- `participant/status`
- `participant/pause`
- `participant/resume`
- `participant/forget`
- `participant/clear`
- `participant/restart`
- `participant/shutdown`
- `participant/request-status`
- `participant/compact`
- `participant/compact-done`
- **Current behavior**: Generic object preview

#### `stream/data`
- **Current behavior**: Filtered from display (binary/chunked data, not shown in envelope view)

#### `capability/*`
- `capability/grant`
- `capability/grant-ack`
- **Current behavior**: Generic object preview

#### `chat/cancel`
- **Current behavior**: Generic object preview

#### Other Protocol Messages
- Any custom or future message kinds
- **Current behavior**: Generic object preview

## Formatter Architecture

### Advanced UI (Only)
- **File**: `src/cli/utils/advanced-interactive-ui.ts`
- **Function**: `getPayloadPreview()` (line ~2540)
- **Component**: `ReasoningDisplay` (line ~1880)
- **Approach**: React component with pluggable tool formatters
- **Tool Formatters**: Object registry at line ~1300
- **Note**: The simple readline UI has been removed as of v0.5

## Recommendations

### High Priority Formatters
1. **`system/error`** - Errors should have distinct formatting (red, prominent)
2. **`participant/status`** - Status telemetry could be tabular
3. **`capability/grant`** - Security-critical, needs clear display

### Medium Priority Formatters
1. **`participant/pause`** - Show timeout and reason clearly
2. **`chat/cancel`** - Show cancellation status visually
3. **`system/presence`** - Show join/leave events clearly

### Tool Formatters to Add
1. **`read_file`** - Show file path and size
2. **`create_directory`** - Show directory path
3. **`list_directory`** - Show directory contents preview
4. **`search_files`** - Show search pattern and results count

## Implementation Notes

- Tool formatters receive `(args, { headerLabel, proposalColor, detailColor, theme })`
- Formatters should return React elements for advanced UI
- Consider both verbose and non-verbose modes
- Maintain consistency with existing color schemes
- Handle edge cases (missing data, large payloads)