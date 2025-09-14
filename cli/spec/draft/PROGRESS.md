# CLI Specification Progress

## Date: 2025-01-14

### Overview
Refined and simplified the MEW CLI specification to create a better user experience focused on simplicity and clean project separation.

## Major Changes

### 1. Template System Refinement
- **Simplified to 2 templates**: `coder-agent` and `note-taker` (removed `basic`, `test-automation`, `multi-agent`)
- **Templates use `space.yaml`** directly, not `space.template.yaml` (cleaner since already in template directory)
- **Template structure includes `package.json`**: Each template provides its own Node.js dependencies instead of dynamically generating

### 2. Isolated MEW Environment (`.mew/` directory)
- **Complete separation of concerns**: All MEW-related files go in `.mew/` directory
- **Space configuration location**: `.mew/space.yaml` is now the preferred location (keeps project root clean)
- **Dependency isolation**: `.mew/package.json` and `.mew/node_modules/` keep MEW dependencies separate from project
- **Backward compatibility**: Still checks for `space.yaml` in project root for existing spaces

### 3. MCP Server Dependencies (ADR-msd)
- **Created and incorporated ADR**: Architecture Decision Record for MCP server dependency management
- **Simple approach**: Template provides package.json, copied to `.mew/`, npm install runs automatically
- **No complex detection**: Removed individual package detection and prompting
- **Clean project**: Project's own package.json (if any) remains untouched

### 4. Configuration Strategy Simplification
- **Template variables vs Environment variables**: Clear separation between what's stored (model name) and what's not (API keys)
- **Changed `required` to `prompt`**: Template variables use `prompt: true/false` to control init prompting
- **API key handling**: Never stored in config, always read from environment
- **Base URL support**: Added support for OpenRouter, local models, etc. via `OPENAI_BASE_URL`

### 5. Streamlined User Experience
- **Default command behavior**: Just run `mew` - it does the right thing (init if new, space up if existing)
- **Minimal prompting**: Only asks for essentials during init (space name, model)
- **Smart defaults**: `gpt-5` as default model, current directory name as default space name
- **After init**: Just shows "Try: mew" instead of "Try: mew space up -i"

### 6. Removed Complexity
- **Removed `--root-config` flag**: Always use `.mew/space.yaml` for new spaces
- **Removed complex dependency detection**: No more checking multiple locations for MCP servers
- **Removed `postInit` from templates**: npm install is handled by init command, not template metadata
- **Simplified interactive flow**: Fewer prompts, clearer messages

## Key Design Decisions

### Everything in `.mew/`
The `.mew/` directory contains ALL MEW-related files:
- `space.yaml` - Space configuration
- `package.json` - MEW dependencies
- `node_modules/` - Isolated dependencies
- `agents/` - Agent scripts
- `pm2/` - Process management
- `logs/` - Log files
- `fifos/` - FIFO pipes

This treats MEW like other dev tools (`.vscode/`, `.idea/`) - configuration that helps you work on the project but isn't part of the project itself.

### Simple Template System
Templates are self-contained Node.js projects:
- Each template has its own `package.json` with exact dependencies
- Template variables control what gets prompted during init
- No dynamic package.json generation
- Copy template files → Run npm install → Done

### Configuration Philosophy
- **Non-sensitive config** (model name) → Stored in space.yaml
- **Sensitive config** (API keys) → Environment variables only
- **Deployment config** (base URLs) → Environment variables
- Never mix secrets with configuration files

## Benefits of These Changes

1. **Zero project pollution**: Your project remains completely clean
2. **Language agnostic**: Works with Python, Ruby, Go projects (not just Node.js)
3. **Simple mental model**: Everything MEW-related is in `.mew/`
4. **Easy cleanup**: Just delete `.mew/` to remove all traces
5. **Provider flexibility**: Easy support for OpenAI, OpenRouter, local models
6. **Git-friendly**: Simple `.gitignore` rule for `.mew/`
7. **Faster onboarding**: Fewer prompts, smarter defaults

## Next Steps

The specification is now ready for implementation with a focus on:
- Simplicity over flexibility
- Clean separation of project and tooling
- Smart defaults that just work
- Minimal user interaction required

The changes make `mew init` a simple, predictable command that sets up an isolated MEW environment without affecting the user's project.