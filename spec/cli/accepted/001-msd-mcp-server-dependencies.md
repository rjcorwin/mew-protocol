# ADR-msd: MCP Server Dependencies Management

**Status:** Accepted
**Date:** 2025-01-14
**Incorporation:** Complete

## Context

When users run `mew init` to set up a new MEW space, the templates often require MCP servers (like `@modelcontextprotocol/server-filesystem`) to provide tools and resources to agents. Currently, users would need to:

1. Run `mew init` to create space.yaml
2. Manually install MCP server dependencies
3. Configure paths and commands correctly
4. Deal with version compatibility issues

This creates friction in the onboarding experience. Users should be able to run `mew init`, pick a template, and have everything "just work" without manual dependency management.

### Current Pain Points

- MCP servers are npm packages that need to be installed
- Different templates may require different MCP servers
- Version compatibility between MEW protocol and MCP servers
- Path resolution for locally vs globally installed packages
- Users may not have npm/node experience

## Options Considered

### Option 1: Bundle Common MCP Servers with CLI

Bundle the most common MCP servers directly with the MEW CLI package.

**Pros:**
- Zero additional installation steps
- Guaranteed version compatibility
- Works offline after initial CLI install
- Simple and predictable

**Cons:**
- Increases CLI package size significantly
- May bundle unused servers
- Harder to update individual servers
- Licensing/distribution complexities

### Option 2: Auto-Install During Init

Automatically install required MCP servers when running `mew init`.

**Pros:**
- Only installs what's needed
- Keeps CLI package small
- Easy to update servers independently
- Clear dependency tracking

**Cons:**
- Requires network access during init
- Adds time to initialization
- Potential npm install failures
- Need to handle different package managers

### Option 3: Docker/Container-Based Approach

Run MCP servers in containers managed by the CLI.

**Pros:**
- Complete isolation
- No local dependency conflicts
- Consistent environment
- Easy cleanup

**Cons:**
- Requires Docker installation
- Significant complexity increase
- Performance overhead
- Not beginner-friendly

### Option 4: Isolated MEW Dependencies Directory

Create a `.mew` directory with its own package.json and node_modules, keeping MEW/MCP dependencies completely separate from the project.

**Pros:**
- Complete separation of concerns (project vs MEW infrastructure)
- No pollution of project's package.json
- Works for non-Node.js projects (Python, Ruby, etc.)
- Easy cleanup (just delete .mew directory)
- Can have different Node version requirements
- Clear boundary between project and tooling

**Cons:**
- Duplicate node_modules if project also uses Node.js
- Need to manage separate dependency tree
- Slightly more complex path resolution
- Users might be confused by multiple package.json files

### Option 5: Hybrid Approach with Smart Defaults

Combine auto-installation with intelligent detection and fallbacks.

**Pros:**
- Best of both worlds
- Graceful degradation
- User choice when needed
- Progressive enhancement

**Cons:**
- More complex implementation
- Multiple code paths to maintain

## Decision

We choose **Option 4: Isolated MEW Dependencies Directory** combined with smart defaults from Option 5.

The CLI will create a `.mew` directory that acts as an isolated environment for all MEW-related dependencies, keeping them completely separate from the project's dependencies. This approach respects the separation of concerns between the project (what you're building) and the MEW space (the AI tooling helping you build).

The implementation will follow these phases:

1. **Isolation Phase**: Create `.mew` directory with its own package.json
2. **Detection Phase**: Check for existing MCP servers in .mew/node_modules
3. **Prompt Phase**: Ask user preference if not found
4. **Installation Phase**: Install into .mew/node_modules
5. **Configuration Phase**: Set up paths correctly

### Implementation Details

#### 1. Directory Structure

The `.mew` directory will contain all MEW-related dependencies:

```
project-directory/
├── .mew/                      # MEW infrastructure directory
│   ├── package.json          # MEW dependencies only
│   ├── node_modules/         # Isolated node_modules
│   ├── agents/               # Agent scripts (copied from template)
│   │   └── assistant.js      # Main agent implementation
│   ├── pm2/                  # PM2 daemon (existing)
│   └── pids.json            # Space metadata (existing)
├── space.yaml               # Space configuration
├── package.json            # Project's own package.json (if any)
└── src/                    # Project files
```

#### 2. Initialize MEW Directory

When `mew init` runs, it first sets up the isolated environment:

```javascript
async function initializeMewDirectory() {
  // Create .mew directory
  await fs.mkdir('.mew', { recursive: true });

  // Create package.json for MEW dependencies
  const mewPackageJson = {
    name: "mew-space-dependencies",
    version: "1.0.0",
    private: true,
    description: "Dependencies for MEW space (AI tooling)",
    dependencies: {}
  };

  await fs.writeFile('.mew/package.json', JSON.stringify(mewPackageJson, null, 2));

  // Add .mew/node_modules to .gitignore if it exists
  await addToGitignore('.mew/node_modules');
}
```

#### 3. MCP Server Detection

Check for MCP servers in the isolated directory first:

```javascript
async function detectMCPServer(serverName) {
  // Check locations in order:
  // 1. MEW's isolated node_modules (preferred)
  // 2. Global npm packages (fallback)
  // 3. System PATH (for standalone binaries)

  const locations = [
    `./.mew/node_modules/${serverName}`,
    `./.mew/node_modules/.bin/${serverName}`,
    await getGlobalNpmPath(serverName),
    `/usr/local/lib/node_modules/${serverName}`,
    await which(serverName)
  ];

  for (const location of locations) {
    if (await exists(location)) {
      return { found: true, path: location };
    }
  }

  return { found: false };
}
```

#### 4. User Prompt for Missing Dependencies

```typescript
interface InstallStrategy {
  method: 'mew' | 'global' | 'skip' | 'path';
  customPath?: string;
}

async function promptForMCPServer(serverName: string): Promise<InstallStrategy> {
  console.log(`Template requires MCP server: ${serverName}`);

  const choice = await prompt({
    type: 'select',
    message: 'How would you like to install it?',
    choices: [
      { title: 'Install in .mew directory (recommended)', value: 'mew' },
      { title: 'Use global installation', value: 'global' },
      { title: 'I\'ll install it myself', value: 'skip' },
      { title: 'It\'s already installed at...', value: 'path' }
    ]
  });

  if (choice === 'path') {
    const customPath = await prompt({
      type: 'text',
      message: 'Enter the path to the MCP server:'
    });
    return { method: 'path', customPath };
  }

  return { method: choice };
}
```

#### 5. Automatic Installation

```javascript
async function installMCPServer(serverName, strategy) {
  const packageManager = await getPackageManager();

  switch (strategy.method) {
    case 'mew':
      console.log(`Installing ${serverName} in .mew directory...`);

      // Change to .mew directory for installation
      const originalDir = process.cwd();
      process.chdir('.mew');

      try {
        await exec(`${packageManager} add ${serverName}`);

        // Update .mew/package.json dependencies
        const pkgJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        pkgJson.dependencies[serverName] = '*'; // Or specific version
        await fs.writeFile('package.json', JSON.stringify(pkgJson, null, 2));
      } finally {
        process.chdir(originalDir);
      }

      return `./.mew/node_modules/.bin/${serverName}`;

    case 'global':
      console.log(`Using global ${serverName}...`);
      return serverName; // Assumes it's in PATH

    case 'path':
      return strategy.customPath;

    case 'skip':
      console.warn('Remember to install the MCP server before running the space');
      return serverName; // Use bare name, user will handle it
  }
}
```

#### 6. Template Metadata Enhancement

Templates will declare their MCP server dependencies:

```json
{
  "name": "coder-agent",
  "description": "Development workspace with AI coding assistant",
  "mcp_servers": [
    {
      "name": "@modelcontextprotocol/server-filesystem",
      "command": "node",
      "args": [".mew/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js", "./"],
      "required": true,
      "install_hint": "Provides file system access for the coding agent"
    }
  ],
  "agent_dependencies": [
    "@mew-protocol/agent",
    "openai"
  ]
}
```

#### 7. Space.yaml Generation

The generated space.yaml will use the resolved paths:

```yaml
participants:
  filesystem-server:
    command: "node"
    args: ["./.mew/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js", "./"]
    auto_start: true
    type: mcp_server
    capabilities:
      - kind: "mcp/response"

  assistant:
    command: "node"
    args: ["./.mew/agents/assistant.js"]
    auto_start: true
    env:
      NODE_PATH: "./.mew/node_modules"
    capabilities:
      - kind: "mcp/request"
      - kind: "chat"
```

#### 8. First-Run Experience

```bash
$ cd my-python-project  # Note: Could be any project type
$ mew init

Welcome to MEW Protocol! Let's set up your space.

? Choose a template: coder-agent

Setting up isolated MEW environment...
✓ Created .mew directory
✓ Initialized .mew/package.json

Checking MCP servers...
✗ @modelcontextprotocol/server-filesystem not found

This template needs the filesystem MCP server to provide file access.
? How would you like to install it? › Install in .mew directory (recommended)

Installing in .mew directory (keeping your project clean)...
✓ Installed @modelcontextprotocol/server-filesystem
✓ Installed @mew-protocol/agent dependencies

? Space name: (my-python-project)
? AI model: (gpt-4)

✓ Created space.yaml
✓ Configured isolated dependencies
✓ Updated .gitignore

Ready! Your project remains untouched.
MEW dependencies are isolated in .mew/

Try: mew space up -i
```

#### 9. Subsequent Runs

Once installed, subsequent `mew` commands detect the installed servers:

```bash
$ mew space up
✓ Found MCP servers in .mew/node_modules
✓ Starting space...
```

### Package Manager Detection

The CLI will use npm for the isolated .mew directory by default, but can detect the user's preference:

```javascript
async function getPackageManager() {
  // For .mew directory, we control the package manager
  // Use npm by default for simplicity and compatibility

  // But we can check user's preference from their project
  if (await exists('../pnpm-lock.yaml')) return 'pnpm';
  if (await exists('../yarn.lock')) return 'yarn';
  if (await exists('../bun.lockb')) return 'bun';

  // Default to npm for .mew directory
  return 'npm';
}
```

### .gitignore Management

The CLI will automatically update .gitignore to exclude MEW artifacts:

```javascript
async function updateGitignore() {
  const gitignorePath = './.gitignore';
  const mewIgnores = [
    '.mew/node_modules/',
    '.mew/pm2/',
    '.mew/*.log',
    '.mew/pids.json'
  ];

  if (await exists(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf8');
    const newIgnores = mewIgnores.filter(ig => !content.includes(ig));

    if (newIgnores.length > 0) {
      await fs.appendFile(gitignorePath, '\n# MEW Protocol\n' + newIgnores.join('\n') + '\n');
    }
  }
}
```

### Error Handling

- Network failures during installation: Provide manual installation instructions
- Permission errors: Suggest using different installation method
- Version conflicts: Warn and provide resolution options
- Missing Node.js: Provide installation instructions for the platform

## Consequences

### Positive

- **Clean separation**: Project dependencies remain completely separate from MEW tooling
- **Language agnostic**: Works with Python, Ruby, Go, or any other project type
- **Easy cleanup**: Just delete .mew directory to remove all MEW dependencies
- **No pollution**: Project's package.json (if any) remains untouched
- **Smooth onboarding**: Users can go from zero to running space quickly
- **Clear boundaries**: Obvious what belongs to MEW vs the project
- **Git-friendly**: Easy to gitignore all MEW artifacts
- **Reproducible**: .mew/package.json tracks exact dependencies

### Negative

- **Disk space**: Duplicate node_modules if project also uses Node.js
- **Complexity**: Need to manage paths to .mew directory
- **Learning curve**: Users might be confused by multiple package.json files
- **Network dependency**: Online access needed for first-time setup
- **Platform differences**: Path separators and npm behavior varies across OS
- **Version management**: Need to track compatible MCP server versions

### Migration Path

For existing spaces without MCP server configuration:
1. Detect missing server configuration on `mew space up`
2. Prompt to install missing servers
3. Update space.yaml with resolved paths
4. Continue normal startup

### Future Enhancements

1. **Bundled servers**: Include most common MCP servers in CLI package
2. **Server registry**: Maintain a curated list of compatible MCP servers
3. **Version pinning**: Lock MCP server versions per MEW protocol version
4. **Offline mode**: Cache servers for offline installation
5. **Update mechanism**: `mew update-servers` command to update all MCP servers

## Summary

The key insight is that **MEW is tooling for your project, not part of your project**. By isolating all MEW dependencies in a `.mew` directory with its own package.json and node_modules, we achieve:

1. **Zero pollution** of the project's dependencies
2. **Language agnostic** - works with any project type (Python, Ruby, Go, etc.)
3. **Clear boundaries** - obvious what's MEW tooling vs project code
4. **Easy cleanup** - just delete .mew to remove all traces

This approach treats MEW like other development tools (e.g., .vscode for VS Code settings, .idea for IntelliJ) - configuration and tooling that helps you work on the project but isn't part of the project itself.

## References

- [MCP Specification](https://modelcontextprotocol.org)
- [npm package installation](https://docs.npmjs.com/cli/v9/commands/npm-install)
- [Node.js module resolution](https://nodejs.org/api/modules.html#modules_all_together)