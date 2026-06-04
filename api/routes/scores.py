from __future__ import annotations

from fastapi import APIRouter, Query

from api.models.db import get_connection, rows_to_dicts


router = APIRouter(prefix="/scores", tags=["scores"])


BASE = """
SELECT
  r.id, r.title, r.cuisine_family, r.dish_category, r.summary,
  cs.commercial_deployability_score,
  mt.catering_fit, mt.ghost_kitchen_fit, mt.productization_fit,
  mt.safari_lounge_fit, mt.scarcity_drop_fit, mt.saas_dataset_fit
FROM recipes r
JOIN commercial_scores cs ON cs.recipe_id = r.id
JOIN monetization_tags mt ON mt.recipe_id = r.id
"""


def ranked(order_by: str, limit: int) -> list[dict]:
    allowed = {
        "commercial_deployability_score": "cs.commercial_deployability_score",
        "catering_fit": "mt.catering_fit",
        "ghost_kitchen_fit": "mt.ghost_kitchen_fit",
        "productization_fit": "mt.productization_fit",
    }
    column = allowed[order_by]
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            {BASE}
            ORDER BY {column} DESC, cs.commercial_deployability_score DESC, r.title
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/top-commercial")
def top_commercial(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    return ranked("commercial_deployability_score", limit)


@router.get("/top-catering")
def top_catering(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    return ranked("catering_fit", limit)


@router.get("/top-ghost-kitchen")
def top_ghost_kitchen(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    return ranked("ghost_kitchen_fit", limit)


@router.get("/top-productization")
def top_productization(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    return ranked("productization_fit", limit)

