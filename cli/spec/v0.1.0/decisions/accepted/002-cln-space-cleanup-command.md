# ADR-cln: Space Cleanup Command

**Status:** Accepted
**Date:** 2025-01-07
**Incorporation:** Complete

## Context

During development and testing, spaces accumulate various artifacts:
- Process information in `.mew/` directory
- Log files in `logs/` directory
- FIFO pipes in `fifos/` directory
- PM2 daemon state (currently in default PM2_HOME)
- Potentially orphaned processes

Currently, cleanup is handled by:
- Manual `rm -rf` commands
- Test teardown scripts
- `mew space down` (only stops processes)

We need a formalized cleanup command that provides consistent, reliable cleanup of space artifacts while giving users control over what to preserve.

## Options Considered

### Option 1: Extend `mew space down` with cleanup flags

Add flags to the existing `down` command:
```bash
mew space down --clean        # Stop and clean everything
mew space down --clean-logs   # Stop and clean logs
mew space down --clean-all    # Stop and clean everything including PM2
```

**Pros:**
- Fewer commands to remember
- Natural extension of stopping a space
- One-step stop and clean

**Cons:**
- Conflates two different operations (stop vs clean)
- Can't clean without stopping
- Unclear what happens if space is already stopped

### Option 2: New `mew space clean` command

Create a dedicated cleanup command:
```bash
mew space clean              # Clean default artifacts (logs, fifos)
mew space clean --all        # Clean everything including .mew
mew space clean --logs-only  # Clean only logs
```

**Pros:**
- Clear separation of concerns
- Can clean without affecting running processes
- More flexible cleanup options
- Can be run independently

**Cons:**
- Additional command to learn
- Might clean while space is running (dangerous)

### Option 3: New `mew space reset` command

Reset implies both stopping and cleaning:
```bash
mew space reset              # Stop everything and clean
mew space reset --preserve-logs  # Stop and clean but keep logs
```

**Pros:**
- Clear intent: "start fresh"
- Single command for common use case
- Implies both stop and clean

**Cons:**
- Less flexible than separate commands
- Name might be confused with config reset

### Option 4: Multiple specific commands

```bash
mew space stop               # Just stop processes
mew space clean              # Just clean artifacts
mew space purge              # Nuclear option - clean everything
```

**Pros:**
- Maximum clarity and control
- Unix philosophy: do one thing well
- Composable commands

**Cons:**
- More commands to remember
- Requires multiple commands for common tasks

## Decision

Implement **Option 2: `mew space clean` command** with safety checks.

This provides the best balance of flexibility and safety while maintaining clear separation of concerns.

### Implementation Details

#### Command Structure
```bash
mew space clean [options]

Options:
  --all                 Clean everything including .mew directory
  --logs                Clean only log files
  --fifos               Clean only FIFO pipes
  --force               Skip confirmation prompts
  --dry-run             Show what would be cleaned without doing it
```

#### Default Behavior (no flags)
- Clean logs/* (except current session if running)
- Clean fifos/*
- Clean temporary files
- Preserve .mew/ directory (contains state)

#### Safety Checks
1. **Running Space Detection**
   - Warn if space is currently running
   - Require `--force` to clean running space artifacts
   - Never clean active FIFO pipes

2. **Confirmation Prompts**
   ```
   Warning: Space is currently running!
   This will clean: logs (42 files), fifos (2 pipes)
   Continue? (y/N)
   ```

3. **Preserve Important Files**
   - Keep .mew/pids.json if space is running
   - Option to preserve recent logs (--keep-recent)
   - Never delete space.yaml or agent files

#### What Gets Cleaned

**Default (`mew space clean`):**
- `logs/*.log` - All log files
- `fifos/*` - All FIFO pipes (if not in use)
- Temporary response files
- Old PM2 logs in .mew/pm2/logs/

**With `--all`:**
- Everything from default
- `.mew/` directory entirely
- PM2 daemon for this space (if using space-local PM2)

**With `--logs`:**
- Only files in `logs/` directory

**With `--fifos`:**
- Only pipes in `fifos/` directory

#### Integration with Other Commands

```bash
# Common workflow
mew space down          # Stop the space
mew space clean         # Clean artifacts
mew space up            # Start fresh

# Or more aggressive
mew space down
mew space clean --all   # Complete cleanup

# During development
mew space clean --logs  # Just clear logs while running
```

## Consequences

### Positive
- Consistent cleanup across all environments
- Safety checks prevent accidental data loss
- Flexible options for different needs
- Clear separation from stop/down operations
- Useful for CI/CD pipelines
- Reduces disk usage from accumulated logs

### Negative
- Additional command to document and maintain
- Risk of cleaning active artifacts if used incorrectly
- Need to educate users on when to use clean vs down

### Future Enhancements

1. **Auto-cleanup policies**
   ```yaml
   # In space.yaml
   cleanup:
     auto_clean_logs: true
     max_log_age: 7d
     max_log_size: 100M
   ```

2. **Scheduled cleanup**
   - Clean old logs automatically
   - Rotate logs based on size/age

3. **Selective preservation**
   ```bash
   mew space clean --keep-errors  # Keep error logs
   mew space clean --keep-recent   # Keep last hour of logs
   ```

## Examples

### Development Workflow
```bash
# After debugging session
mew space clean --logs     # Clear cluttered logs

# Before running tests
mew space clean --all      # Start completely fresh

# CI/CD cleanup
mew space down
mew space clean --all --force  # No prompts
```

### Safety Examples
```bash
$ mew space clean
Space "my-space" is currently running.
Warning: This will clean logs and fifos while space is active.
Use 'mew space down' first, or use --force to proceed anyway.

$ mew space clean --dry-run
Would clean:
  - 47 log files (230 MB)
  - 2 FIFO pipes (inactive)
  - 3 temporary files
Total: 230 MB would be freed

$ mew space clean --all
This will remove ALL space artifacts including configuration.
Are you sure? (y/N): n
Aborted.
```

## Testing Requirements

1. Test cleaning with running space (should warn)
2. Test cleaning with stopped space (should succeed)
3. Test --dry-run shows correct files
4. Test --force skips confirmations
5. Test partial cleaning (--logs, --fifos)
6. Test preservation of important files
7. Test with space-local PM2 cleanup