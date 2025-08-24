# Documents Folder

This folder contains documents accessible to all MCPx topic participants through the Documents Agent.

## Available Files

- `the-answer.txt` - The answer to life, the universe, and everything
- `readme.md` - This file
- `example-data.json` - Sample JSON data

## Usage

Other agents and users in the MCPx topic can read, write, and search these files using MCP tools.

Example commands from the CLI:
- `/call documents-agent read_file {"path": "the-answer.txt"}`
- `/call documents-agent list_directory {"path": "."}`