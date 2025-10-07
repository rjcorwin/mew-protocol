# ADR: CLI Message Navigation for Scrollback Access

**Status**: Draft
**Date**: 2025-10-07
**Decision Makers**: MEW Protocol Working Group

## Context

Coding agents and humans need to review messages that have scrolled above the visible terminal area. Currently, the MEW interactive UI shows recent messages and they scroll away as new ones arrive. There's no keyboard navigation to review history.

**User Need:**
- Navigate through message history with keyboard shortcuts
- Select/focus specific messages (like tab/shift-tab in browsers)
- Automatically scroll viewport when focused message moves out of view
- Works for both humans (better UX) and agents (programmable via send_input)

**Current Limitations:**
1. No way to navigate up to older messages
2. Once content scrolls off screen, it's invisible
3. Agents must use raw logs or control plane state (not visual verification)
4. Humans can't review what just scrolled by

**The Question**: How should message navigation work in the MEW interactive UI?

## Decision Drivers

1. **Human UX First** - Must be intuitive for humans using the CLI
2. **Agent-Automatable** - Must work via `/control/send_input` for coding agents
3. **Familiar Patterns** - Follow conventions from vim, less, browser devtools, etc.
4. **Non-Intrusive** - Don't interfere with normal chat/command input
5. **Visual Clarity** - Clear indication of which message is focused

## Considered Options

### Option 1: Vim-Style Navigation (j/k Keys)

**Approach**: Use j/k for down/up navigation, similar to vim/less.

**Key Bindings:**
- `j` or `↓` - Select next message (down)
- `k` or `↑` - Select previous message (up)
- `g` - Jump to oldest message
- `G` (shift+g) - Jump to newest message
- `Enter` or `i` - Exit navigation mode, return to input
- `/` - Search messages (optional future feature)

**UI Behavior:**
- Messages have subtle focus indicator (e.g., `▶` or highlight background)
- Focused message auto-scrolls into view if off-screen
- Navigation mode triggered by first `j`/`k` press while not typing
- Normal chat input disabled while navigating
- Status line shows "Navigate Mode (Enter to exit)"

**Pros:**
- ✅ Familiar to developers (vim, less, man pages)
- ✅ Efficient single-key navigation
- ✅ Clear mental model (mode-based)
- ✅ Easy to extend (/, n, N for search later)
- ✅ Works perfectly with coding agents via send_input

**Cons:**
- ⚠️ Mode-based UX may confuse some users
- ⚠️ j/k may conflict with typing those letters in messages
- ⚠️ Requires mode indicator in UI

**Agent Usage:**
```bash
# Navigate to older messages
curl -X POST http://localhost:9999/control/send_input -d '{"key":"k"}'
curl -X POST http://localhost:9999/control/send_input -d '{"key":"k"}'
curl -X POST http://localhost:9999/control/send_input -d '{"key":"k"}'

# Capture screen showing older messages
curl -s http://localhost:9999/control/screen | jq -r '.plain'

# Return to latest
curl -X POST http://localhost:9999/control/send_input -d '{"key":"G"}'
```

---

### Option 2: Arrow Keys + Ctrl Modifier

**Approach**: Use Ctrl+↑/↓ for navigation (no mode switching).

**Key Bindings:**
- `Ctrl+↑` - Select previous message (up)
- `Ctrl+↓` - Select next message (down)
- `Ctrl+Home` - Jump to oldest message
- `Ctrl+End` - Jump to newest message
- Any text input automatically deselects and returns to normal input

**UI Behavior:**
- Message gets highlighted when focused
- Auto-scrolls viewport to keep focused message visible
- No mode - just highlight disappears when you start typing
- No status change needed

**Pros:**
- ✅ No mode switching confusion
- ✅ Ctrl modifier prevents accidental activation
- ✅ Familiar from text editors (Ctrl+arrows = word jump)
- ✅ Works with coding agents
- ✅ Simpler mental model (no modes)

**Cons:**
- ⚠️ Ctrl+arrows already used in some terminals (word navigation in input)
- ⚠️ May conflict with terminal emulator shortcuts
- ⚠️ Two-key combo is slower than single key
- ⚠️ Less familiar to vim users

**Agent Usage:**
```bash
# Navigate to older messages
curl -X POST http://localhost:9999/control/send_input -d '{"key":"ctrl+up"}'
curl -X POST http://localhost:9999/control/send_input -d '{"key":"ctrl+up"}'

# Capture
curl -s http://localhost:9999/control/screen | jq -r '.plain'
```

---

### Option 3: Page Up/Down Keys

**Approach**: Use PageUp/PageDown to scroll through message history.

**Key Bindings:**
- `PageUp` - Scroll up ~10 messages
- `PageDown` - Scroll down ~10 messages
- `Home` - Jump to oldest message
- `End` - Jump to newest message

**UI Behavior:**
- No individual message selection
- Entire viewport shifts up/down by page
- Focus stays on input field
- Scrollback indicator shows position (e.g., "Viewing -20 messages")

**Pros:**
- ✅ Very simple mental model (just scrolling)
- ✅ Familiar from less/more pagers
- ✅ No mode switching
- ✅ Works with coding agents

**Cons:**
- ❌ Less precise (can't select individual messages)
- ❌ No focus indicator on messages
- ❌ Doesn't match "tab/shift-tab element selection" pattern user mentioned
- ❌ Harder to programmatically navigate to specific message

---

### Option 4: Browser DevTools Style (Tab/Shift+Tab)

**Approach**: Directly implement the browser pattern user mentioned.

**Key Bindings:**
- `Tab` - Select next message (down) when not typing
- `Shift+Tab` - Select previous message (up)
- `Escape` - Clear selection, return to input
- `Enter` - Action on selected message (copy? inspect? future feature)

**UI Behavior:**
- Messages are focusable elements
- Tab cycles through them (like form fields in browser)
- Visual highlight on focused message
- Auto-scroll to keep focused message visible

**Pros:**
- ✅ Exactly matches user's mental model (tab/shift-tab like browser)
- ✅ Familiar pattern from web development
- ✅ No mode needed
- ✅ Tab already has "cycle through things" meaning

**Cons:**
- ⚠️ Tab traditionally used for autocomplete in CLIs
- ⚠️ May conflict with future autocomplete feature
- ⚠️ Less efficient than j/k (two keys for up)
- ⚠️ Cycling through many messages is tedious

---

### Option 5: Slack/Discord Style (↑ to Edit/Navigate)

**Approach**: Arrow up while input is empty navigates to previous message.

**Key Bindings:**
- `↑` when input empty - Select previous message
- `↓` when message focused - Select next message
- `Escape` - Clear selection, return to input
- `↑` when input has text - Normal cursor movement

**UI Behavior:**
- Only activates when input field is empty
- Natural flow: finish typing → press up → review history
- Clear visual focus on selected message

**Pros:**
- ✅ Context-aware (doesn't interfere with text editing)
- ✅ Familiar from Slack/Discord (↑ edits last message)
- ✅ Single key navigation
- ✅ No mode confusion

**Cons:**
- ⚠️ Only works when input is empty (might be limiting)
- ⚠️ Not quite the same as browser tab pattern
- ⚠️ Users expect ↑ to go to previous command history in terminals

---

## Decision Matrix

| Option | Human UX | Agent UX | Familiar | Precise | Conflicts |
|--------|----------|----------|----------|---------|-----------|
| 1. Vim j/k | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ (devs) | ✅ | ⚠️ Mode-based |
| 2. Ctrl+Arrows | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ✅ | ⚠️ Terminal shortcuts |
| 3. PageUp/Down | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ❌ | ✅ |
| 4. Tab/Shift+Tab | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ (web devs) | ✅ | ⚠️ Autocomplete |
| 5. Slack ↑/↓ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ✅ | ⚠️ Command history |

## Recommendation

**Option 1: Vim-Style Navigation** with escape hatch for non-vim users.

**Primary Bindings** (Vim/power users):
- `j` / `↓` - Next message
- `k` / `↑` - Previous message
- `g` - First message
- `G` - Last message
- `Enter` / `Escape` / `i` - Exit navigation

**Alternative Bindings** (For non-vim users, works simultaneously):
- `PageUp` - Scroll up ~10 messages
- `PageDown` - Scroll down ~10 messages
- Works without mode switching

**Rationale:**
- Matches user's request for keyboard navigation like browser element selection
- Vim bindings are gold standard for power users and coding agents
- PageUp/Down provides alternative for those unfamiliar with vim
- Clear visual feedback on which message is focused
- Easy to automate via control plane send_input
- Can extend later with search (`/`), copy, inspect features

## Implementation Plan

### Phase 1: Basic Message Selection (Core)

**Add State:**
```typescript
const [focusedMessageIndex, setFocusedMessageIndex] = useState<number | null>(null);
const [navigationMode, setNavigationMode] = useState(false);
```

**Key Handler:**
```typescript
useInput((input, key) => {
  if (navigationMode) {
    if (input === 'j' || key.downArrow) {
      setFocusedMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
    } else if (input === 'k' || key.upArrow) {
      setFocusedMessageIndex(prev => Math.max(prev - 1, 0));
    } else if (input === 'g') {
      setFocusedMessageIndex(0);
    } else if (input === 'G') {
      setFocusedMessageIndex(messages.length - 1);
    } else if (key.return || key.escape || input === 'i') {
      setNavigationMode(false);
      setFocusedMessageIndex(null);
    }
  } else {
    // Trigger navigation mode
    if ((input === 'j' || input === 'k') && inputValue === '') {
      setNavigationMode(true);
      setFocusedMessageIndex(messages.length - 1);
    }
  }
});
```

**Rendering:**
```typescript
messages.map((msg, idx) => (
  <Box key={idx}>
    {focusedMessageIndex === idx && <Text color="yellow">▶ </Text>}
    <MessageComponent message={msg} focused={focusedMessageIndex === idx} />
  </Box>
));
```

### Phase 2: Auto-Scroll to Focused Message

**Add scroll tracking:**
```typescript
const scrollToMessage = (index: number) => {
  // Calculate if message is out of viewport
  // Use Ink's built-in scrolling or manual line counting
  // Adjust rendered window to include focused message
};
```

### Phase 3: Visual Polish

- Add status indicator: "Navigate Mode (↵ to exit) | Message 5/42"
- Highlight focused message with background color
- Add subtle animation when focus changes
- Show message timestamp when focused

### Phase 4: PageUp/Down Alternative

- Add PageUp/PageDown handlers for non-vim users
- Each jump moves ~10 messages
- Works without entering navigation mode

## Examples

### Human Usage (Vim Keys)
```
# User types 'k' while input empty → enters navigation mode
▶ ◇ mcp-fs-bridge → system/presence
  mcp-fs-bridge joined (4 capabilities)

  ◇ mew → mcp/request
  ...

Navigate Mode (↵ to exit) | Message 8/42
```

### Agent Usage (Control Plane)
```bash
# Navigate to 3 messages ago
for i in {1..3}; do
  curl -X POST http://localhost:9999/control/send_input \
    -H 'Content-Type: application/json' -d '{"key":"k"}'
  sleep 0.2
done

# Capture screen showing older messages
curl -s http://localhost:9999/control/screen | jq -r '.plain'

# Find presence messages
curl -s http://localhost:9999/control/state | \
  jq '.messages[] | select(.kind=="system/presence")'
```

## Open Questions

1. **Mode indicator placement**: Status line? Inline? Box overlay?
2. **Focus indicator style**: Arrow? Background color? Border?
3. **Message window sizing**: Show 10? 20? Dynamic based on terminal height?
4. **Interaction with signal board**: Does navigation work when board is expanded?
5. **Search feature priority**: Should we add `/` search immediately or defer?

## References

- Vim navigation: Standard j/k/g/G pattern
- Less pager: Similar navigation for file viewing
- Browser DevTools: Tab/shift-tab element selection (user's example)
- Slack: ↑ to edit last message
- Existing input handling: `src/cli/utils/advanced-interactive-ui.ts`
