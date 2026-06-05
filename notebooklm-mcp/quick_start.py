#!/usr/bin/env python3
"""
NotebookLM Quick Start Utility

A simple command-line tool to use NotebookLM programmatically.
Run this after completing: notebooklm login
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from notebooklm import NotebookLMClient


async def quick_start():
    """Interactive quick start guide"""
    print("\n" + "="*70)
    print("NotebookLM Quick Start".center(70))
    print("="*70)

    # Check authentication
    try:
        print("\nChecking authentication...")
        client = NotebookLMClient.from_storage()
        if asyncio.iscoroutine(client):
            client = await client
        print("✓ Authentication successful!")

    except Exception as e:
        print(f"✗ Authentication failed: {e}")
        print("\nPlease run: notebooklm login")
        return

    # Menu
    while True:
        print("\n" + "-"*70)
        print("What would you like to do?")
        print("-"*70)
        print("1. List your notebooks")
        print("2. Create a new notebook")
        print("3. Get notebook details")
        print("0. Exit")
        print("-"*70)

        choice = input("\nEnter your choice (0-3): ").strip()

        if choice == "0":
            print("\nGoodbye!")
            break

        elif choice == "1":
            await list_notebooks(client)

        elif choice == "2":
            await create_notebook(client)

        elif choice == "3":
            await notebook_details(client)

        else:
            print("Invalid choice. Please try again.")


async def list_notebooks(client):
    """List all notebooks"""
    print("\nFetching notebooks...")
    try:
        notebooks = client.list_notebooks()

        if not notebooks:
            print("No notebooks found.")
        else:
            print(f"\nYou have {len(notebooks)} notebook(s):\n")
            for i, nb in enumerate(notebooks, 1):
                print(f"{i}. {nb.title}")
                print(f"   ID: {nb.notebook_id}\n")

    except Exception as e:
        print(f"Error: {e}")


async def create_notebook(client):
    """Create a new notebook"""
    print("\nCreate a new notebook")
    title = input("Enter notebook title: ").strip()

    if not title:
        print("Title cannot be empty.")
        return

    try:
        print(f"\nCreating notebook '{title}'...")
        notebook = client.create_notebook(title=title)
        print(f"✓ Created: {notebook.title}")
        print(f"  ID: {notebook.notebook_id}")
        print("\nNext steps:")
        print(f"  1. Add sources: notebook.add_url_source(url='...')")
        print(f"  2. Ask questions: notebook.ask(message='...')")
        print(f"  3. Generate content: notebook.generate_audio()")

    except Exception as e:
        print(f"Error: {e}")


async def notebook_details(client):
    """Get details about a specific notebook"""
    print("\nGet notebook details")

    try:
        notebooks = client.list_notebooks()

        if not notebooks:
            print("No notebooks found.")
            return

        print("\nSelect a notebook:")
        for i, nb in enumerate(notebooks, 1):
            print(f"{i}. {nb.title}")

        choice = input("Enter number: ").strip()

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(notebooks):
                nb = notebooks[idx]
                print(f"\nNotebook: {nb.title}")
                print(f"ID: {nb.notebook_id}")

                # Get sources
                sources = nb.sources
                print(f"\nSources ({len(sources)}):")
                if sources:
                    for source in sources:
                        title = getattr(source, 'title', 'Unknown')
                        stype = getattr(source, 'source_type', 'unknown')
                        print(f"  - {title} ({stype})")
                else:
                    print("  No sources yet")

            else:
                print("Invalid number.")

        except ValueError:
            print("Invalid input.")

    except Exception as e:
        print(f"Error: {e}")


async def main():
    """Main entry point"""
    try:
        await quick_start()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user.")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
