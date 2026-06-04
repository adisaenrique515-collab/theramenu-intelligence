from __future__ import annotations

from fastapi import APIRouter, Query

from api.models.db import get_connection, rows_to_dicts


router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("")
def list_ingredients(
    q: str | None = None,
    category: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
) -> list[dict]:
    clauses = []
    params: list[str | int] = []
    if q:
        clauses.append("LOWER(name) LIKE LOWER(?)")
        params.append(f"%{q}%")
    if category:
        clauses.append("LOWER(category) LIKE LOWER(?)")
        params.append(f"%{category}%")
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, name, category, allergen_flag
            FROM ingredients
            {where}
            ORDER BY category, name
            LIMIT ?
            """,
            params,
        ).fetchall()
    return rows_to_dicts(rows)

