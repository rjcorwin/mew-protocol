# Decision: Agent Configuration Management Pattern (W002)

## Context
The current agent configuration pattern uses a single file at `~/.mcpx/agent-config.json`, which doesn't scale well for managing multiple agents. This becomes especially problematic when not using containers, as all agents would share the same configuration file.

## Problem Statement
We need a scalable pattern for managing multiple agent configurations that:
- Allows running multiple agents on the same system
- Supports different configuration profiles
- Enables easy agent lifecycle management (start/stop/restart)
- Provides a foundation for future tooling (mcpx-hub, mcpx-studio)

## Options

### Option 1: Directory-based Configuration
Each agent gets its own configuration directory under `~/.mcpx/agents/`

**Structure:**
```
~/.mcpx/agents/
├── weather-agent/
│   ├── config.json
│   ├── state.json
│   └── logs/
├── calculator-agent/
│   ├── config.json
│   ├── state.json
│   └── logs/
```

**Pros:**
- Clear separation between agents
- Easy to manage agent-specific state and logs
- Simple to implement backup/restore per agent
- Supports agent templates/presets

**Cons:**
- Requires directory management logic
- More complex than single file
- Need conventions for agent naming

### Option 2: Single Registry File with Agent Profiles
One file (`~/.mcpx/agents-registry.json`) containing all agent configurations

**Structure:**
```json
{
  "agents": {
    "weather-agent": {
      "config": { ... },
      "enabled": true
    },
    "calculator-agent": {
      "config": { ... },
      "enabled": false
    }
  }
}
```

**Pros:**
- Single source of truth
- Easy to view all agents at once
- Simple to implement
- Easy to backup/restore

**Cons:**
- File can become large with many agents
- Concurrent access issues with multiple processes
- Risk of corruption affecting all agents
- Harder to manage agent-specific artifacts (logs, state)

### Option 3: Process Manager Integration
Use existing process managers (PM2, systemd, supervisor) with MCPx-specific wrapper

**Example with PM2:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'weather-agent',
    script: 'mcpx-agent',
    args: '--config weather-config.json'
  }]
}
```

**Pros:**
- Leverages mature tooling
- Built-in process management (restart, logs, monitoring)
- Industry-standard approach
- Supports clustering and load balancing

**Cons:**
- External dependency
- Platform-specific (PM2 for Node, systemd for Linux)
- Learning curve for users
- Less control over MCPx-specific features

### Option 4: MCPx Hub Service
Dedicated local service managing all agents

**Architecture:**
```
mcpx-hub (localhost:8080)
├── REST API for management
├── Agent lifecycle control
├── Configuration management
└── Web UI (mcpx-studio)
```

**Pros:**
- Centralized management
- Rich API for tooling
- Can provide web UI out of the box
- Supports remote management
- Natural upgrade path to cloud/distributed

**Cons:**
- Most complex to implement
- Another service to run
- Potential single point of failure
- May be overkill for simple use cases

### Option 5: Convention-based with CLI Tool
Combine directory structure with smart CLI tooling

**Usage:**
```bash
mcpx agent create weather-agent --template openai
mcpx agent start weather-agent
mcpx agent list
mcpx agent logs weather-agent
```

**Structure:**
```
~/.mcpx/
├── agents/
│   ├── weather-agent/config.json
│   └── calculator-agent/config.json
├── templates/
│   ├── openai.json
│   └── basic.json
└── runtime/
    ├── weather-agent.pid
    └── calculator-agent.pid
```

**Pros:**
- Good balance of simplicity and features
- Familiar CLI patterns
- Extensible via templates
- No additional services needed
- Natural migration path to hub service

**Cons:**
- Need to implement process management
- Platform differences (Windows vs Unix)
- Limited compared to full hub service

## Recommendation

**Selected Option: Option 5 - Convention-based with CLI Tool**

### Rationale
1. **Progressive Enhancement**: Start simple with CLI, can add hub service later
2. **User-Friendly**: Familiar patterns from tools like npm, docker, pm2
3. **Flexibility**: Supports both simple and complex use cases
4. **No Lock-in**: Easy to migrate to other solutions
5. **Foundation**: Good base for future mcpx-studio UI

### Implementation Plan

#### Phase 1: Basic CLI and Directory Structure
- Implement `mcpx` CLI with agent subcommands
- Create directory structure under `~/.mcpx/agents/`
- Support create, start, stop, list, remove commands

#### Phase 2: Enhanced Features
- Add template system
- Implement log management
- Add status monitoring
- Support environment-specific configs

#### Phase 3: Optional Hub Service
- Build mcpx-hub as optional service
- CLI can detect and use hub if available
- Provides REST API for mcpx-studio

### Migration Strategy
For existing users with `~/.mcpx/agent-config.json`:
1. CLI detects old config on first run
2. Offers to migrate to new structure
3. Creates `~/.mcpx/agents/default/config.json`
4. Preserves backward compatibility temporarily

## Decision
We will implement **Option 5 (Convention-based with CLI Tool)** as it provides the best balance of simplicity, functionality, and future extensibility. This approach allows us to start with a straightforward solution that can evolve into a more sophisticated system (Option 4) as needs grow.

## Next Steps
1. Design detailed CLI command structure
2. Implement core agent management commands
3. Create migration tool for existing configs
4. Document new patterns and usage
5. Plan roadmap for mcpx-hub service (future)