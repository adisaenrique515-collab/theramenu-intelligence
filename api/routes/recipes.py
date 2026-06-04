from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from api.models.db import get_connection, rows_to_dicts


router = APIRouter(prefix="/recipes", tags=["recipes"])


RECIPE_SELECT = """
SELECT
  r.id, r.title, r.source_file, r.cuisine_family, r.dish_category, r.summary, r.created_at,
  cs.commercial_deployability_score,
  mt.catering_fit, mt.ghost_kitchen_fit, mt.productization_fit, mt.safari_lounge_fit, mt.scarcity_drop_fit
FROM recipes r
LEFT JOIN commercial_scores cs ON cs.recipe_id = r.id
LEFT JOIN monetization_tags mt ON mt.recipe_id = r.id
"""


@router.get("")
def list_recipes(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            RECIPE_SELECT
            + """
            ORDER BY cs.commercial_deployability_score DESC, r.title
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/search")
def search_recipes(
    ingredient: str | None = None,
    cuisine: str | None = None,
    category: str | None = None,
    limit: int = Query(50, ge=1, le=500),
) -> list[dict]:
    clauses = []
    params: list[str | int] = []
    join_ingredient = ""
    if ingredient:
        join_ingredient = """
        JOIN recipe_ingredients ri ON ri.recipe_id = r.id
        JOIN ingredients i ON i.id = ri.ingredient_id
        """
        clauses.append("LOWER(i.name) LIKE LOWER(?)")
        params.append(f"%{ingredient}%")
    if cuisine:
        clauses.append("LOWER(r.cuisine_family) LIKE LOWER(?)")
        params.append(f"%{cuisine}%")
    if category:
        clauses.append("LOWER(r.dish_category) LIKE LOWER(?)")
        params.append(f"%{category}%")
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            {RECIPE_SELECT}
            {join_ingredient}
            {where}
            GROUP BY r.id
            ORDER BY cs.commercial_deployability_score DESC, r.title
            LIMIT ?
            """,
            params,
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/{recipe_id}/steps")
def get_recipe_steps(recipe_id: str) -> list[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Recipe not found")
        rows = conn.execute(
            """
            SELECT id, step_number, step_summary, technique, equipment,
                   estimated_time_minutes, temperature, critical_control_note
            FROM cooking_steps
            WHERE recipe_id = ?
            ORDER BY step_number
            """,
            (recipe_id,),
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/{recipe_id}/ingredients")
def get_recipe_ingredients(recipe_id: str) -> list[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Recipe not found")
        rows = conn.execute(
            """
            SELECT i.id, i.name, i.category, i.allergen_flag,
                   ri.role, ri.quantity, ri.unit, ri.preparation_note, ri.optional_flag
            FROM recipe_ingredients ri
            JOIN ingredients i ON i.id = ri.ingredient_id
            WHERE ri.recipe_id = ?
            ORDER BY ri.role, i.name
            """,
            (recipe_id,),
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/{recipe_id}")
def get_recipe(recipe_id: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(RECIPE_SELECT + "WHERE r.id = ?", (recipe_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Recipe not found")
        recipe = dict(row)
        recipe["ingredients"] = rows_to_dicts(
            conn.execute(
                """
                SELECT i.id, i.name, i.category, i.allergen_flag, ri.role, ri.quantity, ri.unit, ri.preparation_note, ri.optional_flag
                FROM recipe_ingredients ri
                JOIN ingredients i ON i.id = ri.ingredient_id
                WHERE ri.recipe_id = ?
                ORDER BY ri.role, i.name
                """,
                (recipe_id,),
            ).fetchall()
        )
        recipe["method"] = dict(
            conn.execute(
                """
                SELECT cooking_method, equipment, prep_complexity, labour_intensity
                FROM methods
                WHERE recipe_id = ?
                """,
                (recipe_id,),
            ).fetchone()
        )
        recipe["scores"] = dict(
            conn.execute("SELECT * FROM commercial_scores WHERE recipe_id = ?", (recipe_id,)).fetchone()
        )
        recipe["monetization"] = dict(
            conn.execute("SELECT * FROM monetization_tags WHERE recipe_id = ?", (recipe_id,)).fetchone()
        )
        recipe["derived_concepts"] = rows_to_dicts(
            conn.execute(
                """
                SELECT dc.*, r.title AS recipe_title
                FROM derived_concepts dc
                JOIN recipes r ON r.id = dc.recipe_id
                WHERE dc.recipe_id = ?
                ORDER BY dc.id
                """,
                (recipe_id,),
            ).fetchall()
        )
    return recipe

