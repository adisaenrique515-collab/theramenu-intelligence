from __future__ import annotations

from fastapi import APIRouter, Query

from api.models.db import get_connection, rows_to_dicts


router = APIRouter(prefix="/concepts", tags=["concepts"])


BASE = """
SELECT
  dc.id, dc.recipe_id, r.title AS recipe_title, r.cuisine_family, r.dish_category,
  dc.concept_title, dc.concept_type, dc.original_derivative_description,
  dc.business_model, dc.notes,
  mt.safari_lounge_fit, mt.scarcity_drop_fit, mt.productization_fit, mt.catering_fit
FROM derived_concepts dc
JOIN recipes r ON r.id = dc.recipe_id
LEFT JOIN monetization_tags mt ON mt.recipe_id = r.id
"""


@router.get("")
def list_concepts(limit: int = Query(100, ge=1, le=500)) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            BASE
            + """
            ORDER BY dc.id
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/safari-lounge")
def safari_lounge_concepts(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            BASE
            + """
            ORDER BY mt.safari_lounge_fit DESC, mt.catering_fit DESC, r.title
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@router.get("/scarcity-drops")
def scarcity_drop_concepts(limit: int = Query(50, ge=1, le=500)) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            BASE
            + """
            ORDER BY mt.scarcity_drop_fit DESC, mt.catering_fit DESC, r.title
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)

