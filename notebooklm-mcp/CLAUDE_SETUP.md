# Setting up NotebookLM MCP with Claude Code

This guide explains how to integrate the NotebookLM MCP server with Claude Code so you can use NotebookLM directly from Claude.

## Quick Start

### 1. Install Dependencies

```bash
cd notebooklm-mcp
pip install -e .
```

### 2. Authenticate

```bash
notebooklm login
```

This opens a browser for you to sign in with your Google account. Your credentials are saved automatically.

### 3. Configure Claude Code

Add the MCP server to your Claude Code settings.

**Option A: Using Claude Code Settings UI**

1. Open Claude Code
2. Go to Settings > MCP Servers
3. Click "Add MCP Server"
4. Configure:
   - **Name**: `notebooklm`
   - **Type**: Python (stdio)
   - **Command**: `python`
   - **Arguments**: `["/absolute/path/to/notebooklm-mcp/server.py"]`

**Option B: Editing settings.json**

Edit `~/.claude/settings.json` (or `.claude/settings.json` in your project):

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "python",
      "args": ["/absolute/path/to/notebooklm-mcp/server.py"],
      "env": {}
    }
  }
}
```

**Important**: Use an absolute path, not a relative path.

### 4. Restart Claude Code

Close and reopen Claude Code to load the MCP server. You should see "NotebookLM" appear in the available tools.

## Usage Examples

### Create a notebook and add sources

```
Claude, please:
1. Create a new notebook called "My Research"
2. Add this URL as a source: https://example.com/research-paper.pdf
3. List all sources to confirm they were added
```

### Ask questions about your sources

```
In my "My Research" notebook, what are the key findings discussed in the sources?
```

### Generate content

```
Generate an audio conversation (deep-dive format) from my notebook sources.
```

## Troubleshooting

### "MCP server is not connecting"

1. Check that NotebookLM is authenticated:
   ```bash
   notebooklm login
   ```

2. Verify the path in settings.json is absolute and correct

3. Check the path contains no spaces (or properly escaped)

4. Restart Claude Code

### "Not authenticated" error when using tools

Run authentication again:

```bash
notebooklm login
```

Then restart Claude Code.

### Server crashes with module not found

Ensure all dependencies are installed:

```bash
pip install -e .
```

If that doesn't work, install explicitly:

```bash
pip install mcp notebooklm pydantic
```

## Advanced Configuration

### Running on a Different Port

If you need to run on a specific port, you can modify the server to use streamable HTTP transport instead of stdio. See the MCP documentation for details.

### Environment Variables

You can pass environment variables to the server:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": {
        "NOTEBOOKLM_BROWSER": "firefox"
      }
    }
  }
}
```

## Integration Ideas

Once you have the MCP server running, you can:

1. **Research Assistant**: Add URLs or YouTube videos, then ask Claude to summarize them
2. **Content Creation**: Generate slides, quizzes, or audio from your research materials
3. **Learning Tool**: Create notebooks with study materials and auto-generate quizzes
4. **Document Analysis**: Upload PDFs and ask questions about their content

## Support

For issues with:
- **Claude Code integration**: Check Claude Code documentation
- **NotebookLM API**: See the main README.md
- **notebooklm-py library**: Visit https://github.com/teng-lin/notebooklm-py
