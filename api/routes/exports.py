from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Query, Response
from fastapi.responses import FileResponse, PlainTextResponse

from api.models.intelligence import (
    EXPORT_DIR,
    add_monetization_context,
    build_notebooklm_pack,
    recommendation_rows,
    records_to_csv,
    records_to_markdown,
    write_pdf,
)


router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/notebooklm-pack")
def notebooklm_pack(
    account_mode: str | None = Query("white_label"),
    limit: int = Query(30, ge=1, le=200),
) -> dict:
    return build_notebooklm_pack(account_mode=account_mode, limit=limit)


@router.get("/brief")
def export_brief(
    product: str = Query("menu", pattern="^(menu|catering|ghost_kitchen|scarcity_drops|safari_lounge)$"),
    format: str = Query("markdown", pattern="^(json|csv|markdown|pdf)$"),
    account_mode: str | None = Query("white_label"),
    limit: int = Query(25, ge=1, le=200),
) -> Response:
    rows = recommendation_rows(product, limit=limit)
    payload = add_monetization_context(rows, f"{product.replace('_', ' ').title()} Intelligence Brief", account_mode)
    title = f"{product.replace('_', ' ').title()} Intelligence Brief"

    if format == "json":
        return Response(json.dumps(payload, indent=2, ensure_ascii=False), media_type="application/json")
    if format == "csv":
        return Response(records_to_csv(rows), media_type="text/csv")
    markdown = records_to_markdown(title, payload)
    if format == "markdown":
        return PlainTextResponse(markdown, media_type="text/markdown")

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = EXPORT_DIR / f"{product}_intelligence_brief.pdf"
    write_pdf(pdf_path, title, markdown)
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)

