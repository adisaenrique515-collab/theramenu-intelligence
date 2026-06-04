#!/usr/bin/env python
from __future__ import annotations

import argparse
import csv
import re
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "master" / "recipe_commercial_intelligence.csv"
DEFAULT_DB = ROOT / "database" / "recipe_intelligence.sqlite"
SCHEMA = ROOT / "database" / "schema.sql"

GENERIC_TITLES = {
    "acknowledgments",
    "preparation",
    "license",
    "reader",
    "menu",
    "recipe",
    "recipes",
    "ingredients",
    "method",
    "notes",
    "contents",
    "index",
}

ALLERGENS = {
    "egg",
    "fish",
    "shrimp",
    "prawn",
    "crab",
    "milk",
    "cheese",
    "butter",
    "cream",
    "wheat",
    "soy",
    "peanut",
    "nut",
    "sesame",
}


def as_int(row: dict, key: str, default: int = 0) -> int:
    try:
        return int(row.get(key) or default)
    except ValueError:
        return default


def clean_title(title: str) -> bool:
    t = (title or "").strip().lower()
    if not t or t in GENERIC_TITLES:
        return False
    if len(t) < 5:
        return False
    if "copyright" in t or "all rights" in t or "isbn" in t:
        return False
    if t.endswith(".") and "," in t:
        return False
    return True


def ingredient_category(name: str, role: str) -> str:
    n = name.lower()
    if role:
        return role
    if any(x in n for x in ["beef", "chicken", "pork", "goat", "lamb", "fish", "shrimp", "egg", "tofu"]):
        return "protein"
    if any(x in n for x in ["rice", "noodle", "pasta", "bread", "potato", "corn"]):
        return "starch"
    if any(x in n for x in ["sauce", "marinade", "rub", "salsa", "dressing", "gravy", "curry"]):
        return "sauce_or_marinade"
    return "ingredient_family"


def allergen_flag(name: str) -> int:
    n = name.lower()
    return 1 if any(a in n for a in ALLERGENS) else 0


def split_tokens(value: str) -> list[str]:
    tokens = []
    for part in re.split(r";|,", value or ""):
        token = re.sub(r"\s+", " ", part).strip()
        if token and token.lower() not in {"mixed/unknown", "standard kitchen"}:
            tokens.append(token)
    return sorted(set(tokens), key=str.lower)


def build_summary(row: dict) -> str:
    parts = [
        row.get("dish_category", "dish candidate"),
        row.get("cuisine_family", "general cuisine"),
        row.get("cooking_method", "unknown method"),
        row.get("best_business_model", "commercial intelligence"),
    ]
    return "Structured commercial metadata record for " + " / ".join(p for p in parts if p) + "."


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def reset_database(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    for table in [
        "derived_concepts",
        "monetization_tags",
        "commercial_scores",
        "methods",
        "recipe_ingredients",
        "ingredients",
        "recipes",
    ]:
        conn.execute(f"DELETE FROM {table}")
    conn.commit()


def ingredient_id(conn: sqlite3.Connection, name: str, category: str) -> int:
    conn.execute(
        "INSERT OR IGNORE INTO ingredients(name, category, allergen_flag) VALUES (?, ?, ?)",
        (name, category, allergen_flag(name)),
    )
    row = conn.execute("SELECT id FROM ingredients WHERE name = ?", (name,)).fetchone()
    return int(row["id"])


def seed(csv_path: Path, db_path: Path) -> dict:
    rows = list(csv.DictReader(csv_path.open("r", encoding="utf-8-sig", newline="")))
    conn = connect(db_path)
    reset_database(conn)
    inserted = 0
    skipped = 0

    for row in rows:
        recipe_id = row.get("recipe_id") or ""
        title = (row.get("recipe_title") or "").strip()
        if not recipe_id or not clean_title(title) or (row.get("needs_review") or "").lower() == "yes":
            skipped += 1
            continue

        conn.execute(
            """
            INSERT INTO recipes(id, title, source_file, cuisine_family, dish_category, summary)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                recipe_id,
                title,
                row.get("source_file", ""),
                row.get("cuisine_family", ""),
                row.get("dish_category", ""),
                build_summary(row),
            ),
        )
        conn.execute(
            """
            INSERT INTO methods(recipe_id, cooking_method, equipment, prep_complexity, labour_intensity)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                recipe_id,
                row.get("cooking_method", ""),
                row.get("equipment", ""),
                as_int(row, "prep_complexity_1_5"),
                as_int(row, "labour_intensity_1_5"),
            ),
        )
        conn.execute(
            """
            INSERT INTO commercial_scores(
              recipe_id, customer_familiarity, premium_pricing, batch_suitability,
              holding_reheat, delivery_suitability, waste_risk, cross_utilisation,
              commercial_deployability_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recipe_id,
                as_int(row, "customer_familiarity_1_5"),
                as_int(row, "premium_pricing_1_5"),
                as_int(row, "batch_suitability_1_5"),
                as_int(row, "holding_reheat_score_1_5"),
                as_int(row, "delivery_suitability_1_5"),
                as_int(row, "waste_risk_1_5"),
                as_int(row, "cross_utilisation_1_5"),
                as_int(row, "commercial_deployability_score"),
            ),
        )
        conn.execute(
            """
            INSERT INTO monetization_tags(
              recipe_id, ghost_kitchen_fit, catering_fit, productization_fit,
              safari_lounge_fit, scarcity_drop_fit, saas_dataset_fit
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recipe_id,
                as_int(row, "ghost_kitchen_fit"),
                as_int(row, "catering_fit"),
                as_int(row, "productization_potential"),
                as_int(row, "safari_lounge_fit"),
                as_int(row, "scarcity_drop_potential"),
                as_int(row, "saas_dataset_fit"),
            ),
        )

        role_map = {
            "protein": row.get("protein", ""),
            "starch": row.get("starch", ""),
            "vegetable": row.get("vegetables", ""),
            "sauce_or_marinade": row.get("sauce_or_marinade", ""),
            "core": row.get("core_ingredients", ""),
        }
        for role, value in role_map.items():
            for token in split_tokens(value):
                iid = ingredient_id(conn, token, ingredient_category(token, role))
                conn.execute(
                    """
                    INSERT OR IGNORE INTO recipe_ingredients(recipe_id, ingredient_id, role, quantity, unit)
                    VALUES (?, ?, ?, NULL, NULL)
                    """,
                    (recipe_id, iid, role),
                )

        concept_title = f"{title} commercial deployment"
        concept_type = row.get("best_business_model", "commercial intelligence")
        conn.execute(
            """
            INSERT INTO derived_concepts(
              recipe_id, concept_title, concept_type, original_derivative_description,
              business_model, notes
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                recipe_id,
                concept_title,
                concept_type,
                row.get("derivative_original_ideas", ""),
                row.get("best_business_model", ""),
                row.get("commercial_notes", ""),
            ),
        )
        inserted += 1

    conn.commit()
    counts = {
        "inserted_recipes": inserted,
        "skipped_rows": skipped,
    }
    for table in [
        "recipes",
        "ingredients",
        "recipe_ingredients",
        "methods",
        "commercial_scores",
        "monetization_tags",
        "derived_concepts",
    ]:
        counts[table] = conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]
    conn.close()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--db", default=str(DEFAULT_DB))
    args = parser.parse_args()
    counts = seed(Path(args.csv), Path(args.db))
    for key, value in counts.items():
        print(f"{key}={value}")
    print(f"db={Path(args.db).resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

