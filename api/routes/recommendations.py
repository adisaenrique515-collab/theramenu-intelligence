from __future__ import annotations

from fastapi import APIRouter, Query

from api.models.intelligence import add_monetization_context, recommendation_rows


router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def recommend(
    recommendation_type: str,
    product_type: str,
    account_mode: str | None,
    limit: int,
    cuisine: str | None,
    ingredient: str | None,
    category: str | None,
    business_model: str | None,
) -> dict:
    rows = recommendation_rows(
        recommendation_type,
        limit=limit,
        cuisine=cuisine,
        ingredient=ingredient,
        category=category,
        business_model=business_model,
    )
    return add_monetization_context(rows, product_type, account_mode)


@router.get("/menu")
def menu_recommendations(
    account_mode: str | None = Query("venue"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> dict:
    return recommend("menu", "Menu Intelligence API", account_mode, limit, cuisine, ingredient, category, business_model)


@router.get("/catering")
def catering_recommendations(
    account_mode: str | None = Query("venue"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> dict:
    return recommend("catering", "Catering Opportunity Engine", account_mode, limit, cuisine, ingredient, category, business_model)


@router.get("/ghost-kitchen")
def ghost_kitchen_recommendations(
    account_mode: str | None = Query("venue"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> dict:
    return recommend("ghost_kitchen", "Ghost Kitchen Menu Generator", account_mode, limit, cuisine, ingredient, category, business_model)


@router.get("/scarcity-drops")
def scarcity_drop_recommendations(
    account_mode: str | None = Query("creator"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> dict:
    return recommend("scarcity_drops", "Scarcity Drop Calendar API", account_mode, limit, cuisine, ingredient, category, business_model)


@router.get("/safari-lounge")
def safari_lounge_recommendations(
    account_mode: str | None = Query("internal_safari_lounge"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> dict:
    return recommend("safari_lounge", "Safari Lounge IP Intelligence Layer", account_mode, limit, cuisine, ingredient, category, business_model)

