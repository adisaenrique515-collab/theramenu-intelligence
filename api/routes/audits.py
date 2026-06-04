from __future__ import annotations

import json

from fastapi import APIRouter, Query, Response
from fastapi.responses import FileResponse, PlainTextResponse

from api.models.intelligence import EXPORT_DIR, audit_markdown, audit_payload, records_to_csv, write_pdf


router = APIRouter(prefix="/audits", tags=["audits"])


@router.get("/menu-leak")
def menu_leak_audit(
    consultant_brand: str = Query("White-Label Hospitality Intelligence"),
    client_name: str = Query("Client Venue"),
    account_mode: str | None = Query("white_label"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> dict:
    return audit_payload(
        consultant_brand=consultant_brand,
        client_name=client_name,
        account_mode=account_mode,
        limit=limit,
        cuisine=cuisine,
        ingredient=ingredient,
        category=category,
        business_model=business_model,
    )


@router.get("/white-label-offer")
def white_label_offer() -> dict:
    return {
        "product": "White-Label Menu Audit SaaS",
        "buyer": "hospitality consultants, restaurant agencies, food-tech builders, menu engineers",
        "promise": "Generate branded client menu audits from scored commercial recipe intelligence without selling or exposing full recipe text.",
        "pricing": [
            {"tier": "Signal", "price": "$299/mo", "best_for": "solo consultants validating demand"},
            {"tier": "Consultant", "price": "$750/mo", "best_for": "consultants delivering recurring audits"},
            {"tier": "White Label", "price": "$1,500+/mo", "best_for": "agencies and operators reselling intelligence"},
        ],
        "client_deliverables": [
            "Menu leak audit",
            "Hidden winner ranking",
            "Catering conversion map",
            "Ghost kitchen opportunity list",
            "Scarcity drop calendar candidates",
            "Ingredient cross-utilisation report",
            "NotebookLM-ready source pack",
        ],
        "copyright_boundary": "Only commercial metadata, scoring, tags, and original derivative business concepts are returned.",
    }


@router.get("/export")
def export_audit(
    consultant_brand: str = Query("White-Label Hospitality Intelligence"),
    client_name: str = Query("Client Venue"),
    format: str = Query("markdown", pattern="^(json|csv|markdown|pdf)$"),
    account_mode: str | None = Query("white_label"),
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> Response:
    payload = audit_payload(
        consultant_brand=consultant_brand,
        client_name=client_name,
        account_mode=account_mode,
        limit=limit,
        cuisine=cuisine,
        ingredient=ingredient,
        category=category,
        business_model=business_model,
    )
    if format == "json":
        return Response(json.dumps(payload, indent=2, ensure_ascii=False), media_type="application/json")
    if format == "csv":
        return Response(records_to_csv(payload["records"]), media_type="text/csv")
    markdown = audit_markdown(payload)
    if format == "markdown":
        return PlainTextResponse(markdown, media_type="text/markdown")

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    safe_client = "".join(ch if ch.isalnum() else "_" for ch in client_name).strip("_") or "client"
    pdf_path = EXPORT_DIR / f"{safe_client}_menu_audit.pdf"
    write_pdf(pdf_path, f"{client_name} Menu Intelligence Audit", markdown)
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)

