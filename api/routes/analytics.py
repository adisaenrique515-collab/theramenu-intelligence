from __future__ import annotations

from fastapi import APIRouter, Query

from api.models.intelligence import cross_utilisation_rows


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/cross-utilisation")
def cross_utilisation(limit: int = Query(50, ge=1, le=500)) -> dict:
    rows = cross_utilisation_rows(limit=limit)
    return {
        "product_type": "Ingredient Cross-Utilisation Optimizer",
        "copyright_boundary": "Ingredient and scoring metadata only; no full recipe instructions.",
        "count": len(rows),
        "records": rows,
    }

