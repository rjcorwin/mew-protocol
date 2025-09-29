# Bug Report: NPX Cache Corruption When Starting Spaces

## Summary
Users installing `@mew-protocol/cli` and running `mew init coder-agent` followed by `mew space up` encounter npm cache corruption errors that prevent the agent from starting.

## Symptoms
When running `mew space up` after a fresh install, the coder-agent fails to start with these errors:
```
npm error code ENOTEMPTY
npm error syscall rmdir
npm error path /Users/rj/.npm/_npx/87e4939a35b417b5/node_modules/@mew-protocol/mew/capability-matcher/dist
npm error errno -66
npm error ENOTEMPTY: directory not empty, rmdir '/Users/rj/.npm/_npx/87e4939a35b417b5/node_modules/@mew-protocol/mew/capability-matcher/dist'
```

Followed by:
```
sh: mew-agent: command not found
```

## Root Cause
The issue occurs when:
1. PM2 runs `npx @mew-protocol/mew/agent` to start the coder-agent
2. NPX attempts to download and cache the package
3. The cache operation fails with ENOTEMPTY error, likely due to concurrent access or incomplete previous installation
4. The agent binary (`mew-agent`) is not properly installed/linked
5. The process fails to start

## Current Workaround
Users can fix this by clearing the npx cache:
```bash
# Clear the specific cache directory
rm -rf ~/.npm/_npx/87e4939a35b417b5

# Or clear all npx cache
rm -rf ~/.npm/_npx/*

# Then restart the space
mew space down
mew space up
```

## Partial Fix Applied
Updated the CLI templates (v0.1.2) to use `npx --yes` flag:
- **Before**: `npx @mew-protocol/mew/agent`
- **After**: `npx --yes @mew-protocol/mew/agent`

This helps by:
- Forcing npx to always download without prompting
- Being more aggressive about re-downloading packages
- Avoiding some cache conflicts

**Note**: This won't fix already corrupted caches - users still need to clear them manually once.

## Files Changed
- `/cli/templates/coder-agent/space.yaml` - Added `--yes` flag to npx commands
- `/cli/package.json` - Bumped version to 0.1.2

## Alternative Solutions to Consider
1. **Bundle dependencies**: Include agent and bridge packages as dependencies of the CLI
2. **Use global install**: Recommend users install packages globally first
3. **Pre-flight check**: Add a command that verifies/repairs npm cache before starting
4. **Direct execution**: Ship the agent as part of the CLI package instead of using npx

## Status
- Partial fix implemented with `npx --yes` flag
- CLI v0.1.2 ready to publish with this fix
- Users with existing cache corruption still need manual cleanup