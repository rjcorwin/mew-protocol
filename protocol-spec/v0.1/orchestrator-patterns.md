# MCPx Orchestrator Patterns Guide

**Version**: 0.1  
**Status**: Draft  
**Date**: 2025-08-27

## Overview

This guide provides recommended patterns for implementing orchestrator agents in MCPx. Orchestrators are trusted agents that review proposals from restricted participants and decide whether to fulfill them, either automatically based on learned policies or with human approval.

This is a **non-normative guide** - orchestrators are free to implement different patterns. However, following these recommendations will improve interoperability and user experience.

## Core Concepts

### Role of Orchestrators

Orchestrators act as intelligent gatekeepers that:
1. **Review** proposals from restricted agents
2. **Decide** whether to approve, reject, or escalate
3. **Execute** approved operations on behalf of proposers
4. **Learn** from human feedback to improve decisions
5. **Audit** all decisions for accountability

### Orchestrator Capabilities

Orchestrators typically need:
- `mcp/request:*` - To execute operations
- `mcp/response:*` - To respond to requests
- `chat` - To communicate with humans and agents
- Additional capabilities based on what they orchestrate

## Recommended Tool Interface

### Core Tools

Orchestrators SHOULD expose these MCP tools for management:

#### `orchestrator.add_rule`
Add an automation rule or policy.

```json
{
  "name": "orchestrator.add_rule",
  "description": "Add an automation rule for proposal handling",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Human-readable rule name"
      },
      "pattern": {
        "type": "object",
        "description": "Pattern to match proposals against"
      },
      "action": {
        "type": "string",
        "enum": ["auto_approve", "auto_reject", "require_human"],
        "description": "Action to take when pattern matches"
      },
      "reason": {
        "type": "string",
        "description": "Explanation for this rule"
      },
      "expires": {
        "type": "string",
        "format": "date-time",
        "description": "Optional expiration time"
      }
    },
    "required": ["name", "pattern", "action"]
  }
}
```

#### `orchestrator.list_rules`
List current automation rules.

```json
{
  "name": "orchestrator.list_rules",
  "description": "List all active automation rules",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filter": {
        "type": "string",
        "description": "Optional filter pattern"
      }
    }
  }
}
```

#### `orchestrator.remove_rule`
Remove an automation rule.

```json
{
  "name": "orchestrator.remove_rule",
  "description": "Remove an automation rule",
  "inputSchema": {
    "type": "object",
    "properties": {
      "rule_id": {
        "type": "string",
        "description": "ID of rule to remove"
      }
    },
    "required": ["rule_id"]
  }
}
```

#### `orchestrator.get_stats`
Get statistics about proposal handling.

```json
{
  "name": "orchestrator.get_stats",
  "description": "Get orchestrator statistics",
  "inputSchema": {
    "type": "object",
    "properties": {
      "since": {
        "type": "string",
        "format": "date-time",
        "description": "Start time for statistics"
      }
    }
  }
}
```

### Optional Tools

#### `orchestrator.review_proposal`
Request manual review of a specific proposal.

#### `orchestrator.set_default_action`
Set default action for unmatched proposals.

#### `orchestrator.export_rules`
Export rules for backup or sharing.

#### `orchestrator.import_rules`
Import rules from backup or another orchestrator.

## Rule Format Recommendations

### Basic Rule Structure

```json
{
  "id": "rule-uuid",
  "name": "Allow TODO updates",
  "pattern": {
    "from": "openai-agent",
    "kind": "mcp/proposal:tools/call",
    "method": "write_file",
    "path_regex": ".*/TODO\\.md$"
  },
  "action": "auto_approve",
  "reason": "TODO updates are low risk",
  "created_by": "human",
  "created_at": "2025-08-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "stats": {
    "matched": 42,
    "approved": 42,
    "rejected": 0
  }
}
```

### Pattern Matching

Patterns should support:
- **Exact match**: `"from": "agent-123"`
- **Wildcard**: `"from": "agent-*"`
- **Regex**: `"path_regex": ".*/TODO\\.md$"`
- **Nested paths**: `"params.tool_name": "write_file"`
- **Arrays**: `"from": ["agent-1", "agent-2"]`

### Action Types

- `auto_approve`: Automatically fulfill the proposal
- `auto_reject`: Automatically reject with reason
- `require_human`: Escalate to human for decision
- `delegate`: Forward to another orchestrator
- `conditional`: Apply additional checks

## Decision Flow

### Standard Decision Process

```
Receive Proposal
    ↓
Match Against Rules (priority order)
    ↓
Found Match? → Execute Rule Action
    ↓ No
Apply Default Action
```

### Implementation Pseudocode

```python
def handle_proposal(proposal):
    # Check rules in priority order
    for rule in sorted_rules:
        if matches_pattern(proposal, rule.pattern):
            log_match(rule, proposal)
            return execute_action(rule.action, proposal)
    
    # No rule matched - use default
    return execute_action(default_action, proposal)

def execute_action(action, proposal):
    if action == "auto_approve":
        return fulfill_proposal(proposal)
    elif action == "auto_reject":
        return reject_proposal(proposal, "Blocked by policy")
    elif action == "require_human":
        return escalate_to_human(proposal)
```

## Learning Patterns

### Human Teaching

Orchestrators should learn from human decisions:

1. **Explicit Teaching**: Human adds rule via tool
2. **Implicit Learning**: Track human decisions on proposals
3. **Feedback Loop**: Adjust rules based on corrections
4. **Batch Learning**: Analyze patterns across many decisions

### Example Teaching Interactions

```
Human: @orchestrator always approve file reads from research-agent
Orchestrator: Added rule: auto-approve read operations from research-agent

Human: @orchestrator reject write operations to /etc
Orchestrator: Added rule: auto-reject write operations to /etc
```

## Security Considerations

### Input Validation

- Validate all proposal patterns to prevent injection
- Sanitize rule names and descriptions
- Verify capability requirements before fulfillment
- Rate limit rule additions to prevent spam

### Audit Requirements

- Log all proposals received
- Log all decisions made (approve/reject/escalate)
- Log all rule changes
- Maintain decision history for analysis
- Track which rules matched which proposals

### Failure Handling

- Clear error messages for rejected proposals
- Timeout handling for human escalations
- Graceful degradation when rules database unavailable
- Recovery mechanisms for partial fulfillments

## Multi-Orchestrator Patterns

### Hierarchical Orchestration

Orchestrators can delegate to other orchestrators:

```
General Orchestrator
    ↓
Domain-Specific Orchestrators
    ↓
Worker Agents
```

### Consensus Orchestration

Multiple orchestrators vote on proposals:

```
Proposal → [O1, O2, O3] → Majority Decision → Execute
```

### Specialized Orchestration

Different orchestrators for different domains:

- **Security Orchestrator**: Reviews security-sensitive operations
- **Compliance Orchestrator**: Ensures regulatory compliance
- **Performance Orchestrator**: Manages resource-intensive operations

## Implementation Checklist

When implementing an orchestrator:

- [ ] Implement core tools (add_rule, list_rules, etc.)
- [ ] Define rule storage mechanism
- [ ] Implement pattern matching engine
- [ ] Add audit logging
- [ ] Create fulfillment mechanism
- [ ] Add human escalation interface
- [ ] Implement timeout handling
- [ ] Add statistics collection
- [ ] Create backup/restore functionality
- [ ] Document rule format
- [ ] Provide example rules
- [ ] Test with various proposal patterns

## Example Orchestrator Responses

### Approval
```json
{
  "decision": "approved",
  "rule_matched": "rule-123",
  "execution_id": "exec-456",
  "timestamp": "2025-08-27T10:30:00Z"
}
```

### Rejection
```json
{
  "decision": "rejected",
  "rule_matched": "rule-789",
  "reason": "Operation blocked by security policy",
  "timestamp": "2025-08-27T10:31:00Z"
}
```

### Escalation
```json
{
  "decision": "escalated",
  "reason": "Requires human approval",
  "escalation_id": "esc-012",
  "timeout": "2025-08-27T10:35:00Z"
}
```

## References

- MCPx Protocol Specification v0.1
- Decision 001: Fulfill Message Kind
- Decision 002: Orchestrator Standardization
