# ADR-p4k: Participant ID Resolution for Space Up

**Status:** Accepted  
**Date:** 2025-01-05  
**Incorporation:** Complete

## Context

The `meup space up` command can optionally connect as a participant after starting the space infrastructure. Currently, users must explicitly provide `--participant <id>` to connect interactively. This creates friction for users who frequently connect to spaces.

We need a low-friction way to determine the participant ID when not explicitly provided, while maintaining clarity about which participant is being used.

## Options Considered

### Option 1: Environment Variable

Use `MEUP_PARTICIPANT_ID` environment variable as default.

**Pros:**
- Standard pattern in CLI tools
- Easy to set in shell profile
- Works across all spaces
- Clear and explicit

**Cons:**
- Requires initial setup
- May not be appropriate for all spaces
- Could cause confusion if forgotten

### Option 2: System Username with Prompt

Use system username as default, prompt for confirmation.

```bash
$ meup space up
> Connecting as participant 'rjcorwin' (your system username). Continue? [Y/n]
```

**Pros:**
- Zero configuration to start
- Natural default for single-user spaces
- Interactive confirmation prevents mistakes

**Cons:**
- System username may not match participant ID
- Extra prompt adds friction
- May not work in automation

### Option 3: Space Configuration Default

Add `default_participant` field to space.yaml.

```yaml
space:
  id: my-space
  default_participant: developer

participants:
  developer:
    tokens: [...]
```

**Pros:**
- Space-specific defaults
- No global configuration needed
- Explicit in space definition

**Cons:**
- Only works for one user per space
- Conflicts in shared repositories
- Not portable across machines

### Option 4: Interactive Selection

If not provided, show list of available participants.

```bash
$ meup space up
Select a participant to connect as:
  1) developer
  2) reviewer
  3) observer
  > (none - run detached)
Choice [none]: 1
```

**Pros:**
- No configuration needed
- Shows all options
- Prevents wrong participant selection

**Cons:**
- Adds interactive step every time
- Doesn't work in automation
- More friction than other options

### Option 5: Simple Cascading (Space Default + Interactive + System Username)

Combine options 2, 3, and 4 in a simple cascade:
1. Command line flag (--participant)
2. Space configuration default_participant
3. Interactive selection from available participants
4. System username as last resort (only for human participants)

**Pros:**
- Simple and predictable
- No global configuration needed
- Prioritizes explicit choices over assumptions
- System username only used when safe

**Cons:**
- No persistent user preference across spaces
- May prompt more often than expected
- System username may not always apply

## Decision

**Selected: Option 5 - Simple Cascading**

We will implement a simple cascading resolution that checks space config, auto-selects single human participants, prompts interactively when multiple options exist, and falls back to system username only for human participants. This approach balances zero-friction defaults with explicit user control.

### Implementation Details

1. **Resolution Order:**
   ```
   1. --participant flag (explicit)
   2. space.yaml default_participant field
   3. Single human participant (auto-select if only one)
   4. Interactive selection (if multiple human participants)
   5. System username (only if matches a non-agent participant)
   6. Detached mode (final fallback)
   ```

2. **Space Configuration:**
   ```yaml
   space:
     id: my-space
     default_participant: developer  # Optional field
   
   participants:
     developer:
       tokens: [...]
     echo-agent:
       command: "node"  # Has command = agent
       args: ["./agents/echo.js"]
     rjcorwin:  # No command = human participant
       tokens: [...]
   ```

3. **Resolution Logic:**
   ```javascript
   function resolveParticipant(args, spaceConfig) {
     // 1. Explicit flag
     if (args.participant) return args.participant;
     if (args.detach) return null;
     
     // 2. Space default
     if (spaceConfig.space?.default_participant) {
       console.log(`Using default participant: ${spaceConfig.space.default_participant}`);
       return spaceConfig.space.default_participant;
     }
     
     // Get human participants (no command field)
     const humanParticipants = Object.entries(spaceConfig.participants)
       .filter(([id, p]) => !p.command)
       .map(([id]) => id);
     
     // 3. Single human participant - auto-select
     if (humanParticipants.length === 1) {
       console.log(`Connecting as '${humanParticipants[0]}' (only human participant)`);
       return humanParticipants[0];
     }
     
     // 4. Interactive selection (if TTY and multiple humans)
     if (process.stdin.isTTY && humanParticipants.length > 1) {
       const choice = promptForParticipant(humanParticipants);
       if (choice !== null) return choice;
     }
     
     // 5. System username (only if matches a human participant)
     const username = os.userInfo().username;
     if (humanParticipants.includes(username)) {
       console.log(`Connecting as '${username}' (your system username)`);
       return username;
     }
     
     // 6. Detached fallback
     console.log('Running detached (no participant selected)');
     return null;
   }
   ```

4. **Interactive Prompt:**
   ```bash
   $ meup space up
   Select participant to connect as:
     1) developer    (human)
     2) reviewer     (human)
     3) observer     (human)
     [echo-agent and other agents not shown]
     0) none (run detached)
   Choice [0]: 1
   > Connecting as participant: developer
   ```

5. **Examples:**
   ```bash
   # Explicit participant
   meup space up --participant reviewer
   
   # Uses default_participant from space.yaml
   meup space up  # → connects as 'developer'
   
   # Single human participant (auto-selected)
   meup space up  # → connects as 'developer' (only human)
   
   # Multiple human participants (interactive)
   meup space up  # → prompts to choose between humans
   
   # System username fallback (only if no prompt)
   MEUP_NO_PROMPT=1 meup space up  # → tries 'rjcorwin' if human
   
   # Detached mode
   meup space up --detach
   ```

## Consequences

### Positive
- Simple implementation with clear precedence
- Zero configuration required to get started
- Auto-selects when there's only one human participant
- Interactive prompt prevents wrong participant selection
- System username only used when safe (human participants)
- Agents automatically excluded from selection
- No configuration files to manage

### Negative
- No persistent user preference across spaces
- May prompt when multiple human participants exist
- System username rarely used (only as last resort)
- No environment variable override for automation

### Mitigation
- Clear messages about which participant is being used
- Interactive prompt only shows human participants
- Can always use explicit --participant flag
- Space default_participant for common cases
- Detached mode available for automation