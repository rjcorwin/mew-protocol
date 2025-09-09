# Changelog

All notable changes to the MEW Protocol specification will be documented in this file.

## [v0.3] - 2025-01-09

### Changed
- **BREAKING**: Protocol renamed from MEUP to MEW Protocol (Multi-Entity Workspace Protocol)
- **BREAKING**: Protocol identifier changed from `meup/v0.2` to `mew/v0.3`
- Abstract updated to include "herding cats" metaphor explaining the protocol's purpose
- All references throughout specification updated to use MEW Protocol

### Architecture Decisions
- **ADR-001**: MEW Protocol name change - defines MEW as Multi-Entity Workspace, capturing the unified context concept while being more intuitive and memorable

### Migration Notes
- Update all protocol identifiers in messages from `"meup/v0.2"` to `"mew/v0.3"`
- Update any documentation references from MEUP to MEW Protocol

## [v0.2] - 2025-01-03

### Added
- Complete protocol specification with all foundational ADRs incorporated
- Space management operations (`capability/grant`, `capability/revoke`, `space/invite`, `space/kick`)
- Reasoning transparency messages (`reasoning/start`, `reasoning/thought`, `reasoning/conclusion`)
- Proposal lifecycle operations (`mcp/withdraw`, `mcp/reject`)
- Context field for hierarchical message organization
- System messages (`system/welcome`, `system/presence`, `system/error`)
- JSON pattern matching for capability definitions
- Array-based correlation IDs for workflow support
- Comprehensive security model with identity validation
- Implementation checklists for gateways and participants

### Changed
- Protocol identifier from `mcp-x/v0` to `meup/v0.2`
- Message kinds to use slash notation (e.g., `mcp/request` instead of `mcp.request`)
- Correlation ID to always be an array of strings
- Capability definitions from string wildcards to JSON pattern matching
- Property naming convention to snake_case following MCP

### Architecture Decisions
The following ADRs were accepted and incorporated:
- **ADR-x7k**: Protocol naming (MEUP)
- **ADR-y3m**: Communication space terminology
- **ADR-m3p**: Minimal kind namespace pattern
- **ADR-q8f**: JSON pattern matching for capabilities
- **ADR-v2c**: Proposal lifecycle management
- **ADR-t8k**: Agent reasoning transparency
- **ADR-k9j**: Sub-context protocol mechanics
- **ADR-p4m**: Context field structure
- **ADR-g7r**: Capability delegation with `capability/*` and `space/*` namespaces
- **ADR-h2n**: Correlation ID as array of strings
- **ADR-j3k**: Property naming convention (snake_case)
- **ADR-n5r**: Protocol-kind separator (slash notation)

### Rejected
- **ADR-d4n**: Space configuration specification (moved to future CLI implementation)

## [v0.1] - Never Released
- Initial draft specification (superseded by v0.2)

## [v0.0] - 2024
- Original MCP-X protocol concept