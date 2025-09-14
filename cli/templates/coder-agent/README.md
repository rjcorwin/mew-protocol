# Coder Agent Template

A sophisticated development workspace with an AI coding assistant that can read and write files, create projects, and help with complex development tasks.

## Features

- **AI-Powered Coding Assistant**: Uses @mew-protocol/agent with OpenAI or compatible models
- **File System Access**: Full read/write access through MCP filesystem tools
- **Safe by Default**: Write operations require human approval (proposals)
- **Read Operations**: Direct access to read files without approval
- **Code Generation**: Creates actual files on disk, not just snippets
- **Project Scaffolding**: Can create entire project structures
- **Multi-Step Tasks**: Handles complex tasks with up to 100 iterations
- **Reasoning Transparency**: Shows its thinking process while working

## Architecture

This template uses the published MEW Protocol packages:

- `@mew-protocol/agent`: The AI agent framework
- `@mew-protocol/participant`: Base participant functionality
- `@mew-protocol/bridge`: MCP bridge for filesystem access
- `@modelcontextprotocol/server-filesystem`: MCP filesystem server

## Participants

1. **human**: You, with full capabilities
2. **coder-agent**: AI assistant that creates proposals for file modifications
3. **mcp-fs-bridge**: Filesystem access provider (executes approved operations)
4. **auto-fulfiller**: Optional auto-approver for proposals (disabled by default)

## Configuration

### Required Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)

### Optional Environment Variables

- `OPENAI_MODEL`: Model to use (default: gpt-4-turbo-preview)
- `OPENAI_BASE_URL`: API endpoint (optional, for OpenAI-compatible services)

## Usage

After initialization:

```bash
# Start the space
mew space up

# The assistant is ready to help with coding tasks
# Examples:
# - "Create a Python Flask web server with user authentication"
# - "Build a React component for a todo list"
# - "Write tests for the calculator module"
```

## Working Modes

### Safe Mode (Default)
- Agent can read files directly
- Write operations create proposals requiring approval
- Human reviews and approves file modifications

### YOLO Mode
To enable direct file writing without approval, uncomment the tools/call capability in space.yaml:

```yaml
# Uncomment for YOLO mode:
- kind: "mcp/request"
  payload:
    method: "tools/call"
```

### Auto-Approval Mode
To enable automatic proposal approval:

1. Set `auto_start: true` for the auto-fulfiller in space.yaml
2. Set `AUTO_APPROVE: "true"` in the auto-fulfiller env

## Workspace Structure

```
your-project/
├── .mew/                    # MEW configuration
│   ├── space.yaml          # Space configuration
│   ├── agents/             # Agent scripts
│   └── node_modules/       # Dependencies
└── workspace/              # Your code files
```

## Customization

Edit `.mew/space.yaml` to:

- Change the AI model
- Adjust the system prompt
- Modify capabilities
- Configure timeouts and limits

## Security Notes

- The agent operates within the workspace directory
- Write operations require explicit approval (by default)
- Sensitive data in environment variables is never stored in config files
- Review proposals carefully before approval

## Troubleshooting

If the agent isn't responding:
1. Check your OPENAI_API_KEY is set
2. Verify the gateway is running: `mew space status`
3. Check logs: `mew space logs coder-agent`

For more information, see the [MEW Protocol documentation](https://github.com/rjcorwin/mew-protocol).