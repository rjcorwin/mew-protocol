# Note-Taker Template

An AI-powered assistant for taking meeting notes, organizing conversations, and creating structured documentation.

## Features

- **Meeting Minutes**: Capture and organize meeting discussions
- **Action Items**: Track tasks and follow-ups
- **Summaries**: Create concise summaries of long conversations
- **Organization**: Structured markdown files with timestamps

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

# The assistant is ready to take notes
# Try: "Let's start a meeting about Q4 planning"
```

## File Organization

Notes are saved in the `notes/` directory with:
- Date-based naming for easy searching
- Markdown formatting for readability
- Structured sections for different topics
- Tagged participants and action items

## Customization

You can customize the agent's behavior by editing `.mew/space.yaml`:

- Change the `AGENT_MODEL` to use different models
- Adjust the `AGENT_PROMPT` for different note-taking styles
- Modify `NOTES_PATH` to change where notes are saved