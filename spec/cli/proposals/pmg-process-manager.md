# ADR-pmg: Process Manager for MEW CLI

**Status:** Accepted
**Date:** 2025-01-07
**Incorporation:** Complete

## Context

The MEW CLI needs to manage long-running processes (gateway, agents, clients) as part of the `mew space up/down` commands. Currently, when spawning the gateway process using Node.js `child_process.spawn()` with `detached: true` and `unref()`, the gateway process dies immediately, even though it stays alive when run directly.

Investigation has revealed:
- The gateway works perfectly when run directly via command line
- The gateway dies when spawned by `mew space up`, regardless of stdio configuration
- Various attempts to keep the process alive (setInterval, never-resolving promises) have failed
- The issue appears to be related to process group management and signal handling when the parent process exits

This is blocking automated testing and making the space management commands unreliable.

## Options Considered

### Option 1: Continue with child_process.spawn() Workarounds

Continue trying to fix the current approach with various spawn configurations and keep-alive mechanisms.

**Pros:**
- No new dependencies
- Direct control over process spawning
- Simpler conceptual model

**Cons:**
- Current approach has proven unreliable despite multiple attempts
- Platform-specific behaviors are difficult to handle
- Process lifecycle management is complex and error-prone
- No built-in process monitoring or restart capabilities

### Option 2: Implement a Lightweight Process Manager

Create an internal process manager service that runs as a daemon and manages all MEW processes.

**Pros:**
- Full control over process lifecycle
- Can implement monitoring, restart, and health checks
- Consistent behavior across platforms
- Enables advanced features (auto-restart, resource limits)
- Provides a clean separation between CLI commands and process management

**Cons:**
- **Would face the same core spawning issues as Option 1**
- If we can't reliably spawn a gateway, we likely can't reliably spawn a daemon
- Requires implementing a daemon service
- More complex architecture
- Need to handle daemon lifecycle (start/stop/status)
- Additional code to maintain
- Significantly more complex than fixing the root cause

### Option 3: Use PM2 as External Dependency

Integrate with PM2, a production-ready process manager for Node.js applications.

**Pros:**
- Battle-tested process management
- Built-in monitoring and logging
- Automatic restart capabilities
- Ecosystem support and documentation
- Handles all edge cases

**Cons:**
- External dependency
- Might be overkill for simple use cases
- Users need to understand PM2 concepts
- Potential version conflicts with user's PM2 installation

### Option 4: Hybrid Approach - Optional Process Manager

Support both direct spawning and process manager, with the manager being optional but recommended.

**Pros:**
- Flexibility for different use cases
- Simple mode for development/testing
- Production mode with full process management
- Gradual migration path

**Cons:**
- Two code paths to maintain
- Potential for inconsistent behavior
- More complex documentation

### Option 5: Alternative Process Managers

Other Node.js process managers were considered:

**forever/forever-monitor** (~5MB):
- Pro: Much lighter weight, simple programmatic API
- Con: Less active maintenance, fewer features

**execa** (1MB):
- Pro: Minimal, excellent API, well-maintained
- Con: Just a spawner, would need custom process management

**node-pty**:
- Pro: Proper PTY handling might solve spawning issues
- Con: Native dependencies, compilation required

**Evaluation**: PM2 remains the best choice despite its size (30MB) due to:
- Battle-tested reliability with millions of downloads
- Programmatic API with PM2_HOME for complete isolation
- Active maintenance and extensive documentation
- Handles edge cases we haven't discovered yet

## Decision

Implement **Option 3: Use PM2 as External Dependency** as the sole solution.

Rationale: PM2 is a battle-tested solution that already solves all the process management challenges we're facing. Rather than reinventing the wheel with Option 2 (which would likely hit the same issues), or maintaining parallel implementations, we should fully commit to leveraging existing, proven technology.

### Implementation Details

1. **PM2 as Embedded Library**
   ```javascript
   // PM2 installed as dependency, used programmatically
   const pm2 = require('pm2');
   
   // Each space gets its own PM2 daemon instance
   // PM2_HOME set to space directory to keep everything local
   process.env.PM2_HOME = path.join(spaceDir, '.mew/pm2');
   
   // Connect to space-specific PM2 daemon
   pm2.connect((err) => {
     // Start processes for this space only
   });
   ```

2. **Space-Contained Process Management**
   - Each space has its own `.mew/pm2/` directory
   - PM2 daemon, logs, and PIDs all contained within space folder
   - No global PM2 installation or configuration required
   - Users don't need to know PM2 is being used
   - Complete isolation between spaces

3. **Architecture**
   ```
   CLI Command → PM2 Library → Space-local PM2 Daemon → Spawned Process
                      ↓
              .mew/pm2/ (local to space directory)
                 ├── pm2.log
                 ├── pm2.pid
                 └── pids/
   ```

4. **Process Configuration**
   ```javascript
   // Programmatic PM2 configuration (no ecosystem file needed)
   pm2.start({
     name: `${spaceId}-gateway`,
     script: path.resolve(__dirname, '../bin/mew.js'),
     args: ['gateway', 'start', '--port', port],
     cwd: spaceDir,
     autorestart: false,  // We handle restart logic
     max_memory_restart: '500M',
     error_file: path.join(spaceDir, 'logs/gateway-error.log'),
     out_file: path.join(spaceDir, 'logs/gateway-out.log'),
     pid_file: path.join(spaceDir, '.mew/pm2/pids/gateway.pid')
   }, callback);
   ```

5. **No Fallback Mode**
   
   **Decision: PM2 will be a required dependency**
   
   Rationale for not having a `--no-pm2` option:
   - Would create a parallel implementation that defeats the purpose
   - We'd still have to solve the same spawning problems for the fallback
   - Maintaining two implementations doubles testing and support burden
   - Users would inevitably use the fallback and hit the same issues we're trying to avoid
   - PM2 is a reasonable dependency (like how many CLIs depend on git, docker, etc.)
   
   Benefits of PM2-only approach:
   - Single, reliable implementation
   - Consistent behavior for all users
   - PM2's maturity solves current and future process management needs
   - Clear documentation and support path
   - Can leverage PM2's full feature set without worrying about fallback compatibility

## Consequences

### Positive
- Immediately solves the process lifecycle issue
- Battle-tested solution used in production environments
- Rich feature set (monitoring, logging, auto-restart, clustering)
- Complete isolation - each space is self-contained
- No global state or configuration
- Users don't need to know PM2 exists
- Can run multiple spaces simultaneously without conflicts
- All artifacts stay within space directory (logs, PIDs, etc.)
- Handles all edge cases we haven't even discovered yet

### Negative
- External dependency (but a mature, stable one)
- Adds ~30MB to installation size
- PM2 daemon overhead per space (minimal, but exists)
- Need to ensure PM2 daemon cleanup on space down
- Slightly more complex than direct spawning (but more reliable)

### Migration Path

1. **Phase 1**: Add PM2 as npm dependency, implement space-local daemon
2. **Phase 2**: Update `mew space up` to use PM2 API with PM2_HOME isolation
3. **Phase 3**: Update `mew space down` to cleanly shutdown PM2 daemon
4. **Phase 4**: Add `mew space logs` and `mew space restart` commands leveraging PM2

### Testing Strategy

- Integration tests with PM2 API
- Test ecosystem file generation from various space.yaml configurations
- Verify process lifecycle (start, stop, restart)
- Test fallback mode without PM2
- Platform-specific tests (macOS, Linux, Windows)
- Test PM2 namespace isolation to avoid conflicts

### Security Considerations

- PM2 runs with user privileges only
- No elevation of privileges
- Process isolation through PM2 namespaces
- Each space gets unique PM2 app names to prevent conflicts
- Token validation remains at gateway level