# Coder Agent Demo

This demo showcases the MEW Agent configured as a coding assistant with file system access through an MCP bridge.

## Overview

The demo includes:
- **Coder Agent**: A ReAct-based agent specialized for coding tasks
- **MCP Filesystem Bridge**: Provides file access to the workspace directory
- **Workspace**: Sample files for the agent to work with

## Architecture

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  Human   │────▶│ Coder Agent │────▶│ MCP FS Bridge│
│          │◀────│   (ReAct)   │◀────│              │
└──────────┘     └─────────────┘     └──────────────┘
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │  Workspace   │
                                      │  Directory   │
                                      └──────────────┘
```

## Prerequisites

1. **Set up OpenAI API Key** (Optional but recommended):
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```
Without this, the agent will use basic placeholder logic.

2. **Install MCP filesystem server**:
```bash
npm install -g @modelcontextprotocol/server-filesystem
```

3. **Install dependencies**:
```bash
cd mew-agent
npm install
```

## Quick Start

From the demo directory:

```bash
cd demos/coder-agent
../../cli/bin/mew.js space up
../../cli/bin/mew.js space connect
```

## What You Can Do

Once connected, try these commands:

### Basic Code Tasks
- "Look at the example.js file"
- "Implement the calculateFactorial function"
- "Complete the TodoList class implementation"
- "Add the fibonacci function implementation"

### Code Quality
- "Review the code and suggest improvements"
- "Add error handling to the functions"
- "Add JSDoc comments to all functions"
- "Create unit tests for example.js"

### File Operations
- "Create a new utils.js file with helper functions"
- "Show me all files in the workspace"
- "Update the styles.css with better responsive design"

### Complex Tasks
- "Refactor the TodoList to use TypeScript"
- "Create a simple Express API using the TodoList class"
- "Add a package.json with appropriate dependencies"

## How It Works

1. **Human sends request**: You describe what you want to code or fix
2. **Coder Agent reasons**: Uses ReAct pattern to plan the approach
3. **MCP Bridge provides tools**: Agent requests file operations
4. **Files are modified**: Changes are made to workspace files
5. **Agent reflects**: Evaluates the changes and iterates if needed

## Workspace Structure

```
workspace/
├── README.md       # This file
├── example.js      # Sample JavaScript with TODOs
├── styles.css      # CSS file needing improvements
└── [your files]    # Files created by the agent
```

## Configuration

The coder agent's behavior is defined in `config/coder-config.yaml`:
- System prompt defining its role
- ReAct prompts for reasoning and reflection
- Available MCP tools
- Maximum iteration count

## Customization

### Modify Agent Behavior
Edit `config/coder-config.yaml` to change:
- The system prompt for different coding styles
- Reasoning patterns
- Available tools
- Response style

### Change Workspace Location
In `space.yaml`, modify the MCP bridge args:
```yaml
args: [..., "--mcp-args", "./your-workspace-path"]
```

## Troubleshooting

### Agent Not Responding
1. Check logs: `npx pm2 logs coder-agent`
2. Verify MCP bridge is running: `npx pm2 list`
3. Ensure workspace directory exists and has proper permissions

### File Operations Not Working
1. Check MCP bridge logs: `npx pm2 logs mcp-fs-bridge`
2. Verify @modelcontextprotocol/server-filesystem is installed
3. Check file permissions in workspace directory

### Connection Issues
1. Ensure gateway is running on port 8080
2. Check no other services are using the port
3. Verify space.yaml paths are correct

## Next Steps

- Try different agent configurations (note-taker, reviewer, etc.)
- Add more MCP servers (database, API, etc.)
- Create multi-agent collaboration demos
- Integrate with real LLMs for enhanced reasoning