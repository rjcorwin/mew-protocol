# CLI Specification Changelog

## [v0.1.0] - 2025-01-10

### Added
- Interactive connection features via `mew space up --interactive` and `mew space connect` commands (ADR-004)
- Smart input detection terminal UI for protocol debugging (ADR-005)
- PM2-based process management with space-local isolation (ADR-001)
- `mew space clean` command for artifact cleanup (ADR-002)
- FIFO input with log output option for non-blocking automation (ADR-003)

### Changed
- Updated all references from MEUP to MEW protocol
- Updated protocol version from v0.2 to v0.4
- Enhanced participant resolution with multiple fallback strategies

### Features
- **Interactive Connection**: Start and connect immediately with `mew space up -i` or connect to running spaces with `mew space connect`
- **Terminal UI**: Smart input detection handles commands, JSON, and plain text naturally
- **Process Management**: Reliable PM2-based process management with complete space isolation
- **Space Cleanup**: Safe cleanup of logs, FIFOs, and space artifacts
- **Flexible I/O**: Support for both interactive terminal and FIFO-based automation

## [v0.0.0] - 2025-01-05

### Initial Release
- Basic gateway, client, and space management commands
- FIFO support for test automation
- Space configuration via space.yaml
- Token-based authentication
- Capability-based authorization