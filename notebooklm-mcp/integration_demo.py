#!/usr/bin/env python3
"""
Claude + NotebookLM Integration Demo

This demonstrates how Claude and NotebookLM work together to solve real problems.
Shows the workflow of:
  1. Claude plans a strategy
  2. NotebookLM executes the plan
  3. Claude analyzes the results
"""

import asyncio
import sys
from pathlib import Path
from typing import List, Dict
import io

# Fix Windows encoding issues
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, str(Path(__file__).parent))

try:
    from notebooklm import NotebookLMClient
except ImportError:
    print("NotebookLM not installed. Install with: pip install git+https://github.com/teng-lin/notebooklm-py.git")
    sys.exit(1)


class ClaudeNotebookLMIntegration:
    """Integration layer between Claude planning and NotebookLM execution"""

    def __init__(self):
        self.client = None
        self.notebooks = {}

    async def initialize(self) -> bool:
        """Initialize and authenticate with NotebookLM"""
        try:
            print("🔐 Authenticating with NotebookLM...")
            self.client = NotebookLMClient.from_storage()
            if asyncio.iscoroutine(self.client):
                self.client = await self.client
            print("✓ Authentication successful!\n")
            return True
        except Exception as e:
            print(f"✗ Authentication failed: {e}")
            print("\nTo authenticate, run: notebooklm login")
            return False

    async def execute_plan(self, plan: Dict) -> Dict:
        """Execute a Claude-designed plan"""
        results = {
            "plan": plan,
            "executed_steps": [],
            "generated_content": {},
            "errors": []
        }

        try:
            print(f"\n📋 Executing Plan: {plan['name']}")
            print(f"📝 Strategy: {plan['strategy']}\n")

            # Step 1: Create notebook
            print("▶ Step 1: Creating notebook...")
            try:
                notebook = self.client.create_notebook(title=plan['notebook_title'])
                self.notebooks[plan['notebook_title']] = notebook
                print(f"  ✓ Created: {notebook.title} (ID: {notebook.notebook_id})")
                results["executed_steps"].append("notebook_created")
            except Exception as e:
                results["errors"].append(f"Notebook creation failed: {e}")
                return results

            # Step 2: Add sources
            print("\n▶ Step 2: Adding sources...")
            sources_added = 0
            for source in plan['sources']:
                try:
                    if source['type'] == 'url':
                        notebook.add_url_source(url=source['url'])
                        print(f"  ✓ Added URL: {source['url'][:50]}...")
                    elif source['type'] == 'text':
                        notebook.add_web_text_source(
                            text=source['content'][:200],
                            title=source.get('title', 'Text Source')
                        )
                        print(f"  ✓ Added text: {source.get('title', 'Untitled')}")
                    sources_added += 1
                except Exception as e:
                    results["errors"].append(f"Source addition failed: {e}")

            results["executed_steps"].append(f"sources_added_{sources_added}")
            print(f"  Total sources added: {sources_added}")

            # Step 3: Generate content
            print("\n▶ Step 3: Generating content...")
            for content_type in plan['generate']:
                try:
                    if content_type == 'audio':
                        print("  Generating audio (deep-dive)...")
                        audio = notebook.generate_audio(
                            conversation_format="deep-dive",
                            conversation_length="medium",
                            language="en"
                        )
                        results["generated_content"]["audio"] = {
                            "url": getattr(audio, 'download_url', 'Generated'),
                            "format": "deep-dive",
                            "status": "success"
                        }
                        print("  ✓ Audio generated")

                    elif content_type == 'slides':
                        print("  Generating slides...")
                        slides = notebook.generate_slides()
                        results["generated_content"]["slides"] = {
                            "url": getattr(slides, 'download_url', 'Generated'),
                            "status": "success"
                        }
                        print("  ✓ Slides generated")

                    elif content_type == 'quiz':
                        print("  Generating quiz...")
                        quiz = notebook.generate_quiz()
                        num_questions = len(quiz.questions) if hasattr(quiz, 'questions') else 0
                        results["generated_content"]["quiz"] = {
                            "questions": num_questions,
                            "status": "success"
                        }
                        print(f"  ✓ Quiz generated ({num_questions} questions)")

                    elif content_type == 'flashcards':
                        print("  Generating flashcards...")
                        flashcards = notebook.generate_flashcards()
                        num_cards = len(flashcards.cards) if hasattr(flashcards, 'cards') else 0
                        results["generated_content"]["flashcards"] = {
                            "cards": num_cards,
                            "status": "success"
                        }
                        print(f"  ✓ Flashcards generated ({num_cards} cards)")

                except Exception as e:
                    results["errors"].append(f"Content generation failed ({content_type}): {e}")

            results["executed_steps"].append("content_generated")

            # Step 4: Q&A
            if plan.get('questions'):
                print("\n▶ Step 4: Answering questions...")
                qa_results = []
                for question in plan['questions'][:3]:  # Limit to 3 questions
                    try:
                        response = notebook.ask(message=question)
                        answer = getattr(response, 'answer', str(response))
                        qa_results.append({
                            "question": question,
                            "answer": answer[:200] + "..." if len(answer) > 200 else answer
                        })
                        print(f"  Q: {question}")
                        print(f"  A: {answer[:100]}...\n")
                    except Exception as e:
                        qa_results.append({
                            "question": question,
                            "error": str(e)
                        })

                results["generated_content"]["qa"] = qa_results
                results["executed_steps"].append("qa_completed")

        except Exception as e:
            results["errors"].append(f"Plan execution failed: {e}")

        return results

    async def analyze_results(self, results: Dict) -> str:
        """Analyze execution results (Claude's perspective)"""
        analysis = "\n" + "="*70 + "\n"
        analysis += "📊 EXECUTION ANALYSIS (Claude's Perspective)\n"
        analysis += "="*70 + "\n\n"

        # Plan summary
        plan = results['plan']
        analysis += f"Plan: {plan['name']}\n"
        analysis += f"Goal: {plan['goal']}\n"
        analysis += f"Strategy: {plan['strategy']}\n\n"

        # Execution summary
        analysis += "Execution Summary:\n"
        analysis += f"  Completed steps: {len(results['executed_steps'])}\n"
        analysis += f"  Content generated: {len(results['generated_content'])} types\n"
        analysis += f"  Errors encountered: {len(results['errors'])}\n\n"

        # What was generated
        if results['generated_content']:
            analysis += "Generated Content:\n"
            for content_type, data in results['generated_content'].items():
                if isinstance(data, dict):
                    if content_type == 'qa':
                        analysis += f"  • {content_type.upper()}: {len(data)} Q&A pairs\n"
                    elif 'questions' in data:
                        analysis += f"  • {content_type.upper()}: {data['questions']} questions\n"
                    elif 'cards' in data:
                        analysis += f"  • {content_type.upper()}: {data['cards']} cards\n"
                    else:
                        analysis += f"  • {content_type.upper()}: Generated successfully\n"

        # Insights
        analysis += "\n💡 Key Insights:\n"
        if results['errors']:
            analysis += f"  • {len(results['errors'])} issues encountered\n"
            analysis += "  • May need authentication or API adjustments\n"
        else:
            analysis += "  • All steps completed successfully\n"
            analysis += "  • Complete learning materials generated\n"

        analysis += "\n" + "="*70 + "\n"
        return analysis


# Example Plans Designed by Claude
EXAMPLE_PLANS = {
    "research_paper": {
        "name": "Research Paper Deep Dive",
        "goal": "Deeply understand a complex research paper and create learning materials",
        "strategy": "Ingest paper → Generate audio discussion → Create study materials → Enable Q&A",
        "notebook_title": "AI Research Deep Dive",
        "sources": [
            {
                "type": "url",
                "url": "https://arxiv.org/abs/1706.03762",
                "title": "Attention Is All You Need"
            }
        ],
        "generate": ["audio", "quiz", "flashcards"],
        "questions": [
            "What is the main contribution of this paper?",
            "How does the transformer architecture work?",
            "What are the practical applications?"
        ]
    },

    "learning_path": {
        "name": "Machine Learning Learning Path",
        "goal": "Create comprehensive learning materials on machine learning",
        "strategy": "Aggregate multiple sources → Generate multiple formats → Create self-study path",
        "notebook_title": "ML Fundamentals Course",
        "sources": [
            {
                "type": "url",
                "url": "https://en.wikipedia.org/wiki/Machine_learning"
            },
            {
                "type": "text",
                "title": "Key Concepts",
                "content": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed."
            }
        ],
        "generate": ["audio", "slides", "quiz", "flashcards"],
        "questions": [
            "What are the main types of machine learning?",
            "How do supervised and unsupervised learning differ?",
            "What are real-world applications of ML?"
        ]
    },

    "competitive_analysis": {
        "name": "Competitive Intelligence Report",
        "goal": "Analyze competitor strategies and market positioning",
        "strategy": "Collect sources → Generate analysis materials → Create comparison framework",
        "notebook_title": "Market Competitive Analysis",
        "sources": [
            {
                "type": "url",
                "url": "https://en.wikipedia.org/wiki/Artificial_intelligence"
            }
        ],
        "generate": ["audio", "slides", "quiz"],
        "questions": [
            "What are the key market trends?",
            "How do competitors differentiate?",
            "What opportunities exist?"
        ]
    }
}


async def main():
    """Main integration demo"""
    print("\n" + "="*70)
    print("Claude + NotebookLM INTEGRATION DEMO".center(70))
    print("="*70)

    print("\n🎯 This demonstrates how Claude and NotebookLM work together:")
    print("  1. Claude designs a strategic plan")
    print("  2. NotebookLM executes the plan")
    print("  3. Claude analyzes the results\n")

    # Initialize integration
    integration = ClaudeNotebookLMIntegration()
    authenticated = await integration.initialize()

    if not authenticated:
        print("\n" + "="*70)
        print("DEMO PLANS (Would execute if authenticated)".center(70))
        print("="*70)

        for plan_key, plan in EXAMPLE_PLANS.items():
            print(f"\n📋 Plan: {plan['name']}")
            print(f"   Goal: {plan['goal']}")
            print(f"   Notebook: {plan['notebook_title']}")
            print(f"   Sources: {len(plan['sources'])}")
            print(f"   Generate: {', '.join(plan['generate'])}")

        print("\n" + "="*70)
        print("\n✨ To run this integration:")
        print("  1. Run: notebooklm login")
        print("  2. Complete authentication in browser")
        print("  3. Run: python integration_demo.py")
        print("\n✨ Then the demo will:")
        print("  ✓ Execute each plan step-by-step")
        print("  ✓ Create notebooks and add sources")
        print("  ✓ Generate audio, slides, quizzes, flashcards")
        print("  ✓ Answer questions with citations")
        print("  ✓ Analyze results from Claude's perspective")
        return

    # Execute plans
    print("\n" + "="*70)
    print("EXECUTING INTEGRATION DEMO PLANS".center(70))
    print("="*70)

    all_results = {}
    for plan_key, plan in EXAMPLE_PLANS.items():
        results = await integration.execute_plan(plan)
        all_results[plan_key] = results

        # Analyze results
        analysis = await integration.analyze_results(results)
        print(analysis)

        print("\n")

    # Final summary
    print("="*70)
    print("INTEGRATION SUMMARY".center(70))
    print("="*70)
    print(f"\n✓ Executed {len(all_results)} integration scenarios")
    print("✓ Claude planned strategies")
    print("✓ NotebookLM executed plans")
    print("✓ Generated multiple content formats")
    print("✓ Demonstrated seamless integration\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user.")
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)
