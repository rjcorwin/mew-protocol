# ADR-009: Approval Dialog UX Improvements

**Status:** Proposed
**Date:** 2025-01-15
**Incorporation:** Not Incorporated

## Context

The current approval dialog for MCP operations shows an "a" character in the input box after approval, which creates a confusing user experience. The dialog currently uses keyboard shortcuts ([a] Approve, [d] Deny, [Esc] Cancel) that leave residual characters in the input buffer.

Current issues:
1. After pressing 'a' to approve, the character appears in the input field
2. The dialog overlaps with ongoing agent thinking indicators
3. No clear visual feedback after approval/denial
4. The dialog persists briefly after action, creating visual confusion
5. No way to batch approve similar operations

## Options Considered

### Option 1: Consume Input Characters (Minimal Fix)

Modify the current implementation to consume the input characters so they don't appear in the input box.

**Implementation:**
- Clear input buffer after processing approval/denial
- Add a brief "Approved ✓" or "Denied ✗" message before closing dialog
- Immediately close dialog after action

**Pros:**
- Minimal code change
- Fixes the immediate issue
- Quick to implement
- Maintains current keyboard-based interaction

**Cons:**
- Doesn't address batch approval needs
- Still interrupts flow for every operation
- No improvement to visual hierarchy

### Option 2: Simple Numbered List (MVP)

A minimal implementation using numbered options without capability grants or specific templates.

**Implementation (generic for all operations):**
```
╭──────────────────────────────────────────────────────────╮
│ coder-agent wants to execute operation                  │
│                                                         │
│ Method: tools/call                                     │
│ Tool: write_file                                       │
│ Target: mcp-fs-bridge                                  │
│                                                         │
│ Arguments:                                              │
│ ╭────────────────────────────────────────────────────╮  │
│ │ {                                                  │  │
│ │   "path": "config.json",                          │  │
│ │   "content": "{\n  \"name\": \"my-app\"\n}"       │  │
│ │ }                                                  │  │
│ ╰────────────────────────────────────────────────────╯  │
│                                                         │
│ Do you want to allow this?                             │
│ ❯ 1. Yes                                               │
│   2. No                                                │
│                                                         │
╰──────────────────────────────────────────────────────────╯
```

**Pros:**
- Simple to implement quickly
- No character input issues
- Shows participant context
- Generic template works for all operations
- No complex capability grant logic needed

**Cons:**
- No session-level permissions (more interruptions)
- No user feedback mechanism
- Less optimized display for common operations
- Only Yes/No options

### Option 3: Full Numbered List Selection (Claude-style)

Replace keyboard shortcuts with numbered options that users can select, similar to modern CLI assistants.

**Implementation for file operations:**
```
╭──────────────────────────────────────────────────────────╮
│ coder-agent wants to write file                         │
│ ╭────────────────────────────────────────────────────╮  │
│ │ config.json                                        │  │
│ │                                                    │  │
│ │ {                                                  │  │
│ │   "name": "my-app",                                │  │
│ │   "version": "1.0.0",                              │  │
│ │   "settings": {                                    │  │
│ │     "theme": "dark"                                │  │
│ │   }                                                │  │
│ │ }                                                  │  │
│ ╰────────────────────────────────────────────────────╯  │
│                                                         │
│ Do you want to allow this?                             │
│ ❯ 1. Yes                                               │
│   2. Yes, allow coder-agent to write files             │
│   3. No, and tell coder-agent what to do differently   │
│                                                         │
╰──────────────────────────────────────────────────────────╯
```

**Implementation for common tool calls (with templates):**
```
╭──────────────────────────────────────────────────────────╮
│ assistant wants to execute command                      │
│ ╭────────────────────────────────────────────────────╮  │
│ │ npm install express                                │  │
│ │                                                    │  │
│ │ Working directory: /home/user/project             │  │
│ ╰────────────────────────────────────────────────────╯  │
│                                                         │
│ Do you want to allow this?                             │
│ ❯ 1. Yes                                               │
│   2. Yes, allow assistant to run npm commands          │
│   3. No, and tell assistant what to do differently     │
│                                                         │
╰──────────────────────────────────────────────────────────╯
```

**Implementation for generic/unknown tool calls (fallback):**
```
╭──────────────────────────────────────────────────────────╮
│ coder-agent wants to call tool                          │
│                                                         │
│ Target: analytics-server                               │
│ Method: tools/call                                     │
│ Tool: track_event                                      │
│                                                         │
│ Arguments:                                              │
│ ╭────────────────────────────────────────────────────╮  │
│ │ {                                                  │  │
│ │   "event": "user_signup",                         │  │
│ │   "properties": {                                  │  │
│ │     "plan": "premium",                            │  │
│ │     "source": "landing_page"                      │  │
│ │   }                                                │  │
│ │ }                                                  │  │
│ ╰────────────────────────────────────────────────────╯  │
│                                                         │
│ Do you want to allow this?                             │
│ ❯ 1. Yes                                               │
│   2. Yes, allow coder-agent to call analytics-server   │
│   3. No, and tell coder-agent what to do differently   │
│                                                         │
╰──────────────────────────────────────────────────────────╯
```

**Key features:**
- **Shows who is proposing** the operation in the title bar
- Number keys (1, 2, 3) for selection or arrow keys + Enter
- Option 2 triggers a capability grant (per MEW Protocol spec) for the session
- Option 3 allows user to provide feedback to the specific participant
- Shows operation details clearly (file content preview, tool description)
- Consistent phrasing: "Do you want to allow this?"

**Dynamic Context in Options:**
All options include the participant's name for clarity:
- Option 1: "Yes" (simple approval)
- Option 2: "Yes, allow [participant] to [operation category]"
- Option 3: "No, and tell [participant] what to do differently"

**Dynamic Option 2 Text Examples:**
- File write: "Yes, allow coder-agent to write files"
- File read: "Yes, allow assistant to read files"
- npm commands: "Yes, allow build-bot to run npm commands"
- Generic: "Yes, allow analytics-agent to call tools on metrics-server"

This ensures users always know:
1. **Who** is requesting the operation (in title)
2. **What** they want to do (in content area)
3. **Who** will receive the capability grant (in Option 2)
4. **Who** will receive feedback (in Option 3)

**Option 2 Capability Grant Behavior:**
When user selects "Yes, allow all X during this session", the CLI sends a capability grant message:
```json
{
  "protocol": "mew/v0.3",
  "from": "human",
  "to": ["coder-agent"],
  "kind": "capability/grant",
  "payload": {
    "recipient": "coder-agent",
    "capabilities": [
      {
        "kind": "mcp/request",
        "payload": {
          "method": "tools/call",
          "params": {
            "name": "write_file"
          }
        }
      }
    ],
    "reason": "User approved all write operations for this session"
  }
}
```

**Pros:**
- No character input issues
- Clear, modern UI pattern
- Session-level permissions reduce interruptions
- Provides user feedback option
- Shows operation context clearly
- Quick selection with number keys

**Cons:**
- Takes more screen space
- Requires refactoring current implementation
- Need to track session-level permissions

### Option 4: Inline Approval with Smart Defaults

Show approval inline with the message flow, with smart defaults based on risk level.

**Implementation:**
```
[06:32:51] ← coder-agent mcp/proposal
└─ write_file to config.json
   ⚠️ Approve? [Y/n] (auto-approve in 5s for SAFE operations)
```

**Pros:**
- Less intrusive
- Maintains message flow context
- Can auto-approve safe operations with timeout
- Compact display

**Cons:**
- Less prominent, might be missed
- Auto-approval might be controversial
- Harder to show detailed information

### Option 5: Sidebar Approval Queue

Create a persistent sidebar showing pending approvals that can be handled asynchronously.

**Implementation:**
```
Messages                    │ Pending Approvals (3)
─────────────────────────────┼──────────────────────────
[06:32:51] ← coder-agent    │ 1. write_file ⚠️
└─ thinking...              │    config.json
                            │    [A]pprove [D]eny
[06:32:52] ← coder-agent    │
└─ found solution           │ 2. read_file ✓
                            │    README.md
                            │    [A]pprove [D]eny
                            │
                            │ [B]atch approve all SAFE
```

**Pros:**
- Non-blocking workflow
- Can review multiple operations at once
- Batch operations possible
- Maintains context

**Cons:**
- Complex implementation
- Takes permanent screen space
- May miss urgent approvals

### Option 6: Multi-Level Approval System

Implement different approval mechanisms based on risk and user preference.

**Implementation:**
- **SAFE operations**: Auto-approve or inline confirmation
- **CAUTION operations**: Quick modal with 3-second timeout
- **DANGEROUS operations**: Full modal requiring explicit action
- **Batch mode**: "Approve all similar" option

**Configuration in space.yaml:**
```yaml
approval_mode:
  safe: auto        # auto, inline, modal
  caution: inline   # inline, modal
  dangerous: modal  # modal only
  batch_window: 30  # seconds to batch similar operations
```

**Pros:**
- Flexible for different use cases
- Reduces interruption for safe operations
- Maintains safety for dangerous operations
- User configurable

**Cons:**
- Most complex implementation
- Requires configuration
- Multiple code paths to maintain

## Decision

**Recommended: Phased approach starting with Option 2 (Simple Numbered List)**

Phase 1: Implement Option 1 immediately to fix the character input issue
Phase 2: Implement Option 2 (Simple Numbered List) as MVP
Phase 3: Evolve to Option 3 (Full Numbered List) with capability grants and templates

### Implementation Details

#### Phase 1 (Immediate):
1. Modify `OperationConfirmation` component to consume input characters
2. Add completion feedback: "✓ Approved" or "✗ Denied"
3. Clear dialog immediately after action

#### Phase 2 (Simple Numbered List - MVP):
1. Create new `ProposalDialog` component with:
   - Generic template for all operations
   - Shows participant name, method, tool, target
   - Formatted JSON arguments display
   - Simple Yes/No numbered options (1, 2)
2. Replace current approval dialog
3. Use number keys or arrow + Enter for selection
4. No capability grants yet (every operation needs approval)

#### Phase 3 (Full Numbered List Selection):
1. Create new `ProposalDialog` component with:
   - Operation title and details display
   - Content preview box for file operations
   - Numbered options (1, 2, 3)
   - Arrow key navigation support
2. Implement capability grants for session-level permissions:
   - When Option 2 selected, send capability/grant message
   - Gateway handles capability updates for the participant
   - Future proposals matching the grant are auto-converted to requests
   - Show brief notification: "✓ Granted write_file capability to coder-agent"
3. Add feedback mechanism:
   - When user selects option 3, capture their input
   - Send feedback as a chat message to the agent
4. Template system for different operations:

   **Common operation templates:**
   - `write_file`: Show filename and content preview (max 10 lines)
   - `read_file`: Show filename and path
   - `create_directory`: Show directory path
   - `delete_file`: Show filename with warning color
   - `move_file`: Show source → destination
   - `execute_command`: Show command and working directory
   - `run_script`: Show script name and arguments
   - `list_directory`: Show directory path

   **Generic fallback template:**
   - Shows raw MCP operation details
   - Displays method, tool name, and formatted arguments
   - Used for any operation without a specific template
   - Shows From/To participants for context

   **Template detection logic:**
   ```javascript
   function getDialogTemplate(proposal) {
     const method = proposal.payload?.method;
     const toolName = proposal.payload?.params?.name;

     // Check for specific templates
     if (method === 'tools/call') {
       switch(toolName) {
         case 'write_file':
         case 'create_file':
           return FileWriteTemplate;
         case 'read_file':
           return FileReadTemplate;
         case 'execute_command':
         case 'run_bash':
           return CommandExecuteTemplate;
         // ... more specific templates
       }
     }

     // Fallback to generic template
     return GenericMCPTemplate;
   }
   ```

### Code Changes

#### Phase 1 - Fix input consumption:
```javascript
function OperationConfirmation({ operation, onApprove, onDeny }) {
  const [status, setStatus] = useState(null);

  useInput((input, key) => {
    if (status) return; // Ignore input after decision

    if (input === 'a') {
      setStatus('approved');
      setTimeout(() => onApprove(), 100); // Brief feedback
      return; // Consume the input
    }
    if (input === 'd') {
      setStatus('denied');
      setTimeout(() => onDeny(), 100);
      return; // Consume the input
    }
    if (key.escape) {
      onDeny();
      return;
    }
  });

  if (status) {
    return React.createElement(Box, { borderStyle: 'round', borderColor: 'green' },
      React.createElement(Text, { color: status === 'approved' ? 'green' : 'red' },
        status === 'approved' ? '✓ Approved' : '✗ Denied'
      )
    );
  }

  // ... rest of current implementation
}
```

#### Phase 2 - Numbered list selection:
```javascript
function ProposalDialog({ proposal, onApprove, onDeny, sessionPermissions }) {
  const [selectedOption, setSelectedOption] = useState(1);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  // Check if auto-approved by session permissions
  const isAutoApproved = checkSessionPermission(proposal, sessionPermissions);
  if (isAutoApproved) {
    useEffect(() => {
      showNotification(`✓ Auto-approved: ${proposal.operation}`);
      onApprove();
    }, []);
    return null;
  }

  const options = getOptionsForProposal(proposal);
  // e.g., for write_file:
  // 1. Yes
  // 2. Yes, allow all writes during this session
  // 3. No, and tell coder-agent what to do differently

  const handleOption = (option) => {
    switch(option) {
      case 1:
        // Approve this single operation
        onApprove();
        break;
      case 2:
        // Grant capability for all similar operations
        const grant = {
          protocol: "mew/v0.3",
          from: participantId,
          to: [proposal.from],
          kind: "capability/grant",
          payload: {
            recipient: proposal.from,
            capabilities: [generateCapabilityPattern(proposal)],
            reason: `User approved all ${getOperationType(proposal)} operations for this session`
          }
        };
        ws.send(JSON.stringify(grant));
        onApprove();
        break;
      case 3:
        // Deny and provide feedback
        setFeedbackMode(true);
        break;
    }
  };

  useInput((input, key) => {
    if (feedbackMode) {
      // Handle feedback input
      return;
    }

    // Number key selection
    if (input >= '1' && input <= '3') {
      handleOption(parseInt(input));
      return;
    }

    // Arrow navigation
    if (key.upArrow) {
      setSelectedOption(Math.max(1, selectedOption - 1));
    }
    if (key.downArrow) {
      setSelectedOption(Math.min(options.length, selectedOption + 1));
    }
    if (key.return) {
      handleOption(selectedOption);
    }
  });

  return React.createElement(Box, { flexDirection: 'column', borderStyle: 'round' },
    // Title
    React.createElement(Text, { bold: true }, getOperationTitle(proposal)),

    // Content preview (for file operations)
    proposal.content && React.createElement(Box, {
      borderStyle: 'single',
      padding: 1,
      marginY: 1
    },
      React.createElement(Text, { dimColor: true }, proposal.filename),
      React.createElement(Text, null, truncateContent(proposal.content, 10))
    ),

    // Question
    React.createElement(Text, null, `Do you want to ${getActionPhrase(proposal)}?`),

    // Options
    options.map((option, i) =>
      React.createElement(Text, {
        key: i,
        color: selectedOption === i + 1 ? 'blue' : undefined
      },
        `${selectedOption === i + 1 ? '❯' : ' '} ${i + 1}. ${option}`
      )
    )
  );
}
```

## Consequences

### Positive
- Immediate fix for the input character issue
- Protocol-compliant implementation using capability grants
- Reduced interruptions through proper capability delegation
- Familiar UI pattern from modern CLI tools
- Empowers users to grant appropriate permissions dynamically
- Gateway handles capability enforcement (no client-side tracking needed)

### Negative
- More complex codebase
- Configuration adds cognitive overhead
- Multiple UI patterns to learn
- Testing complexity increases
- Potential for approval fatigue with auto-approval

### Migration Path

1. Deploy Phase 1 fix immediately (backward compatible)
2. Add risk assessment without changing UI
3. Introduce configuration options with defaults matching current behavior
4. Gradually enable new modes based on user feedback
5. Document best practices for approval configuration

## Updated Implementation Plan (2025-01-15)

After implementing the initial fix, the implementation strategy has been refined into three clear phases:

### Phase 1: Generic Template (✅ COMPLETED)
- Implemented Option 2 with enhanced navigation
- Arrow keys + Enter for selection
- Number key shortcuts (1/2)
- Visual selection indicator
- Proper focus management
- Input composer disabled during dialog

### Phase 2: Tool-Specific Templates (🚧 TODO)
Create optimized templates for common operations:
- File operations (read/write/delete)
- Command execution (npm/shell/git)
- Network requests
- Database operations

Each template will:
- Auto-detect based on tool name and method
- Provide operation-specific formatting
- Show relevant risks and context
- Fall back to generic template for unknown tools

### Phase 3: Capability Grants (📋 FUTURE)
Add "Yes, allow X to Y" option that:
- Sends MEW Protocol `capability/grant` messages
- Updates participant capabilities dynamically
- Reduces interruptions for similar operations
- Tracks grants per session (not persistent)

This phased approach delivers immediate value while building toward sophisticated capability management.

## References

- Current implementation: `/cli/src/utils/advanced-interactive-ui.js`
- Related issue: TODO.md line "Better fulfill UX"
- Similar patterns: VSCode extension approval, Docker Desktop permission dialogs
- Terminal UI best practices: https://github.com/vadimdemedes/ink