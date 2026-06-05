#!/usr/bin/env python3
"""NotebookLM MCP Server

An MCP server that provides programmatic access to Google NotebookLM
via the notebooklm-py library.
"""

import asyncio
import json
import logging
import sys
from typing import Any, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from pydantic import BaseModel, Field

try:
    from notebooklm import NotebookLMClient
except ImportError:
    raise ImportError(
        "notebooklm-py is required. Install with: pip install notebooklm"
    )

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MCP server
server = Server("notebooklm-mcp")


class NotebookLMManager:
    """Manages NotebookLM client and operations"""

    def __init__(self):
        self.client = None
        self._ensure_authenticated()

    def _ensure_authenticated(self):
        """Ensure client is authenticated"""
        try:
            # Try to load from existing storage (handle both sync and async)
            auth_result = NotebookLMClient.from_storage()
            # If it's a coroutine, we need to run it
            if asyncio.iscoroutine(auth_result):
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                self.client = loop.run_until_complete(auth_result)
            else:
                self.client = auth_result
            logger.info("Loaded authentication from storage")
        except Exception as e:
            logger.warning(f"Could not load from storage: {e}")
            logger.info("Please run 'notebooklm login' first to authenticate")
            self.client = None

    def is_authenticated(self) -> bool:
        """Check if authenticated"""
        return self.client is not None

    def create_notebook(self, title: str) -> dict:
        """Create a new notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.create_notebook(title=title)
        return {
            "id": notebook.notebook_id,
            "title": notebook.title,
        }

    def list_notebooks(self) -> list[dict]:
        """List all notebooks"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebooks = self.client.list_notebooks()
        return [
            {
                "id": nb.notebook_id,
                "title": nb.title,
            }
            for nb in notebooks
        ]

    def delete_notebook(self, notebook_id: str) -> dict:
        """Delete a notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        self.client.delete_notebook(notebook_id=notebook_id)
        return {"success": True, "notebook_id": notebook_id}

    def rename_notebook(self, notebook_id: str, new_title: str) -> dict:
        """Rename a notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        notebook.rename(new_title)
        return {"notebook_id": notebook_id, "new_title": new_title}

    def add_source(
        self,
        notebook_id: str,
        source_type: str,
        content: str,
        title: Optional[str] = None,
    ) -> dict:
        """Add a source to a notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)

        if source_type == "url":
            source = notebook.add_url_source(url=content)
        elif source_type == "youtube":
            source = notebook.add_url_source(url=content)
        elif source_type == "text":
            source = notebook.add_web_text_source(text=content, title=title or "Text")
        elif source_type == "pdf":
            source = notebook.add_file_source(file_path=content)
        elif source_type == "drive":
            source = notebook.add_drive_file_source(drive_file_id=content)
        else:
            raise ValueError(f"Unknown source type: {source_type}")

        return {
            "notebook_id": notebook_id,
            "source_id": source.source_id if hasattr(source, "source_id") else "unknown",
            "type": source_type,
        }

    def list_sources(self, notebook_id: str) -> list[dict]:
        """List sources in a notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        sources = notebook.sources

        return [
            {
                "id": getattr(s, "source_id", str(i)),
                "title": getattr(s, "title", "Unknown"),
                "type": getattr(s, "source_type", "unknown"),
            }
            for i, s in enumerate(sources)
        ]

    def ask_question(self, notebook_id: str, question: str) -> dict:
        """Ask a question about notebook sources"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        response = notebook.ask(message=question)

        return {
            "question": question,
            "answer": response.answer if hasattr(response, "answer") else str(response),
            "sources": getattr(response, "sources", []),
        }

    def generate_audio(
        self,
        notebook_id: str,
        format: str = "deep-dive",
        length: str = "medium",
        language: str = "en",
    ) -> dict:
        """Generate audio from notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        audio = notebook.generate_audio(
            conversation_format=format,
            conversation_length=length,
            language=language,
        )

        return {
            "notebook_id": notebook_id,
            "format": format,
            "length": length,
            "language": language,
            "status": "generated",
            "download_url": getattr(audio, "download_url", None),
        }

    def generate_slides(self, notebook_id: str) -> dict:
        """Generate slides from notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        slides = notebook.generate_slides()

        return {
            "notebook_id": notebook_id,
            "status": "generated",
            "download_url": getattr(slides, "download_url", None),
        }

    def generate_quiz(self, notebook_id: str) -> dict:
        """Generate quiz from notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        quiz = notebook.generate_quiz()

        return {
            "notebook_id": notebook_id,
            "status": "generated",
            "questions": len(quiz.questions) if hasattr(quiz, "questions") else 0,
        }

    def generate_flashcards(self, notebook_id: str) -> dict:
        """Generate flashcards from notebook"""
        if not self.is_authenticated():
            raise RuntimeError("Not authenticated. Run 'notebooklm login' first")

        notebook = self.client.get_notebook(notebook_id=notebook_id)
        flashcards = notebook.generate_flashcards()

        return {
            "notebook_id": notebook_id,
            "status": "generated",
            "cards": len(flashcards.cards) if hasattr(flashcards, "cards") else 0,
        }


# Initialize manager
manager = NotebookLMManager()


# List of available tools
TOOLS = [
    Tool(
        name="create_notebook",
        description="Create a new NotebookLM notebook",
        inputSchema={
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Title for the new notebook",
                }
            },
            "required": ["title"],
        },
    ),
    Tool(
        name="list_notebooks",
        description="List all NotebookLM notebooks",
        inputSchema={
            "type": "object",
            "properties": {},
            "required": [],
        },
    ),
    Tool(
        name="delete_notebook",
        description="Delete a NotebookLM notebook",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook to delete",
                }
            },
            "required": ["notebook_id"],
        },
    ),
    Tool(
        name="rename_notebook",
        description="Rename a NotebookLM notebook",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook to rename",
                },
                "new_title": {
                    "type": "string",
                    "description": "New title for the notebook",
                },
            },
            "required": ["notebook_id", "new_title"],
        },
    ),
    Tool(
        name="add_source",
        description="Add a source (URL, YouTube, text, PDF, or Drive file) to a notebook",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                },
                "source_type": {
                    "type": "string",
                    "enum": ["url", "youtube", "text", "pdf", "drive"],
                    "description": "Type of source to add",
                },
                "content": {
                    "type": "string",
                    "description": "URL, YouTube link, text content, file path, or Drive file ID",
                },
                "title": {
                    "type": "string",
                    "description": "Optional title for the source (required for text sources)",
                },
            },
            "required": ["notebook_id", "source_type", "content"],
        },
    ),
    Tool(
        name="list_sources",
        description="List all sources in a notebook",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                }
            },
            "required": ["notebook_id"],
        },
    ),
    Tool(
        name="ask_question",
        description="Ask a question about the sources in a notebook",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                },
                "question": {
                    "type": "string",
                    "description": "Question to ask about the notebook sources",
                },
            },
            "required": ["notebook_id", "question"],
        },
    ),
    Tool(
        name="generate_audio",
        description="Generate an audio conversation from notebook sources",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                },
                "format": {
                    "type": "string",
                    "enum": ["deep-dive", "brief", "critique", "debate"],
                    "description": "Audio conversation format",
                },
                "length": {
                    "type": "string",
                    "enum": ["short", "medium", "long"],
                    "description": "Length of the audio",
                },
                "language": {
                    "type": "string",
                    "description": "Language code (e.g., en, es, fr, de)",
                },
            },
            "required": ["notebook_id"],
        },
    ),
    Tool(
        name="generate_slides",
        description="Generate slides from notebook sources",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                }
            },
            "required": ["notebook_id"],
        },
    ),
    Tool(
        name="generate_quiz",
        description="Generate a quiz from notebook sources",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                }
            },
            "required": ["notebook_id"],
        },
    ),
    Tool(
        name="generate_flashcards",
        description="Generate flashcards from notebook sources",
        inputSchema={
            "type": "object",
            "properties": {
                "notebook_id": {
                    "type": "string",
                    "description": "ID of the notebook",
                }
            },
            "required": ["notebook_id"],
        },
    ),
]


@server.list_tools()
async def list_tools():
    """Return list of available tools"""
    return TOOLS


@server.call_tool()
async def handle_tool_call(name: str, arguments: dict):
    """Handle tool calls from the client"""
    try:
        if name == "create_notebook":
            result = manager.create_notebook(title=arguments["title"])
        elif name == "list_notebooks":
            result = manager.list_notebooks()
        elif name == "delete_notebook":
            result = manager.delete_notebook(notebook_id=arguments["notebook_id"])
        elif name == "rename_notebook":
            result = manager.rename_notebook(
                notebook_id=arguments["notebook_id"],
                new_title=arguments["new_title"],
            )
        elif name == "add_source":
            result = manager.add_source(
                notebook_id=arguments["notebook_id"],
                source_type=arguments["source_type"],
                content=arguments["content"],
                title=arguments.get("title"),
            )
        elif name == "list_sources":
            result = manager.list_sources(notebook_id=arguments["notebook_id"])
        elif name == "ask_question":
            result = manager.ask_question(
                notebook_id=arguments["notebook_id"],
                question=arguments["question"],
            )
        elif name == "generate_audio":
            result = manager.generate_audio(
                notebook_id=arguments["notebook_id"],
                format=arguments.get("format", "deep-dive"),
                length=arguments.get("length", "medium"),
                language=arguments.get("language", "en"),
            )
        elif name == "generate_slides":
            result = manager.generate_slides(notebook_id=arguments["notebook_id"])
        elif name == "generate_quiz":
            result = manager.generate_quiz(notebook_id=arguments["notebook_id"])
        elif name == "generate_flashcards":
            result = manager.generate_flashcards(notebook_id=arguments["notebook_id"])
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

        return [TextContent(type="text", text=json.dumps(result))]

    except Exception as e:
        logger.error(f"Error handling tool {name}: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    """Run the MCP server"""
    if not manager.is_authenticated():
        logger.warning("NotebookLM authentication required. Run 'notebooklm login' first.")
    else:
        logger.info("NotebookLM authenticated and ready!")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, {})


if __name__ == "__main__":
    asyncio.run(main())
