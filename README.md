# TheraMenu · Hospital Dietary Intelligence Platform

A clinical therapeutic menu planning system for hospitals combining a local clinical engine, Claude AI review, and USDA FoodData Central nutrient enrichment.

---

## Project Map

```
Thera-menu-main/      → Main app  (React 19 + TypeScript + Tailwind + Node.js)
Costing-app-main/     → Recipe costing analysis app (React + TypeScript)
api/                  → Recipe Intelligence REST API (Python FastAPI)
database/             → SQLite schema + seed scripts for the Recipe API
data/                 → Raw data (USDA CSVs, branded foods, clinical audits)
_imports/             → AUSNUT Australian nutrition data + resource pack
notebooklm-mcp/       → Claude + Google NotebookLM automation scripts
scripts/              → Utility/pipeline scripts
prompts/              → Saved AI prompts
```

---

## Quick Start — TheraMenu App

### 1. Install dependencies

```bash
cd Thera-menu-main
npm install          # also installs @types/react and @types/react-dom
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — fill in ANTHROPIC_API_KEY and VITE_USDA_FDC_API_KEY
```

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for AI) | Claude API key — server-side only |
| `VITE_USDA_FDC_API_KEY` | Yes (for live nutrients) | USDA FDC key — server-side only |
| `VITE_USE_MOCK_DATA` | No | Set `true` for full offline mode |

### 3. Run dev server

```bash
npm run dev          # Vite dev server on http://localhost:3000
```

### 4. Build for production

```bash
npm run build        # outputs to Thera-menu-main/dist/
npm start            # serves dist/ with the standalone Node.js server
```

---

## Quick Start — Recipe Intelligence API (Python)

```bash
# From repo root
pip install -r requirements.txt
uvicorn api.app:app --reload --port 8000
# Docs at http://localhost:8000/docs
```

The API uses `database/recipe_intelligence.sqlite`. To seed it from scratch:

```bash
cd database
python seed_from_csv.py
python validate_database.py
```

---

## Quick Start — NotebookLM Integration

```bash
cd notebooklm-mcp
venv\Scripts\python.exe -m notebooklm login   # one-time Google auth
python integration_demo.py                     # run demo workflows
python quick_start.py                          # interactive tool
```

---

## TheraMenu App — How It Works

Plan generation runs in three sequential stages:

```
Patient form input
      │
      ▼
Stage 1 — Local clinical engine
      Deterministic protocol-based meal plan (offline, no external calls)
      POST /api/internal/clinical-engine/generate
      │
      ▼
Stage 2 — Claude AI review (claude-sonnet-4-6)
      Improves clarity, validates clinical narrative, checks IDDSI/JCI rules
      POST /api/ai/refine
      │
      ▼
Stage 3 — USDA FoodData Central enrichment
      Attaches real per-100g nutrient data to every food item
      POST /api/usda/enrich
      │
      ▼
WeeklyTherapeuticPlan displayed + PDF export
```

Stages 2 and 3 fail gracefully: if keys are missing the original plan is returned with a note.

---

## App Tabs

| Tab | Purpose |
|---|---|
| Protocol Generator | Enter patient data → generate weekly meal plan |
| Blueprint | Browse clinical diagnosis database |
| JCI Screening | Nutritional risk screening tool |
| Compliance | JCI food-safety compliance dashboard |
| Audit Logs | Clinical decision audit trail |

---

## Clinical Protocols Supported

`GENERAL_HOSPITAL` · `T2DM` · `HTN` · `CARDIAC` · `RENAL_STAGE_3` · `RENAL_STAGE_4` · `H_PYLORI` · `GASTRIC` · `PEPTIC_ULCER` · `HEPATIC`

To add a protocol: extend `Thera-menu-main/config/therapeuticSchema.ts`.

---

## Security Notes

- `ANTHROPIC_API_KEY` and `VITE_USDA_FDC_API_KEY` are **server-side only** — Vite masks them and never includes them in the browser bundle.
- `.env.local` is gitignored. Never commit real keys.
- PHI (patient data) is processed locally; only anonymised meal plan JSON is sent to Claude.

---

## Pending Manual Step

After network access is restored, run inside `Thera-menu-main/`:

```bash
npm install
```

This installs `@types/react@^19` and `@types/react-dom@^19` (already in `package.json`) which resolves IDE type errors in React component files.
