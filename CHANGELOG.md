# CLI Changelog

All notable changes to the MEW Protocol CLI will be documented in this file.

## [Unreleased]

### Seacat

#### Implemented: Ship-to-Ship Combat (c5x-ship-combat)
**Status:** Complete ✅ (All 5 Phases)
**Proposal:** `spec/seacat/proposals/c5x-ship-combat/`
**Implementation Plan:** `spec/seacat/proposals/c5x-ship-combat/implementation.md`

Full cannon-based ship combat for multiplayer PvP and cooperative multi-crew gameplay.

**Features Implemented:**
- ✅ Cannon control points (3 per side: port/starboard)
- ✅ Manual aiming system (±45° arc adjustment)
- ✅ Physics-based projectiles (gravity, momentum inheritance)
- ✅ Damage/health system (100 HP, sinking at 0)
- ✅ Hit detection with client claims & server validation
- ✅ Visual effects (cannonball trails, explosions, water splash, damage smoke)
- ✅ Audio effects (5 sounds via Howler.js: cannon fire, impact, splash, sinking, respawn)
- ✅ Ship sinking animation and respawn mechanics
- ✅ Multi-crew coordination support

**Implementation Phases:**
- Phase 1 (Control points & aiming): ✅ COMPLETE
- Phase 2 (Firing & projectiles): ✅ COMPLETE
- Phase 3 (Collision & damage): ✅ COMPLETE
- Phase 4 (Sinking & respawn): ✅ COMPLETE
- Phase 5 (Polish & sounds): ✅ COMPLETE

**New Protocol Messages:**
- `ship/aim_cannon` - Adjust cannon aim angle
- `ship/fire_cannon` - Fire cannonball
- `game/projectile_spawn` - Broadcast projectile creation
- `game/projectile_hit` - Client hit claim
- `ship/damage` - Damage notification
- `ship/respawn` - Ship respawn after sinking

**Technical Notes:**
- Audio system uses Howler.js instead of Phaser audio (Phaser's XHR loader crashes in Electron)
- Solution: HTML5 Audio + absolute file paths via `window.location.href`
- All 5 combat sounds working in Electron production builds
- Friendly fire disabled (ships can't damage themselves)
- Ships respawn at original spawn location after 5 seconds
- No speed penalty for damaged ships (keeps gameplay smooth)

#### Implemented: Tiled Map Integration (t4m)
**Status:** Complete ✅
**Proposal:** `spec/seacat/proposals/t4m-tiled-maps/`

Add support for Tiled Map Editor (.tmj) files with tile-based collision detection and gameplay properties.

**Features:**
- ✅ Load isometric maps from Tiled Map Editor (JSON format)
- ✅ Multiple layer support (Ground, Water, Obstacles)
- ✅ Tile-based collision detection (O(1) lookups)
- ✅ Map boundary enforcement (prevent off-map movement)
- ✅ Tile properties: walkable (bool), speedModifier (float), terrain (string)
- ✅ Water tiles reduce speed to 50% (swimming mechanics)
- ✅ Wall tiles block movement completely
- ✅ Procedural tileset generation (5 terrain types)
- ✅ Multiplayer position synchronization maintained

**Implementation:**
- Phase 3a ✅: Tiled map loading with procedural tileset
- Phase 3b ✅: Tile-based collision with boundary enforcement
- Phase 3c ✅: Water speed modification and tile properties
- Phase 3d: Multiplayer testing (ready for testing)

**Files Added:**
- `clients/seacat/assets/maps/example-map.tmj` - Example 20×20 map
- `clients/seacat/assets/maps/tilesets/terrain.tsj` - Terrain tileset definition
- `clients/seacat/assets/maps/README.md` - Map creation guide
- `spec/seacat/proposals/t4m-tiled-maps/` - Complete proposal

**Files Modified:**
- `clients/seacat/src/game/GameScene.ts` - Map loading, collision, rendering
- `spec/seacat/implementation-plan.md` - Milestone 3 complete

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
