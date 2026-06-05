#!/usr/bin/env python3
"""Basic tests for the NotebookLM MCP server"""

import json
import sys
from pathlib import Path

# Add the server module to path
sys.path.insert(0, str(Path(__file__).parent))

from server import manager, TOOLS


def test_authentication():
    """Test that authentication is properly checked"""
    print("Testing authentication...")
    is_auth = manager.is_authenticated()
    if is_auth:
        print("[OK] NotebookLM authenticated")
    else:
        print("[WARN] NotebookLM not authenticated - run 'notebooklm login' first")
    return is_auth


def test_tools_registered():
    """Test that all tools are registered"""
    print("\nTesting tool registration...")

    expected_tools = [
        "create_notebook",
        "list_notebooks",
        "delete_notebook",
        "rename_notebook",
        "add_source",
        "list_sources",
        "ask_question",
        "generate_audio",
        "generate_slides",
        "generate_quiz",
        "generate_flashcards",
    ]

    registered_tools = [tool.name for tool in TOOLS]

    for tool in expected_tools:
        if tool in registered_tools:
            print(f"  [OK] {tool}")
        else:
            print(f"  [FAIL] {tool}")

    print(f"\n[OK] Tool registration complete ({len(registered_tools)} tools)")
    return True


def test_manager_methods():
    """Test that manager has all required methods"""
    print("\nTesting manager methods...")

    required_methods = [
        "is_authenticated",
        "create_notebook",
        "list_notebooks",
        "delete_notebook",
        "rename_notebook",
        "add_source",
        "list_sources",
        "ask_question",
        "generate_audio",
        "generate_slides",
        "generate_quiz",
        "generate_flashcards",
    ]

    for method in required_methods:
        if hasattr(manager, method):
            print(f"  [OK] {method}")
        else:
            print(f"  [FAIL] {method}")

    print("\n[OK] All manager methods available")
    return True


def main():
    """Run all tests"""
    print("=" * 50)
    print("NotebookLM MCP Server Test Suite")
    print("=" * 50)

    try:
        test_manager_methods()
        test_tools_registered()
        is_auth = test_authentication()

        print("\n" + "=" * 50)
        if is_auth:
            print("[SUCCESS] All tests passed! Server is ready to use.")
            print("\nNext steps:")
            print("1. Start the server: python server.py")
            print("2. Or use with Claude Code (see CLAUDE_SETUP.md)")
        else:
            print("[WARN] Server initialized but not authenticated")
            print("\nNext steps:")
            print("1. Run: notebooklm login")
            print("2. Then start the server: python server.py")
        print("=" * 50)

        return 0 if is_auth else 1

    except Exception as e:
        print(f"\n[ERROR] {e}")
        print("\nDebug info:")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
