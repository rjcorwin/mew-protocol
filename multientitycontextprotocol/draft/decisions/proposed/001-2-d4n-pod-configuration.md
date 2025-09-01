# ADR-d4n: Pod Configuration Specification

**Status:** Proposed  
**Date:** 2025-08-31  
**Context:** MECP Protocol Draft Specification
**Incorporation:** Not Incorporated
**Parent ADR:** 001-1-y3m (Pod Terminology)

## Context

Currently, the protocol assumes loose authorization where tokens work across any pod. This lacks explicit configuration for pod participants, their capabilities, and connection methods. We need a declarative way to configure pods that:
- Defines who can participate
- Specifies participant capabilities
- Supports different connection types (local processes, remote endpoints, access keys)
- Handles protocol bridging for non-MECP participants
- Provides reproducible pod environments

Similar to how Docker Compose defines multi-container applications, or how MCP servers are configured in coding agents, pods need explicit configuration files.

### Decision Drivers
- Need for explicit, reproducible pod configurations
- Support for heterogeneous participant types
- Security through explicit capability assignment
- Ease of pod deployment and management
- Support for protocol bridging (MCP, A2A, MECP)

## Decision

**Adopt YAML-based pod configuration files**

Pods are configured through a `pod.yaml` file (or similar) that declaratively specifies participants, their capabilities, connection methods, and protocols. This provides explicit, version-controlled pod definitions.

## Options Considered

### Option 1: No Configuration (Status Quo)

Continue with dynamic, token-based authorization without explicit configuration.

**Pros:**
- Maximum flexibility
- No configuration overhead
- Dynamic participant joining

**Cons:**
- No reproducibility
- Unclear pod boundaries
- Hard to audit/review
- No explicit capability management

### Option 2: YAML Configuration Files (Recommended)

Use YAML files similar to docker-compose.yml for pod configuration.

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

Use JSON for pod configuration.

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

### Pod Configuration Structure

```yaml
# pod.yaml
version: "1.0"
name: "code-review-pod"
description: "Pod for collaborative code review with security scanning"

# Pod-level settings
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
      - "mecp/*"  # Full MECP access
      - "chat"
    
  # Local process (MECP native)
  security-scanner:
    type: local
    command: "./security-scanner"
    args: ["--mode", "aggressive"]
    env:
      SCAN_LEVEL: "high"
    protocol: mecp  # Native MECP participant
    capabilities:
      - "mecp/proposal:*"
      - "mecp/response:*"
      - "chat"
  
  # Remote MCP server (needs bridge)
  mcp-file-editor:
    type: remote
    url: "https://mcp-server.example.com/file-editor"
    protocol: mcp
    bridge:
      enabled: true
      image: "@mecp/mcp-bridge:latest"
    # Bridge translates capabilities to MCP tools
    capabilities:
      - "mecp/request:tools/read_file"
      - "mecp/request:tools/write_file"
      - "mecp/response:*"
    
  # Remote A2A agent (needs bridge)
  a2a-analyzer:
    type: remote
    url: "wss://a2a-agent.example.com/analyzer"
    protocol: a2a
    bridge:
      enabled: true
      image: "@mecp/a2a-bridge:latest"
    capabilities:
      - "mecp/proposal:*"
      - "chat"
  
  # Embedded bridge for external connections
  github-bridge:
    type: local
    command: "@mecp/github-bridge"
    args: ["--repo", "${GITHUB_REPO}"]
    protocol: mecp
    capabilities:
      - "mecp/request:tools/create_pr"
      - "mecp/request:tools/comment"
      - "mecp/response:*"

# Access keys for external participants
access_keys:
  - id: "reviewer-key-1"
    participant: "human-reviewer"
    expires: "2025-12-31T23:59:59Z"
  - id: "ci-system-key"
    participant: "ci-agent"
    capabilities:
      - "mecp/request:tools/run_tests"
      - "mecp/response:*"
      - "chat"

# Bridge configurations
bridges:
  mcp:
    default_image: "@mecp/mcp-bridge:latest"
    config:
      timeout: 30000
      retry_attempts: 3
  a2a:
    default_image: "@mecp/a2a-bridge:latest"
    config:
      task_timeout: 60000
```

### Participant Types

#### 1. Local Process (`type: local`)
- Spawned as subprocess
- Can be MECP native or use bridge
- Supports command, args, environment variables

#### 2. Remote Endpoint (`type: remote`)
- Connects to external service
- Requires protocol specification
- Bridge automatically configured if non-MECP

#### 3. Access Key (`type: key`)
- Generates joinable access tokens
- Can be distributed to users/systems
- Supports expiration and capability limits

### Protocol Bridging

When `protocol` is not `mecp`, a bridge agent is automatically provisioned:

```yaml
participant:
  type: remote
  protocol: mcp  # or 'a2a'
  bridge:
    enabled: true
    image: "@mecp/mcp-bridge:latest"  # Bridge container/process
    config:
      # Bridge-specific configuration
```

The bridge agent:
- Translates between MECP and target protocol
- Maintains protocol-specific connections
- Maps capabilities to protocol-specific operations
- Handles message transformation

### Capability Mapping for Bridges

MCP Bridge Example:
```yaml
# MECP capability -> MCP tool mapping
capability_mapping:
  "mecp/request:tools/read_file": "mcp.tools.read_file"
  "mecp/request:tools/write_file": "mcp.tools.write_file"
  "mecp/proposal:*": null  # MCP doesn't support proposals
```

### Pod Lifecycle

```bash
# Start pod from configuration
mecp pod start ./pod.yaml

# List running pods
mecp pod list

# Show pod participants and status
mecp pod status code-review-pod

# Stop pod
mecp pod stop code-review-pod

# Validate configuration
mecp pod validate ./pod.yaml
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
- **Explicit Configuration**: Clear, auditable pod definitions
- **Reproducibility**: Pods can be recreated exactly
- **Protocol Agnostic**: Supports MCP, A2A, MECP participants
- **Version Control**: Configuration files can be tracked
- **Security**: Explicit capability assignment
- **Automation**: Pods can be programmatically deployed

### Negative
- **Less Dynamic**: Requires configuration before use
- **Complexity**: More complex than simple token auth
- **Bridge Overhead**: Non-MECP participants need bridges
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
3. Gradually require configuration for new pods
4. Deprecate unconfigured pods in future version

## Future Enhancements

- Pod templates for common scenarios
- Configuration inheritance/composition
- Dynamic participant addition with approval
- Hot-reload of configuration changes
- Integration with orchestration platforms (K8s, Docker Compose)
- GUI configuration builders