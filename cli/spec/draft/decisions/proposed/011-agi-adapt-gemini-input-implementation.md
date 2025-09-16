# ADR-agi: Adapt Gemini CLI Input Implementation

**Status:** Proposed
**Date:** 2025-01-16
**Incorporation:** Not Incorporated

## Context

Following ADR-010's Option 7, this ADR explores the concrete implementation details of adapting Google's Gemini CLI input components for the MEW Protocol CLI. The Gemini CLI has a proven, production-ready implementation of all the terminal input features we need, licensed under Apache 2.0 which is compatible with our MIT license.

## Decision

We will copy and adapt specific components from Gemini CLI to implement comprehensive terminal input features in MEW CLI, with proper attribution and necessary modifications for our use case.

## Implementation Plan

### 1. Files to Copy and Adapt

#### Core Input Components
```
From gemini-cli/packages/cli/src/:

1. ui/components/InputPrompt.tsx (~890 lines)
   → cli/src/ui/components/EnhancedInput.tsx

2. ui/components/shared/text-buffer.ts (~2000 lines)
   → cli/src/ui/utils/text-buffer.ts

3. ui/hooks/useInputHistory.ts (~112 lines)
   → cli/src/ui/hooks/useInputHistory.ts

4. ui/hooks/useKeypress.ts
   → cli/src/ui/hooks/useKeypress.ts

5. ui/keyMatchers.ts (~102 lines)
   → cli/src/ui/keyMatchers.ts

6. config/keyBindings.ts (~166 lines)
   → cli/src/config/keyBindings.ts

7. ui/utils/textUtils.ts (unicode handling)
   → cli/src/ui/utils/textUtils.ts
```

#### Supporting Components
```
8. ui/components/SuggestionsDisplay.tsx
   → cli/src/ui/components/SuggestionsDisplay.tsx

9. ui/hooks/useCommandCompletion.ts
   → cli/src/ui/hooks/useCommandCompletion.ts

10. ui/hooks/useShellHistory.ts (optional)
    → cli/src/ui/hooks/useShellHistory.ts
```

### 2. Required Modifications

#### Remove Google-Specific Features
- [ ] Remove Google Cloud integration
- [ ] Remove Gemini AI specific prompts
- [ ] Remove IDE context features not applicable to MEW
- [ ] Remove shell mode if not needed
- [ ] Remove reverse search (Ctrl+R) if too complex

#### Adapt to MEW Protocol
- [ ] Replace Gemini's command structure with MEW slash commands
- [ ] Integrate with MEW's approval dialog system
- [ ] Connect to MEW's message handling
- [ ] Adapt styling to MEW's theme system
- [ ] Ensure compatibility with existing debug mode

#### Simplify Features
- [ ] Strip vim bindings (can add later if needed)
- [ ] Remove clipboard image handling (or make optional)
- [ ] Simplify external editor integration
- [ ] Remove unused configuration options

### 3. Integration Points

#### Component Hierarchy
```typescript
// Current MEW CLI structure
<InteractiveMode>
  <MessageHistory />
  <InputArea /> // ← Replace this
  <ApprovalDialog />
</InteractiveMode>

// New structure with Gemini components
<InteractiveMode>
  <MessageHistory />
  <EnhancedInput  // ← Adapted InputPrompt
    buffer={textBuffer}
    commands={slashCommands}
    workingDirectory={process.cwd()}
    onSubmit={handleSubmit}
  />
  <ApprovalDialog />
</InteractiveMode>
```

#### Key Integration Requirements
```typescript
interface IntegrationRequirements {
  // Must maintain these existing behaviors
  approvalDialogCompatibility: boolean;  // Arrow keys shouldn't conflict
  debugModeSharedHistory: boolean;       // Share history with debug mode
  messageFormatting: boolean;            // Support JSON/chat detection

  // New features to add
  slashCommandAutocomplete: boolean;     // MEW-specific commands
  atFileAutocomplete: boolean;          // @ filesystem references
  multilineJSON: boolean;                // Shift+Enter for JSON
}
```

### 4. Attribution and Licensing

#### File Headers
Each adapted file must include:
```typescript
/**
 * Adapted from Gemini CLI (https://github.com/google/gemini-cli)
 * Original Copyright 2025 Google LLC
 * Licensed under Apache License 2.0
 *
 * Modifications for MEW Protocol CLI:
 * - Removed Google-specific features
 * - Adapted for MEW slash commands
 * - Integrated with MEW approval system
 *
 * @license Apache-2.0 (original)
 * @license MIT (modifications)
 */
```

#### License Files
```
cli/
├── LICENSE (existing MIT)
├── LICENSES/
│   ├── Apache-2.0.txt (Google's license)
│   └── NOTICE.md (attribution details)
```

#### NOTICE.md Content
```markdown
# Third-Party Licenses

## Gemini CLI Components

This software includes code adapted from Google's Gemini CLI:
- Repository: https://github.com/google/gemini-cli
- Copyright: 2025 Google LLC
- License: Apache License 2.0

The following components are adapted from Gemini CLI:
- Text buffer implementation
- Input history management
- Keyboard input handling
- Command completion system

See LICENSES/Apache-2.0.txt for the full license text.
```

### 5. Implementation Milestones

#### Milestone 1: Core Text Buffer
1. Copy `text-buffer.ts` and `textUtils.ts`
2. Strip unused features (vim mode, shell mode, reverse search)
3. Ensure basic cursor movement and multi-line editing works
4. Add tests for core functionality
5. **Deliverable**: Working multi-line text editing with cursor navigation

#### Milestone 2: Input Component Integration
1. Copy `InputPrompt.tsx` as `EnhancedInput.tsx`
2. Copy keypress hooks and matchers (`useKeypress.ts`, `keyMatchers.ts`)
3. Copy key bindings configuration (`keyBindings.ts`)
4. Remove Gemini-specific features (Google Cloud, IDE context)
5. Integrate with MEW's existing UI structure
6. Ensure approval dialog compatibility
7. Add Option+arrow word navigation
8. **Deliverable**: Fully functional input with all keyboard shortcuts

#### Milestone 3: History & Persistence
1. Copy `useInputHistory` hook
2. Implement `.mew/cli-history` persistence
3. Share history with debug mode
4. Test history navigation with up/down arrows
5. **Deliverable**: Persistent command history across sessions

#### Milestone 4: Autocomplete Features
1. Copy and adapt `SuggestionsDisplay` component
2. Copy `useCommandCompletion` hook
3. Adapt for MEW slash commands
4. Implement @ filesystem autocomplete
5. Test all autocomplete behaviors
6. Polish and integration testing
7. **Deliverable**: Full autocomplete functionality for commands and paths

### 6. Testing Strategy

#### Unit Tests
```typescript
describe('EnhancedInput', () => {
  it('should handle arrow key history navigation');
  it('should support multi-line with Shift+Enter');
  it('should autocomplete slash commands');
  it('should autocomplete filesystem paths with @');
  it('should not conflict with approval dialog keys');
});

describe('TextBuffer', () => {
  it('should handle unicode characters correctly');
  it('should support word navigation');
  it('should handle cursor movement in multi-line text');
});
```

#### Integration Tests
- Test with existing MEW CLI commands
- Verify approval dialog still works
- Check history persistence
- Test with various terminal emulators

### 7. Maintenance Plan

#### Tracking Upstream Changes
- [ ] Document which Gemini CLI commit we copied from
- [ ] Set up quarterly review of Gemini CLI updates
- [ ] Maintain list of our modifications
- [ ] Consider contributing improvements back

#### Version Documentation
```typescript
// In each adapted file
const GEMINI_VERSION = {
  repository: 'https://github.com/google/gemini-cli',
  commit: 'abc123...',  // Specific commit hash
  date: '2025-01-16',
  files: {
    'text-buffer.ts': { lines: 2000, modified: true },
    'InputPrompt.tsx': { lines: 890, modified: true },
    // ... etc
  }
};
```

## Consequences

### Positive

- **Rapid Implementation**: Get all features working quickly with clear milestones
- **Production Quality**: Battle-tested code from Google
- **Complete Features**: All edge cases already handled
- **Reduced Bugs**: Avoid reimplementation errors
- **Learning Opportunity**: Learn from Google's engineering patterns

### Negative

- **Mixed Licensing**: Project will have both MIT and Apache 2.0 code
- **Attribution Overhead**: Must maintain proper attribution
- **Code Ownership**: Less familiarity with copied code initially
- **Potential Bloat**: May include unnecessary complexity
- **Maintenance Burden**: Need to track and merge upstream fixes

## Alternatives Considered

### Alternative 1: Selective Copying
Only copy the most complex parts (TextBuffer) and write the rest ourselves.

**Pros:** Less licensing overhead, more control
**Cons:** Still significant implementation work, risk of integration issues

### Alternative 2: Clean Room Implementation
Study Gemini's code but rewrite everything from scratch.

**Pros:** Full ownership, no licensing issues
**Cons:** Much slower, likely to introduce bugs

## Decision Rationale

Direct adaptation is chosen because:
1. **Time to Market**: Fastest path to comprehensive features
2. **Risk Reduction**: Proven code reduces bug risk
3. **License Compatibility**: Apache 2.0 and MIT work well together
4. **Reversibility**: Can always refactor later if needed
5. **Learning Value**: Understanding Google's patterns improves our engineering

## Implementation Checklist

### Legal/Attribution
- [ ] Add Apache 2.0 license file
- [ ] Create NOTICE.md with attribution
- [ ] Add headers to all adapted files
- [ ] Document Gemini CLI version/commit

### Technical Setup
- [ ] Create directory structure
- [ ] Set up build configuration
- [ ] Configure TypeScript paths
- [ ] Set up test framework

### Milestone 1 Implementation
- [ ] Copy text-buffer.ts
- [ ] Copy textUtils.ts
- [ ] Remove vim-specific code
- [ ] Add basic tests
- [ ] Verify cursor movement

### Integration
- [ ] Replace existing input component
- [ ] Connect to message handling
- [ ] Test with approval dialog
- [ ] Verify debug mode compatibility

### Documentation
- [ ] Update user documentation
- [ ] Document keyboard shortcuts
- [ ] Create migration guide
- [ ] Add inline code comments

## Appendix: Key Differences

### Gemini CLI vs MEW CLI Commands

| Gemini CLI | MEW CLI | Notes |
|------------|---------|-------|
| No slash commands | `/help`, `/exit`, `/participants`, etc. | Need to add command registry |
| Shell mode with `!` | No shell mode initially | Can add later if needed |
| Clipboard image paste | Optional feature | May keep for agent interactions |
| Reverse search (Ctrl+R) | Not required initially | Complex feature, can skip |
| Vim bindings | Not required | Skip to reduce complexity |

### File Size Comparison

| Component | Gemini (lines) | Expected MEW (lines) | Reduction |
|-----------|---------------|---------------------|-----------|
| TextBuffer | ~2000 | ~1500 | 25% (remove vim, shell) |
| InputPrompt | ~890 | ~600 | 33% (remove Google features) |
| Total | ~3500 | ~2500 | 29% |

## References

- [Gemini CLI Repository](https://github.com/google/gemini-cli)
- [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)
- [MIT License Compatibility](https://opensource.org/licenses/MIT)
- [ADR-010: Terminal Input Enhancements](./010-tie-terminal-input-enhancements.md)