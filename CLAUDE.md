# CLAUDE.md — Project Context for Claude Code

## What this project is

**TheraMenu** is a JCI-compliant hospital dietary intelligence platform. It generates weekly therapeutic meal plans for clinical patients, combining:
1. A deterministic local clinical engine (offline-capable)
2. Claude AI review and narrative enrichment
3. Live USDA FoodData Central nutrient data

## Repository layout

```
Thera-menu-main/          MAIN APP — always start here
  App.tsx                 Root component, orchestrates the 3-stage pipeline
  index.tsx               React entry point
  index.html              HTML template (CDN imports: FA icons, Google Fonts)
  types.ts                All shared TypeScript types (WeeklyTherapeuticPlan etc.)
  constants.ts            Clinical protocol text constants
  vite.config.ts          Vite config + internalApiPlugin (server middleware hook)
  components/             React UI components
  services/               Client-side service wrappers (call /api/* endpoints)
  server/                 Node.js server-side middleware (runs inside Vite)
  config/                 Static protocol config (therapeuticSchema.ts) + USDA seed
  resources/              Clinical JSON seeds (diabetes, renal, ESPEN, KDIGO)
  utils/appMode.ts        Detects MOCK vs LIVE execution mode
  data/local-db/          SQLite nutrition database (theramenu-clinical.sqlite)

Costing-app-main/         Separate recipe costing analysis React app
api/                      Python FastAPI — Recipe Intelligence REST API
database/                 SQLite schema + seed scripts for api/
_imports/                 AUSNUT Australian food composition data
notebooklm-mcp/           Google NotebookLM automation (Python + MCP server)
```

## Key architectural rules

- **API keys are server-side only.** `ANTHROPIC_API_KEY` and `VITE_USDA_FDC_API_KEY` live in `.env.local`, are injected into `process.env` by `vite.config.ts`, and are masked (`***configured***`) in the browser bundle. Never move them to `import.meta.env` or expose them client-side.
- **Server files use `.ts` import extensions** (`./foo.ts`) — required for Node.js ESM with `--experimental-strip-types`. Do not remove them from `server/` files.
- **Client/services files do NOT use `.ts` extensions** — Vite resolves them without the extension.
- **Graceful degradation:** All three pipeline stages catch errors and return the previous stage's output rather than crashing. Preserve this pattern.
- **Protocol config is the source of truth.** To add a new diagnosis protocol, extend `config/therapeuticSchema.ts` — the engine reads it at runtime.
- **PHI never leaves the server.** Patient demographics stay in the local clinical engine. Only the anonymised meal plan JSON is sent to Claude.

## How the dev server works

`vite.config.ts` registers `internalApiPlugin()` which hooks into Vite's dev server middleware. All `/api/*` requests are intercepted and handled by `server/internalApi.ts` before Vite's HMR layer sees them. The same handler is wired into `server/index.ts` for standalone production use.

## Execution modes

| Mode | Trigger | Behaviour |
|---|---|---|
| `LIVE` | `ANTHROPIC_API_KEY` set in `.env.local` | Claude + USDA enrichment are active |
| `MOCK` | Key missing or `VITE_USE_MOCK_DATA=true` | Offline fallbacks; no external calls |

Header shows `LOCAL PHI` (MOCK) or `LIVE` in the status badge.

## Common tasks

**Run dev server:**
```bash
cd Thera-menu-main && npm run dev
```

**Run Python API:**
```bash
pip install -r requirements.txt
uvicorn api.app:app --reload --port 8000
```

**Type-check:**
```bash
cd Thera-menu-main && npm run lint
```

**Smoke-test offline clinical engine:**
```bash
cd Thera-menu-main && npm run smoke:offline
```

## Known issues / pending

- `@types/react@^19` and `@types/react-dom@^19` are in `package.json` devDependencies but not yet installed (network was unavailable). Run `npm install` inside `Thera-menu-main/` to resolve IDE React type errors. The Vite build works regardless (`skipLibCheck: true`).
- USDA FDC API key in `.env.local` should be rotated — it was previously in a committed file.

## Local nutrition database

`data/local-db/*.sqlite` is local ETL/runtime data and must not be committed (gitignored). `theramenu-clinical.sqlite` is auto-hydrated from USDA flat files (`FOOD_DES.txt`, `NUT_DATA.txt`, `WEIGHT.txt`) on first server request — place them in `data/usda-flatfiles/`, `resources/usda-flatfiles/`, or set `THERAMENU_USDA_FLATFILE_DIR`. MOCK mode does not require the local DB.

## File relationships worth knowing

- `types.ts` is imported by both client services AND server modules
- `config/therapeuticSchema.ts` is imported by both `services/planValidation.ts` (client) and `server/localClinicalEngineApi.ts` (server)
- `server/localMealPlanner.ts` imports `services/planValidation.ts` — the validation logic is shared across the boundary
