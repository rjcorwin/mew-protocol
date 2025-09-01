# ADR-d4n: Space Configuration Specification

**Status:** Proposed  
**Date:** 2025-08-31  
**Context:** MEUP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Parent ADR:** 001-1-y3m (Communication Space Terminology)

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

### Space Configuration Structure

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
participants:
  # Human user with access key
  human-reviewer:
    type: key
    description: "Human code reviewer"
    capabilities:
      - "meup/*"  # Full MEUP access
      - "chat"
    
  # Local process (MEUP native)
  security-scanner:
    type: local
    command: "./security-scanner"
    args: ["--mode", "aggressive"]
    env:
      SCAN_LEVEL: "high"
    protocol: meup  # Native MEUP participant
    capabilities:
      - "meup/proposal:*"
      - "meup/response:*"
      - "chat"
  
  # Remote MCP server (needs bridge)
  mcp-file-editor:
    type: remote
    url: "https://mcp-server.example.com/file-editor"
    protocol: mcp
    bridge:
      enabled: true
      image: "@meup/mcp-bridge:latest"
    # Bridge translates capabilities to MCP tools
    capabilities:
      - "meup/request:tools/read_file"
      - "meup/request:tools/write_file"
      - "meup/response:*"
    
  # Remote A2A agent (needs bridge)
  a2a-analyzer:
    type: remote
    url: "wss://a2a-agent.example.com/analyzer"
    protocol: a2a
    bridge:
      enabled: true
      image: "@meup/a2a-bridge:latest"
    capabilities:
      - "meup/proposal:*"
      - "chat"
  
  # Embedded bridge for external connections
  github-bridge:
    type: local
    command: "@meup/github-bridge"
    args: ["--repo", "${GITHUB_REPO}"]
    protocol: meup
    capabilities:
      - "meup/request:tools/create_pr"
      - "meup/request:tools/comment"
      - "meup/response:*"

# Access keys for external participants
access_keys:
  - id: "reviewer-key-1"
    participant: "human-reviewer"
    expires: "2025-12-31T23:59:59Z"
  - id: "ci-system-key"
    participant: "ci-agent"
    capabilities:
      - "meup/request:tools/run_tests"
      - "meup/response:*"
      - "chat"

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

#### 2. Remote Endpoint (`type: remote`)
- Connects to external service
- Requires protocol specification
- Bridge automatically configured if non-MEUP

#### 3. Access Key (`type: key`)
- Generates joinable access tokens
- Can be distributed to users/systems
- Supports expiration and capability limits

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

MCP Bridge Example:
```yaml
# MEUP capability -> MCP tool mapping
capability_mapping:
  "meup/request:tools/read_file": "mcp.tools.read_file"
  "meup/request:tools/write_file": "mcp.tools.write_file"
  "meup/proposal:*": null  # MCP doesn't support proposals
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