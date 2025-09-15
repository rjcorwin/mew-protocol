# MEW CLI Specification - Minimal Test Implementation

**Version:** draft (for v0.2.0)  
**Status:** Draft  
**Last Updated:** 2025-01-10

## Overview

The MEW CLI (`@mew/cli`) provides minimal command-line tools needed to execute the test plan in `/tests/TEST_PLAN.md`. This is a focused implementation that prioritizes getting tests running.

## Scope

This specification covers:
- Space initialization with template system
- Gateway server with space configuration support
- Client connections with FIFO mode for automation
- Interactive space connection via terminal UI
- Capability management through space.yaml
- Process management for local agents

## Architecture

```
@mew/cli
├── Commands
│   ├── init.js       # Initialize new space from templates
│   ├── gateway.js    # Start gateway server
│   ├── client.js     # Connect as client (interactive or FIFO)
│   ├── space.js      # Space management (up/down/status)
│   └── token.js      # Generate test tokens
├── Templates         # Built-in space templates
│   ├── coder-agent/  # Development workspace with coding assistant
│   └── note-taker/   # Note-taking and organization assistant
├── SDK Dependencies
│   ├── @mew/gateway
│   ├── @mew/client
│   ├── @mew/agent
│   └── @mew/capability-matcher
└── External Dependencies
    ├── pm2               # Process manager (embedded library)
    ├── js-yaml           # Parse space.yaml config
    ├── commander         # CLI argument parsing
    ├── ws                # WebSocket client
    ├── ink               # React-based terminal UI (advanced mode)
    ├── react             # UI framework for Ink
    └── readline          # Simple terminal UI (debug mode)
```

## Commands

### `mew init`

Initializes a new MEW space in the current directory using predefined templates. This command provides a quick way to set up a working space configuration for common use cases. By default, creates the space configuration in `.mew/space.yaml` to keep the project root clean.

```bash
mew init [template] [options]

Arguments:
  template                   Space template to use (optional, prompts if not provided)

Options:
  --name <name>             Space name (default: current directory name)
  --description <desc>      Space description
  --port <port>             Gateway port (default: 8080)
  --force                   Overwrite existing space configuration
  --list-templates          Show available templates and exit
  --template-info <name>    Show details about a specific template
```

#### Template System

The init command uses a template-based approach to create space configurations for common patterns:

**Available Templates:**

1. **`coder-agent`** (default if no template specified)
   - Development workspace with AI coding assistant
   - File system and code execution tools
   - MCP request capabilities for the agent
   - Based on the `demos/coder-agent` pattern
   - Specialized prompt for code generation and debugging

2. **`note-taker`**
   - Meeting and conversation note-taking assistant
   - File system tools for saving and organizing notes
   - MCP request capabilities for structured note management
   - Similar structure to coder-agent but with note-taking prompt
   - Focuses on summarization and organization

#### Template Discovery

Templates are discovered from:
1. Built-in templates (in CLI package)
2. `~/.mew/templates/` (user templates)
3. `./templates/` (project-local templates)
4. URLs or Git repositories (future)

Each template directory contains:
- `space.yaml` - Template space configuration with placeholders
- `package.json` - Node.js dependencies for the space (MCP servers, agent libs)
- `agents/` - Agent scripts/configurations
- `README.md` - Template documentation and usage instructions
- `template.json` - Template metadata (name, description, variables)

**Example Template Structure:**
```
templates/coder-agent/
├── space.yaml          # Space configuration template
├── package.json        # Dependencies (copied to .mew/package.json)
├── template.json       # Template metadata and variables
├── README.md          # How to use this template
└── agents/
    └── assistant.js   # Main agent implementation
```

#### Template Metadata

```json
{
  "name": "coder-agent",
  "description": "Development workspace with AI coding assistant",
  "author": "MEW Protocol Team",
  "version": "1.0.0",
  "tags": ["development", "coding", "ai-assistant"],
  "variables": [
    {
      "name": "SPACE_NAME",
      "description": "Name of your space",
      "default": "${dirname}",
      "prompt": true  // Ask user during init
    },
    {
      "name": "AGENT_MODEL",
      "description": "AI model to use (e.g., gpt-5, claude-3-opus)",
      "default": "gpt-5",
      "prompt": true  // Ask user during init
    },
    {
      "name": "WORKSPACE_PATH",
      "description": "Path to workspace",
      "default": "./",
      "prompt": false  // Use default, don't ask
    },
    {
      "name": "AGENT_PROMPT",
      "description": "System prompt for the agent",
      "default": "You are a helpful coding assistant...",
      "prompt": false  // Template provides this, don't ask
    }
  ]
}
```

#### Interactive Flow

When run without arguments, `mew init` provides an interactive experience:

```bash
$ mew init

Welcome to MEW Protocol! Let's set up your space.

? Choose a template:
❯ coder-agent - AI coding assistant for development
  note-taker - AI assistant for note-taking and organization

Setting up isolated MEW environment...
✓ Created .mew directory
✓ Copied template files to .mew/

Installing dependencies...
✓ Running npm install in .mew/
✓ Dependencies installed

? Space name: (my-project)
? AI model: (gpt-5)

Checking environment...
✓ Found OPENAI_API_KEY in environment
✓ Using OPENAI_BASE_URL: https://api.openai.com/v1

✓ Created .mew/space.yaml
✓ Copied agent files to .mew/agents/
✓ Configured isolated dependencies
✓ Updated .gitignore

Ready! Your project root remains clean.
MEW configuration and dependencies are isolated in .mew/

Try: mew
```

#### Behavior Logic

The command follows this decision tree:

1. **No space configuration exists (checks .mew/space.yaml then space.yaml):**
   - If template specified: Use that template
   - If no template: Show template selection prompt
   - Create .mew/space.yaml from template

2. **Space configuration exists:**
   - If `--force`: Overwrite with template
   - Otherwise: Error "Space already initialized, use --force to overwrite"

3. **No arguments and no template:**
   - If only one template available: Use it automatically
   - Otherwise: Show interactive template selection

4. **Template not found:**
   - Show error with available templates
   - Suggest `--list-templates` for full list

#### Template Processing

Templates support variable substitution using mustache-style syntax. Both templates have similar structure but different agent configurations:

```yaml
# templates/coder-agent/space.yaml (template file)
space:
  id: "{{SPACE_NAME}}"
  name: "{{SPACE_NAME}}"
  description: "{{SPACE_DESCRIPTION}}"

participants:
  human:
    capabilities:
      - kind: "mcp/*"
      - kind: "chat"

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
      AGENT_MODEL: "{{AGENT_MODEL}}"  # Template variable, stored in space.yaml
      AGENT_PROMPT: "{{AGENT_PROMPT}}"  # Template-specific (coder vs note-taker)
      # API key and base URL come from environment at runtime
    capabilities:
      - kind: "mcp/request"
      - kind: "chat"
```

The key difference between `coder-agent` and `note-taker` templates is the `AGENT_PROMPT` variable:
- **coder-agent**: Focuses on code generation, debugging, and development tasks
- **note-taker**: Focuses on summarization, organization, and meeting notes

#### Variable Resolution

Template variables are resolved in order:

1. **Command-line options** - Override any variable (e.g., `--name my-space`)
2. **Interactive prompts** - Only if `prompt: true` in template.json
3. **Environment variables** - Check for matching env var
4. **Template defaults** - Use the default value from template.json
5. **System defaults** - Special variables like `${dirname}` for current directory

**Variable Prompting Logic:**
```javascript
for (const variable of template.variables) {
  if (variable.prompt) {
    // Ask user for this variable
    value = await prompt(variable.description, variable.default);
  } else {
    // Use default without prompting
    value = variable.default;
  }

  // Special resolution for ${...} syntax
  if (value.startsWith('${')) {
    value = resolveSpecialVariable(value);
  }
}
```

**Special Variables:**
- `${dirname}` - Current directory name
- `${username}` - System username
- `${date}` - Current date
- `${VARNAME}` - Environment variable lookup

#### Configuration Strategy

MEW uses a simple strategy for configuration:

**Template Variables (stored in space.yaml):**
- Space name
- Model name (e.g., "gpt-5", "claude-3-opus")
- Any other non-sensitive configuration

**Environment Variables (never stored):**
- `OPENAI_API_KEY` - Your API key
- `OPENAI_BASE_URL` - Provider endpoint (defaults to OpenAI)
- Any other sensitive or deployment-specific values

**During Init:**
1. Prompt for template variables (space name, model)
2. Substitute variables in template files
3. Save to `.mew/space.yaml`
4. Check for required environment variables
5. Warn if missing (but don't block init)

**At Runtime:**
```bash
# Agent gets configuration from both sources:
# From space.yaml: AGENT_MODEL="gpt-5"
# From environment: OPENAI_API_KEY, OPENAI_BASE_URL
```

**Common Provider Examples:**
```bash
# OpenAI GPT-5 (default)
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_API_KEY=sk-...
# Model in space.yaml: "gpt-5"

# OpenRouter with Claude
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_API_KEY=sk-or-...
# Model in space.yaml: "anthropic/claude-3-opus"

# Local model (LM Studio)
export OPENAI_BASE_URL=http://localhost:1234/v1
# No API key needed
# Model in space.yaml: "local-model"

# Override model at runtime (without editing space.yaml)
AGENT_MODEL_OVERRIDE=gpt-4-turbo mew
```

**Storage Options:**
```bash
# Option 1: Environment variables (recommended)
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
export OPENAI_API_KEY=sk-or-...
mew  # Agent reads from environment

# Option 2: .env file in .mew/ (gitignored)
cat > .mew/.env << EOF
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-...
EOF

# Option 3: Pass at runtime
OPENAI_BASE_URL=http://localhost:1234/v1 mew
```

**What Gets Saved in space.yaml:**
```yaml
participants:
  assistant:
    command: "node"
    args: ["./.mew/agents/assistant.js"]
    env:
      AGENT_MODEL: "gpt-5"  # Model name IS stored (not sensitive)
      # Base URL and API key NOT stored here
```

**What the Agent Actually Sees at Runtime:**
```javascript
// space.yaml provides:
process.env.AGENT_MODEL  // "gpt-5" from space.yaml

// Environment provides:
process.env.OPENAI_BASE_URL  // "https://openrouter.ai/api/v1" from shell
process.env.OPENAI_API_KEY   // "sk-or-..." from shell

// Agent can also override model if needed:
const model = process.env.AGENT_MODEL_OVERRIDE ||
              process.env.AGENT_MODEL ||
              'gpt-5';
```

**Agent Implementation:**
```javascript
// Agent reads configuration from environment
const baseUrl = process.env.OPENAI_BASE_URL ||
                process.env.AGENT_BASE_URL ||
                'https://api.openai.com/v1';
const apiKey = process.env.OPENAI_API_KEY || process.env.AGENT_API_KEY;

// For local models, API key might be optional
if (!apiKey && !baseUrl.includes('localhost')) {
  console.error('No API key found. Set OPENAI_API_KEY environment variable.');
  process.exit(1);
}

// Initialize client with provider-agnostic config
const client = new OpenAI({
  baseURL: baseUrl,
  apiKey: apiKey || 'not-needed',  // Some local models don't need keys
});
```

This approach ensures:
- API keys never appear in space.yaml
- Keys can be shared across spaces via environment
- Different deployment environments can use different keys
- Git never sees the actual keys

#### Dependency Management

The CLI isolates all MEW-related dependencies (MCP servers, agents, etc.) in a `.mew` directory, keeping them completely separate from the project's dependencies. Each template includes its own `package.json` that defines exactly what the space needs.

**Simple Flow:**
1. **Copy**: Template files → `.mew/` directory
2. **Install**: Run `npm install` in `.mew/`
3. **Done**: Everything ready to use

**Benefits:**
- Project's package.json (if any) remains untouched
- All MEW dependencies isolated in `.mew/node_modules/`
- Works with any project type (Python, Ruby, Go, etc.)
- Clean separation between project and tooling

**Example Template `package.json`:**
```json
{
  "name": "mew-space-{{SPACE_NAME}}",
  "version": "1.0.0",
  "private": true,
  "description": "Dependencies for MEW {{SPACE_NAME}} space",
  "dependencies": {
    "@modelcontextprotocol/server-filesystem": "^0.5.0",
    "@mew-protocol/agent": "^0.2.0",
    "openai": "^4.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

The package name uses the `{{SPACE_NAME}}` template variable to ensure unique workspace names when multiple spaces are created in the same project or monorepo. This prevents npm workspace conflicts.

#### Post-Initialization Actions

After creating the space configuration:

1. **Create .mew Directory**: Initialize `.mew/` directory structure
2. **Copy Template Files**:
   - `template/package.json` → `.mew/package.json` (with variable substitution)
   - `template/agents/*` → `.mew/agents/`
   - `template/space.yaml` → `.mew/space.yaml` (with variable substitution)
3. **Process Templates**: Replace all `{{VARIABLE}}` placeholders in:
   - `space.yaml` - Space configuration with participant settings
   - `package.json` - Ensures unique package names for npm workspaces
4. **Install Dependencies**: Run `npm install` in `.mew/` directory
5. **Git Integration**: Add `.mew/node_modules/`, `.mew/pm2/`, `.mew/logs/` to .gitignore
6. **File Permissions**: Set execute permissions on agent scripts
7. **Validation**: Verify the generated configuration and dependencies
8. **Auto-Continue**: After successful init, automatically run `mew space up -i` to start and connect
9. **Instructions**: Show that project root remains clean, everything MEW-related in `.mew/`

#### Examples

```bash
# Initialize with default template (basic)
mew init

# Initialize with specific template
mew init coder-agent

# Initialize with options
mew init coder-agent --name "my-project" --port 3000

# See available templates
mew init --list-templates

# Get info about a template
mew init --template-info coder-agent

# Force overwrite existing space
mew init test-automation --force

# Initialize in different directory
cd /path/to/project && mew init coder-agent
```

#### Integration with Other Commands

After initialization:
- `mew space up -i` starts the space and connects interactively
- `mew space status` shows if processes are running
- `mew space down` stops all processes
- All other space commands work with the initialized configuration

The init command creates a foundation that works seamlessly with the rest of the CLI ecosystem.

#### Default Command Behavior

When `mew` is run without any subcommand, it provides intelligent defaults:

```bash
$ mew
```

**Behavior:**
1. **No space configuration found** (neither `.mew/space.yaml` nor `space.yaml`):
   - Automatically runs `mew init` with interactive template selection
   - Creates configuration in `.mew/space.yaml` by default
   - After successful init, automatically continues to `mew space up -i`
2. **Space configuration exists but space not running**:
   - Automatically runs `mew space up -i` to start and connect interactively
3. **Space configuration exists and space is running**:
   - Automatically runs `mew space connect` to join the running space

This provides a streamlined experience:
- New users get guided setup and immediate connection when they first run `mew`
- Existing spaces start immediately when users run `mew`
- Running spaces get immediate connection without restarting
- No need to remember specific commands for common workflows

**Examples:**

```bash
# First time in a new directory
$ mew
Welcome to MEW Protocol! Let's set up your space.
? Choose a template: ...
# (runs init flow)
Space initialized! Starting and connecting...
# (automatically continues to space up -i)

# After init, space exists but not running
$ mew
Starting space and connecting interactively...
# (runs space up -i automatically)

# Space already running
$ mew
Connecting to running space...
# (runs space connect automatically)
```

This behavior can be overridden by explicitly providing a subcommand:
```bash
mew space up -d  # Start detached instead of interactive
mew init --force # Force re-initialization
```

### `mew gateway start`

Starts a gateway server. Automatically detects configuration in `.mew/space.yaml` or `space.yaml`.

```bash
mew gateway start [options]

Options:
  --port <port>          Port to listen on (default: 8080)
  --space-config <path>  Path to space.yaml (default: auto-detect)
  --log-level <level>    debug|info|warn|error (default: info)
```

**Example:**
```bash
mew gateway start --port 8080 --space-config ./space.yaml --log-level debug
```

### `mew client connect`

Connects to a gateway as a client. Supports interactive mode (default) or FIFO mode for automation.

```bash
mew client connect [options]

Options:
  --gateway <url>        WebSocket URL (required)
  --space <space>        Space to join (required)
  --token <token>        Authentication token
  --participant-id <id>  Participant ID
  --fifo-in <path>       Input FIFO for automation (optional)
  --fifo-out <path>      Output FIFO for automation (optional)
  --no-interactive       Disable interactive mode when using FIFOs
```

**Interactive Mode (default):**
- Uses readline-based terminal interface
- Plain text automatically becomes chat messages
- JSON envelopes can be sent for any message type
- Commands start with `/` (e.g., `/help`, `/exit`)
- See responses in real-time
- Press Ctrl+C to exit

**FIFO Mode (for automation):**
- Specify both --fifo-in and --fifo-out
- Send JSON messages to fifo-in
- Receive JSON messages from fifo-out
- Add --no-interactive to disable terminal input

**Examples:**
```bash
# Interactive mode (default)
mew client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant-id human-user

# FIFO mode for automation
mkfifo cli-in cli-out
mew client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant-id test-client \
  --fifo-in cli-in \
  --fifo-out cli-out \
  --no-interactive &

# @TODO Document curl example here for automation
```

## Running Agents

Agents are standalone executables that connect to the gateway. They are NOT started through the CLI but run directly or via space.yaml configuration.

### Direct Execution

```bash
# Run example agents directly
node ./agents/echo.js --gateway ws://localhost:8080 --token echo-token
node ./agents/calculator.js --gateway ws://localhost:8080 --space test-space
python ./my-custom-agent.py --gateway ws://localhost:8080

# Each agent handles its own argument parsing
```

### Via Space Configuration

Agents can be auto-started when the gateway starts:

```yaml
# space.yaml
participants:
  echo-agent:
    command: "node"
    args: ["./agents/echo.js", "--gateway", "ws://localhost:8080"]
    auto_start: true
    tokens: ["echo-token"]
```

### `mew token create`

Creates a simple test token.

```bash
mew token create [options]

Options:
  --participant-id <id>  Participant ID (required)
  --capabilities <json>  JSON array of capabilities (required)
```

**Example:**
```bash
mew token create \
  --participant-id echo-agent \
  --capabilities '[{"kind":"chat"}]'
```


## FIFO Message Format

Messages sent to/from FIFOs use MEW v0.3 protocol format.

**Input (to fifo-in):**
Simplified format - CLI adds protocol envelope fields:
```json
{
  "kind": "chat",
  "payload": {
    "text": "Hello world"
  }
}
```

**Output (from fifo-out):**
Full MEW v0.3 envelope:
```json
{
  "protocol": "mew/v0.3",
  "id": "msg-123",
  "ts": "2025-01-05T12:00:00Z",
  "from": "other-agent",
  "kind": "chat",
  "payload": {
    "text": "Response"
  }
}
```

## Test Execution Flow

The test plan uses the CLI as follows:

1. **Start Gateway (with space config):**
   ```bash
   mew gateway start --port 8080 --space-config ./space.yaml > gateway.log 2>&1 &
   ```

2. **Start Agents (if not auto-started):**
   ```bash
   # Agents are separate programs, not part of CLI
   # Example: node ./tests/agents/echo.js --gateway ws://localhost:8080 &
   # Or define in space.yaml with auto_start: true
   ```

3. **Connect Test Clients with FIFOs:**
   ```bash
   mkfifo cli-in cli-out
   mew client connect \
     --gateway ws://localhost:8080 \
     --space test-space \
     --fifo-in cli-in \
     --fifo-out cli-out &
   ```

4. **Send Test Messages:**
   ```bash
   echo '{"kind":"chat","payload":{"text":"test"}}' > cli-in
   ```

5. **Read Responses:**
   ```bash
   RESPONSE=$(timeout 5 cat cli-out | head -1)
   echo "$RESPONSE" | jq '.kind'
   ```

## Minimal Implementation Requirements

### Gateway
- Start WebSocket server on specified port
- Accept client connections
- Route messages between participants in same space
- Load space.yaml for capability configuration
- Provide hooks for capability resolution

### Client
- Connect to gateway WebSocket
- Join specified space
- Support interactive mode (readline) by default
- Support FIFO mode for automation
- Read JSON from fifo-in, send to gateway (FIFO mode)
- Write received messages to fifo-out as JSON (FIFO mode)


### Token
- Generate simple JWT or even just return the participant-id as token
- Gateway can ignore tokens initially

## Error Handling

Minimal error handling for test scenarios:
- Malformed JSON: Return system/error
- Missing fields: Return system/error
- Capability violations: Return system/error (if implemented)

## Dependencies

Core dependencies:
- `ws` - WebSocket client/server
- `commander` - Command parsing
- `ink` - React-based terminal UI (advanced interactive mode)
- `react` - UI framework for Ink components
- `pm2` - Process manager (embedded library)
- `js-yaml` - Parse space.yaml configuration
- `readline` - Simple terminal UI (debug mode)
- Core SDK packages (@mew/gateway, @mew/client, @mew/agent)

## Configuration

### Space Configuration (space.yaml)

The CLI manages participant capabilities through a `space.yaml` configuration file. This design separates authorization logic from the gateway implementation, allowing the gateway library to remain a pure protocol handler while the CLI manages the policy layer.

#### Configuration Structure

```yaml
space:
  id: space-identifier
  name: "Human Readable Space Name"
  description: "Space description"
  
participants:
  participant-id:
    tokens:
      - token-value-1
      - token-value-2
    capabilities:
      - kind: "mcp/*"
      - kind: "chat"

defaults:
  capabilities:
    - kind: "mcp/proposal"
    - kind: "chat"
```

#### Capability Patterns

Capabilities use JSON pattern matching as defined in MEW v0.3:

**Simple patterns:**
```yaml
capabilities:
  - kind: "*"           # All capabilities
  - kind: "mcp/*"       # All MCP messages (request, response, proposal)
  - kind: "chat"        # Only chat messages
```

**Nested patterns for fine-grained control:**
```yaml
capabilities:
  - kind: "mcp/request"
    payload:
      method: "tools/call"
      params:
        name: "read_*"   # Only read tools
  - kind: "mcp/response"
  - kind: "chat"
```

#### Gateway Integration Architecture

The gateway library provides bidirectional hooks for capability management and participant lifecycle:

```javascript
// Gateway requests capability resolution from CLI
gateway.setCapabilityResolver(async (token, participantId, messageKind) => {
  // CLI loads from space.yaml (may return subset of configured capabilities)
  const config = await loadSpaceConfig();
  const participant = findParticipantByToken(config, token);
  
  // CLI can choose to return only relevant capabilities for this message
  const relevantCaps = filterCapabilitiesForMessage(
    participant?.capabilities || config.defaults.capabilities,
    messageKind
  );
  return relevantCaps;
});

// Gateway notifies CLI when participants join
gateway.onParticipantJoined(async (participantId, token, metadata) => {
  // CLI can update space.yaml with new participant
  if (!knownParticipant(participantId)) {
    await addParticipantToConfig(participantId, token, {
      type: 'key',
      capabilities: config.defaults.capabilities,
      first_seen: new Date().toISOString()
    });
  }
  // CLI may also spawn local agents based on space.yaml
  await spawnLocalAgents(config);
});

// Gateway provides authorization hook
gateway.setAuthorizationHook(async (participantId, messageKind, capabilities) => {
  const required = getRequiredCapability(messageKind);
  return hasCapability(capabilities, required);
});
```

#### Participant Lifecycle Management

The space.yaml can define how local participants should be started:

```yaml
participants:
  calculator-agent:
    type: local
    command: "node"
    args: ["./agents/calculator.js", "--gateway", "ws://localhost:8080"]
    env:
      LOG_LEVEL: "debug"
      CACHE_DIR: "/tmp/calculator-cache"
    auto_start: true  # CLI spawns this when space starts
    restart_policy: "on-failure"
    tokens:
      - calculator-token
    capabilities:
      - kind: "mcp/*"
      - kind: "chat"
```

#### FIFO and Output Configuration

Participants can be configured with FIFOs for automation and testing:

```yaml
participants:
  test-client:
    tokens: ["test-token"]
    capabilities:
      - kind: "chat"
    fifo: true  # Create input FIFO (and output FIFO unless output_log is set)
    output_log: "./logs/test-client.log"  # Redirect output to file (non-blocking)
    auto_connect: true  # Auto-connect when space starts
```

**FIFO Configuration Options:**

- `fifo: true` - Creates FIFOs for the participant:
  - When `output_log` is NOT set: Creates both input and output FIFOs
  - When `output_log` IS set: Creates only input FIFO, output goes to log file

- `output_log: <path>` - Redirects client output to a file instead of FIFO:
  - Prevents blocking issues in automated tests
  - Allows analysis of output after test completion
  - Appends to file if it exists

- `auto_connect: true` - Automatically connects the client when space starts

**Use Cases:**

```yaml
# Automated testing (non-blocking)
test-client:
  fifo: true
  output_log: "./logs/test-output.log"  # Output to file
  auto_connect: true

# Interactive debugging (traditional FIFOs)  
debug-client:
  fifo: true
  # No output_log means both FIFOs are created
  auto_connect: false  # Connect manually for debugging

# Agent without FIFOs
echo-agent:
  fifo: false
  auto_start: true
  command: "node"
  args: ["./agents/echo.js"]
```

The CLI handles:
- **Process Management**: Starting/stopping local agents based on config
- **Environment Setup**: Passing environment variables to agents
- **Restart Policies**: Handling agent failures
- **Dynamic Registration**: Adding new participants as they join

The gateway only cares about:
- **Token Validation**: Is this token valid?
- **Capability Check**: Does this participant have this capability?
- **Message Routing**: Protocol-level concerns

This architecture enables:
- **Separation of Concerns**: Gateway handles protocol, CLI handles operations
- **Dynamic Participants**: New participants can be added at runtime
- **Flexible Deployment**: Different environments can have different startup configs
- **Testing**: Mock resolvers for unit tests
- **Capability Subsetting**: CLI can return only needed capabilities per request

#### Loading Configuration

The CLI loads space configuration in order of precedence:
1. Command-line flag: `--space-config path/to/space.yaml`
2. Environment variable: `MEW_SPACE_CONFIG`
3. Default search order:
   - `./.mew/space.yaml` (preferred, keeps root clean)
   - `./space.yaml` (legacy/compatibility)

This dual-location support ensures:
- New spaces keep configuration in `.mew/` by default
- Existing spaces with root `space.yaml` continue to work
- Backward compatibility maintained

Example:
```bash
# Use specific config
mew gateway start --port 8080 --space-config ./configs/production.yaml

# Auto-detect (checks .mew/space.yaml first, then space.yaml)
mew space up
```

## Process Management

The CLI uses PM2 as an embedded library for reliable process management. This ensures that gateway and agent processes remain running even after the parent CLI command exits.

### PM2 Integration Architecture

PM2 is used programmatically as a library, not as a global tool:

```javascript
// Each space gets its own isolated PM2 daemon
process.env.PM2_HOME = path.join(spaceDir, '.mew/pm2');

// Connect to space-specific PM2 daemon
const pm2 = require('pm2');
pm2.connect((err) => {
  // All PM2 operations are space-local
});
```

### Space-Local Process Management

Each space maintains complete isolation with all MEW-related files in the `.mew` directory:

```
space-directory/
├── .mew/                # MEW infrastructure directory
│   ├── space.yaml       # Space configuration (preferred location)
│   ├── package.json     # MEW dependencies only
│   ├── node_modules/    # Isolated node_modules for MCP servers and agents
│   ├── agents/          # Agent scripts (copied from template)
│   │   └── assistant.js # Main agent implementation
│   ├── pm2/            # PM2 daemon for this space only
│   │   ├── pm2.log     # PM2 daemon logs
│   │   ├── pm2.pid     # Daemon process ID
│   │   └── pids/       # Managed process PIDs
│   ├── pids.json       # Space metadata
│   ├── logs/           # Process output logs
│   │   ├── gateway.log
│   │   └── agent-*.log
│   └── fifos/          # FIFO pipes if configured
├── space.yaml          # Space configuration (legacy/optional location)
└── [project files]     # Your actual project remains clean
```

Benefits of this approach:
- **No global PM2 required**: PM2 is bundled with the CLI
- **Complete isolation**: Multiple spaces can run simultaneously
- **Self-contained**: All artifacts stay within the space directory
- **Transparent**: Users don't need to know PM2 is being used
- **Reliable**: Processes survive parent CLI exit

## Space Management

### `mew space up`

Brings up all components of a space based on space configuration, optionally connecting interactively as a participant. Automatically detects configuration in `.mew/space.yaml` or `space.yaml`.

```bash
mew space up [options]

Options:
  --space-config <path>   Path to space.yaml (default: auto-detect)
  --port <port>          Gateway port (default: from config or 8080)
  --participant <id>      Connect as this participant
  --interactive, -i      Connect interactively after starting space
  --detach, -d            Run in background (incompatible with -i)
  --debug                 Use simple debug interface instead of advanced UI
  --simple                Alias for --debug
  --no-ui                 Disable UI enhancements, use plain interface
```

This command:
1. Creates space-local PM2 daemon in `.mew/pm2/`
2. Starts the gateway using PM2 for process management
3. Starts all agents with `auto_start: true` via PM2
4. If `-i` flag is present: Connects interactively as a participant (uses advanced UI by default, or debug UI with `--debug`)
5. If `-d` flag is present: Runs in background without connecting
6. If neither flag: Starts space and exits (current behavior)

All processes are managed by PM2 and will continue running after the CLI exits. When connecting as a participant, tokens and capabilities come from space.yaml - no need to specify them.

#### Participant Resolution

The CLI automatically determines which participant to connect as using this precedence:

1. **Explicit flag**: `--participant <id>` always takes priority
2. **Space default**: `default_participant` field in space.yaml
3. **Single human**: Auto-selects if only one participant without a `command` field exists
4. **Interactive prompt**: Shows list of human participants to choose from
5. **System username**: Used if it matches a human participant (last resort)
6. **Detached mode**: Runs without connecting if no participant can be determined

Example space.yaml with participant resolution:
```yaml
space:
  id: my-space
  default_participant: developer  # Optional default
  
participants:
  developer:           # Human participant (no command)
    tokens: [...]
  echo-agent:         # Agent participant (has command)
    command: "node"
    args: ["./agents/echo.js"]
    auto_start: true
  rjcorwin:           # Matches system username
    tokens: [...]
```

### `mew space status`

Shows the status of running space processes. Automatically detects configuration in `.mew/space.yaml` or `space.yaml`.

```bash
mew space status [options]

Options:
  --space-config <path>   Path to space.yaml (default: auto-detect)
  --json                  Output as JSON
```

This command:
1. Connects to the space-local PM2 daemon
2. Lists all managed processes with their status
3. Shows gateway health check results
4. Displays connected participants

### `mew space connect`

Connects interactively to a running space. Automatically detects configuration in `.mew/space.yaml` or `space.yaml`.

```bash
mew space connect [options]

Options:
  --space-config <path>   Path to space.yaml (default: auto-detect)
  --participant <id>     Connect as this participant
  --space-dir <path>     Directory of space to connect to (default: .)
  --gateway <url>        Override gateway URL (default: from running space)
  --debug                 Use simple debug interface instead of advanced UI
  --simple                Alias for --debug
  --no-ui                 Disable UI enhancements, use plain interface
```

This command:
1. Checks if space is running in current/specified directory
2. Loads space configuration
3. Resolves participant (same logic as `space up`)
4. Connects interactively to the space
5. Shows interactive terminal UI (advanced mode by default, debug mode with `--debug`)

Error handling:
- If space not running: "No running space found. Use 'mew space up' first."
- If no participant resolved: "No participant found. Specify with --participant"
- If connection fails: Shows helpful error with gateway URL

### `mew space down`

Stops all components of a running space. Automatically detects configuration in `.mew/space.yaml` or `space.yaml`.

```bash
mew space down [options]

Options:
  --space-config <path>   Path to space.yaml (default: auto-detect)
  --force                 Force kill processes if graceful shutdown fails
```

This command:
1. Disconnects all clients
2. Stops all PM2-managed processes for this space
3. Shuts down the space-local PM2 daemon
4. Cleans up FIFOs and temporary files
5. Preserves logs for debugging

### `mew space clean`

Cleans up space artifacts such as logs, FIFOs, and temporary files. Provides safety checks to prevent accidental data loss.

```bash
mew space clean [options]

Options:
  --all                 Clean everything including .mew directory
  --logs                Clean only log files
  --fifos               Clean only FIFO pipes
  --force               Skip confirmation prompts
  --dry-run             Show what would be cleaned without doing it
```

**Default behavior (no flags):**
- Cleans `logs/*` (except current session if running)
- Cleans `fifos/*` (except active pipes)
- Cleans temporary response files
- Preserves `.mew/` directory (contains process state)

**With `--all`:**
- Everything from default cleaning
- Removes `.mew/` directory entirely
- Stops PM2 daemon for this space

**Safety features:**
- Warns if space is currently running
- Requires confirmation for destructive operations
- Never cleans active FIFO pipes
- Preserves space.yaml and agent files
- Shows summary of what will be cleaned

**Examples:**
```bash
# Clean logs after debugging session
mew space clean --logs

# Start completely fresh for testing
mew space down
mew space clean --all

# Check what would be cleaned
mew space clean --dry-run

# CI/CD cleanup (no prompts)
mew space down
mew space clean --all --force
```

## Interactive Terminal Interface

The CLI provides two interactive modes for different use cases:

1. **Advanced Interactive Mode (default)**: Full-featured Ink-based UI with MCP operation confirmations, native terminal scrolling, and rich formatting
2. **Debug Mode**: Simple readline-based interface for protocol debugging and testing environments

### Advanced Interactive Mode (Default)

The default interactive mode uses Ink (React for CLI) to provide a modern terminal interface that preserves native scrolling behavior while adding rich UI components for operation confirmations and status display.

**Key Features:**
- Native terminal scrolling for message history
- Persistent bottom UI with input composer and status
- MCP operation confirmation dialogs with risk assessment
- Rich message formatting with syntax highlighting
- Real-time participant status and typing indicators
- Auto-approval rules for trusted operations

**Architecture:**
- Message history uses Ink's `Static` component for native scrolling
- Persistent bottom panel stays fixed during scrolling
- Content-aware truncation prevents UI overflow
- Preserves terminal features (text selection, copy/paste)

### Debug Mode (--debug flag)

A lightweight terminal interface for protocol debugging and automated testing. This is a protocol debugging tool with convenience features, not a polished chat interface.

### MCP Operation Confirmation Workflow

The advanced interactive mode includes built-in confirmation dialogs for MCP (Model Context Protocol) operations that require human approval. The implementation follows a phased approach from [ADR-009: Approval Dialog UX](./decisions/accepted/009-aud-approval-dialog-ux.md).

#### Phase 1: Generic Template (✅ IMPLEMENTED)

**Current Features:**
- Simple numbered list interface with multiple input methods
- Arrow key navigation (↑↓) with visual selection indicator
- Enter key to confirm current selection
- Number key shortcuts (1 for Yes, 2 for No)
- Clear display of participant context and operation details
- Generic template that works for all operations
- Escape key support for quick denial
- Proper focus management with input composer disabled

#### Phase 2: Tool-Specific Templates (🚧 PLANNED)

**Planned Templates:**
- **File Operations**: Optimized display for read/write/delete with file previews
- **Command Execution**: Show command, working directory, and risk assessment
- **Network Requests**: Display URL, method, headers, and payload
- **Database Operations**: Show query type, affected tables, and data preview

Templates will auto-detect operation type and provide context-appropriate formatting while maintaining the same interaction pattern.

#### Phase 3: Capability Grants (📋 FUTURE)

**Planned Features:**
- Third option: "Yes, allow [participant] to [operation category]"
- Sends MEW Protocol `capability/grant` messages
- Dynamic capability updates for the session
- Reduces repeated approval prompts
- Grant tracking and management UI

**Example Confirmation Dialog:**
```
╭──────────────────────────────────────────────────────────╮
│ coder-agent wants to execute operation                  │
│                                                         │
│ Method: tools/call                                     │
│ Tool: write_file                                       │
│ Target: mcp-fs-bridge                                  │
│                                                         │
│ Arguments:                                              │
│ ╭────────────────────────────────────────────────────╮  │
│ │ {                                                  │  │
│ │   "path": "config.json",                          │  │
│ │   "content": "{\n  \"name\": \"my-app\"\n}"       │  │
│ │ }                                                  │  │
│ ╰────────────────────────────────────────────────────╯  │
│                                                         │
│ Do you want to allow this?                             │
│ ❯ 1. Yes                                               │
│   2. No                                                │
│                                                         │
│ Use ↑↓ arrows + Enter, or press 1/2, or Esc to cancel  │
│                                                         │
╰──────────────────────────────────────────────────────────╯
```

**User Interaction Methods:**
1. **Arrow Keys + Enter** (recommended):
   - Use `↑` and `↓` arrow keys to move selection
   - Press `Enter` to confirm selected option
   - Visual indicator (`❯`) shows current selection

2. **Number Key Shortcuts**:
   - Press `1` to immediately approve
   - Press `2` to immediately deny

3. **Cancel**:
   - Press `Escape` to cancel (same as deny)

**Approval Flow:**
1. Agent sends `mcp/proposal` for operations requiring approval
2. Dialog appears showing operation details
3. User presses `1` or `2` to decide
4. If approved (1), CLI fulfills the proposal by sending `mcp/request` with `correlation_id` referencing the proposal
5. If denied (2), proposal is discarded and no action is taken

This simplified approach provides essential approval functionality without the complexity of:
- Risk assessment levels
- Session-level permissions
- Remember-choice functionality
- Auto-approval rules

These advanced features can be added in future iterations as the system matures beyond MVP.

### Input Processing

The terminal interface uses smart input detection with clear rules and escape hatches:

#### Detection Rules (applied in order):
1. **Commands** (starts with `/`): Execute command
2. **Valid JSON** (parseable as JSON): Send as-is if valid envelope, otherwise wrap
3. **Plain text**: Wrap as chat message

#### Input Examples:
```bash
> Hello everyone                    # Sends chat message
> {"kind": "chat", "payload": {"text": "hi"}}  # Partial envelope - adds protocol fields
> {"kind": "mcp/request", ...}      # Sends JSON envelope  
> /help                              # Executes help command
> { invalid json                     # Sends as chat (not valid JSON)
> /chat {"actual": "json"}          # Forces JSON to be sent as chat text
> /json {"kind": "custom"}          # Forces input as protocol message
```

### Message Display Format

All messages shown with consistent format:
```
[timestamp] direction participant kind
└─ payload preview
```

Examples:
```
[10:23:45] → you chat
└─ "Hello everyone"

[10:23:46] ← echo-agent chat  
└─ "Echo: Hello everyone"

[10:23:50] → you mcp/request
└─ method: "tools/list", to: ["calculator"]

[10:23:51] ← calculator mcp/response
└─ tools: [3 tools]
```

Verbose mode (`/verbose`) shows full JSON messages.

### Terminal Commands

#### Essential commands:
```
/help              Show available commands
/participants      List active participants
/capabilities      Show your current capabilities  
/verbose           Toggle verbose output (show full JSON)
/json <msg>        Force input as JSON (escape hatch)
/chat <text>       Force input as chat (escape hatch)
/replay            Show last N messages
/clear             Clear screen
/exit              Disconnect and exit
```

#### Future commands (not in initial implementation):
```
/filter <kind>     Filter messages by kind
/save <file>       Save session to file
/load <file>       Replay messages from file
/stats             Show message statistics
```

### Output Filtering

Control what's displayed:
- System messages (welcome, presence) - dimmed by default
- Heartbeats - hidden by default  
- Chat messages - normal color
- MCP messages - highlighted
- Errors - red

Configuration via environment:
```bash
MEW_INTERACTIVE_SHOW_HEARTBEAT=true
MEW_INTERACTIVE_SHOW_SYSTEM=true
MEW_INTERACTIVE_COLOR=false  # Disable colors
```

### Interactive Mode Overrides

When in interactive mode, certain participant configurations are overridden:
- `fifo: true` → Ignored (use interactive terminal instead)
- `output_log` → Ignored (output to terminal)
- `auto_connect` → Ignored (we're manually connecting)

The interactive connection always uses:
- Terminal input (stdin)
- Terminal output (stdout)  
- Readline-based interface

### Example Sessions

#### Interactive Development Session
```bash
# Start fresh and connect immediately with advanced UI
mew space up -i

# Connect with debug interface for protocol debugging
mew space up -i --debug

# In another terminal, connect as different participant
mew space connect --participant admin

# Connect to space in another directory
mew space connect --space-dir ../other-project

# Connect with simple debug interface
mew space connect --participant debugger --debug

# In another terminal, CI system connects with FIFOs for automation
mkfifo ci-in ci-out
mew client connect \
  --gateway ws://localhost:8080 \
  --space code-review \
  --participant ci-bot \
  --fifo-in ci-in \
  --fifo-out ci-out &
```

#### Mixed Interactive and Automation Session
```bash
# Start space in background
mew space up -d

# Connect interactively to debug
mew space connect --participant debugger

# Also connect test clients with FIFOs for automation
mkfifo client1-in client1-out
mew client connect \
  --gateway ws://localhost:8080 \
  --space test-space \
  --participant test-client-1 \
  --fifo-in client1-in \
  --fifo-out client1-out &

# Send test messages
echo '{"kind":"chat","payload":{"text":"test"}}' > client1-in
```

## Next Steps

After tests pass with this minimal implementation:
1. ~~Add proper authentication~~ ✓ Token-based auth via space.yaml
2. ~~Implement capability enforcement~~ ✓ Via resolver hooks
3. ~~Add space configuration support~~ ✓ space.yaml specification
4. Implement remaining features from `/cli/spec/next/SPEC.md`

## Success Criteria

This CLI successfully implements the test plan when:
1. All test scenarios in TEST_PLAN.md can be executed
2. Gateway starts and accepts connections
3. Agents respond appropriately
4. FIFO mode enables test automation
5. Messages flow correctly between participants