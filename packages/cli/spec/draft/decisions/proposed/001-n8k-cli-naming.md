# ADR-n8k: CLI Naming

**Status:** Proposed  
**Date:** 2025-08-31  
**Context:** MECP CLI Specification
**Incorporation:** Not Incorporated

## Context

MECP needs a command-line interface that allows humans to start pods and participate directly in the shared context. The CLI name should:
- Be memorable and easy to type
- Reflect the key innovation of humans being "inside" the context
- Work well with common command patterns (start, join, status, etc.)
- Avoid conflicts with existing CLI tools
- Capture the collaborative nature of the protocol

### Decision Drivers
- Ease of use and memorability
- Conceptual alignment with MECP's core value
- Avoiding naming conflicts
- Professional yet approachable
- Command line ergonomics

## Decision

**To be determined** - This ADR presents options for consideration.

## Options Considered

### Option 1: `pod`

Simple, direct use of the core MECP concept.

**Usage:**
```bash
pod up ./config.yaml
pod join workspace
pod status
pod down
```

**Pros:**
- Simple and obvious
- Directly references MECP pods
- Short and easy to type
- Natural command patterns
- Memorable

**Cons:**
- Very generic name
- Might conflict with other tools
- Doesn't emphasize the human aspect

### Option 2: `mecp`

Use the protocol name directly.

**Usage:**
```bash
mecp start ./pod.yaml
mecp join workspace
mecp status
mecp stop
```

**Pros:**
- Clear connection to protocol
- No ambiguity about purpose
- Establishes brand identity
- Unlikely to conflict

**Cons:**
- Less intuitive for new users
- Sounds technical/intimidating
- Doesn't convey the action

### Option 3: `inside`

Captures the key innovation of humans moving inside the context.

**Usage:**
```bash
inside ./pod.yaml
inside workspace --as human
inside status
```

**Pros:**
- Perfect conceptual alignment
- Memorable and distinctive
- Emphasizes the key differentiator
- Natural language feel

**Cons:**
- Unconventional for a CLI name
- Some commands might read awkwardly
- Could be too abstract

### Option 4: `dive`

Action-oriented, suggesting immersion into the context.

**Usage:**
```bash
dive ./pod.yaml
dive into workspace
dive status
dive surface  # exit
```

**Pros:**
- Action-oriented and dynamic
- Suggests deep engagement
- Memorable metaphor
- Short and typeable

**Cons:**
- Metaphor might not be obvious
- Could suggest one-way action
- Might not convey ongoing participation

### Option 5: `copod`

Portmanteau of "co-" (collaborative) and "pod".

**Usage:**
```bash
copod start ./config.yaml
copod join workspace
copod status
copod leave
```

**Pros:**
- Emphasizes collaboration
- Unique and memorable
- References pods
- Sounds like "copilot"

**Cons:**
- Made-up word
- Pronunciation ambiguity
- Less professional sounding

### Option 6: `enter`

Simple verb suggesting joining the shared context.

**Usage:**
```bash
enter ./pod.yaml
enter workspace
enter --status
enter --exit
```

**Pros:**
- Clear action word
- Natural language
- Simple and direct
- Easy to remember

**Cons:**
- Very generic
- Might conflict with shell commands
- Doesn't reference pods or MECP

### Option 7: `chorus`

Metaphor for many voices working in harmony.

**Usage:**
```bash
chorus start ./pod.yaml
chorus join workspace
chorus voices  # list participants
chorus leave
```

**Pros:**
- Unique and memorable
- Captures collaboration aspect
- Pleasant associations
- Unlikely to conflict

**Cons:**
- Abstract metaphor
- Not immediately obvious
- Longer to type
- May seem unprofessional

### Option 8: `nexus`

Connection point for all participants.

**Usage:**
```bash
nexus create ./pod.yaml
nexus connect workspace
nexus status
nexus disconnect
```

**Pros:**
- Technical but accessible
- Suggests connection/hub
- Memorable
- Professional sounding

**Cons:**
- Might be taken
- Doesn't reference pods
- More corporate feeling

### Option 9: `podium`

Playing on "pod" with a platform/stage metaphor.

**Usage:**
```bash
podium up ./pod.yaml
podium join workspace
podium speak  # send message
podium step-down  # leave
```

**Pros:**
- Clever wordplay on "pod"
- Suggests speaking/participating platform
- Memorable and unique
- Professional connotation

**Cons:**
- Metaphor might feel forced
- Could imply hierarchy (speaker on stage)
- Longer to type

### Option 10: `podme`

Personalized pod command - "pod me into the context".

**Usage:**
```bash
podme in ./pod.yaml
podme into workspace
podme status
podme out
```

**Pros:**
- Personal and action-oriented
- Clear intent ("pod me in")
- Memorable phrase
- Casual and approachable

**Cons:**
- Very informal
- Might not age well
- Could seem unprofessional

### Option 11: `podmecp`

Combination of pod + MECP.

**Usage:**
```bash
podmecp start ./pod.yaml
podmecp join workspace
podmecp status
podmecp leave
```

**Pros:**
- References both pod and protocol
- Unique, unlikely to conflict
- Clear purpose

**Cons:**
- Awkward to pronounce
- Too many consonants
- Feels like concatenation

### Option 12: `podmeup`

Playful action phrase - "pod me up!"

**Usage:**
```bash
podmeup ./pod.yaml
podmeup to workspace
podmeup status
podmeup down
```

**Pros:**
- Fun and memorable
- Action-oriented
- Pop culture reference ("Beam me up")
- Energetic feeling

**Cons:**
- Very casual/playful
- Might not be taken seriously
- Could age poorly

### Option 13: `beammeup`

Direct Star Trek reference for joining pods.

**Usage:**
```bash
beammeup ./pod.yaml
beammeup to workspace
beammeup status
beammedown
```

**Pros:**
- Instantly memorable
- Fun cultural reference
- Conveys transportation/joining
- Conversation starter

**Cons:**
- Too long to type regularly
- Might face trademark issues
- Not professional
- Novelty might wear off

### Option 14: `podtime`

It's pod time! Time to collaborate.

**Usage:**
```bash
podtime ./pod.yaml
podtime join workspace
podtime status
podtime over  # end session
```

**Pros:**
- Energetic and action-oriented
- Easy to remember
- Suggests temporal sessions
- "It's podtime!" is catchy

**Cons:**
- Could seem juvenile
- Might imply time-limited sessions
- Less clear as a command

### Option 15: `podulant`

Playful variation suggesting modulation/undulation.

**Usage:**
```bash
podulant ./pod.yaml
podulant join workspace
podulant status
```

**Pros:**
- Unique and distinctive
- Sophisticated sound
- Unlikely to conflict

**Cons:**
- Not intuitive
- Hard to spell/remember
- No clear meaning connection

### Option 16: `podsome`

Get some pod action - casual and inviting.

**Usage:**
```bash
podsome ./pod.yaml
podsome with workspace
podsome status
```

**Pros:**
- Casual and approachable
- "Get podsome" is memorable
- Friendly feeling

**Cons:**
- Very informal
- Could be misheard/misunderstood
- Might not age well

### Option 17: `podster`

The pod launcher - agent of pods.

**Usage:**
```bash
podster up ./pod.yaml
podster join workspace
podster status
podster down
```

**Pros:**
- Personality-driven name
- "-ster" suffix is familiar (Napster, etc.)
- Suggests expertise/mastery

**Cons:**
- Could seem dated
- Might imply single user focus
- Less serious tone

### Option 18: `podl`

Minimal pod + l (could mean launcher, link, etc.).

**Usage:**
```bash
podl ./pod.yaml
podl join workspace
podl status
podl exit
```

**Pros:**
- Very short (4 chars)
- Easy to type
- Clean and minimal
- Could backronym (Pod Launcher)

**Cons:**
- Pronunciation unclear (poddle? pod-el?)
- Too minimal, lacks character
- Easy to typo

### Option 19: `podar`

Pod + radar/sonar suffix, suggesting awareness.

**Usage:**
```bash
podar scan  # list pods
podar lock workspace  # join
podar ping  # status
podar off
```

**Pros:**
- Technical feel
- Suggests discovery/awareness
- Unique combination
- Memorable

**Cons:**
- Military/naval connotations
- Commands might feel forced
- Not immediately clear

## Implementation Considerations

### Command Structure

Regardless of name chosen, basic commands should include:
```bash
<cli> start [config]     # Start a new pod
<cli> join [pod-id]      # Join existing pod
<cli> status            # Show pod and participant status
<cli> leave             # Leave current pod
<cli> stop              # Stop a pod you started
<cli> list              # List available pods
<cli> whoami            # Show your participant info
```

### Installation

Should be installable via:
```bash
npm install -g @mecp/<cli-name>
# or
brew install <cli-name>
# or  
cargo install <cli-name>
```

### Shell Integration

Consider shell completions and aliases:
```bash
alias p='<cli-name>'  # Even shorter usage
```

## Consequences

### Positive
- Good CLI name improves adoption
- Memorable name aids word-of-mouth spread
- Clear name reduces learning curve

### Negative
- Generic names may conflict
- Abstract names need explanation
- Changing later is disruptive

## Security Considerations

- CLI name shouldn't imply security properties it doesn't have
- Avoid names that might be typo-squatted
- Consider namespace (npm, brew, etc.) availability

## Future Considerations

- Might want family of related tools (like git ecosystem)
- Consider how name works in different languages/cultures
- Think about trademark and domain availability