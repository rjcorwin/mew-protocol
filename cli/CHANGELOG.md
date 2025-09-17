# CLI Changelog

All notable changes to the MEW Protocol CLI will be documented in this file.

## [v0.3.2] - 2025-01-16

### Added
- **Enhanced Terminal Input** - Complete rewrite of the CLI input system
  - Multi-line text buffer with proper cursor management
  - Full Unicode/emoji support with correct width calculations
  - Comprehensive keyboard shortcuts (Ctrl+A/E, Alt+arrows, etc.)
  - Word navigation and deletion commands (Ctrl+W, Ctrl+K, Ctrl+U)
  - Command history navigation with up/down arrows (in-memory for now)
  - Debug logging to `.mew/debug.log` for troubleshooting

### Fixed
- **Enter key submission** - Enter key now properly submits messages instead of being treated as printable character
- **Mac delete key** - Delete key on Mac keyboards now works correctly (mapped to backward delete)
- **Special key handling** - Arrow keys, escape, tab, and other special keys no longer incorrectly matched as printable
- **Input visibility** - Text input is now properly visible while typing
- **Backspace functionality** - Backspace key works correctly in all contexts

### Technical
- Implemented ADR-010 and ADR-011 for terminal input enhancements
- Added comprehensive test suite for text buffer operations
- Improved key pattern matching to properly exclude special characters

## [v0.2.2] - 2025-01-15

### Added
- **MEW Banner**: Happy cat ASCII art banner with 40+ random taglines
  - Displays when starting interactive mode (not in debug mode)
  - Shows space name, participant ID, and gateway info
  - Professional cat herding taglines that rotate on each startup
  - Color support with cyan/yellow/green theming

### Improved
- Visual identity for the CLI with playful branding
- Better startup experience with clear connection information

## [v0.2.1] - 2025-01-15

### Fixed
- **Duplicate workspace names** - Templates now use `{{SPACE_NAME}}` variable in package.json to ensure unique workspace names when multiple spaces exist
- **Init-to-connect flow** - After `mew init`, the command now automatically continues to `mew space up -i` for seamless onboarding
- **Port conflicts** - Gateway now automatically finds an available port when the default is in use
- **Space state detection** - Default `mew` command now properly detects if space is already running and connects instead of restarting

### Changed
- Template package.json files now undergo variable substitution during init
- Improved default command behavior with three distinct states (no config, config but not running, config and running)
- CLI spec updated to document these behaviors as intended functionality

## [v0.2.0] - 2025-01-15

### Added
- **MCP Operation Approval Dialog** - Interactive approval system for MCP proposals
  - Arrow key navigation with visual selection indicator
  - Number key shortcuts (1/2) for quick approval/denial
  - Enter key confirmation and Escape to cancel
  - Proper focus management with input composer disabled during dialogs
  - Generic template that works for all operation types

- **Enhanced `mew init` Command**
  - Template system for space initialization
  - Built-in templates: `coder-agent` and `note-taker`
  - Interactive template selection when no template specified
  - Isolated dependencies in `.mew/` directory
  - Auto-detection of space configuration in `.mew/space.yaml` or `space.yaml`

- **Improved Interactive UI**
  - Better formatting for reasoning messages (thinking/thoughts)
  - Context-aware message display
  - Visual reasoning status with spinner animation
  - Improved message formatting for all types

### Fixed
- Input focus issues during approval dialogs (characters no longer appear in input field)
- Lint errors in advanced-interactive-ui.js
- Protocol name consistency (MEUP → MEW Protocol)

### Changed
- Updated to MEW Protocol v0.3 naming convention
- Improved default command behavior (`mew` alone now intelligently chooses init or space up)
- Enhanced space configuration with better defaults

### Documentation
- ADR-009: Approval Dialog UX (accepted) - Three-phase implementation plan
- Updated CLI specification with approval dialog documentation
- Added Phase 2 and 3 implementation tasks to TODO.md

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