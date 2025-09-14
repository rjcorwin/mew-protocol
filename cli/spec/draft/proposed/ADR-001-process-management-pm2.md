# ADR-001: PM2-Based Process Management for Space Components

## Status
Proposed

## Context

The CLI specification describes a space as consisting of multiple components (gateway, agents, clients) that need to be managed as a cohesive unit. The implementation needs to:

1. Start/stop multiple processes reliably
2. Manage process lifecycles independently
3. Survive parent CLI process exit (detached mode)
4. Provide process monitoring and restart capabilities
5. Handle space isolation (multiple spaces on same machine)
6. Maintain process state across CLI invocations

The current implementation uses PM2 as an embedded library for process management, while the specification is largely silent on implementation details.

## Decision

We will use **PM2 as an embedded library** (not global tool) for process management with space-local isolation.

### Key Design Decisions:

1. **PM2 as Library**: Use `require('pm2')` programmatically, not global CLI commands
2. **Space Isolation**: Each space uses its own PM2 daemon in `.mew/pm2/` 
3. **Process Naming**: Prefix all process names with `${spaceId}-` for uniqueness
4. **Configuration**: Store PM2 config alongside space config, not in global PM2 registry
5. **Lifecycle Management**: CLI manages PM2 daemon lifecycle per space

### Architecture:
```
space-directory/
├── space.yaml           # Space configuration
├── .mew/               
│   ├── pm2/            # PM2 daemon for this space only
│   │   ├── pm2.log     # PM2 daemon logs
│   │   ├── pm2.pid     # Daemon process ID
│   │   └── pids/       # Managed process PIDs
│   └── pids.json       # Space metadata
├── logs/               # Process output logs
│   ├── gateway.log
│   └── agent-*.log
└── fifos/              # FIFO pipes if configured
```

## Rationale

### Advantages of PM2 Approach:
1. **Reliability**: PM2 handles process crashes, restarts, and monitoring
2. **Detached Operation**: Processes survive parent CLI exit
3. **Resource Management**: Memory limits, CPU monitoring
4. **Log Management**: Automatic log rotation and timestamping
5. **Mature**: Battle-tested in production environments
6. **Cross-Platform**: Works on Windows, macOS, Linux

### Space Isolation Benefits:
1. **No Global State**: Multiple spaces can run simultaneously without conflict
2. **Clean Shutdown**: Stopping one space doesn't affect others
3. **Resource Attribution**: Each space's resource usage is isolated
4. **Configuration Isolation**: Space-specific PM2 settings

### Alternative Approaches Considered:

#### Native Child Process Management
- **Pros**: Simpler, no external dependencies, lighter weight
- **Cons**: Complex PID tracking, manual restart logic, no resource monitoring

#### Docker/Containers
- **Pros**: Better isolation, resource limits
- **Cons**: Adds complexity, requires Docker, overkill for local development

#### systemd/launchd Native Services
- **Pros**: OS-native, reliable
- **Cons**: Platform-specific, requires admin rights, complex for temporary spaces

## Implementation Details

### PM2 Configuration Per Process:
```javascript
const processConfig = {
  name: `${spaceId}-gateway`,           // Unique per space
  script: path.join(__dirname, '../../bin/mew.js'),
  args: ['gateway', 'start', '--port', port],
  cwd: spaceDir,
  autorestart: false,                   // CLI controls restart policy
  max_memory_restart: '500M',
  error_file: path.join(logsDir, 'gateway-error.log'),
  out_file: path.join(logsDir, 'gateway.log'),
  merge_logs: true,
  time: true
};
```

### Daemon Management:
```javascript
// Each space gets isolated PM2 daemon
process.env.PM2_HOME = path.join(spaceDir, '.mew/pm2');

// Connect to space-specific daemon
pm2.connect((err) => {
  // All operations are space-local
});
```

### Process Discovery:
```javascript
// List only processes for this space
const processes = await listPM2Processes();
const spaceProcesses = processes.filter(p => 
  p.name && p.name.startsWith(`${spaceId}-`)
);
```

## Consequences

### Positive:
- **Robust Process Management**: Handles edge cases (crashes, resource limits)
- **Operational Excellence**: Built-in monitoring, logging, health checks
- **Developer Experience**: Consistent `mew space up/down/status` commands
- **Production Ready**: PM2 is proven in production environments

### Negative:
- **Dependency Weight**: Adds ~50MB to CLI package
- **Complexity**: Additional abstraction layer to understand
- **Debug Overhead**: PM2 logs add another layer when debugging
- **Platform Coupling**: Tied to Node.js ecosystem

### Risks:
- **PM2 Bugs**: Issues in PM2 affect CLI reliability
- **Version Conflicts**: PM2 version updates might break compatibility
- **Resource Usage**: PM2 daemon per space consumes memory
- **Learning Curve**: Developers need to understand PM2 behavior for debugging

## Monitoring and Observability

The PM2 approach provides:
- Process health monitoring
- Memory/CPU usage tracking  
- Automatic log file management
- Process restart statistics
- Real-time status reporting via `mew space status`

## Migration Path

This decision affects:
1. **Package Dependencies**: PM2 must be bundled with CLI
2. **Documentation**: Need PM2-specific troubleshooting guides
3. **Testing**: Test suites must account for PM2 process lifecycle
4. **CI/CD**: Build systems need PM2 cleanup procedures

## Status Tracking

- [ ] Update package.json dependencies
- [ ] Document PM2 troubleshooting in README
- [ ] Add PM2 cleanup to test teardown
- [ ] Create monitoring dashboards for PM2 processes