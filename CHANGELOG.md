# MEW Protocol Changelog

All notable changes to the MEW Protocol will be documented in this file.

## [Unreleased]

## [0.9.0] - 2025-11-23

### Added

#### [s2w] Stream Ownership Transfer
**Proposal:** `spec/protocol/proposals/s2w-stream-ownership/`

**Problem:** Streams currently enforce strict single-writer semantics - only the participant who created a stream can publish frames to it. This prevents important use cases like game character control delegation (player takes control of character position stream), collaborative workflows (multiple agents write to shared output stream), and ownership transfer when the original creator disconnects.

**Solution:** Add three new message kinds for stream authorization management:
- `stream/grant-write` - Owner grants write access to another participant
- `stream/revoke-write` - Owner revokes write access from a participant
- `stream/transfer-ownership` - Owner transfers complete ownership to another participant

Additionally, extend `system/welcome.active_streams` with `authorized_writers` array showing all participants authorized to write to each stream.

**Changes:**
- Protocol: Added three new message kinds for stream authorization (see SPEC.md 3.10.5-3.10.7)
- Protocol: Added `authorized_writers` field to `system/welcome.active_streams` (SPEC.md 3.10.8)
- Gateway: Tracks authorized writers per stream (initialized on stream creation)
- Gateway: Validates stream frame publishers against authorized writers list
- Gateway: Auto-revokes write access when participants disconnect (except owner)
- Gateway: Implements grant/revoke/transfer handlers with proper authorization checks
- Gateway: Broadcasts acknowledgement messages for all authorization operations
- Types: Added payload types for new message kinds (StreamGrantWritePayload, StreamRevokeWritePayload, StreamTransferOwnershipPayload)
- Types: Extended `StreamMetadata` with `authorized_writers` field

**Use Cases:**
- Game character control delegation (Seacat RTS character position streams)
- Collaborative output streams (multiple agents writing to shared results)
- Ownership transfer on disconnect (backup takes over critical stream)

**Security:**
- Only stream owner can grant/revoke/transfer authorization
- Gateway validates authorized writers on every frame
- Owner cannot revoke self (always authorized)
- All authorization changes are broadcast for transparency

## [0.8.0] - 2025-11-23

### Added

#### [j8v] Stream Visibility on Join with Metadata Preservation (Done)
**Proposal:** `spec/protocol/proposals/j8v-stream-visibility/`
**Status:** Done

**Problem:** When a participant joins a space with active streams, they don't receive information about those streams in their welcome message. This creates a visibility gap where new joiners receive stream data frames (`#streamID#data`) without context about what streams exist or how to parse them.

**Solution:** Include active streams in the `system/welcome` payload with complete metadata preservation. All fields from the original `stream/request` (including `content_type`, `format`, `metadata`, and custom fields) are preserved and sent to late joiners, ensuring zero information loss.

**Changes:**
- Protocol: Add `active_streams` field to `system/welcome` payload with extensible metadata
- Types: Extended `StreamRequestPayload` and `StreamMetadata` with `content_type`, `format`, `metadata` fields
- Gateway: Preserve entire payload when creating streams (spread operator)
- Gateway: Build active streams array by spreading all metadata fields
- Tests: Enhanced scenario-15 to validate metadata preservation (17 assertions)

**Use Cases Enabled:**
- Real-time game movement streams with custom formats and coordinate systems
- Voice chat transcription with language and speaker metadata
- File transfers with MIME types, checksums, and filenames
- AI reasoning traces with format specifications

### Changed
- **Node.js version support** - Updated to support Node 23.x, 24.x, and 25.x (dropped Node 22.x support)
  - Updated `package.json` engines requirement to `>=23.0.0`
  - Updated CI matrix to test on Node 23.x, 24.x, and 25.x
  - Future-proofs the project for Node 25 (released November 2025)

### Fixed
- **E2E test compatibility** - Fixed issues preventing e2e tests from running on local developer machines
  - Fixed `mew init` hanging when output is redirected (e.g., `> init.log 2>&1`)
    - Now checks both `stdin` and `stdout` for TTY detection, not just `stdin`
    - Prevents interactive prompts from appearing when either stream is redirected
  - Fixed Python command compatibility across different systems
    - Replaced `python` with `python3` in all e2e test scripts (11 instances across 4 scenarios)
    - Tests now work on systems without `python-is-python3` package installed
    - Ensures compatibility with macOS, Ubuntu 20.04+, and other modern systems
  - All 15 e2e scenarios now pass on local development machines

## [0.7.0] - 2025-11-08

### Changed

#### Seacat Graduated to Standalone Repository
**Seacat game is now an independent project!** 🎉

The Seacat multiplayer sailing game has been moved to its own repository at [github.com/rjcorwin/seacat](https://github.com/rjcorwin/seacat).

**What changed:**
- Removed `mew seacat` command from CLI
- Removed `clients/seacat/` directory
- Removed `spec/seacat/` directory
- Removed `templates/seacat/` template
- Removed `src/mcp-servers/ship-server/` (moved to seacat repo)
- Removed seacat-related build scripts and package.json entries

**For Seacat users:**
- Clone the new repository: `git clone https://github.com/rjcorwin/seacat.git`
- Follow setup instructions in the seacat repo's README
- Seacat continues to use MEW Protocol as a dependency (`@mew-protocol/mew`)

This change allows both projects to evolve independently while maintaining seacat as a demonstration of MEW Protocol's capabilities for real-time multiplayer games.

For seacat's full history, see the seacat repository's CHANGELOG or mew-protocol versions 0.6.0-0.6.2.

---

## [0.6.2] - 2025-11-03

### Note
This version and v0.6.0-0.6.1 were seacat-specific releases. Seacat has now graduated to its own repository. See v0.7.0 changelog above.

---

## [v0.5.1] - 2025-01-06

### Fixed
- **Missing dependencies** - Added `micromatch` and `debug` to dependencies (were causing runtime errors on npm install)

## [v0.5.0] - 2025-01-06

### Changed
- **BREAKING: Repository restructure** - Flattened from monorepo to single-package layout
  - Moved `packages/mew/src/` → `src/`
  - Moved `packages/mew/package.json` → root `package.json`
  - Renamed `tests/` → `e2e/` for clarity
  - Simplified TypeScript configuration (removed project references)
  - Updated CI workflows to work with new structure
  - Contributors with open PRs will need to rebase
- **BREAKING: Package consolidation** - Unified all `@mcpx-protocol/*` packages into single `@mew-protocol/mew` package
  - All functionality (CLI, SDK, gateway, client, agent, bridge) now in one package
  - Simpler installation: `npm install -g @mew-protocol/mew`
  - Maintained exports for backward compatibility via package subpaths

### Added

#### CLI Theme System
- **Customizable themes** - Complete color scheme system for interactive UI
  - New `src/cli/themes.ts` with comprehensive theme definitions
  - Configure via `ui_theme` field in `space.yaml`
  - Themes control input, status bar, messages, reasoning display, and more
  - Visual polish with startup animations

#### Default-to Configuration
- **Auto-targeting for chat** - Send messages without specifying recipient every time
  - Configure default recipients in `space.yaml`: `default_to.chat: ["participant"]`
  - Eliminates repetitive `@participant` mentions
  - Especially useful for 1:1 human-agent interactions
  - Applied to all bundled templates (coder-agent, note-taker, cat-maze)

#### Enhanced Message Formatters
- **Rich formatting for 15+ envelope kinds** - Better visual display of protocol messages
  - `chat` - Full-width borders, diamond prefix, theme-aware colors
  - `chat/acknowledge` - Checkmark prefix with status display
  - `mcp/request`, `mcp/proposal`, `mcp/response` - Method, tool, and result formatting
  - `reasoning/thought`, `reasoning/start`, `reasoning/conclusion` - Colored reasoning display
  - `stream/request`, `stream/open`, `stream/close` - Stream lifecycle indicators
  - `system/help` - Multi-line help with section highlighting
  - Tool-specific formatters for common MCP operations
  - Documented in `spec/scratch/MESSAGE-FORMATTERS.md`

#### Thinking Tag Filter
- **Clean agent output** - Automatically filters internal reasoning from display
  - Removes `<thinking>`, `<reasoning>`, `<scratchpad>` tags
  - Agent can use tags for internal planning without cluttering user view
  - Implemented in `src/cli/ui/utils/thinkingFilter.ts`
  - Updated coder-agent prompt to use thinking tags

#### Improved Coding Agent
- **Better prompts and filesystem handling**
  - Updated system prompt with thinking tag guidance
  - Filesystem hygiene: excludes `node_modules`, `.git`, `.mew/node_modules`, `dist`, `build`
  - Workspace path templating for MCP bridge (replaces hardcoded `./`)
  - More concise output by default, explains only when asked

### Documentation
- **AGENTS.md** - Quick reference guide for AI agents developing with MEW
- **Tool formatters spec** - Documented formatter system in CLI spec
- **Repository spec** - New `spec/repo/REPO-SPEC.md` documenting repo structure
- **Decision records** - ADR-015 for CLI TypeScript conversion

### Fixed
- Template variable substitution for workspace paths
- Consistent message colors in chat display

## [v0.4.10] - 2025-09-29

### Fixed
- **Template capability coverage** – every human participant now receives `kind: "*"`, ensuring access to reasoning cancel and future capability channels across all bundled templates.

## [v0.4.9] - 2025-09-29

### Changed
- **Cat Maze template polish** – swapped the finish tile to a 🏡 house and updated solver/narrator glyph expectations to match the refreshed maze visuals.

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
