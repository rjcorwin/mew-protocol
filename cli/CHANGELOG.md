# CLI Changelog

All notable changes to the MEUP CLI specification will be documented in this file.

## [v0.0.0] - 2025-01-05

### Initial Release

First official release of the MEUP CLI specification for minimal test implementation.

### Features

#### Commands
- `meup gateway start` - Start gateway server with WebSocket support
- `meup client connect` - Connect to gateway (interactive or FIFO mode)
- `meup space up` - Bring up entire space infrastructure
- `meup space down` - Tear down space infrastructure
- `meup token create` - Generate test tokens

#### Terminal Interface
- Smart input detection (chat vs JSON envelopes)
- Interactive commands (`/help`, `/participants`, `/capabilities`, `/exit`)
- Readline-based terminal UI for human interaction

#### Space Management
- Space configuration via `space.yaml`
- Automatic participant resolution (6-step cascade)
- Agent auto-start with `auto_start: true`
- Process management for local agents

#### Capability System
- Gateway hooks for capability resolution
- Participant lifecycle management
- Wildcard pattern matching for capabilities
- Dynamic participant registration

### Architecture Decisions

- **ADR-001-a1b**: Removed `meup agent start` command - agents run directly
- **ADR-002-p4k**: Smart participant ID resolution with cascading precedence
- **ADR-003-t7m**: Smart terminal input detection for chat and JSON

### Dependencies

- `@meup/gateway` - Gateway server implementation
- `@meup/client` - Client connection logic
- `@meup/agent` - Agent base functionality
- `@meup/capability-matcher` - Capability pattern matching
- `ws` - WebSocket client/server
- `commander` - Command-line parsing
- `js-yaml` - YAML configuration parsing
- `readline` - Terminal interface

### Notes

This is an alpha release focused on enabling the test plan execution. The implementation prioritizes simplicity and testability over feature completeness.