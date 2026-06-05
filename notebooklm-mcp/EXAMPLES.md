# NotebookLM Python Usage Guide

This directory contains everything you need to use Google NotebookLM programmatically.

## Quick Setup

### 1. Authenticate with NotebookLM

```bash
cd C:\Users\erick\Downloads\Thera-menu-main-patched\notebooklm-mcp
venv\Scripts\python.exe -m notebooklm login
```

This will:
- Open a browser for Google sign-in
- Save your authentication locally
- Allow programmatic access to NotebookLM

### 2. Run Quick Start (Interactive)

```bash
venv\Scripts\python.exe quick_start.py
```

This is an interactive menu to:
- List your notebooks
- Create new notebooks
- View notebook details

## Python Scripts Available

### `quick_start.py` - Interactive Menu
Simple command-line interface to use NotebookLM.

**Features:**
- List existing notebooks
- Create new notebooks
- View notebook contents
- Easy to use interactively

**Run:**
```bash
python quick_start.py
```

### `examples_usage.py` - Code Examples
Shows 10 different usage patterns with complete code examples.

**Includes:**
1. List notebooks
2. Create notebook & add source
3. Add multiple source types
4. Generate audio conversations
5. Generate presentation slides
6. Generate quiz questions
7. Generate flashcards
8. Ask questions with citations
9. Complete workflow example
10. Error handling patterns

**View:**
```bash
python examples_usage.py
```

### `authenticate.py` - Check Authentication
Verify that your authentication is saved and ready.

**Run:**
```bash
python authenticate.py
```

## Complete Usage Examples

### Example 1: Create a Notebook and Add Sources

```python
from notebooklm import NotebookLMClient
import asyncio

async def main():
    # Load authenticated client
    client = NotebookLMClient.from_storage()
    if asyncio.iscoroutine(client):
        client = await client
    
    # Create notebook
    notebook = client.create_notebook(title="AI Research")
    
    # Add different types of sources
    notebook.add_url_source(url="https://arxiv.org/abs/2005.14165")
    notebook.add_url_source(url="https://www.youtube.com/watch?v=...")
    notebook.add_web_text_source(
        text="Additional context here...",
        title="Custom Text"
    )
    
    print(f"Created: {notebook.title}")

asyncio.run(main())
```

### Example 2: Generate Multiple Content Types

```python
async def main():
    client = NotebookLMClient.from_storage()
    if asyncio.iscoroutine(client):
        client = await client
    
    # Get a notebook
    notebooks = client.list_notebooks()
    notebook = notebooks[0]
    
    # Generate different formats
    audio = notebook.generate_audio(
        conversation_format="deep-dive",
        conversation_length="medium",
        language="en"
    )
    
    slides = notebook.generate_slides()
    quiz = notebook.generate_quiz()
    flashcards = notebook.generate_flashcards()
    
    print(f"Audio: {audio.download_url}")
    print(f"Slides: {slides.download_url}")
    print(f"Quiz questions: {len(quiz.questions)}")
    print(f"Flashcards: {len(flashcards.cards)}")

asyncio.run(main())
```

### Example 3: Ask Questions and Get Citations

```python
async def main():
    client = NotebookLMClient.from_storage()
    if asyncio.iscoroutine(client):
        client = await client
    
    notebook = client.list_notebooks()[0]
    
    # Ask questions and get cited answers
    response = notebook.ask(
        message="What are the main findings?"
    )
    
    print("Answer:")
    print(response.answer)
    
    print("\nSources:")
    for source in response.sources:
        print(f"- {source}")

asyncio.run(main())
```

## API Reference

### NotebookLMClient

#### Methods

**`create_notebook(title: str) -> Notebook`**
- Creates a new notebook with given title

**`list_notebooks() -> List[Notebook]`**
- Returns all notebooks

**`get_notebook(notebook_id: str) -> Notebook`**
- Gets a specific notebook by ID

**`delete_notebook(notebook_id: str)`**
- Deletes a notebook

### Notebook

#### Methods

**`add_url_source(url: str) -> Source`**
- Adds a web URL or YouTube video

**`add_web_text_source(text: str, title: str) -> Source`**
- Adds text directly

**`add_file_source(file_path: str) -> Source`**
- Adds a PDF or document file

**`add_drive_file_source(drive_file_id: str) -> Source`**
- Adds a Google Drive file

**`list_sources() -> List[Source]`**
- Gets all sources in the notebook

**`ask(message: str) -> Response`**
- Asks a question about notebook content
- Returns answer with source citations

**`generate_audio(conversation_format: str, conversation_length: str, language: str) -> Audio`**
- Generates audio conversation
- Formats: "deep-dive", "brief", "critique", "debate"
- Lengths: "short", "medium", "long"

**`generate_slides() -> Slides`**
- Generates Google Slides presentation

**`generate_quiz() -> Quiz`**
- Generates multiple-choice quiz

**`generate_flashcards() -> Flashcards`**
- Generates study flashcards

**`rename(new_title: str)`**
- Renames the notebook

## Common Patterns

### Error Handling

```python
try:
    client = NotebookLMClient.from_storage()
    if asyncio.iscoroutine(client):
        client = await client
    
    # Your code here
    
except FileNotFoundError:
    print("Run: notebooklm login")
except Exception as e:
    print(f"Error: {e}")
```

### Batch Operations

```python
async def process_multiple_notebooks():
    client = NotebookLMClient.from_storage()
    if asyncio.iscoroutine(client):
        client = await client
    
    notebooks = client.list_notebooks()
    
    for notebook in notebooks:
        # Process each notebook
        audio = notebook.generate_audio()
        slides = notebook.generate_slides()
        print(f"Generated for: {notebook.title}")
```

### Working with Files

```python
from pathlib import Path

# Add local PDF
pdf_path = Path("research_paper.pdf")
notebook.add_file_source(file_path=str(pdf_path))

# Save download URL
audio = notebook.generate_audio()
print(f"Download: {audio.download_url}")
```

## Troubleshooting

### "Storage file not found"
Run: `notebooklm login`

### Authentication fails
- Try clearing browser cache/cookies
- Run: `notebooklm login` again
- Check internet connection

### Source not added
- Verify URL is accessible
- For files, check path exists
- For Drive files, ensure file is accessible

### Generation fails
- Ensure notebook has sources
- Wait a moment and retry
- Check NotebookLM service status

## Next Steps

1. **Authenticate:** Run `notebooklm login`
2. **Try interactive:** Run `python quick_start.py`
3. **Write scripts:** Use examples as templates
4. **Automate:** Create workflows in your application

## Support

For issues with the notebooklm-py library:
- GitHub: https://github.com/teng-lin/notebooklm-py
- Issues: Report problems on GitHub

For NotebookLM itself:
- Website: https://notebooklm.google.com
- Help: https://support.google.com/notebooklm
