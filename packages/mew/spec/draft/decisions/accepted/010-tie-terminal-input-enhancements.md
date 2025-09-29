# ADR-tie: Terminal Input Enhancements

**Status:** Accepted
**Date:** 2025-01-16
**Incorporation:** Complete (v0.4.2)

## Context

The current CLI interactive terminal input lacks standard terminal editing capabilities that users expect from modern command-line interfaces. Users need familiar keyboard shortcuts and navigation patterns to efficiently interact with the MEW Protocol CLI, especially during longer sessions or when composing complex MCP requests.

Current limitations:
- No command history navigation (up/down arrows)
- No cursor movement within the input line
- No multi-line input support
- No standard terminal shortcuts (Ctrl-A, Ctrl-E, etc.)
- Loss of previously typed commands/messages
- No autocomplete for slash commands
- No filesystem path autocomplete
- No word-wise cursor navigation with Option/Alt keys

## Options Considered

### Option 1: Custom Input Handler Implementation

Build our own input handling layer on top of the existing Ink-based UI.

**Pros:**
- Full control over behavior and appearance
- Can integrate tightly with existing Ink components
- No additional dependencies
- Can customize behavior precisely for MEW Protocol needs

**Cons:**
- Significant development effort
- Need to handle all edge cases ourselves
- Risk of missing standard behaviors users expect
- Maintenance burden for complex input handling logic

### Option 2: Extend ink-text-input Component

Use the existing `ink-text-input` component and build history/navigation features around it.

**Pros:**
- Already handles basic text input and cursor movement (left/right arrows)
- Maintained by the Ink community
- Proven stable component used in many CLI apps
- Can wrap it with our own component for history management

**Cons:**
- Only supports single-line input (no multi-line capability)
- No built-in history functionality (up/down arrows do nothing)
- No readline shortcuts (Ctrl-A, Ctrl-E, etc.)
- Would need to intercept and override all arrow key handling
- Significant custom code still needed for history and shortcuts

### Option 3: Use @inkjs/ui TextInput

Switch to the newer `@inkjs/ui` TextInput component as a foundation.

**Pros:**
- More modern implementation than ink-text-input
- Includes autocomplete/suggestions feature
- Better TypeScript support
- Part of the official Ink UI component library

**Cons:**
- Still single-line only (explicitly documented)
- No history functionality
- No multi-line support
- No readline shortcuts
- Would require same amount of custom code as Option 2
- Less mature/proven than ink-text-input

### Option 4: Integrate Non-Ink Terminal Input Library

Use a dedicated terminal input library like `inquirer`, `prompt-toolkit` patterns, or Node's native `readline` with history.

**Pros:**
- Battle-tested implementations with full feature sets
- Native readline includes history support
- Handles all edge cases and terminal compatibility
- Standard behavior users expect

**Cons:**
- Fundamentally incompatible with Ink's React rendering model
- Would require running outside of Ink's component tree
- Could cause screen corruption with competing render systems
- Would need complete UI architecture redesign

### Option 5: Hybrid Approach with readline-like Interface

Implement a readline-compatible input handler that works within Ink's component model, similar to how GNU readline works but adapted for React's declarative paradigm.

**Pros:**
- Familiar readline behavior for users
- Can leverage existing readline knowledge/patterns
- Progressive enhancement (add features incrementally)
- Works within Ink's component model
- Can share code between debug mode (already uses readline) and advanced mode

**Cons:**
- Still requires implementation effort
- Need to map imperative readline concepts to React
- May have performance implications for React re-renders

### Option 6: Build Custom TextBuffer Component (Gemini CLI Architecture)

Build a comprehensive TextBuffer component following the architecture used by Google's Gemini CLI, implementing a full-featured text buffer system with all terminal features from scratch.

**Pros:**
- **Proven implementation**: Already working in production (Gemini CLI)
- **Complete feature set**: History, multi-line, all readline shortcuts, word navigation
- **React-optimized**: Designed specifically for Ink's React model
- **Advanced features**: Includes reverse search (Ctrl+R), shell history, vim bindings
- **Clean architecture**: Separates concerns (TextBuffer, InputHistory hook, key matchers)
- **Configurable keybindings**: User-customizable shortcuts via configuration

**Cons:**
- **Most complex implementation**: Requires building comprehensive text buffer system
- **Large code footprint**: TextBuffer alone is ~2000 lines
- **Over-engineered for MVP**: Includes features we may not need initially

### Option 7: Adapt Gemini CLI Code Directly

Copy and adapt the actual TextBuffer implementation from Gemini CLI, modifying it to fit MEW Protocol's needs. (See ADR-011 for detailed implementation plan)

**Pros:**
- **Fastest implementation**: 4 clear milestones instead of months of uncertain development
- **Battle-tested code**: Google's implementation is already debugged and optimized
- **Complete feature set immediately**: All features work from day one
- **Lower risk**: Avoids bugs from reimplementing complex logic
- **License compatible**: Apache 2.0 is compatible with MIT
- **Can strip unused features**: ~29% code reduction by removing vim bindings, shell mode, etc.
- **Modular architecture**: 10 well-separated files that can be adapted independently

**Cons:**
- **Attribution required**: Must include Apache 2.0 notice and credit Google LLC
- **Mixed licensing**: Project would have both MIT and Apache 2.0 code
- **Maintenance complexity**: Need to track upstream changes or fork permanently
- **Initial size**: ~3500 lines of code (reducible to ~2500 after cleanup)
- **Learning curve**: Need to understand Google's code architecture first

## Analysis

### Comparison: Options 5, 6, and 7

All three options would work within Ink's React model. The key differences:

**Implementation Speed:**
- Option 5: Many months - need to write everything from scratch
- Option 6: Even longer - need to understand and recreate Gemini's architecture
- Option 7: 4 clear milestones - copy working code and modify (per ADR-011)

**Implementation Risk:**
- Option 5: Medium risk - may have bugs in custom implementation
- Option 6: Higher risk - recreating complex system from scratch
- Option 7: Lowest risk - using proven, tested code with clear adaptation plan

**Code Size:**
- Option 5: ~1000-1500 lines (growing over time)
- Option 6: ~2000-2500 lines (full implementation)
- Option 7: ~2500 lines after cleanup (from 3500 original)

**Maintenance:**
- Option 5: Smaller codebase, fully owned
- Option 6: Larger codebase, fully owned
- Option 7: Well-documented attribution, modular architecture aids maintenance

**Feature Completeness:**
- Option 5: Start basic, add features over time
- Option 6: Full features but written from scratch
- Option 7: Full features immediately, can strip unneeded ones

**Licensing:**
- Option 5 & 6: Pure MIT license
- Option 7: Mixed MIT/Apache 2.0 (compatible, requires NOTICE file per ADR-011)

## Decision

**Selected Option: Option 7 - Adapt Gemini CLI Code Directly**

After thorough analysis, we will adapt Gemini CLI's input implementation rather than building from scratch. This decision represents a strategic pivot based on the research findings.

**Note on Decision Evolution**: This ADR initially favored Option 5 (build from scratch) based on a preference for code ownership. However, after detailed research and creating ADR-011's implementation plan, the time and risk advantages of Option 7 became overwhelming.

### Rationale for Choosing Option 7

**Primary Factors:**
1. **Time to Market**: 4 achievable milestones vs many months of uncertain development
2. **Risk Reduction**: Eliminates unknown edge cases in Unicode handling, multi-line text, cursor positioning
3. **Proven Quality**: Battle-tested in production by Google
4. **Opportunity Cost**: 2+ months saved can be invested in core MEW Protocol features

**Addressing Concerns:**
- **Attribution overhead**: Trivial - just a NOTICE file and headers (< 1 hour of work)
- **Mixed licensing**: Apache 2.0 + MIT is a common, well-understood combination
- **Code ownership**: We can refactor later if needed, but starting with working code is pragmatic
- **Over-engineering**: We can strip 29% immediately, removing vim bindings, shell mode, etc.

### Why Not Option 5?

While Option 5 (building from scratch) offers "pure" ownership, the cost-benefit analysis doesn't support it:
- **Hidden Complexity**: Text input has numerous edge cases (emoji handling, RTL text, zero-width characters, etc.)
- **User Expectations**: Modern users expect flawless terminal input - partial implementations feel broken
- **Non-Differentiating**: Terminal input is not MEW Protocol's value proposition
- **Maintenance Burden**: We'd own every bug and edge case forever

### Implementation Approach

ADR-011 provides the complete implementation plan with four clear milestones:
- Milestone 1: Core text buffer integration
- Milestone 2: Input component and key handling
- Milestone 3: History and persistence
- Milestone 4: Autocomplete features

**Strategic Insight**: Terminal input is infrastructure, not MEW Protocol's core value proposition. Every day spent on input mechanics is a day not spent on protocol innovation.

**Decision Summary**: Pragmatism over purism. We choose to deliver excellent user experience quickly rather than spend months reinventing a solved problem.

### Implementation Details

The implementation will adapt Gemini CLI's components directly, as detailed in ADR-011.

**Key Components to Adapt from Gemini CLI:**
- Uses a `useKeypress` hook to capture all keyboard input
- Maintains a `TextBuffer` state (~2000 lines) that tracks lines, cursor position, and viewport
- Separates concerns: InputHistory hook, key matchers, and text buffer are independent modules
- Implements configurable key bindings via a command enum pattern
- Handles multi-line with proper word wrapping and cursor tracking
- Has command completion with `useCommandCompletion` hook that shows suggestions
- Supports Option/Alt+arrow word navigation via `move('wordLeft')` and `move('wordRight')`
- Implements `@` path completion for file references in input
- Modular architecture: 10 distinct files that can be adapted separately

The implementation will include:

1. **History Management**
   - Maintain a circular buffer of previous inputs
   - Persist history across sessions in `.mew/cli-history`
   - Support configurable history size (default: 1000 entries)
   - Filter duplicates and empty entries

2. **Cursor Navigation**
   - Left/Right arrows for character movement
   - Ctrl-A (or Home) to move to beginning of line
   - Ctrl-E (or End) to move to end of line
   - Option-Left / Option-Right (Alt on Linux/Windows) for word-wise movement
   - Ctrl-← / Ctrl-→ as alternative for word navigation

3. **Line Editing**
   - Backspace/Delete for character removal
   - Ctrl-K to delete from cursor to end of line
   - Ctrl-U to delete from cursor to beginning of line
   - Ctrl-W to delete previous word

4. **Multi-line Support**
   - Shift-Enter (or Alt-Enter) to insert newline
   - Preserve formatting in multi-line inputs
   - Visual indication of multi-line mode
   - Support for JSON formatting across multiple lines

5. **History Navigation**
   - Up arrow to navigate to previous entries
   - Down arrow to navigate to newer entries
   - Preserve current input when starting history navigation
   - Search through history with Ctrl-R (future enhancement)

6. **Slash Command Autocomplete**
   - Detect `/` at beginning of input to trigger command mode
   - Display filtered list of available commands below input
   - Update suggestions in real-time as user types
   - Show command descriptions alongside names
   - Navigate suggestions with up/down arrows
   - Accept suggestion with Tab or Enter
   - Escape to cancel autocomplete and return to normal input

7. **Filesystem Path Autocomplete**
   - Detect `@` character to trigger filesystem autocomplete
   - Use current working directory where MEW CLI was launched
   - Show filtered list of files and directories
   - Support relative and absolute paths after `@`
   - Display file/directory icons or indicators
   - Navigate with Tab through suggestions
   - Support nested path completion (e.g., `@src/components/`)
   - Escape to cancel autocomplete
   - Particularly useful for agent interactions (coder, todo agents)

8. **Component Architecture**
   ```typescript
   interface EnhancedInputProps {
     onSubmit: (value: string) => void;
     placeholder?: string;
     multiline?: boolean;
     historySize?: number;
     persistHistory?: boolean;
     commands?: Command[];  // Available slash commands
     workingDirectory?: string;  // For @ filesystem autocomplete
   }

   interface Command {
     name: string;
     description: string;
     aliases?: string[];
     handler?: () => void;
   }

   class InputHistory {
     private entries: string[];
     private currentIndex: number;
     private tempEntry: string; // Current unsaved input

     addEntry(entry: string): void;
     getPrevious(): string | null;
     getNext(): string | null;
     saveTemp(entry: string): void;
   }

   const EnhancedInput: React.FC<EnhancedInputProps> = (props) => {
     const [value, setValue] = useState('');
     const [cursorPos, setCursorPos] = useState(0);
     const [history] = useState(() => new InputHistory());
     const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
     const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
     const [showPathSuggestions, setShowPathSuggestions] = useState(false);
     const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
     const [selectedSuggestion, setSelectedSuggestion] = useState(0);

     // Detect slash command mode
     useEffect(() => {
       if (value.startsWith('/')) {
         const query = value.slice(1).toLowerCase();
         const filtered = props.commands?.filter(cmd =>
           cmd.name.toLowerCase().includes(query) ||
           cmd.aliases?.some(a => a.toLowerCase().includes(query))
         ) || [];
         setFilteredCommands(filtered);
         setShowCommandSuggestions(filtered.length > 0);
       } else {
         setShowCommandSuggestions(false);
       }
     }, [value, props.commands]);

     // Detect @ filesystem autocomplete
     useEffect(() => {
       const atIndex = value.lastIndexOf('@');
       if (atIndex !== -1) {
         const afterAt = value.slice(atIndex + 1);
         // Get filesystem suggestions based on afterAt path
         const paths = getPathSuggestions(props.workingDirectory, afterAt);
         setFilteredPaths(paths);
         setShowPathSuggestions(paths.length > 0);
       } else {
         setShowPathSuggestions(false);
       }
     }, [value, props.workingDirectory]);

     useInput((input, key) => {
       // Handle command/path suggestions navigation
       if (showCommandSuggestions || showPathSuggestions) {
         const suggestions = showCommandSuggestions ? filteredCommands : filteredPaths;
         const maxIndex = suggestions.length - 1;

         if (key.upArrow) {
           setSelectedSuggestion(Math.max(0, selectedSuggestion - 1));
           return;
         }
         if (key.downArrow) {
           setSelectedSuggestion(Math.min(maxIndex, selectedSuggestion + 1));
           return;
         }
         if (key.tab || key.return) {
           if (showCommandSuggestions) {
             const cmd = filteredCommands[selectedSuggestion];
             setValue(`/${cmd.name} `);
             setShowCommandSuggestions(false);
           } else if (showPathSuggestions) {
             const path = filteredPaths[selectedSuggestion];
             const atIndex = value.lastIndexOf('@');
             setValue(value.slice(0, atIndex) + `@${path} `);
             setShowPathSuggestions(false);
           }
           return;
         }
         if (key.escape) {
           setShowCommandSuggestions(false);
           setShowPathSuggestions(false);
           return;
         }
       }

       // Handle word navigation with Option/Alt keys
       if ((key.meta || key.alt) && key.name === 'left') {
         moveCursorWordLeft();
         return;
       }
       if ((key.meta || key.alt) && key.name === 'right') {
         moveCursorWordRight();
         return;
       }

       // Handle history navigation
       if (key.upArrow) {
         const prev = history.getPrevious();
         if (prev !== null) {
           setValue(prev);
           setCursorPos(prev.length);
         }
       }
       // ... other key handlers
     });

     return (
       <Box flexDirection="column">
         <CustomTextInput value={value} ... />
         {showCommandSuggestions && (
           <CommandSuggestions
             commands={filteredCommands}
             selectedIndex={selectedSuggestion}
           />
         )}
         {showPathSuggestions && (
           <PathSuggestions
             paths={filteredPaths}
             selectedIndex={selectedSuggestion}
           />
         )}
       </Box>
     );
   };
   ```

9. **Integration Points**
   - Replace current input component in advanced interactive mode
   - Share history between debug and advanced modes
   - Maintain backward compatibility with existing shortcuts
   - Ensure approval dialogs still work with new input handling

## Consequences

### Positive

- **Improved User Experience**: Users get familiar terminal behaviors they expect
- **Increased Productivity**: Faster command entry and editing with standard shortcuts
- **Better Error Recovery**: Can edit and retry commands without retyping
- **Learning Curve Reduction**: Standard terminal behaviors reduce learning requirements
- **History Persistence**: Users don't lose their command history between sessions
- **Multi-line Support**: Easier to compose complex JSON messages and formatted text
- **Command Discovery**: Slash command autocomplete helps users discover available commands
- **Reduced Typing**: Autocomplete reduces typing and prevents command typos
- **Efficient File References**: @ autocomplete makes it easy to reference files when working with agents
- **Faster Navigation**: Word-wise cursor movement with Option/Alt keys speeds up text editing

### Negative

- **Attribution Requirements**: Must maintain Apache 2.0 attribution and NOTICE file
- **Mixed Licensing**: Project will contain both MIT and Apache 2.0 licensed code
- **Initial Learning Curve**: Need to understand Gemini's architecture before modifying
- **Potential Over-Engineering**: May include patterns we don't need (mitigated by 29% reduction plan)
- **Less Familiar Code**: Team didn't write it originally (mitigated by good documentation)
- **Upstream Tracking**: Should monitor Gemini CLI for important fixes

### Implementation Milestones

Following ADR-011's implementation plan:

1. **Milestone 1: Core Text Buffer**
   - Copy and adapt TextBuffer (~2000 lines)
   - Strip vim mode and unnecessary features
   - Ensure basic cursor movement works
   - Deliverable: Working multi-line text editing

2. **Milestone 2: Input Component Integration**
   - Adapt InputPrompt as EnhancedInput
   - Integrate with MEW's UI structure
   - Add key handling and Option+arrow navigation
   - Deliverable: Fully functional input with keyboard shortcuts

3. **Milestone 3: History & Persistence**
   - Implement history management
   - Add `.mew/cli-history` persistence
   - Ensure debug mode compatibility
   - Deliverable: Persistent command history across sessions

4. **Milestone 4: Autocomplete Features**
   - Slash command autocomplete
   - @ filesystem path completion
   - Polish and testing
   - Deliverable: Full autocomplete functionality

**Risk Mitigation**: Start with the most complex component (TextBuffer) first. If adaptation proves more difficult than expected, we can fall back to using it as-is with minimal modifications.

### Testing Requirements

- Unit tests for InputHistory class
- Integration tests for keyboard shortcut handling
- Cross-platform testing (macOS, Linux, Windows terminals)
- Performance testing with large history buffers
- Accessibility testing for screen readers

### Configuration

Users can configure behavior via environment variables or config file:

```yaml
# .mew/config.yaml
cli:
  input:
    historySize: 1000
    persistHistory: true
    multilineShortcut: "shift+enter"  # or "alt+enter"
    shortcuts:
      beginningOfLine: ["ctrl+a", "home"]
      endOfLine: ["ctrl+e", "end"]
```

## References

- GNU Readline Documentation
- Node.js readline module
- ink-text-input component documentation
- VS Code integrated terminal input handling
- Common terminal emulator behaviors (iTerm2, Terminal.app, gnome-terminal)
- [ADR-011: Adapt Gemini CLI Input Implementation](./011-agi-adapt-gemini-input-implementation.md) - Detailed Option 7 implementation plan
- [Gemini CLI Source](https://github.com/google/gemini-cli) - Reference implementation