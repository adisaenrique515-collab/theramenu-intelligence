# NotebookLM MCP Server

An MCP (Model Context Protocol) server that provides programmatic access to Google NotebookLM via the `notebooklm-py` library.

## Features

- **Notebook Management**: Create, list, rename, and delete notebooks
- **Source Management**: Add URLs, YouTube videos, PDF files, Google Drive files, and text content
- **Question Answering**: Ask questions about notebook sources with source citations
- **Content Generation**: Generate audio conversations, slides, quizzes, and flashcards
- **Flexible Formats**: Support for multiple audio formats (deep-dive, brief, critique, debate) and languages

## Prerequisites

- Python 3.9+
- Google account with access to NotebookLM
- `notebooklm-py` library installed

## Installation

1. **Install dependencies**:
```bash
pip install -e .
```

2. **Authenticate with NotebookLM**:
```bash
notebooklm login
```

This will open a browser to authenticate. Your credentials will be saved locally for subsequent API calls.

## Usage

### Starting the MCP Server

```bash
python server.py
```

Or with stdio transport (for Claude Code):
```bash
python -m mcp.server.stdio server:server
```

### Available Tools

#### Notebook Management

- **create_notebook**: Create a new notebook
  ```json
  {
    "title": "Research Paper Analysis"
  }
  ```

- **list_notebooks**: List all notebooks
  - No parameters required

- **rename_notebook**: Rename a notebook
  ```json
  {
    "notebook_id": "your-notebook-id",
    "new_title": "New Title"
  }
  ```

- **delete_notebook**: Delete a notebook
  ```json
  {
    "notebook_id": "your-notebook-id"
  }
  ```

#### Source Management

- **add_source**: Add a source to a notebook
  ```json
  {
    "notebook_id": "your-notebook-id",
    "source_type": "url",
    "content": "https://example.com",
    "title": "Optional Source Title"
  }
  ```
  
  Supported source types:
  - `url`: Web URLs
  - `youtube`: YouTube video URLs
  - `text`: Plain text content
  - `pdf`: Local PDF file paths
  - `drive`: Google Drive file IDs

- **list_sources**: List sources in a notebook
  ```json
  {
    "notebook_id": "your-notebook-id"
  }
  ```

#### Querying

- **ask_question**: Ask a question about notebook sources
  ```json
  {
    "notebook_id": "your-notebook-id",
    "question": "What are the main conclusions?"
  }
  ```

#### Content Generation

- **generate_audio**: Generate an audio conversation
  ```json
  {
    "notebook_id": "your-notebook-id",
    "format": "deep-dive",
    "length": "medium",
    "language": "en"
  }
  ```
  
  Options:
  - `format`: deep-dive, brief, critique, debate
  - `length`: short, medium, long
  - `language`: Language code (en, es, fr, de, etc.)

- **generate_slides**: Generate a slide deck
  ```json
  {
    "notebook_id": "your-notebook-id"
  }
  ```

- **generate_quiz**: Generate a quiz
  ```json
  {
    "notebook_id": "your-notebook-id"
  }
  ```

- **generate_flashcards**: Generate flashcards
  ```json
  {
    "notebook_id": "your-notebook-id"
  }
  ```

## Integrating with Claude Code

### Option 1: Add to Claude Code Settings

Edit `.claude/settings.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "python",
      "args": ["/path/to/notebooklm-mcp/server.py"]
    }
  }
}
```

### Option 2: Use as a Skill

You can also wrap this as a Claude Code skill for easier management and reuse.

## Architecture

The server consists of:

1. **NotebookLMManager**: Encapsulates all NotebookLM API calls
2. **Tool Handlers**: MCP tool implementations that delegate to the manager
3. **Error Handling**: Graceful error reporting with actionable messages

## Authentication

Authentication is handled via the `notebooklm-py` library:

1. Run `notebooklm login` to authenticate with your Google account
2. Credentials are stored locally in your home directory
3. The MCP server automatically loads stored credentials

## Limitations

- This is an unofficial integration using undocumented Google APIs
- API stability is not guaranteed
- Some features may change without notice
- Usage is subject to Google's terms of service

## Future Enhancements

- [ ] Batch operations (e.g., create multiple notebooks)
- [ ] Export functionality (download audio, slides as files)
- [ ] Research agent integration (web/drive research)
- [ ] Notebook settings management (visibility, sharing)
- [ ] Citation tracking and source management

## Troubleshooting

### Authentication Issues

If you get "Not authenticated" errors:

```bash
notebooklm login
```

Then restart the MCP server.

### Source Addition Failures

Different source types have different requirements:
- URLs: Must be accessible
- YouTube: Must be a valid YouTube URL
- PDFs: Must be local file paths
- Drive files: Requires a valid Drive file ID
- Text: Can be any string

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
