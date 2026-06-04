#!/usr/bin/env python
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "database" / "recipe_intelligence.sqlite"


REQUIRED_TABLES = {
    "recipes",
    "ingredients",
    "recipe_ingredients",
    "cooking_steps",
    "methods",
    "commercial_scores",
    "monetization_tags",
    "derived_concepts",
}


def fail(message: str) -> None:
    raise SystemExit(f"VALIDATION_FAILED: {message}")


def validate(db_path: Path) -> dict:
    if not db_path.exists():
        fail(f"database not found: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    tables = {
        row["name"]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    missing = REQUIRED_TABLES - tables
    if missing:
        fail(f"missing tables: {sorted(missing)}")

    fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    if fk_violations:
        fail(f"foreign key violations: {len(fk_violations)}")

    counts = {}
    for table in sorted(REQUIRED_TABLES):
        counts[table] = conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]

    if counts["recipes"] == 0:
        fail("no recipes seeded")
    if counts["cooking_steps"] == 0:
        fail("no cooking_steps seeded")
    for table in ["methods", "commercial_scores", "monetization_tags"]:
        missing_rows = conn.execute(
            f"""
            SELECT COUNT(*) AS c
            FROM recipes r
            LEFT JOIN {table} t ON t.recipe_id = r.id
            WHERE t.recipe_id IS NULL
            """
        ).fetchone()["c"]
        if missing_rows:
            fail(f"{table} missing rows for {missing_rows} recipes")

    bad_scores = conn.execute(
        """
        SELECT COUNT(*) AS c
        FROM commercial_scores
        WHERE commercial_deployability_score IS NULL
          OR commercial_deployability_score < -10
          OR commercial_deployability_score > 30
        """
    ).fetchone()["c"]
    if bad_scores:
        fail(f"bad commercial score rows: {bad_scores}")

    top = conn.execute(
        """
        SELECT r.id, r.title, cs.commercial_deployability_score
        FROM recipes r
        JOIN commercial_scores cs ON cs.recipe_id = r.id
        ORDER BY cs.commercial_deployability_score DESC
        LIMIT 5
        """
    ).fetchall()
    conn.close()
    return {"counts": counts, "top": [dict(row) for row in top]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=str(DEFAULT_DB))
    args = parser.parse_args()
    result = validate(Path(args.db))
    print("VALIDATION_OK")
    for table, count in result["counts"].items():
        print(f"{table}={count}")
    print("top_commercial=")
    for row in result["top"]:
        print(f"- {row['id']} | {row['title']} | {row['commercial_deployability_score']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

