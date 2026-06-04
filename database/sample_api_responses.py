#!/usr/bin/env python
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.models.intelligence import (
    add_monetization_context,
    audit_payload,
    build_notebooklm_pack,
    cross_utilisation_rows,
    recommendation_rows,
)
DB = ROOT / "database" / "recipe_intelligence.sqlite"
OUT = ROOT / "data" / "api_samples"


def rows(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    conn.row_factory = sqlite3.Row
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    samples = {
        "recipes.json": rows(
            conn,
            """
            SELECT r.id, r.title, r.cuisine_family, r.dish_category, cs.commercial_deployability_score
            FROM recipes r
            JOIN commercial_scores cs ON cs.recipe_id = r.id
            ORDER BY cs.commercial_deployability_score DESC
            LIMIT 5
            """,
        ),
        "ingredients.json": rows(conn, "SELECT * FROM ingredients ORDER BY category, name LIMIT 10"),
        "scores_top_commercial.json": rows(
            conn,
            """
            SELECT r.id, r.title, r.dish_category, cs.commercial_deployability_score
            FROM recipes r
            JOIN commercial_scores cs ON cs.recipe_id = r.id
            ORDER BY cs.commercial_deployability_score DESC
            LIMIT 10
            """,
        ),
        "concepts_safari_lounge.json": rows(
            conn,
            """
            SELECT dc.id, dc.recipe_id, r.title AS recipe_title, dc.concept_title, mt.safari_lounge_fit
            FROM derived_concepts dc
            JOIN recipes r ON r.id = dc.recipe_id
            JOIN monetization_tags mt ON mt.recipe_id = r.id
            ORDER BY mt.safari_lounge_fit DESC, r.title
            LIMIT 10
            """,
        ),
        "recommendations_menu.json": add_monetization_context(
            recommendation_rows("menu", limit=10),
            "Menu Intelligence API",
            "white_label",
        ),
        "recommendations_catering.json": add_monetization_context(
            recommendation_rows("catering", limit=10),
            "Catering Opportunity Engine",
            "venue",
        ),
        "recommendations_ghost_kitchen.json": add_monetization_context(
            recommendation_rows("ghost_kitchen", limit=10),
            "Ghost Kitchen Menu Generator",
            "venue",
        ),
        "recommendations_scarcity_drops.json": add_monetization_context(
            recommendation_rows("scarcity_drops", limit=10),
            "Scarcity Drop Calendar API",
            "creator",
        ),
        "analytics_cross_utilisation.json": {
            "product_type": "Ingredient Cross-Utilisation Optimizer",
            "records": cross_utilisation_rows(limit=20),
        },
        "audits_menu_leak.json": audit_payload(
            consultant_brand="White-Label Hospitality Intelligence",
            client_name="Sample Venue",
            account_mode="white_label",
            limit=15,
        ),
    }
    for filename, data in samples.items():
        (OUT / filename).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"wrote={OUT / filename}")
    notebooklm = build_notebooklm_pack(account_mode="white_label", limit=15)
    (OUT / "exports_notebooklm_pack.json").write_text(
        json.dumps(notebooklm, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"wrote={OUT / 'exports_notebooklm_pack.json'}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
