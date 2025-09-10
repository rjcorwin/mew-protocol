# ADR-006: Terminal UI Library Selection

**Status:** Proposed  
**Date:** 2025-01-10  
**Incorporation:** Not Incorporated

## Context

The current interactive mode (ADR-005) uses a simple readline-based interface that's sufficient for protocol debugging. However, we need a more advanced interactive mode that can:

1. Show MCP operation proposals as confirmation dialogs
2. Display multiple panels (chat, participants, operations log)
3. Handle rich formatting and layouts
4. Provide keyboard shortcuts and navigation
5. Show real-time updates without disrupting user input
6. Display progress indicators for long-running operations

This requires a modern Terminal User Interface (TUI) library that can handle complex layouts and interactions while maintaining good performance and cross-platform compatibility.

## Options Considered

### Option 1: Blessed

A comprehensive ncurses-like library for Node.js with extensive widget support.

**Pros:**
- Most feature-rich option with boxes, forms, tables, etc.
- Good documentation and examples
- Mature and battle-tested
- Supports mouse input
- Full screen terminal apps

**Cons:**
- Large dependency (700KB+)
- Complex API with steep learning curve
- Not actively maintained (last update 2018)
- Can be overkill for our needs

### Option 2: Ink (React for CLI)

React-based terminal UI framework using Yoga layout engine.

```javascript
import React from 'react';
import {render, Box, Text} from 'ink';

const App = () => (
  <Box flexDirection="column">
    <Text color="green">MEW Interactive</Text>
    <Box borderStyle="round">
      <Text>Chat messages here</Text>
    </Box>
  </Box>
);

render(<App />);
```

**Pros:**
- React paradigm - familiar to many developers
- Declarative UI with components
- Good TypeScript support
- Active development and community
- Built-in testing utilities
- Flexbox layout system

**Cons:**
- Requires React knowledge
- Heavier than alternatives (~500KB with dependencies)
- Might be harder to integrate with existing code
- Performance overhead from React reconciliation

### Option 3: Blessed-contrib

Extension of Blessed with data visualization widgets.

**Pros:**
- Adds charts, graphs, and dashboards to Blessed
- Good for monitoring and metrics display
- Pre-built widgets for common patterns

**Cons:**
- Inherits all Blessed issues
- Even larger than base Blessed
- Overkill for our chat/confirmation needs
- Not actively maintained

### Option 4: Inquirer.js + Chalk + Boxen

Combination of focused libraries:
- Inquirer for prompts and confirmations
- Chalk for colors
- Boxen for boxes and borders
- Ora for spinners

**Pros:**
- Each library does one thing well
- Already using Chalk
- Inquirer is excellent for confirmations
- Minimal dependencies
- Easy to integrate incrementally

**Cons:**
- Not a full TUI - more for enhanced CLI
- Limited layout capabilities
- Can't do split panels easily
- Less cohesive than framework approach

### Option 5: Charm's Bubble Tea (via Node bindings)

Go-based TUI framework with Node.js bindings.

**Pros:**
- Excellent design and UX
- Model-View-Update architecture
- Very performant
- Beautiful default styles

**Cons:**
- Requires Go runtime or complex bindings
- Less mature Node.js ecosystem
- Additional complexity for deployment

### Option 6: Clack

Modern CLI prompts library with beautiful default styles.

```javascript
import { intro, outro, confirm, spinner } from '@clack/prompts';

intro('MEW Interactive Mode');
const shouldProceed = await confirm({
  message: 'Agent wants to execute: calculator.add(5, 3). Allow?',
});
```

**Pros:**
- Beautiful, modern design out of the box
- Simple API
- Lightweight (~50KB)
- Great for confirmations and prompts
- Actively maintained

**Cons:**
- Not a full TUI framework
- Limited to prompts and simple interactions
- Can't do complex layouts

## Decision

Implement **Option 2: Ink (React for CLI)** for the advanced interactive mode, specifically using Ink v6+ with its `Static` component for native scrolling.

### Rationale

1. **Proven Success**: Gemini CLI demonstrates this exact architecture works beautifully in production
2. **Static Component**: Ink's `Static` component (v3+) enables native terminal scrolling while maintaining React benefits
3. **Component-based architecture** aligns well with our needs for different UI panels (chat, confirmations, participant list)
4. **Active development** ensures long-term support and bug fixes (v6+ is actively maintained)
5. **React paradigm** makes it easy to manage state for real-time updates
6. **Good testing story** with built-in testing utilities
7. **Flexbox layout** perfect for persistent bottom UI
8. **TypeScript support** maintains code quality

### Real-World Validation

Gemini CLI successfully uses Ink v6.2.3 with:
- Native scrolling via `Static` component for message history
- Persistent bottom UI with Composer and StatusBar
- Content-aware truncation with overflow indicators
- Multi-modal input (chat, shell, vim modes)
- Excellent performance with long sessions

This validates our architecture choice.

### Implementation Strategy

We'll use a **dual-mode approach** with Ink as the default:

1. **Default Mode**: Ink-based rich interface for best user experience (ADR-007)
2. **Debug Mode**: Simple readline-based for protocol debugging (ADR-005)

Command structure:
```bash
mew space connect                  # Default - Ink-based UI  
mew space connect --debug          # Debug mode - simple readline
mew space connect --simple         # Alias for --debug
mew space up -i                    # Default - Ink-based UI
mew space up -i --debug            # Debug mode - simple readline
```

This provides the best UX by default while maintaining the simple debugging tool for troubleshooting.

## Implementation Details

### Core Dependencies

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "ink-text-input": "^5.0.1",
    "ink-select-input": "^5.0.0",
    "ink-spinner": "^5.0.0",
    "ink-box": "^2.0.1"
  }
}
```

### Basic Architecture

```javascript
// components/App.jsx
import React, { useState } from 'react';
import { Box } from 'ink';
import ChatPanel from './ChatPanel';
import ConfirmationDialog from './ConfirmationDialog';
import ParticipantList from './ParticipantList';

const App = ({ ws, participant, space }) => {
  const [messages, setMessages] = useState([]);
  const [pendingOperation, setPendingOperation] = useState(null);
  
  return (
    <Box flexDirection="row" height="100%">
      <Box flexDirection="column" flexGrow={1}>
        <ChatPanel messages={messages} />
        {pendingOperation && (
          <ConfirmationDialog 
            operation={pendingOperation}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        )}
      </Box>
      <ParticipantList participants={participants} />
    </Box>
  );
};
```

### Component Examples

**Confirmation Dialog:**
```javascript
const ConfirmationDialog = ({ operation, onConfirm, onReject }) => (
  <Box borderStyle="round" borderColor="yellow" padding={1}>
    <Box flexDirection="column">
      <Text bold>⚠️  Operation Proposed</Text>
      <Text>Agent: {operation.from}</Text>
      <Text>Tool: {operation.tool}</Text>
      <Text>Args: {JSON.stringify(operation.args)}</Text>
      <Box marginTop={1}>
        <Text>Press Y to allow, N to reject</Text>
      </Box>
    </Box>
  </Box>
);
```

## Consequences

### Positive
- Rich, modern UI for complex interactions
- Better UX for MCP operation confirmations
- Reusable components for future features
- Good developer experience with React
- Can show real-time updates without disrupting input

### Negative  
- Larger dependency footprint
- Learning curve for developers not familiar with React
- More complex than simple readline approach
- Potential performance overhead
- Need to maintain two UI modes

### Migration Path

1. **Phase 1**: Implement Ink-based UI as default mode
   - Basic app structure with Static component
   - Port existing simple features to Ink components
   - Add `--debug` flag to fall back to readline mode

2. **Phase 2**: Add MCP operation confirmations
   - Operation notification in bottom UI
   - Basic approve/reject flow
   - Risk-level indicators

3. **Phase 3**: Enhanced UX features
   - Content-aware truncation (MaxSizedBox pattern)
   - Expandable operation details
   - Keyboard shortcuts

4. **Phase 4**: Advanced capabilities
   - Auto-approval rules
   - Multi-modal input support
   - Batch operation handling

5. **Phase 5**: Maintain debug mode for edge cases
   - Keep simple readline mode working
   - Use for automated testing and protocol debugging

## Alternatives for Specific Needs

If Ink proves too heavy, we could fall back to:
- **For confirmations only**: Use `@clack/prompts` or `inquirer`
- **For simple TUI**: Use `blessed` despite maintenance concerns
- **For minimal approach**: Enhance existing readline with ANSI codes

## Testing Requirements

1. Component testing with Ink's test utilities
2. Integration tests for confirmation flows
3. Performance testing with many messages
4. Cross-platform testing (Windows Terminal, iTerm2, etc.)
5. Accessibility testing with screen readers