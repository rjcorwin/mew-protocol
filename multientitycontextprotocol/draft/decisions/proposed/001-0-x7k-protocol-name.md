# ADR-x7k: Protocol Name

**Status:** Proposed  
**Date:** 2025-08-30  
**Context:** MCPx Protocol Draft Specification
**Incorporation:** Not Incorporated

## Context

The protocol needs a clear, memorable name that accurately represents its purpose and capabilities. The current name "MCPx" was a placeholder indicating an extension of MCP. A proper name should:
- Clearly indicate the multi-party nature
- Show the relationship to MCP
- Be memorable and pronounceable
- Accurately represent that humans are first-class participants
- Avoid conflicts with existing protocols

### Decision Drivers
- Accuracy in describing protocol purpose
- Clarity for new users
- Maintaining connection to MCP heritage
- Avoiding naming conflicts
- Marketability and memorability

## Decision

**Adopt MEUP (Multi-Entity Unified-Context Protocol) as the protocol name**

MEUP captures the protocol's core purpose of unifying context for multiple entities (humans, AI agents, robots, services). The name works as both protocol and CLI command ("meup into pod"), making it memorable and action-oriented. While we use the full "Multi-Entity Unified-Context Protocol" expansion, the acronym intentionally drops the "C" to create the pronounceable "MEUP" rather than "MEUCP".

## Options Considered

### Option 1: MCPx (Status Quo)

Keep the current MCPx name.

**Pros:**
- Already in use
- Shows MCP extension clearly
- No migration needed

**Cons:**
- Unclear what "x" means
- Sounds like a placeholder
- Doesn't describe functionality

### Option 2: MECP - Multi-Entity Context Protocol

**Pros:**
- Clearly indicates multiple entities (not just models)
- Emphasizes shared context (key differentiator)
- Maintains MCP naming pattern
- Simple, pronounceable, memorable
- Accurately includes humans as entities

**Cons:**
- New acronym to learn
- Requires documentation updates

### Option 3: MPCP - Multi-Participant Context Protocol

**Pros:**
- "Participant" is inclusive of all entity types
- Maintains MCP prefix and pattern
- Clear functional description
- Natural language - everyone understands "participant"
- Avoids technical jargon
- Accurate terminology for the protocol's purpose

**Cons:**
- Very similar to MCP (one letter difference)
- Could be confused in speech/pronunciation
- "Participant" is less distinctive than "Entity"
- Longer acronym (4 letters)

### Option 4: MCPP - Model Context Pod Protocol

**Pros:**
- Maintains MCP prefix
- Includes "pod" terminology
- Clear lineage from MCP

**Cons:**
- "Model" doesn't accurately include human participants
- Ties protocol name to container metaphor
- Less descriptive of actual functionality

### Option 5: MACP - Multi-Agent Context Protocol

**Pros:**
- Clear multi-party indication
- Maintains MCP pattern
- Short and memorable

**Cons:**
- "Agent" may not clearly include humans
- Could imply AI-only system

### Option 6: MCSP - Multi-Context Sharing Protocol

**Pros:**
- Emphasizes context sharing
- Clear functional description

**Cons:**
- Loses direct MCP connection in naming
- Less clear about multi-entity aspect

### Option 7: MXCP - Multi-X Context Protocol

**Pros:**
- X as variable represents any participant type (human, AI, robot, service)
- Mathematically elegant - X as universal placeholder
- Future-proof - doesn't limit participant types
- Distinctive from MCP in pronunciation
- Maintains MCP heritage pattern
- Avoids entity/participant terminology debate
- Cool technical factor

**Cons:**
- X might be unclear without explanation
- Could seem gimmicky or trendy
- Less descriptive than spelled-out names

### Option 8: MEUP - Multi-Entity Unified Protocol (Recommended)

Simple, clean expansion without "Context" in the name.

**Pros:**
- Natural command line usage ("meup into pod")
- Playful "beam me up" connotation
- "Unified Context" precisely describes the shared space
- Memorable and pronounceable
- CLI and protocol name unity
- Action-oriented feeling
- Flexible acronym expansion

**Cons:**
- Less formal/professional sounding
- Could be seen as gimmicky
- Doesn't maintain MCP pattern as clearly
- "Me up" phrasing might not translate well internationally

### Option 9: MEUCP - Multi-Entity Unified-Context Protocol

Full acronym with all components represented.

**Pros:**
- Accurate acronym - every word is represented
- "Unified-Context" is precisely descriptive
- Maintains technical credibility
- No ambiguity about what each letter means
- Still pronounceable ("mew-cp" or "me-you-cp")
- Professional and precise

**Cons:**
- Loses the playful "me up" sound
- 5 letters is getting long
- Less memorable than MEUP
- Harder to type quickly
- "Mew-cp" pronunciation less intuitive
- Doesn't work as naturally for CLI naming

### Option 10: MEUP - Multi-Entity Unified-Context Protocol (with selective acronym)

Same full name as Option 9 but using MEUP as the acronym (dropping the C).

**Pros:**
- Gets the "me up" playful sound
- Full name is technically accurate
- Marketing-friendly acronym
- Natural CLI usage
- Precedent exists (like SOAP not being SOARP)

**Cons:**
- Acronym doesn't match the full name exactly
- Could seem contrived or forced
- Might confuse technical audiences
- Appears to prioritize branding over accuracy

### Option 11: UCP - Unified-Context Protocol

Drops "Multi-Entity" for simplicity.

**Pros:**
- Short and clean (3 letters)
- Focus on the key innovation (unified context)
- Easy to pronounce and remember
- Professional sounding
- No acronym gymnastics

**Cons:**
- Loses the multi-entity emphasis
- Very generic sounding
- Might conflict with existing protocols
- Doesn't indicate who/what is being unified
- Less descriptive than other options

### Option 12: POD Protocol Variants

Various "POD" acronym expansions were considered (Participant Orchestration & Delegation, etc.)

**Pros:**
- Memorable acronym
- Could align with pod terminology

**Cons:**
- "POD Protocol" name already exists
- Focuses on container metaphor rather than functionality
- Longer full names

### Option 13: MEUC - Multi-Entity Unified-Context Protocol

Same as MEUCP but with a 4-letter acronym dropping the P.

**Pros:**
- Shorter than MEUCP (4 letters vs 5)
- Still includes all key concepts
- Easier to type than MEUCP
- Pronounceable ("mew-k" or "myook")
- Maintains technical accuracy

**Cons:**
- Dropping "Protocol" from acronym is unconventional
- Pronunciation might vary
- Less clear that it's a protocol without the P
- Could be confused with other acronyms

### Option 14: UECP - Unified Entity Context Protocol

Puts "Unified" first, emphasizing the unification aspect.

**Pros:**
- Emphasizes unification as the primary feature
- Clear and descriptive
- Professional sounding
- All components represented in acronym
- Good flow: unified -> entities -> context -> protocol

**Cons:**
- 4 letters might be harder to remember
- Less distinctive than shorter options
- "Unified Entity" could be misread as single entity
- Doesn't maintain MCP pattern

### Option 15: UEP - Unified Entity Protocol

Simplified version focusing on unified entities.

**Pros:**
- Short and clean (3 letters)
- Easy to pronounce ("you-ep" or "yoop")
- Emphasizes the key innovation (unified entities)
- Simple and memorable
- Professional sounding

**Cons:**
- Loses "context" which is central to the protocol
- Very generic sounding
- Could conflict with existing protocols
- Less descriptive than other options

### Option 16: UCEP - Unified Context for Entities Protocol

Emphasizes that the context is what's unified, not the entities.

**Pros:**
- Grammatically clearer ("unified context" not "unified entities")
- Accurately describes the architecture
- Makes it clear entities remain independent
- Good technical accuracy

**Cons:**
- Longer name with "for" in the middle
- 4-letter acronym
- Less catchy than shorter options
- More complex to explain

### Option 17: UXP - Unified X Protocol (where X = Entity Context)

Uses X as a variable representing the entity-context combination.

**Pros:**
- Very short (3 letters)
- X as variable is elegant and flexible
- Easy to pronounce ("you-ex-pee" or "yux-p")
- Memorable and distinctive
- X can represent the intersection/crossing of entities and context
- Mathematical/technical appeal
- Future-proof - X can evolve in meaning

**Cons:**
- X might be too abstract without explanation
- Loses explicit mention of entities and context
- Could seem gimmicky
- Harder to understand purpose from name alone
- "Unified X" sounds like placeholder text

### Option 18: CCP - Collaborative Context Protocol

Direct emphasis on collaboration between entities.

**Pros:**
- Short and memorable (3 letters)
- "Collaborative" perfectly captures the spirit
- Clear purpose from the name
- Easy to pronounce
- Professional sounding

**Cons:**
- High likelihood of naming conflicts (CCP is common)
- Doesn't explicitly mention entities
- Very generic combination of words
- SEO challenges due to conflicts

### Option 19: COCP - Collaborative Context Protocol

Adds an O to avoid conflicts while keeping "Collaborative".

**Pros:**
- Avoids direct CCP conflicts
- Still emphasizes collaboration
- Reasonably short (4 letters)
- Clear descriptive name
- "Co" prefix reinforces collaboration

**Cons:**
- Pronunciation unclear ("co-cp"? "cock-p"?)
- Extra letter makes it less elegant
- Still might conflict with other protocols
- The O seems arbitrary

### Option 20: COLP - Collaborative Protocol

Simplified version focusing on collaboration.

**Pros:**
- Short (4 letters)
- Unique combination unlikely to conflict
- "Collaborative" is the key differentiator
- Clean acronym
- Could pronounce as "collab-p"

**Cons:**
- Loses both "context" and "entity" concepts
- Too generic without those key terms
- Less descriptive of actual functionality
- COLP is less intuitive as an acronym

### Option 21: COPE - Commons Protocol for Entities

Uses "Commons" metaphor for shared collaborative space.

**Pros:**
- "Commons" perfectly captures shared ownership concept
- COPE is memorable and positive ("cope with complexity")
- Clear that it's for multiple entities
- Rich historical/cultural meaning (town commons, creative commons)
- Implies democratic participation
- Natural word with good connotations

**Cons:**
- "Cope" might imply dealing with problems
- Longer full name with "for" in middle
- Commons might sound informal to some
- Could be seen as too metaphorical

### Option 22: COMP - Commons Protocol

Simplified commons-based name.

**Pros:**
- Very short (4 letters)
- "Commons" captures the shared space concept
- COMP is familiar from "computer", "component"
- Clean and professional
- Easy to type and remember
- Could use "comp" as CLI command

**Cons:**
- Very generic sounding
- High chance of conflicts (COMP is common abbreviation)
- Loses explicit mention of entities
- Might be confused with "comparison" or "computer"

### Option 23: ECP - Entity Commons Protocol

Entities-first naming with commons concept.

**Pros:**
- Short and clean (3 letters)
- "Entity Commons" is descriptive
- Emphasizes that entities share the commons
- Professional yet approachable
- Good flow: entities -> commons -> protocol
- Natural abbreviation

**Cons:**
- ECP might already be taken
- Could be confused with other protocols
- "Entity Commons" is a new phrase to explain
- Less distinctive than longer options

### Option 24: MECP - Multi-Entity Commons Protocol

Reinterprets MECP with "Commons" instead of "Context".

**Pros:**
- Keeps the MECP acronym already in use
- "Commons" is more evocative than "Context"
- Emphasizes shared ownership and democratic participation
- Rich metaphor (digital commons, creative commons heritage)
- Multiple entities sharing a commons is intuitive
- Maintains MCP naming pattern
- No migration needed from current MECP usage

**Cons:**
- Changes meaning of C from Context to Commons
- Commons might sound less technical
- Requires explaining the commons concept
- Some might prefer the precision of "Context"

## Implementation Details

### Protocol Identifier
```json
{
  "protocol": "meup/v0.1"
}
```

### Package Naming
- NPM organization: `@meup`
- Repository: `meup-protocol` or similar
- Package structure:
  - `@meup/sdk` - Core SDK
  - `@meup/gateway` - Gateway server
  - `@meup/bridge` - MCP-to-MEUP bridge
  - `meup` - CLI tool (note: no @meup prefix for easier typing)

### CLI Usage
```bash
# Install globally
npm install -g meup

# Natural command flow
meup ./pod.yaml          # Start and join a pod
meup into workspace      # Join existing pod
meup status             # Check status
meup down               # Leave pod
```

### Documentation Updates
- Replace all instances of "MCPx" and "MECP" with "MEUP"
- Update protocol description to emphasize unified context
- Embrace the playful nature in examples and tutorials

## Consequences

### Positive
- **Clear Purpose**: Name describes what the protocol does
- **Inclusive**: "Entity" covers humans, AI, robots, services
- **MCP Heritage**: Maintains naming pattern and connection
- **Professional**: Sounds like a real protocol, not a placeholder
- **No Conflicts**: No known conflicts with existing protocols

### Negative
- **Breaking Change**: Requires updating all references
- **New Learning**: Users must learn new acronym
- **SEO Impact**: Lose any existing "MCPx" search presence

## Migration Path

Since this is v0.x (experimental):
1. Direct cutover to MEUP naming
2. Update all documentation and folder structures
3. Create new packages under @meup organization
4. Emphasize the "meup into context" concept in messaging
5. No backward compatibility needed in v0.x