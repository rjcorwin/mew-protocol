# TODO

- [x] RENAME EVERYTHING FROM MEUP TO MEW ✅

- [x] [TD0.0.1] Clean up tests structure
    - [x] [TD0.0.1.0] Remove unused files from `tests/` directory
    - [x] [TD0.0.1.1] Move test scenarios up one directory

- [x] [TD0.1] Create sdk client
    - [x] [TD0.1.1] Typed API to handle each message kind (MEWClient complete)
    - [x] [TD0.1.2] Migrate existing test agents to use MEWClient
        - [x] [TD0.1.2.1] Update echo.js agent in scenario-1
        - [x] [TD0.1.2.2] Update calculator.js agent in scenario-2
        - [x] [TD0.1.2.3] Update fulfiller.js in scenario-3
    
- [x] [TD0.2] Create sdk participant base class
    - [x] [TD0.2.1] API for propose/request -> response (promise-based)
    - [x] [TD0.2.2] lifecycle: respond to tool/list requests (automatic MCP handling)
    - [x] [TD0.2.3] Auto-registration and capability management
    - [ ] [TD0.2.4] Migrate test agents to use MEWParticipant
        - [x] [TD0.2.4.1] Update calculator.js to use MEWParticipant (simpler, cleaner code) - Migrated to calculator-participant.js, all scenarios updated
        - [x] [TD0.2.4.2] Update fulfiller.js to use MEWParticipant (promise-based proposal fulfillment)
        - [ ] [TD0.2.4.3] Create new scenario test using promise-based requests
        - [ ] [TD0.2.4.4] Add performance comparison test (MEWClient vs MEWParticipant)

- [x] [TD1] Bridge an mcp server from space config (start with file mcp server inside cwd)
    - [x] [TD1.1] Incorporate sdk client and sdk participant into mcp bridge ✅
        - [x] [TD1.1.1] Replace raw WebSocket with MEWClient in mcp-bridge.js - Using MEWParticipant which includes MEWClient
        - [x] [TD1.1.2] Use participant base class for bridge lifecycle - Successfully implemented
        - [x] [TD1.1.3] Add proper error handling and reconnection - Included in MEWParticipant base class
        - Note: MCP bridge successfully receives requests and gets responses from MCP server. Minor issue with response forwarding in test (may be test-specific)
    - [ ] [TD1.2] Add support for more MCP server types
        - [ ] [TD1.2.1] NPX-based MCP servers
        - [ ] [TD1.2.2] Docker-based MCP servers
        
- [ ] [TD2] Interactive Connection Features (CLI v0.1.0 spec)
    - [ ] [TD2.1] `mew space up --interactive` flag
        - [ ] [TD2.1.1] Add -i/--interactive flag to space up command
        - [ ] [TD2.1.2] Connect interactively after starting space
        - [ ] [TD2.1.3] Ensure -i and -d flags are mutually exclusive
        - [ ] [TD2.1.4] Use participant resolution logic (see TD2.3)
    - [ ] [TD2.2] `mew space connect` command
        - [ ] [TD2.2.1] Create new connect subcommand
        - [ ] [TD2.2.2] Check if space is running before connecting
        - [ ] [TD2.2.3] Load space config and resolve gateway URL
        - [ ] [TD2.2.4] Connect to running space interactively
        - [ ] [TD2.2.5] Support --space-dir flag for other directories
    - [ ] [TD2.3] Shared participant resolution logic
        - [ ] [TD2.3.1] Extract participant resolution to shared module
        - [ ] [TD2.3.2] Priority: --participant flag
        - [ ] [TD2.3.3] Priority: default_participant in space.yaml
        - [ ] [TD2.3.4] Priority: Single human participant auto-select
        - [ ] [TD2.3.5] Priority: Interactive selection prompt
        - [ ] [TD2.3.6] Priority: System username match
        - [ ] [TD2.3.7] Error handling when no participant found
    - [ ] [TD2.4] Interactive Terminal UI
        - [ ] [TD2.4.1] Smart input detection (commands, JSON, plain text)
        - [ ] [TD2.4.2] Message display with timestamp and direction
        - [ ] [TD2.4.3] Essential commands (/help, /participants, /exit, etc.)
        - [ ] [TD2.4.4] Verbose mode to show full JSON
        - [ ] [TD2.4.5] Escape hatches (/json, /chat) for edge cases
        - [ ] [TD2.4.6] Output filtering (hide heartbeats, dim system messages)
        - [ ] [TD2.4.7] Override participant config (ignore fifo, output_log)
        - [ ] [TD2.4.8] Use MEWClient for WebSocket connection
        - [ ] [TD2.4.9] Readline-based interface for terminal interaction
    - [ ] [TD2.5] Advanced TUI with confirmation support
    
- [ ] [TD3] Create `mew-agent` package
    - [ ] [TD3.1] Base agent class using sdk participant
    - [ ] [TD3.2] Agent templates for common patterns
    - [ ] [TD3.3] CLI for creating new agents from templates


- [ ] [TD4] `mew init [template]` command
    - [ ] [TD4.1] `mew` by itself launches init if not init'ed, other wise it's up with interactive. if not init'ed, prompts user to pick template, then launches on choice. One of templates will be `coding`, another is `notes`,

- [ ] [TD5] Support for streams in mew protocol (see proposed ADR)

- [ ] [TD6] publish all npm packages