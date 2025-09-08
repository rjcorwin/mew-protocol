# TODO

- [x] [TD0.0.1] Clean up tests structure
    - [x] [TD0.0.1.0] Remove unused files from `tests/` directory
    - [x] [TD0.0.1.1] Move test scenarios up one directory

- [ ] [TD0.1] Create sdk client
    - [x] [TD0.1.1] Typed API to handle each message kind (MEUPClient complete)
    - [ ] [TD0.1.2] Migrate existing test agents to use MEUPClient
        - [x] [TD0.1.2.1] Update echo.js agent in scenario-1
        - [x] [TD0.1.2.2] Update calculator.js agent in scenario-2
        - [x] [TD0.1.2.3] Update fulfiller.js in scenario-3
        - [ ] [TD0.1.2.4] Update remaining test agents
    - [ ] [TD0.1.3] Create example client applications
        - [ ] [TD0.1.3.1] Basic chat client example
        - [ ] [TD0.1.3.2] MCP tool caller example
        - [ ] [TD0.1.3.3] Proposal system example
    
- [ ] [TD0.2] Create sdk participant base class
    - [ ] [TD0.2.1] API for propose/request -> response
    - [ ] [TD0.2.2] lifecycle: respond to tool/list requests
    - [ ] [TD0.2.3] Auto-registration and capability management

- [x] [TD1] Bridge an mcp server from space config (start with file mcp server inside cwd)
    - [ ] [TD1.1] Incorporate sdk client and sdk participant into mcp bridge
        - [ ] [TD1.1.1] Replace raw WebSocket with MEUPClient in mcp-bridge.js
        - [ ] [TD1.1.2] Use participant base class for bridge lifecycle
        - [ ] [TD1.1.3] Add proper error handling and reconnection
    - [ ] [TD1.2] Add support for more MCP server types
        - [ ] [TD1.2.1] NPX-based MCP servers
        - [ ] [TD1.2.2] Docker-based MCP servers
        
- [ ] [TD2] `meup space connect` - Interactive terminal UI
    - [ ] [TD2.1] Use MEUPClient for connection handling
    - [ ] [TD2.2] Implement chat interface
    - [ ] [TD2.3] Implement tool calling interface
    - [ ] [TD2.4] Show participant list and capabilities
    
- [ ] [TD3] Create `meup-agent` package
    - [ ] [TD3.1] Base agent class using sdk participant
    - [ ] [TD3.2] Agent templates for common patterns
    - [ ] [TD3.3] CLI for creating new agents from templates
