# Recipe Intelligence API

SQLite + FastAPI backend for the Recipe Intelligence Database. It stores commercial metadata, scores, monetization tags, and original derivative concepts. It does not store full copyrighted recipe instructions.

## Setup

```powershell
pip install -r requirements.txt
# Seed from 7 NotebookLM notebook sources (authoritative)
python database/seed_notebooks.py
# Or re-seed from CSV export
python database/seed_from_csv.py --csv data/master/recipe_commercial_intelligence.csv
python database/validate_database.py
uvicorn api.app:app --host 127.0.0.1 --port 8000
```

## Database

Default database:

`database/recipe_intelligence.sqlite`

Seed sources:

- `database/seed_notebooks.py` — authoritative seed from NB-055, 056, 074, 081, 090, 107, 108
- `database/seed_from_csv.py` — CSV-based bulk import from `data/master/recipe_commercial_intelligence.csv`

## Endpoints

- `GET /recipes`
- `GET /recipes/{id}`
- `GET /recipes/search?ingredient=&cuisine=&category=`
- `GET /ingredients`
- `GET /scores/top-commercial`
- `GET /scores/top-catering`
- `GET /scores/top-ghost-kitchen`
- `GET /scores/top-productization`
- `GET /concepts`
- `GET /concepts/safari-lounge`
- `GET /concepts/scarcity-drops`
- `GET /recommendations/menu`
- `GET /recommendations/catering`
- `GET /recommendations/ghost-kitchen`
- `GET /recommendations/scarcity-drops`
- `GET /recommendations/safari-lounge`
- `GET /analytics/cross-utilisation`
- `GET /exports/notebooklm-pack`
- `GET /exports/brief?product=menu&format=markdown`
- `GET /audits/menu-leak`
- `GET /audits/white-label-offer`
- `GET /audits/export?format=pdf`

## Sample Queries

```powershell
Invoke-RestMethod http://127.0.0.1:8000/recipes?limit=5
Invoke-RestMethod "http://127.0.0.1:8000/recipes/search?ingredient=beef&limit=5"
Invoke-RestMethod http://127.0.0.1:8000/scores/top-commercial?limit=10
Invoke-RestMethod http://127.0.0.1:8000/concepts/safari-lounge?limit=10
Invoke-RestMethod "http://127.0.0.1:8000/recommendations/menu?account_mode=white_label&limit=5"
Invoke-RestMethod "http://127.0.0.1:8000/recommendations/catering?ingredient=beef&limit=5"
Invoke-RestMethod "http://127.0.0.1:8000/recommendations/ghost-kitchen?category=Hot%20Main&limit=5"
Invoke-RestMethod "http://127.0.0.1:8000/recommendations/scarcity-drops?account_mode=creator&limit=5"
Invoke-RestMethod http://127.0.0.1:8000/analytics/cross-utilisation?limit=10
Invoke-RestMethod "http://127.0.0.1:8000/exports/notebooklm-pack?account_mode=white_label&limit=20"
Invoke-RestMethod "http://127.0.0.1:8000/exports/brief?product=menu&format=markdown&limit=10"
Invoke-RestMethod "http://127.0.0.1:8000/audits/menu-leak?consultant_brand=Your%20Brand&client_name=Client%20Venue&limit=10"
Invoke-RestMethod "http://127.0.0.1:8000/audits/white-label-offer"
Invoke-WebRequest "http://127.0.0.1:8000/audits/export?client_name=Client%20Venue&format=pdf&limit=10" -OutFile client_menu_audit.pdf
```

## Commercial Account Modes

- `creator`: food creators, pop-ups, home chefs; optimized for preorder rhythm and scarcity drops.
- `venue`: restaurants, cafes, bars, caterers; optimized for deployability, efficiency, catering, and margin.
- `consultant`: hospitality consultants; optimized for audit evidence and client-ready recommendations.
- `white_label`: consultants, agencies, food-tech builders; optimized for resellable intelligence and exports.
- `internal_safari_lounge`: Safari Lounge internal team or licensees; optimized for fusion IP and weekly drops.

## Export Formats

`GET /exports/brief` supports:

- `format=json`
- `format=csv`
- `format=markdown`
- `format=pdf`

`product` supports:

- `menu`
- `catering`
- `ghost_kitchen`
- `scarcity_drops`
- `safari_lounge`

`GET /exports/notebooklm-pack` writes a NotebookLM-ready source bundle to `data/exports`.

## White-Label Menu Audit SaaS

Use `/audits/menu-leak` and `/audits/export` as the first sellable SaaS surface.

The audit product returns:

- audit priority score
- menu leak risk score
- hidden winner score
- client-facing subscription tiers
- white-label consultant branding
- exportable JSON, CSV, Markdown, and PDF briefs

Example use:

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/audits/menu-leak?consultant_brand=Acme%20Menu%20Lab&client_name=Safari%20Lounge&limit=20"
Invoke-WebRequest "http://127.0.0.1:8000/audits/export?consultant_brand=Acme%20Menu%20Lab&client_name=Safari%20Lounge&format=pdf&limit=20" -OutFile safari_lounge_audit.pdf
```

## Sample Responses

Generated JSON samples live in:

`data/api_samples`

Run:

```powershell
python database/sample_api_responses.py
```

## Retrieval Backend Notes

The current schema is ready for Gemini/OpenAI retrieval:

- Use `recipes.summary`, `derived_concepts.original_derivative_description`, and categorical fields as retrievable text.
- Use `commercial_scores` and `monetization_tags` as ranking/filter signals.
- Keep full copyrighted recipe text outside the database.
- Add embeddings later in a separate `recipe_embeddings` table keyed by `recipe_id`.
- 
