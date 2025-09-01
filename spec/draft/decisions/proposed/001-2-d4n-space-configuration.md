# ADR-d4n: Space Configuration Specification

**Status:** Proposed  
**Date:** 2025-08-31  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated (Should be incorporated last after other ADRs stabilize)
**Parent ADR:** 001-1-y3m (Communication Space Terminology)
**Related ADRs:** 002-1-q8f (Capability Definition Conventions)

## Context

Currently, the protocol assumes loose authorization where tokens work across any space. This lacks explicit configuration for space participants, their capabilities, and connection methods. We need a declarative way to configure spaces that:
- Defines who can participate
- Specifies participant capabilities
- Supports different connection types (local processes, remote endpoints, access keys)
- Handles protocol bridging for non-MEUP participants
- Provides reproducible space environments

Similar to how Docker Compose defines multi-container applications, or how MCP servers are configured in coding agents, spaces need explicit configuration files.

### Decision Drivers
- Need for explicit, reproducible space configurations
- Support for heterogeneous participant types
- Security through explicit capability assignment
- Ease of space deployment and management
- Support for protocol bridging (MCP, A2A, MEUP)

## Decision

**Adopt YAML-based space configuration files**

Spaces are configured through a `space.yaml` file (or similar) that declaratively specifies participants, their capabilities, connection methods, and protocols. This provides explicit, version-controlled space definitions.

**Note:** The exact configuration structure and field names shown in this ADR are illustrative examples. This ADR should be incorporated last, after other foundational ADRs have stabilized. The final design will be refined during incorporation into the specification, with particular attention to:
- Consistency with the capability format from ADR-q8f
- Clear distinction between native and bridged participants
- Proper separation of protocol-specific details
- Validation and error handling requirements
- Integration with decisions from other ADRs (namespace patterns, lifecycle management, etc.)

## Options Considered

### Option 1: No Configuration (Status Quo)

Continue with dynamic, token-based authorization without explicit configuration.

**Pros:**
- Maximum flexibility
- No configuration overhead
- Dynamic participant joining

**Cons:**
- No reproducibility
- Unclear space boundaries
- Hard to audit/review
- No explicit capability management

### Option 2: YAML Configuration Files (Recommended)

Use YAML files similar to docker-compose.yml for space configuration.

**Pros:**
- Declarative and version-controllable
- Familiar pattern from Docker/Kubernetes
- Human-readable and editable
- Supports comments and documentation
- Explicit capability management

**Cons:**
- YAML parsing complexity
- Potential for configuration errors
- Less dynamic than pure token-based

### Option 3: JSON Configuration

Use JSON for space configuration.

**Pros:**
- Native to JavaScript/TypeScript
- No parsing ambiguity
- Direct object mapping

**Cons:**
- Less human-friendly
- No comments support
- More verbose than YAML

### Option 4: Code-Based Configuration

Use programming language (TypeScript/Python) for configuration.

**Pros:**
- Full programming power
- Type safety possible
- Dynamic configuration

**Cons:**
- Not declarative
- Requires code execution
- Harder to validate/audit

## Implementation Details

**Important:** The configuration examples below are illustrative and will be refined during specification incorporation. The goal is to establish the pattern of declarative YAML configuration; exact field names, structure, and semantics will be finalized based on implementation experience and community feedback.

### Capability Format

Capabilities use the JSON pattern matching format defined in ADR-q8f. They can be:
- Simple strings for basic message types: `kind: "chat"`
- Complex patterns with payload inspection:
  ```yaml
  kind: "mcp.request"
  payload:
    method: "tools/*"
    params:
      name: "read_*"
  ```

### Space Configuration Structure (Illustrative Example)

```yaml
# space.yaml
version: "1.0"
name: "code-review-space"
description: "Space for collaborative code review with security scanning"

# Space-level settings
settings:
  max_participants: 10
  message_retention: "24h"
  context_depth_limit: 5

# Participant definitions
# Note: Participants that provide tools/resources typically have response capabilities,
# while those that use tools have request capabilities
participants:
  # Human user with access key
  human-reviewer:
    type: key
    description: "Human code reviewer"
    capabilities:
      - kind: "*"  # Full access to all message types (can request and respond)
    
  # Local process (MEUP native)
  security-scanner:
    type: local
    command: "./security-scanner"
    args: ["--mode", "aggressive"]
    env:
      SCAN_LEVEL: "high"
    protocol: meup  # Native MEUP participant
    capabilities:
      - kind: "meup.proposal"
      - kind: "meup.response"
      - kind: "chat"
  
  # Remote MCP server (needs bridge)
  mcp-file-editor:
    type: remote
    url: "https://mcp-server.example.com/file-editor"
    protocol: mcp
    bridge:
      enabled: true
      image: "@meup/mcp-bridge:latest"
    # These are the MEUP capabilities this MCP server provides via bridge
    capabilities:
      - kind: "mcp.response"  # Can respond to requests
    # MCP tools this server exposes (bridge handles translation)
    mcp_tools:
      - "read_file"
      - "write_file"
    
  # Remote A2A agent (needs bridge)
  a2a-analyzer:
    type: remote
    url: "wss://a2a-agent.example.com/analyzer"
    protocol: a2a
    bridge:
      enabled: true
      image: "@meup/a2a-bridge:latest"
    capabilities:
      - kind: "meup.proposal"
      - kind: "chat"
  
  # GitHub integration (native MEUP bridge)
  github-integration:
    type: local
    command: "@meup/github-bridge"
    args: ["--repo", "${GITHUB_REPO}"]
    protocol: meup  # Bridge speaks native MEUP
    capabilities:
      - kind: "meup.response"  # Can respond to requests
    # This bridge provides these tools to the space
    provides_tools:
      - "create_pr"
      - "comment"
      - "get_pr_status"
  
  # Workflow engine with arbitrary configuration
  workflow-orchestrator:
    type: local
    command: "@meup/workflow-engine"
    protocol: meup
    capabilities:
      - kind: "*"  # Full capabilities to orchestrate
    # Arbitrary configuration passed to the participant
    config:
      engine: "dagster"
      workflow:
        name: "code-review-pipeline"
        steps:
          - id: "security-scan"
            type: "parallel"
            agents: ["security-scanner"]
            timeout: 300
          - id: "style-check"
            type: "sequential"
            agents: ["linter", "formatter"]
          - id: "approval"
            type: "human-in-loop"
            require_all: false
        triggers:
          - type: "on_message"
            pattern: "pr:opened"
        error_handling:
          retry_count: 3
          fallback: "manual-review"
      runtime:
        max_parallel_tasks: 5
        checkpoint_interval: "10m"
        state_backend: "redis://localhost:6379"

# Access keys for external participants
access_keys:
  - id: "reviewer-key-1"
    participant: "human-reviewer"
    expires: "2025-12-31T23:59:59Z"
  - id: "ci-system-key"
    participant: "ci-agent"
    capabilities:
      - kind: "mcp.request"
        payload:
          method: "tools/call"
          params:
            name: "run_tests"
      - kind: "meup.response"  # Can respond in MEUP protocol
      - kind: "chat"

# Bridge configurations
bridges:
  mcp:
    default_image: "@meup/mcp-bridge:latest"
    config:
      timeout: 30000
      retry_attempts: 3
  a2a:
    default_image: "@meup/a2a-bridge:latest"
    config:
      task_timeout: 60000
```

### Participant Types

#### 1. Local Process (`type: local`)
- Spawned as subprocess
- Can be MEUP native or use bridge
- Supports command, args, environment variables
- Accepts arbitrary `config` object passed to participant

#### 2. Remote Endpoint (`type: remote`)
- Connects to external service
- Requires protocol specification
- Bridge automatically configured if non-MEUP
- Accepts arbitrary `config` object for service configuration

#### 3. Access Key (`type: key`)
- Generates joinable access tokens
- Can be distributed to users/systems
- Supports expiration and capability limits

### Arbitrary Participant Configuration

Any participant can include a `config` field containing arbitrary YAML/JSON that is passed directly to the participant at startup. This enables:

1. **Workflow Engines**: Complete workflow DAG definitions
2. **AI Agents**: Model parameters, prompts, temperature settings
3. **Tool Servers**: Database connections, API keys, feature flags
4. **Custom Services**: Any domain-specific configuration

Example configurations:

```yaml
# AI Agent with model configuration
ai-assistant:
  type: local
  command: "ai-agent"
  config:
    model: "gpt-4"
    temperature: 0.7
    system_prompt: "You are a helpful code reviewer"
    tools_enabled: ["search", "explain", "suggest"]
    max_tokens: 4000

# Database bridge with connection config
database-bridge:
  type: local
  command: "@meup/sql-bridge"
  config:
    connection:
      host: "${DB_HOST}"
      port: 5432
      database: "code_review"
      credentials_secret: "db-creds"
    query_timeout: 30000
    allowed_operations: ["SELECT", "INSERT"]

# Custom analytics engine
analytics-engine:
  type: remote
  url: "https://analytics.internal"
  config:
    metrics:
      - type: "code_complexity"
        threshold: 10
      - type: "test_coverage"
        minimum: 80
    reporting:
      format: "json"
      destination: "s3://reports/bucket"
```

The `config` field is:
- Passed as-is to the participant on startup
- Can be any valid YAML structure
- Supports environment variable substitution
- Participant-specific (gateway doesn't interpret it)
- Enables "participant as a service" pattern

### Protocol Bridging

When `protocol` is not `meup`, a bridge agent is automatically provisioned:

```yaml
participant:
  type: remote
  protocol: mcp  # or 'a2a'
  bridge:
    enabled: true
    image: "@meup/mcp-bridge:latest"  # Bridge container/process
    config:
      # Bridge-specific configuration
```

The bridge agent:
- Translates between MEUP and target protocol
- Maintains protocol-specific connections
- Maps capabilities to protocol-specific operations
- Handles message transformation

### Capability Mapping for Bridges

Bridge agents translate MEUP JSON pattern capabilities to protocol-specific operations. The bridge inspects the capability patterns and maps them accordingly.

MCP Bridge Example:
```yaml
# Bridge automatically translates JSON patterns to MCP operations
# For example, this MEUP capability:
meup_capability:
  kind: "mcp.request"
  payload:
    method: "tools/call"
    params:
      name: "read_*"

# Maps to MCP tools matching the pattern
mcp_operations: ["read_file", "read_config", "read_logs"]
```

### Space Lifecycle

```bash
# Start space from configuration
meup space start ./space.yaml

# List running spaces
meup space list

# Show space participants and status
meup space status code-review-space

# Stop space
meup space stop code-review-space

# Validate configuration
meup space validate ./space.yaml
```

### Environment Variable Substitution

Support environment variables in configuration:

```yaml
participant:
  type: remote
  url: "${API_ENDPOINT}"
  auth:
    token: "${API_TOKEN}"
```

## Consequences

### Positive
- **Explicit Configuration**: Clear, auditable space definitions
- **Reproducibility**: Spaces can be recreated exactly
- **Protocol Agnostic**: Supports MCP, A2A, MEUP participants
- **Version Control**: Configuration files can be tracked
- **Security**: Explicit capability assignment
- **Automation**: Spaces can be programmatically deployed

### Negative
- **Less Dynamic**: Requires configuration before use
- **Complexity**: More complex than simple token auth
- **Bridge Overhead**: Non-MEUP participants need bridges
- **Configuration Management**: Another file to maintain

## Security Considerations

- Access keys must be securely generated and stored
- Configuration files may contain sensitive data (use env vars)
- Bridge agents have elevated privileges (protocol translation)
- Capability validation must be enforced
- Remote endpoints need authentication

## Migration Path

1. Start with optional configuration (fallback to current behavior)
2. Provide configuration generators from existing setups
3. Gradually require configuration for new spaces
4. Deprecate unconfigured spaces in future version

## Future Enhancements

- Space templates for common scenarios
- Configuration inheritance/composition
- Dynamic participant addition with approval
- Hot-reload of configuration changes
- Integration with orchestration platforms (K8s, Docker Compose)
- GUI configuration builders