# Documents Agent

An MCPx agent that exposes a documents folder through the filesystem MCP server. This demonstrates how to bridge an existing MCP server (in this case, the standard filesystem server) to make files available to all participants in an MCPx topic.

## Overview

This agent uses the MCPx Bridge to connect `@modelcontextprotocol/server-filesystem` to an MCPx topic, allowing other participants to:
- Read files from the documents folder
- List directory contents
- Write new files (with appropriate permissions)
- Search for files

## Files

- `documents/` - The folder containing documents exposed by this agent
  - `the-answer.txt` - A sample file containing "42"
- `bridge-config.json` - Configuration for the MCPx bridge
- `start.js` - Script to start the bridge with authentication

## Quick Start

### From the examples directory:

```bash
# Install dependencies (first time only)
cd documents-agent
npm install

# Start the agent
npm start
```

### From the root directory:

```bash
# Start the documents agent
npm run example:documents
```

## Testing the Agent

Once the agent is running and connected to the topic:

### 1. Connect with the CLI

```bash
# From another terminal
npm run cli:test
```

### 2. List available participants

```
/list
```

You should see `documents-agent` in the list.

### 3. Check available tools

```
/tools documents-agent
```

Expected tools:
- `read_file` - Read a file's contents
- `read_multiple_files` - Read multiple files
- `write_file` - Write content to a file
- `edit_file` - Edit a file
- `create_directory` - Create a new directory
- `list_directory` - List directory contents
- `move_file` - Move or rename a file
- `search_files` - Search for files
- `get_file_info` - Get file metadata
- `list_allowed_directories` - List allowed directories

### 4. Read the sample file

```
/call documents-agent read_file {"path": "the-answer.txt"}
```

Expected result: The file contents "42"

### 5. List directory contents

```
/call documents-agent list_directory {"path": "."}
```

### 6. Create a new file

```
/call documents-agent write_file {"path": "hello.txt", "content": "Hello from MCPx!"}
```

### 7. Search for files

```
/call documents-agent search_files {"query": "answer", "path": "."}
```

## How It Works

1. **MCP Server**: Uses `@modelcontextprotocol/server-filesystem` to expose filesystem operations
2. **MCPx Bridge**: Connects the MCP server to the MCPx topic
3. **Documents Folder**: All operations are restricted to the `documents/` folder
4. **Authentication**: Automatically generates auth tokens on startup

## Configuration

The `bridge-config.json` file configures:
- MCPx server connection (default: `ws://localhost:3000`)
- Topic to join (default: `test-room`)
- Participant identity
- MCP server command and arguments
- Documents folder path (absolute path required)

## Adding Documents

Simply add files to the `documents/` folder:

```bash
# Add a new document
echo "New content" > documents/my-file.txt

# Create a subdirectory
mkdir documents/reports
echo "Q4 Results" > documents/reports/q4.txt
```

These files are immediately available to all topic participants.

## Security Notes

- The filesystem server only allows access to the configured `documents/` folder
- File operations are subject to filesystem permissions
- Consider read-only mode for production use
- Be cautious about what documents you expose

## Customization

To expose a different folder:

1. Edit `bridge-config.json`
2. Update the path in `mcp_server.args`
3. Restart the agent

To change the participant name or ID:

1. Edit `bridge-config.json`
2. Update `participant.id` and `participant.name`
3. Restart the agent

## Troubleshooting

### "MCPx server unreachable"
- Ensure the gateway is running: `npm run dev:gateway`
- Check the server URL in `bridge-config.json`

### "Failed to generate token"
- The gateway might have restarted
- The agent will attempt to generate a new token on startup

### "Access denied" errors
- Use absolute paths in the configuration
- Check filesystem permissions on the documents folder

### Files not appearing
- Ensure files are saved in the `documents/` folder
- Check that the bridge is connected (look for "Bridge started successfully")

## Use Cases

This pattern is useful for:
- Sharing documentation with AI agents
- Providing data files for analysis
- Creating a shared workspace for collaborative agents
- Exposing configuration files
- Building knowledge bases accessible via MCPx

## Next Steps

- Add more documents to the folder
- Try different file operations through the CLI
- Build agents that use the exposed documents
- Combine with other agents for document processing workflows