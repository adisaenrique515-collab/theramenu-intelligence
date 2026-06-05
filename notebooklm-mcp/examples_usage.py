#!/usr/bin/env python3
"""
NotebookLM Usage Examples

These scripts demonstrate how to use NotebookLM programmatically.
Before running: Complete authentication with `notebooklm login`
"""

import asyncio
from pathlib import Path
import sys

# Add server module to path
sys.path.insert(0, str(Path(__file__).parent))

from notebooklm import NotebookLMClient


async def example_1_list_notebooks():
    """Example 1: List all your existing notebooks"""
    print("\n" + "="*60)
    print("EXAMPLE 1: List Notebooks")
    print("="*60)

    try:
        client = NotebookLMClient.from_storage()
        if asyncio.iscoroutine(client):
            client = await client

        notebooks = client.list_notebooks()

        if not notebooks:
            print("No notebooks found.")
        else:
            print(f"Found {len(notebooks)} notebook(s):\n")
            for nb in notebooks:
                print(f"  - {nb.title} (ID: {nb.notebook_id})")

        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


async def example_2_create_notebook():
    """Example 2: Create a new notebook and add a source"""
    print("\n" + "="*60)
    print("EXAMPLE 2: Create Notebook & Add Source")
    print("="*60)

    try:
        client = NotebookLMClient.from_storage()
        if asyncio.iscoroutine(client):
            client = await client

        # Create a new notebook
        print("\nCreating notebook: 'AI Research Papers'...")
        notebook = client.create_notebook(title="AI Research Papers")
        print(f"✓ Created notebook: {notebook.title}")
        print(f"  ID: {notebook.notebook_id}\n")

        # Add a URL source
        print("Adding URL source...")
        source = notebook.add_url_source(url="https://arxiv.org/abs/2005.14165")
        print(f"✓ Added source")

        print(f"\nNotebook '{notebook.title}' is ready!")
        print("You can now:")
        print("  - Add more sources")
        print("  - Ask questions about the content")
        print("  - Generate audio, slides, quizzes")

        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


async def example_3_add_multiple_sources():
    """Example 3: Add multiple types of sources to a notebook"""
    print("\n" + "="*60)
    print("EXAMPLE 3: Add Multiple Source Types")
    print("="*60)

    source_examples = {
        "URL": "https://en.wikipedia.org/wiki/Machine_learning",
        "YouTube": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "Text": "Machine learning is a subset of artificial intelligence...",
    }

    print("\nExample code to add different source types:")
    print("\n# Add a web URL")
    print('notebook.add_url_source(url="https://example.com")')

    print("\n# Add a YouTube video")
    print('notebook.add_url_source(url="https://youtube.com/watch?v=...")')

    print("\n# Add text directly")
    print('notebook.add_web_text_source(text="Your text here", title="Custom Text")')

    print("\n# Add a PDF file")
    print('notebook.add_file_source(file_path="/path/to/file.pdf")')

    print("\n# Add from Google Drive")
    print('notebook.add_drive_file_source(drive_file_id="...")')

    return True


async def example_4_generate_audio():
    """Example 4: Generate audio conversation from notebook"""
    print("\n" + "="*60)
    print("EXAMPLE 4: Generate Audio Conversation")
    print("="*60)

    print("\nGenerate audio with different formats:")
    print("\nFormats available:")
    print("  - 'deep-dive': Comprehensive discussion")
    print("  - 'brief': Quick overview")
    print("  - 'critique': Critical analysis")
    print("  - 'debate': Different perspectives debate")

    print("\nExample code:")
    print("\n# Generate deep-dive audio (medium length, English)")
    print('audio = notebook.generate_audio(')
    print('    conversation_format="deep-dive",')
    print('    conversation_length="medium",')
    print('    language="en"')
    print(')')

    print("\n# Get download URL")
    print('print(audio.download_url)')

    return True


async def example_5_generate_slides():
    """Example 5: Generate presentation slides"""
    print("\n" + "="*60)
    print("EXAMPLE 5: Generate Presentation Slides")
    print("="*60)

    print("\nGenerate slides from your notebook content:")
    print("\nExample code:")
    print("\nslides = notebook.generate_slides()")
    print("print(f'Slides generated: {slides.download_url}')")

    print("\n✓ Slides will be in Google Slides format")
    print("✓ Automatically formatted with content from your sources")
    print("✓ Ready to download and present")

    return True


async def example_6_generate_quiz():
    """Example 6: Generate quiz questions"""
    print("\n" + "="*60)
    print("EXAMPLE 6: Generate Quiz")
    print("="*60)

    print("\nCreate a quiz to test understanding of your content:")
    print("\nExample code:")
    print("\nquiz = notebook.generate_quiz()")
    print("for i, question in enumerate(quiz.questions, 1):")
    print("    print(f'{i}. {question}')")

    print("\n✓ Questions automatically created from sources")
    print("✓ Multiple choice format with explanations")
    print("✓ Perfect for studying or teaching")

    return True


async def example_7_generate_flashcards():
    """Example 7: Generate study flashcards"""
    print("\n" + "="*60)
    print("EXAMPLE 7: Generate Flashcards")
    print("="*60)

    print("\nCreate flashcards for spaced repetition learning:")
    print("\nExample code:")
    print("\nflashcards = notebook.generate_flashcards()")
    print("for card in flashcards.cards:")
    print("    print(f'Q: {card.front}')")
    print("    print(f'A: {card.back}')")

    print("\n✓ Key concepts extracted from sources")
    print("✓ Perfect for memorization")
    print("✓ Can import into Anki or other flashcard apps")

    return True


async def example_8_ask_questions():
    """Example 8: Ask questions about notebook content"""
    print("\n" + "="*60)
    print("EXAMPLE 8: Ask Questions with Citations")
    print("="*60)

    print("\nQuery your notebook and get answers with source citations:")
    print("\nExample code:")
    print("\nresponse = notebook.ask(message='What are the key concepts?')")
    print("print(response.answer)")
    print("print(response.sources)")

    print("\n✓ Get answers based only on your sources")
    print("✓ Sources are cited for verification")
    print("✓ Use for research and fact-checking")

    return True


async def example_9_complete_workflow():
    """Example 9: Complete workflow - create, populate, and generate"""
    print("\n" + "="*60)
    print("EXAMPLE 9: Complete Workflow")
    print("="*60)

    print("\nHere's a complete example workflow:\n")
    print("""
# 1. Create notebook
notebook = client.create_notebook(title="Market Research 2024")

# 2. Add multiple sources
notebook.add_url_source(url="https://example.com/report")
notebook.add_url_source(url="https://example.com/analysis")
notebook.add_file_source(file_path="./market_data.pdf")

# 3. Ask questions
response = notebook.ask("What are the top 3 market trends?")
print("Trends:", response.answer)

# 4. Generate learning materials
audio = notebook.generate_audio(conversation_format="deep-dive")
slides = notebook.generate_slides()
quiz = notebook.generate_quiz()

# 5. Download results
print(f"Audio: {audio.download_url}")
print(f"Slides: {slides.download_url}")
print(f"Quiz: {quiz.questions}")
    """)

    return True


async def example_10_error_handling():
    """Example 10: Proper error handling"""
    print("\n" + "="*60)
    print("EXAMPLE 10: Error Handling Best Practices")
    print("="*60)

    print("\nAlways wrap operations in try-except blocks:\n")
    print("""
try:
    # Authenticate
    client = NotebookLMClient.from_storage()
    if asyncio.iscoroutine(client):
        client = await client

    # Create notebook
    notebook = client.create_notebook(title="Research Project")

    # Add sources
    notebook.add_url_source(url="https://example.com")

    # Generate content
    audio = notebook.generate_audio()

    print("✓ Workflow completed successfully")

except FileNotFoundError:
    print("Authentication file not found. Run: notebooklm login")
except ValueError as e:
    print(f"Invalid input: {e}")
except Exception as e:
    print(f"Error: {e}")
    """)

    return True


async def main():
    """Run all examples"""
    print("\n" + "="*70)
    print("NotebookLM USAGE EXAMPLES".center(70))
    print("="*70)

    print("\nBefore running any examples:")
    print("1. Complete authentication: notebooklm login")
    print("2. Run individual examples by calling the functions")
    print("3. Adapt the code for your specific use case")

    # Run examples
    examples = [
        ("List existing notebooks", example_1_list_notebooks),
        ("Create notebook and add source", example_2_create_notebook),
        ("Add multiple source types", example_3_add_multiple_sources),
        ("Generate audio conversation", example_4_generate_audio),
        ("Generate slides", example_5_generate_slides),
        ("Generate quiz", example_6_generate_quiz),
        ("Generate flashcards", example_7_generate_flashcards),
        ("Ask questions with citations", example_8_ask_questions),
        ("Complete workflow", example_9_complete_workflow),
        ("Error handling", example_10_error_handling),
    ]

    print("\n" + "="*70)
    print("Available Examples:")
    print("="*70)

    for i, (name, _) in enumerate(examples, 1):
        print(f"{i:2}. {name}")

    print("\n" + "="*70)
    print("To see code examples, run:")
    print("  python examples_usage.py")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
