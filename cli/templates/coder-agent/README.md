# Coder Agent Template

A development workspace with an AI coding assistant that can read and write files, create projects, and help with development tasks.

## Features

- **File System Access**: Full read/write access to your workspace
- **AI Assistant**: Powered by OpenAI or compatible models
- **Code Generation**: Creates actual files on disk, not just snippets
- **Project Scaffolding**: Can create entire project structures

## Configuration

The assistant uses environment variables for sensitive configuration:

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_BASE_URL`: API endpoint (optional, defaults to OpenAI)

These are never stored in configuration files.

## Usage

After initialization:

```bash
# Start the space
mew

# The assistant is ready to help with coding tasks
# Try: "Create a simple Python web server with Flask"
```

## Customization

You can customize the agent's behavior by editing `.mew/space.yaml`:

- Change the `AGENT_MODEL` to use different models
- Adjust the `AGENT_PROMPT` for different coding styles
- Modify capabilities to restrict or expand operations