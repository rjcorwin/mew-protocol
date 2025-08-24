# Changelog

All notable changes to @mcpx-protocol/cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-08-24

### Fixed
- Fixed critical connection error "TypeError: this.client.on is not a function"
- Updated both cli.ts and cli-blessed.ts to use correct MCPxClient API methods
  - Changed `client.on('welcome')` to `client.onWelcome()`
  - Changed `client.on('chat')` to `client.onChat()`
  - Changed `client.on('peer-joined')` to `client.onPeerJoined()`
  - Changed `client.on('peer-left')` to `client.onPeerLeft()`
  - Changed `client.on('message')` to `client.onMessage()`
  - Changed `client.on('error')` to `client.onError()`
  - Changed `client.on('disconnected')` to `client.onDisconnected()`
  - Changed `client.on('reconnected')` to `client.onReconnected()`

### Added
- Basic test suite using Vitest
- Test coverage for MCPxClient API usage

## [0.1.0] - 2025-08-23

### Initial Release
- Interactive CLI chat client for MCPx protocol
- Two interfaces: blessed TUI and simple readline
- FIFO bridge support for automation
- Connection management with saved configurations
- MCP tool discovery and invocation
- Debug mode for protocol inspection
- Command history and auto-completion