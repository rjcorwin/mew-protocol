# ADR-004: Dual Interactive UI Modes - Debug vs Advanced

## Status
Proposed

## Context

The CLI specification describes interactive terminal interfaces but doesn't specify the level of sophistication required. The current implementation provides two distinct interactive modes:

1. **Debug Mode** (`--debug` or `--simple`): Lightweight readline-based interface  
2. **Advanced Mode** (default): Ink-based React terminal UI with rich features

This creates a choice between simplicity/reliability vs features/polish that affects development, testing, and user experience.

### Current Implementation:
- **Debug Mode**: Simple readline interface for protocol debugging
- **Advanced Mode**: Full-featured terminal UI with native scrolling, MCP confirmations, reasoning display
- **Mode Selection**: Command-line flags control which UI is used

### Technical Stack:
- **Debug Mode**: Node.js `readline` module only
- **Advanced Mode**: React + Ink for terminal rendering

## Decision

We will maintain **dual interactive UI modes** to serve different use cases, with clear boundaries and selection criteria.

### Mode Selection Strategy:
```
Default: Advanced Mode (rich experience)
  ↓
Fallback Triggers:
  - `--debug` or `--simple` flags
  - `--no-ui` flag  
  - `TERM=dumb` environment
  - CI/testing environments
  - Ink rendering failures
  ↓
Result: Debug Mode (reliable fallback)
```

### Architecture:
```javascript
// Dynamic UI selection
const useDebugUI = options.debug || 
                   options.simple || 
                   options.noUi ||
                   process.env.CI ||
                   process.env.TERM === 'dumb';

const InteractiveUI = useDebugUI ? 
  require('../utils/interactive-ui') :        // Debug mode
  require('../utils/advanced-interactive-ui'); // Advanced mode
```

## Rationale

### Why Dual Modes vs Single Mode:

#### Single Simple Mode Problems:
- **Limited UX**: Poor experience for daily development use
- **Missing Features**: No MCP confirmations, reasoning display, rich formatting
- **Competition**: Other tools provide better terminal experiences

#### Single Advanced Mode Problems:
- **Complexity**: React/Ink dependencies add failure points
- **Testing Issues**: Hard to automate tests with rich terminal UI
- **Platform Issues**: May not work in all terminal environments
- **Debug Difficulty**: Harder to see raw protocol messages

### Mode-Specific Benefits:

#### Debug Mode Advantages:
- **Reliability**: Simple readline, fewer dependencies
- **Protocol Visibility**: Raw JSON messages clearly displayed
- **Testing Friendly**: Easy to automate and script
- **Universal Compatibility**: Works in any terminal
- **Debug Focused**: Designed for protocol debugging

#### Advanced Mode Advantages:
- **User Experience**: Modern terminal UI with native scrolling
- **MCP Integration**: Built-in operation confirmation dialogs
- **Reasoning Display**: Shows AI agent thinking processes transparently
- **Rich Formatting**: Syntax highlighting, contextual colors
- **Production Ready**: Suitable for daily development workflows

## Implementation Details

### Debug Mode Features:
```javascript
class InteractiveUI {
  // Core functionality
  - Message input/output with smart detection
  - JSON vs chat message handling
  - Command system (/help, /verbose, /exit)
  - Message history and replay
  - Configurable filtering (heartbeat, system messages)
  - Raw protocol message display
  
  // Optimized for:
  - Protocol debugging
  - Automated testing
  - CI/CD environments
  - Learning MEW protocol
}
```

### Advanced Mode Features:
```javascript  
function AdvancedInteractiveUI() {
  // Enhanced functionality
  - All debug mode features
  - Native terminal scrolling (preserves terminal behavior)
  - MCP operation confirmation dialogs
  - Real-time reasoning session display
  - Rich message formatting with syntax highlighting
  - Persistent bottom input area
  - Auto-approval rules for trusted operations
  
  // Optimized for:
  - Daily development workflows
  - Human supervision of autonomous agents
  - Rich protocol interaction
  - Production debugging
}
```

### Mode Selection Logic:
```javascript
function selectInteractiveMode(options) {
  // Explicit user choice
  if (options.debug || options.simple || options.noUi) {
    return 'debug';
  }
  
  // Environment detection
  if (process.env.CI || process.env.TERM === 'dumb') {
    return 'debug';
  }
  
  // Try advanced mode with fallback
  try {
    require('ink');
    return 'advanced';
  } catch (error) {
    console.warn('Falling back to debug UI due to missing dependencies');
    return 'debug';
  }
}
```

## MCP Operation Confirmation Design

### Advanced Mode Confirmation Flow:
```
MCP Proposal Received
        ↓
Risk Assessment (file write, network access, etc.)
        ↓
Auto-approval Rules Check
        ↓
If auto-approved: Fulfill directly
If needs approval: Show confirmation dialog
        ↓
User Decision: [a]pprove [d]eny [r]emember
        ↓
Execute fulfillment or send rejection
```

### Confirmation Dialog Example:
```
┌─ MCP Operation Approval Required ──────────┐
│ calculator wants to execute: tools/call    │
│                                             │
│ Method: tools/call                          │
│ Tool: file_write                           │  
│ Args: { path: "/tmp/result.txt" }          │
│                                             │
│ Risk Level: CAUTION (file system write)    │
│                                             │
│ [a] Approve  [d] Deny  [r] Remember choice │
└─────────────────────────────────────────────┘
```

## Reasoning Transparency Integration

### Real-time Reasoning Display:
```javascript
// Active reasoning session indicator
{activeReasoning && (
  <Box borderStyle="round" borderColor="blue">
    <Text color="blue">
      🤔 {activeReasoning.from} is thinking...
    </Text>
    <Text>{activeReasoning.message}</Text>
    <Text color="gray">
      Thoughts: {activeReasoning.thoughtCount} | 
      Duration: {formatDuration(activeReasoning.startTime)}
    </Text>
  </Box>
)}
```

### Reasoning Context Filtering:
- Advanced mode can hide/show reasoning contexts
- Debug mode shows all messages with clear labeling
- Context-aware prompt construction (per MEW spec)

## Technical Dependencies

### Debug Mode Dependencies:
```json
{
  "readline": "built-in",  
  "chalk": "^4.1.2",      // Optional colors
  "uuid": "^9.0.0"        // Message IDs
}
```

### Advanced Mode Additional Dependencies:
```json
{
  "ink": "^3.2.0",        // Terminal UI framework
  "react": "^18.2.0"      // UI framework for Ink
}
```

## Testing Strategy

### Debug Mode Testing:
- **Unit Tests**: Mock readline input/output
- **Integration Tests**: Spawn CLI process and send input
- **Protocol Tests**: Verify correct MEW message generation
- **Automation**: Easy to script for CI/CD

### Advanced Mode Testing:
- **Component Tests**: Test React components in isolation
- **Snapshot Tests**: Verify UI rendering consistency
- **Interaction Tests**: Simulate user interactions
- **Fallback Tests**: Verify graceful degradation to debug mode

## Environment Configuration

### Shared Configuration:
```bash
MEW_INTERACTIVE_SHOW_HEARTBEAT=true   # Show heartbeat messages
MEW_INTERACTIVE_SHOW_SYSTEM=true     # Show system messages
MEW_INTERACTIVE_COLOR=false          # Disable colors
```

### Mode-Specific Environment:
```bash
# Force debug mode
MEW_INTERACTIVE_MODE=debug

# Force advanced mode (fails if dependencies missing)
MEW_INTERACTIVE_MODE=advanced

# Auto-detect mode (default)
MEW_INTERACTIVE_MODE=auto
```

## Use Case Matrix

| Use Case | Recommended Mode | Rationale |
|----------|-----------------|-----------|
| Daily development | Advanced | Rich UX, MCP confirmations |
| Protocol debugging | Debug | Raw message visibility |
| CI/CD testing | Debug | Automation friendly |
| Agent supervision | Advanced | MCP confirmations, reasoning |
| Learning MEW | Debug | Protocol transparency |
| Production debugging | Either | Depends on context |

## Consequences

### Positive:
- **Flexibility**: Right tool for the job
- **Reliability**: Fallback ensures functionality
- **User Experience**: Rich experience when possible
- **Testing**: Both automated and manual testing supported
- **Compatibility**: Works across environments

### Negative:
- **Complexity**: Two codebases to maintain
- **Feature Drift**: Risk of modes diverging
- **Documentation**: Need to document both interfaces  
- **Support**: Users may be confused by mode differences

### Risks:
- **Maintenance Burden**: Duplicate bug fixes across modes
- **Feature Inconsistency**: Advanced mode gets features debug doesn't
- **Dependency Issues**: Ink/React updates breaking advanced mode
- **Testing Gaps**: Different test coverage between modes

## Migration Path

### Transition Strategy:
1. **Phase 1**: Stabilize both modes independently
2. **Phase 2**: Extract common protocol logic into shared module
3. **Phase 3**: Create unified testing approach
4. **Phase 4**: Consider mode convergence or deprecation based on usage

### Code Organization:
```
src/utils/
├── interactive-ui.js           # Debug mode implementation  
├── advanced-interactive-ui.js  # Advanced mode implementation
├── interactive-common.js       # Shared protocol logic
└── interactive-factory.js      # Mode selection logic
```

## Future Considerations

### Potential Convergence:
- Extract shared message handling logic
- Unified configuration system
- Common testing framework
- Shared command system

### Alternative Approaches:
- **Plugin System**: Pluggable UI components
- **Layered Approach**: Rich UI as optional enhancement
- **Mode Evolution**: Gradual feature migration

## Monitoring and Metrics

### Usage Tracking:
- Which mode is selected in different environments
- Failure rates for advanced mode fallback
- User preference patterns
- Feature usage within each mode

### Quality Metrics:
- Bug reports per mode
- Test coverage differences
- User satisfaction by mode
- Performance characteristics

## Status Tracking

- [ ] Extract shared protocol logic
- [ ] Create unified testing approach
- [ ] Document mode selection criteria
- [ ] Add usage analytics
- [ ] Create mode migration utilities