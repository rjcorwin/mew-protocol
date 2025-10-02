# MEW Protocol Templates

Templates provide pre-configured spaces demonstrating MEW Protocol capabilities. Each template creates a fully functional MEW space with participants, tools, and capabilities configured for specific use cases.

## Available Templates

### cat-maze

**Purpose**: Demonstrate MCP bridge and AI agent tool calling

**What it includes**:
- MEW AI agent that can solve puzzles
- Cat-maze MCP server (interactive maze game)
- Transparent reasoning flow
- Tool calling workflow (view, up, down, left, right)

**Try it**:
```bash
mew init cat-maze
cd cat-maze
mew space up
```

**Use case**: Learn how MEW agents interact with MCP servers and use tools to accomplish goals.

**Full Guide**: See [docs/templates.md - Cat-Maze Template](../docs/templates.md#cat-maze-template)

---

### coder-agent

**Purpose**: Human-in-loop file operations with proposals and progressive trust

**What it includes**:
- MEW AI coding assistant
- Filesystem MCP bridge
- Capability-based security
- Proposal/approval workflow
- Auto-fulfiller (optional)

**Try it**:
```bash
mew init coder-agent
cd coder-agent
mew space up
```

**Use case**: Build AI coding assistants with safe file system access. Agent can read files directly but must create proposals for write operations that require human approval.

**Key features**:
- **Read-only operations**: Agent calls `read_file`, `list_directory` directly
- **Write operations**: Agent creates proposals for `write_file`, `edit_file`
- **Progressive trust**: Grant capabilities dynamically based on observed behavior
- **Transparent reasoning**: See the agent's thought process

**Full Guide**: See [docs/templates.md - Coder-Agent Template](../docs/templates.md#coder-agent-template)

---

### note-taker

**Purpose**: Minimal agent for note-taking tasks

**What it includes**:
- Simple AI agent for taking notes
- Basic conversational interface
- Minimal configuration

**Try it**:
```bash
mew init note-taker
cd note-taker
mew space up
```

**Use case**: Simple conversational agent without file system access or complex tool integration. Good starting point for building custom agents.

---

## Template Structure

Each template contains:

```
template-name/
├── space.yaml           # Participant configuration
├── README.md            # Template documentation
└── agents/              # Template-specific agents (optional)
    └── *.js             # Custom agent implementations
```

### space.yaml

The `space.yaml` file defines:
- **Participants**: Agents, MCP bridges, and human participants
- **Capabilities**: Fine-grained permissions for each participant
- **Configuration**: Environment variables, working directories, tokens

Example structure:
```yaml
name: template-name
participants:
  - id: participant-name
    kind: agent | mcp-bridge | human
    capabilities: [...]
    env: {...}
```

## Creating Custom Templates

### 1. Copy an Existing Template

Start with a template that's closest to your use case:

```bash
cp -r templates/coder-agent templates/my-template
cd templates/my-template
```

### 2. Modify space.yaml

Update participant configurations:
- Change `name` to your template name
- Add/remove participants as needed
- Configure capabilities for your use case
- Set environment variables

### 3. Add Custom Agents (Optional)

Create custom agent implementations in `agents/`:

```javascript
// agents/my-agent.js
import { MEWAgent } from '@mew-protocol/mew/agent';

const agent = new MEWAgent({
  gateway: process.env.GATEWAY_URL,
  space: process.env.SPACE_NAME,
  token: process.env.TOKEN,
  // Custom configuration
});

// Register custom tools
agent.registerTool({
  name: 'my-tool',
  description: 'Does something useful',
  inputSchema: { /* JSON Schema */ },
  execute: async (args) => {
    // Tool implementation
    return result;
  }
});

agent.start();
```

### 4. Update README.md

Document your template:
- Purpose and use case
- What's included
- How to use it
- Configuration options
- Examples

### 5. Test Your Template

```bash
# Test template initialization
cd /tmp/test-template
mew init my-template

# Verify files created
ls -la .mew/

# Test starting the space
mew space up
pm2 list

# Test functionality
mew space connect

# Clean up
mew space down
```

### 6. Share Your Template

Once tested, your template can be:
- Added to the MEW Protocol repository (submit a PR)
- Published as a standalone npm package
- Shared as a GitHub repository

## Template Configuration Guide

### Participant Types

**agent**: AI agents that can reason, use tools, and interact with users
```yaml
- id: my-agent
  kind: agent
  command: mew
  args: ["agent", "run", "--type", "typescript"]
  capabilities: [...]
```

**mcp-bridge**: Bridges MEW Protocol to MCP servers
```yaml
- id: mcp-bridge
  kind: mcp-bridge
  command: mew
  args: ["bridge", "start", "--mcp-command", "mew", "--mcp-args", "mcp,filesystem"]
  capabilities: [...]
```

**human**: Human participants
```yaml
- id: human
  kind: human
  capabilities: ["*"]  # Full access
```

### Capability Patterns

Capabilities control what participants can do:

**Chat capabilities**:
```yaml
- kind: "chat"              # Send chat messages
- kind: "chat/acknowledge"  # Acknowledge chats
- kind: "chat/cancel"       # Cancel chats
```

**Reasoning capabilities**:
```yaml
- kind: "reasoning/*"  # All reasoning message types
```

**MCP capabilities**:
```yaml
# Direct tool execution
- kind: "mcp/request"
  payload:
    method: "tools/call"
    params:
      name: "read_file"  # Specific tool

# Proposal creation (for restricted operations)
- kind: "mcp/proposal"
```

**Stream capabilities**:
```yaml
- kind: "stream/request"  # Request streams
- kind: "stream/open"     # Open streams
- kind: "stream/close"    # Close streams
```

**Capability management**:
```yaml
- kind: "capability/grant"    # Grant capabilities to others
- kind: "capability/revoke"   # Revoke capabilities
```

For complete capability documentation, see the [Protocol Specification](../spec/protocol/v0.4/SPEC.md).

## Testing Templates

For detailed template testing guides, see [docs/templates.md](../docs/templates.md):
- Step-by-step walkthroughs
- Testing MCP tools
- Proposal workflows
- Capability grants
- Debugging tips

## Template Best Practices

1. **Start with minimal capabilities**: Grant only what's needed, add more as trust develops
2. **Use proposals for sensitive operations**: File writes, system commands, etc.
3. **Enable transparent reasoning**: Help users understand agent behavior
4. **Document capabilities**: Explain why each participant has specific permissions
5. **Provide examples**: Include example interactions in README
6. **Test thoroughly**: Verify all workflows before sharing

## Need Help?

- [Template Testing Guide](../docs/templates.md) - Detailed walkthroughs
- [Development Guide](../docs/development.md) - Building custom templates
- [Protocol Specification](../spec/protocol/v0.4/SPEC.md) - Understanding capabilities
- [GitHub Issues](https://github.com/rjcorwin/mew-protocol/issues) - Get help or report issues

## Contributing Templates

We welcome template contributions! Submit a pull request with:
- Template files in `templates/your-template/`
- Documentation in template README.md
- Entry in this file
- Testing walkthrough in docs/templates.md (optional but helpful)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
