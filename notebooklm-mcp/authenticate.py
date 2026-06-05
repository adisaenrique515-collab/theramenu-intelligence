#!/usr/bin/env python3
"""NotebookLM Authentication Script"""

import sys
import asyncio
from pathlib import Path

# Add server module to path
sys.path.insert(0, str(Path(__file__).parent))

from notebooklm import NotebookLMClient


async def authenticate():
    """Authenticate with NotebookLM"""
    print("\n" + "="*60)
    print("NotebookLM Authentication")
    print("="*60)

    try:
        print("\nAttempting to load existing authentication...")
        client = NotebookLMClient.from_storage()

        if asyncio.iscoroutine(client):
            client = await client

        print("[OK] Successfully loaded existing authentication!")
        print(f"[OK] NotebookLM client is ready")

        return True

    except Exception as e:
        print(f"[INFO] No existing authentication found: {e}")
        print("\nTo authenticate:")
        print("1. Open your browser and go to: https://notebooklm.google.com")
        print("2. Sign in with your Google account")
        print("3. Grant NotebookLM access")
        print("4. The credentials will be automatically saved")
        print("\nOnce authenticated, this script can use NotebookLM programmatically.")
        return False


if __name__ == "__main__":
    result = asyncio.run(authenticate())
    sys.exit(0 if result else 1)
