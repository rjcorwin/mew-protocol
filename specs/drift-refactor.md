# Drift Refactor: MCPx to Multi-Repository Architecture

## Overview
This document outlines the separation of the current MCPx monorepo into two distinct repositories:
1. **MCPx** - Protocol specification and reference implementations
2. **Drift** - Agent orchestration platform and tooling

## Repository Structure

### MCPx Repository
**Purpose**: Protocol specification and reference implementations

```
mcpx/
├── spec/                       # MCPx protocol specification
│   ├── v0/                     # Version 0 specification
│   │   ├── README.md           # Protocol overview
│   │   ├── envelope.md         # Message envelope spec
│   │   ├── topics.md           # Topic routing spec
│   │   └── examples/           # Protocol examples
│   └── schemas/                # JSON schemas for validation
│
├── packages/                   # All implementation packages
│   ├── gateway/                # Reference gateway server
│   │   ├── src/                # WebSocket gateway implementation
│   │   ├── tests/              # Server tests
│   │   └── package.json
│   │
│   ├── web-client/             # Reference web client
│   │   ├── src/                # React frontend for protocol testing
│   │   ├── tests/              # Frontend tests
│   │   └── package.json
│   │
│   ├── bridge/                 # MCP-to-MCPx bridge
│   │   ├── src/                # Bridge implementation
│   │   ├── tests/              # Bridge tests
│   │   └── package.json
│   │
│   ├── sdk-typescript/         # TypeScript SDK
│   │   ├── src/                # MCPx client library
│   │   ├── tests/              # SDK tests
│   │   └── package.json
│   │
│   └── sdk-python/             # Python SDK (future)
│       ├── src/
│       ├── tests/
│       └── pyproject.toml
│
├── examples/                   # Example implementations
│   ├── chat-client/            # Simple chat example
│   ├── tool-server/            # MCP tool server example
│   └── multi-agent/            # Multi-agent coordination example
│
├── docs/                       # Protocol documentation
│   ├── getting-started.md
│   ├── api-reference.md
│   └── integration-guide.md
│
├── package.json                # Monorepo root with workspaces
├── tsconfig.json               # Shared TypeScript config
└── README.md                   # MCPx protocol overview
```

### Drift Repository
**Purpose**: Agent orchestration platform and management tools

```
drift/
├── packages/                   # All Drift packages
│   ├── drift-cli/              # Core CLI and orchestration engine
│   │   ├── src/
│   │   │   ├── cli.ts          # CLI entry point
│   │   │   ├── commands/       # CLI commands
│   │   │   │   ├── agent.ts    # Agent management
│   │   │   │   ├── bridge.ts   # Bridge management
│   │   │   │   ├── up.ts       # System start (drift up)
│   │   │   │   ├── down.ts     # System stop (drift down)
│   │   │   │   └── status.ts   # System status
│   │   │   └── lib/
│   │   │       ├── AgentManager.ts
│   │   │       ├── ProcessManager.ts
│   │   │       └── ConfigManager.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── drift-studio/           # Desktop management application
│   │   ├── src/
│   │   │   ├── main/           # Electron main process
│   │   │   ├── renderer/       # React UI
│   │   │   └── preload/        # Electron preload scripts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── drift-server/           # Headless daemon with API
│   │   ├── src/
│   │   │   ├── api/            # REST API endpoints
│   │   │   ├── orchestrator/   # Agent orchestration
│   │   │   └── scheduler/      # Task scheduling
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── agent-sdk/              # SDK for building agents
│   │   ├── src/
│   │   │   ├── client.ts       # MCPx client wrapper
│   │   │   ├── agent.ts        # Base agent class
│   │   │   └── tools.ts        # Tool helpers
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── templates/              # Agent and config templates
│       ├── basic/
│       ├── openai/
│       ├── claude/
│       └── fleet/
│
├── agents/                     # Example agent implementations
│   ├── ai-agent/               # OpenAI/Claude agent
│   ├── tool-agent/             # Generic tool executor
│   └── coordinator/            # Multi-agent coordinator
│
├── examples/                   # Example configurations
│   ├── single-agent/           # Simple single agent setup
│   ├── multi-agent/            # Multi-agent coordination
│   └── fleet-management/       # Fleet deployment example
│
├── docs/                       # Drift documentation
│   ├── getting-started.md
│   ├── cli-reference.md
│   ├── agent-development.md
│   └── fleet-management.md
│
├── package.json                # Monorepo root with workspaces
├── tsconfig.json               # Shared TypeScript config
└── README.md                   # Drift platform overview
```

## Migration Plan

### Phase 1: Repository Setup
1. Create new `drift` repository
2. Keep `mcpx` repository for protocol work
3. Set up CI/CD for both repositories

### Phase 2: Code Migration

#### Items to Move to Drift:
- `mcpx-cli/` → `drift/` (rename and refactor)
- `mcpx-studio/` → `drift-studio/`
- `agent/` → `drift/agents/ai-agent/`
- `agent-client/` → `drift/sdk/agent-client/`
- Agent templates and management code

#### Items to Keep in MCPx:
- `server/` - Reference gateway implementation
- `frontend/` - Reference web client
- `bridge/` - MCP-to-MCPx bridge
- `mcpx-chat/` - Extract protocol client as SDK
- `mcpx-spec/` → `spec/`

#### Items to Archive/Remove:
- `v0/` - Move relevant specs to `mcpx/spec/v0/`
- Temporary planning documents

### Phase 3: Refactoring

#### Naming Changes:
- `mcpx` CLI → `drift` CLI
- `mcpx-studio` → `drift-studio`
- `mcpx start` → `drift up`
- `mcpx stop` → `drift down`
- `mcpx agent` → `drift agent`
- `mcpx bridge` → `drift bridge`

#### Configuration Changes:
- `~/.mcpx/` → `~/.drift/`
- `mcpx.json` → `drift.yaml` (consider YAML for better readability)
- Agent configs move to `~/.drift/agents/`
- Bridge configs move to `~/.drift/bridges/`

#### Architecture Improvements:
1. **Plugin System**: Make agents and bridges pluggable
2. **Service Discovery**: Add automatic service discovery
3. **Health Monitoring**: Built-in health checks and recovery
4. **Deployment Modes**: Support local, server, and cloud deployment
5. **Fleet Management**: First-class support for agent fleets

## Dependency Management

### MCPx Dependencies:
- Core protocol libraries only
- WebSocket libraries
- JSON schema validators
- Standard web frameworks (React, Express)

### Drift Dependencies:
- MCPx SDK (from MCPx repo)
- Process management libraries
- Electron (for Studio)
- Redux Toolkit
- Agent-specific dependencies (OpenAI, Anthropic SDKs)

## API Contracts

### MCPx Protocol API:
- WebSocket connection: `ws://host/v0/ws?topic=<topic>`
- REST endpoints for discovery and history
- Message envelope format per MCPx spec

### Drift Management API:
```typescript
// Agent Management
POST   /api/agents                 // Create agent
GET    /api/agents                 // List agents
GET    /api/agents/:id             // Get agent details
PUT    /api/agents/:id             // Update agent
DELETE /api/agents/:id             // Remove agent
POST   /api/agents/:id/start       // Start agent
POST   /api/agents/:id/stop        // Stop agent
GET    /api/agents/:id/logs        // Get agent logs

// System Control
POST   /api/system/up              // Start system
POST   /api/system/down            // Stop system
GET    /api/system/status          // System status
GET    /api/system/health          // Health check

// Fleet Management
POST   /api/fleets                 // Create fleet
GET    /api/fleets                 // List fleets
POST   /api/fleets/:id/deploy      // Deploy fleet
```

## Benefits of Separation

### MCPx Repository:
- Clean protocol specification
- Reference implementations only
- Easy to implement in other languages
- Clear licensing for protocol adoption

### Drift Repository:
- Focused on orchestration and operations
- Can evolve independently of protocol
- Supports multiple deployment models
- Clear product identity

## Implementation Timeline

### Week 1:
- Set up Drift repository structure
- Migrate CLI and Studio code
- Update import paths and dependencies

### Week 2:
- Refactor naming throughout codebase
- Implement new CLI commands
- Update configuration system

### Week 3:
- Add fleet management features
- Implement plugin system
- Create deployment templates

### Week 4:
- Documentation updates
- Testing and bug fixes
- Release preparation

## Open Questions

1. **Versioning Strategy**: How to version Drift independently of MCPx protocol?
2. **Plugin Distribution**: NPM packages, GitHub repos, or custom registry?
3. **Cloud Deployment**: Support for K8s, Docker Swarm, or custom orchestration?
4. **Monitoring Integration**: Prometheus, OpenTelemetry, or custom metrics?
5. **Authentication**: OAuth2, JWT, or API keys for remote management?

## Next Steps

1. Review and approve this refactor plan
2. Create Drift repository with initial structure
3. Begin migration of CLI code
4. Update documentation and examples
5. Announce changes to early adopters

---

## Appendix: Component Mapping

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| mcpx-cli/ | drift/packages/drift-cli/ | Rename, refactor commands |
| mcpx-studio/ | drift/packages/drift-studio/ | Update branding |
| agent/ | drift/agents/ai-agent/ | Example implementation |
| agent-client/ | drift/packages/agent-sdk/ | Agent development SDK |
| server/ | mcpx/packages/gateway/ | Reference gateway |
| frontend/ | mcpx/packages/web-client/ | Reference web client |
| bridge/ | mcpx/packages/bridge/ | MCP-to-MCPx bridge |
| mcpx-chat/ | Extract client code to mcpx/packages/sdk-typescript/ | TypeScript SDK |
| mcpx-spec/ | mcpx/spec/ | Protocol specification |

## Spec Documents Status

The following spec documents have been consolidated in `/specs/`:
- `drift-refactor.md` - This refactoring plan
- `agent-client-architecture.md` - MCPx agent client design
- `decision-2-openai-peer-targeting.md` - Peer targeting strategy
- `decision.md` - Original MCPx design decisions
- `mcpx-studio-architecture-design.md` - Studio architecture
- `bug-report-agent-templates.md` - Known issues to fix
- `TESTING.md` - Testing documentation

These will be distributed as follows:
- **To MCPx repo**: agent-client-architecture.md, decision-2-openai-peer-targeting.md (protocol-related)
- **To Drift repo**: mcpx-studio-architecture-design.md → drift-studio-architecture.md
- **To Drift issues**: bug-report-agent-templates.md (as GitHub issues)