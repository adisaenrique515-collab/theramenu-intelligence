from __future__ import annotations

import csv
import json
from io import StringIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from api.models.db import ROOT, get_connection, rows_to_dicts


EXPORT_DIR = ROOT / "data" / "exports"

ACCOUNT_MODES = {
    "creator": {
        "buyer": "food creators, pop-ups, home chefs",
        "price_band": "$29-$99/mo",
        "lens": "preorder rhythm, scarcity drops, portable items, and low-labour offers",
    },
    "venue": {
        "buyer": "restaurants, cafes, bars, caterers",
        "price_band": "$99-$999/mo",
        "lens": "menu deployability, kitchen efficiency, catering conversion, and margin protection",
    },
    "consultant": {
        "buyer": "hospitality consultants",
        "price_band": "$299-$1,500/mo",
        "lens": "audit evidence, menu leak diagnostics, and client-ready ranked recommendations",
    },
    "white_label": {
        "buyer": "consultants, agencies, food-tech builders",
        "price_band": "$1,000+/mo",
        "lens": "resellable intelligence, exportable briefs, and API-backed decision support",
    },
    "internal_safari_lounge": {
        "buyer": "Safari Lounge internal team or licensees",
        "price_band": "$2,500-$10,000+ license value",
        "lens": "fusion IP, weekly drops, sauce/protein/base recombination, and catering bundles",
    },
}


BASE_SELECT = """
SELECT
  r.id,
  r.title,
  r.source_file,
  r.cuisine_family,
  r.dish_category,
  r.summary,
  m.cooking_method,
  m.equipment,
  m.prep_complexity,
  m.labour_intensity,
  cs.customer_familiarity,
  cs.premium_pricing,
  cs.batch_suitability,
  cs.holding_reheat,
  cs.delivery_suitability,
  cs.waste_risk,
  cs.cross_utilisation,
  cs.commercial_deployability_score,
  mt.ghost_kitchen_fit,
  mt.catering_fit,
  mt.productization_fit,
  mt.safari_lounge_fit,
  mt.scarcity_drop_fit,
  mt.saas_dataset_fit,
  dc.concept_title,
  dc.concept_type,
  dc.original_derivative_description,
  dc.business_model,
  dc.notes
FROM recipes r
JOIN methods m ON m.recipe_id = r.id
JOIN commercial_scores cs ON cs.recipe_id = r.id
JOIN monetization_tags mt ON mt.recipe_id = r.id
LEFT JOIN derived_concepts dc ON dc.recipe_id = r.id
"""


ORDER_EXPRESSIONS = {
    "menu": """
      (cs.commercial_deployability_score * 2
       + cs.customer_familiarity
       + cs.premium_pricing
       + cs.cross_utilisation
       + mt.saas_dataset_fit)
    """,
    "catering": """
      (mt.catering_fit * 3
       + cs.batch_suitability * 2
       + cs.holding_reheat * 2
       + cs.cross_utilisation
       + cs.commercial_deployability_score)
    """,
    "ghost_kitchen": """
      (mt.ghost_kitchen_fit * 3
       + cs.delivery_suitability * 2
       + cs.holding_reheat
       + cs.customer_familiarity
       + cs.commercial_deployability_score
       - m.labour_intensity)
    """,
    "scarcity_drops": """
      (mt.scarcity_drop_fit * 3
       + mt.catering_fit
       + cs.premium_pricing
       + cs.batch_suitability
       + cs.commercial_deployability_score)
    """,
    "safari_lounge": """
      (mt.safari_lounge_fit * 3
       + mt.scarcity_drop_fit
       + mt.catering_fit
       + mt.productization_fit
       + cs.commercial_deployability_score)
    """,
}


def account_mode_payload(account_mode: str | None) -> dict:
    key = account_mode or "venue"
    return {"mode": key, **ACCOUNT_MODES.get(key, ACCOUNT_MODES["venue"])}


def build_filters(
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
) -> tuple[str, str, list[str]]:
    joins = ""
    clauses = []
    params: list[str] = []
    if ingredient:
        joins += """
        JOIN recipe_ingredients ri_filter ON ri_filter.recipe_id = r.id
        JOIN ingredients i_filter ON i_filter.id = ri_filter.ingredient_id
        """
        clauses.append("LOWER(i_filter.name) LIKE LOWER(?)")
        params.append(f"%{ingredient}%")
    if cuisine:
        clauses.append("LOWER(r.cuisine_family) LIKE LOWER(?)")
        params.append(f"%{cuisine}%")
    if category:
        clauses.append("LOWER(r.dish_category) LIKE LOWER(?)")
        params.append(f"%{category}%")
    if business_model:
        clauses.append("LOWER(dc.business_model) LIKE LOWER(?)")
        params.append(f"%{business_model}%")
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    return joins, where, params


def recommendation_rows(
    recommendation_type: str,
    limit: int = 25,
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
) -> list[dict]:
    order_expr = ORDER_EXPRESSIONS[recommendation_type]
    joins, where, params = build_filters(cuisine, ingredient, category, business_model)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT base.*, ({order_expr}) AS recommendation_score
            FROM (
              {BASE_SELECT}
              {joins}
              {where}
              GROUP BY r.id
            ) base
            JOIN recipes r ON r.id = base.id
            JOIN methods m ON m.recipe_id = r.id
            JOIN commercial_scores cs ON cs.recipe_id = r.id
            JOIN monetization_tags mt ON mt.recipe_id = r.id
            LEFT JOIN derived_concepts dc ON dc.recipe_id = r.id
            ORDER BY recommendation_score DESC, base.commercial_deployability_score DESC, base.title
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
    return rows_to_dicts(rows)


def add_monetization_context(rows: list[dict], product_type: str, account_mode: str | None) -> dict:
    mode = account_mode_payload(account_mode)
    return {
        "product_type": product_type,
        "account_mode": mode,
        "copyright_boundary": "Commercial metadata only. No full copyrighted recipe instructions are stored or returned.",
        "count": len(rows),
        "records": rows,
    }


def cross_utilisation_rows(limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              i.id,
              i.name,
              i.category,
              i.allergen_flag,
              COUNT(DISTINCT ri.recipe_id) AS recipe_count,
              ROUND(AVG(cs.commercial_deployability_score), 2) AS avg_commercial_score,
              ROUND(AVG(mt.catering_fit), 2) AS avg_catering_fit,
              ROUND(AVG(mt.ghost_kitchen_fit), 2) AS avg_ghost_kitchen_fit,
              ROUND(AVG(mt.productization_fit), 2) AS avg_productization_fit,
              ROUND(AVG(mt.safari_lounge_fit), 2) AS avg_safari_lounge_fit,
              GROUP_CONCAT(DISTINCT r.dish_category) AS dish_categories
            FROM ingredients i
            JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
            JOIN recipes r ON r.id = ri.recipe_id
            JOIN commercial_scores cs ON cs.recipe_id = r.id
            JOIN monetization_tags mt ON mt.recipe_id = r.id
            GROUP BY i.id
            ORDER BY recipe_count DESC, avg_commercial_score DESC, i.name
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


def records_to_csv(records: list[dict]) -> str:
    output = StringIO()
    if not records:
        return ""
    fieldnames = list(records[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(records)
    return output.getvalue()


def records_to_markdown(title: str, payload: dict) -> str:
    records = payload["records"]
    mode = payload["account_mode"]
    lines = [
        f"# {title}",
        "",
        f"**Product type:** {payload['product_type']}",
        f"**Account mode:** {mode['mode']} ({mode['buyer']})",
        f"**Price band:** {mode['price_band']}",
        f"**Commercial lens:** {mode['lens']}",
        "",
        f"**Copyright boundary:** {payload['copyright_boundary']}",
        "",
        "| Title | Category | Cuisine | Business Model | Score | Commercial Score |",
        "|---|---|---|---|---:|---:|",
    ]
    for row in records:
        lines.append(
            "| {title} | {category} | {cuisine} | {model} | {score} | {commercial} |".format(
                title=str(row.get("title", "")).replace("|", "/"),
                category=str(row.get("dish_category", "")).replace("|", "/"),
                cuisine=str(row.get("cuisine_family", "")).replace("|", "/"),
                model=str(row.get("business_model", "")).replace("|", "/"),
                score=row.get("recommendation_score", ""),
                commercial=row.get("commercial_deployability_score", ""),
            )
        )
    lines.extend(
        [
            "",
            "## Usage",
            "",
            "- Use as a commercial decision brief, not a recipe document.",
            "- Pair records with venue constraints: labour, prep capacity, packaging, and target buyer.",
            "- Convert high-scoring records into audit findings, preorder drops, catering trays, or white-label intelligence.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_pdf(path: Path, title: str, markdown: str) -> None:
    styles = getSampleStyleSheet()
    story = []
    for line in markdown.splitlines():
        if not line.strip():
            story.append(Spacer(1, 8))
        elif line.startswith("# "):
            story.append(Paragraph(line[2:], styles["Title"]))
        elif line.startswith("## "):
            story.append(Paragraph(line[3:], styles["Heading2"]))
        elif line.startswith("|"):
            continue
        elif line.startswith("- "):
            story.append(Paragraph("• " + line[2:], styles["BodyText"]))
        else:
            story.append(Paragraph(line.replace("**", ""), styles["BodyText"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Top Records", styles["Heading2"]))
    table_data = [["Title", "Category", "Model", "Score"]]
    for line in markdown.splitlines():
        if line.startswith("| ") and not line.startswith("| Title") and not line.startswith("|---"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) >= 5:
                table_data.append([cells[0], cells[1], cells[3], cells[4]])
    table = Table(table_data[:16], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8efe9")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(table)
    doc = SimpleDocTemplate(str(path), pagesize=A4, title=title)
    doc.build(story)


def build_notebooklm_pack(account_mode: str | None = None, limit: int = 30) -> dict:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    mode = account_mode_payload(account_mode)
    menu = add_monetization_context(
        recommendation_rows("menu", limit=limit),
        "NotebookLM Menu Intelligence Source Pack",
        mode["mode"],
    )
    catering = add_monetization_context(
        recommendation_rows("catering", limit=limit),
        "NotebookLM Catering Opportunity Source Pack",
        mode["mode"],
    )
    scarcity = add_monetization_context(
        recommendation_rows("scarcity_drops", limit=limit),
        "NotebookLM Scarcity Drop Source Pack",
        mode["mode"],
    )
    cross = {"records": cross_utilisation_rows(limit=limit)}
    files = {}
    exports = {
        "menu_intelligence.md": records_to_markdown("Menu Intelligence Pack", menu),
        "catering_opportunities.md": records_to_markdown("Catering Opportunity Pack", catering),
        "scarcity_drop_calendar.md": records_to_markdown("Scarcity Drop Pack", scarcity),
        "cross_utilisation.json": json.dumps(cross, indent=2, ensure_ascii=False),
        "notebooklm_query_guide.md": notebooklm_query_guide(mode),
    }
    for filename, content in exports.items():
        path = EXPORT_DIR / filename
        path.write_text(content, encoding="utf-8")
        files[filename] = str(path)
    return {
        "account_mode": mode,
        "export_dir": str(EXPORT_DIR),
        "files": files,
        "copyright_boundary": "Commercial metadata and original derivative descriptions only; no full recipe instructions.",
    }


def notebooklm_query_guide(mode: dict) -> str:
    return f"""# NotebookLM Premium Source Pack Query Guide

Account mode: {mode['mode']}
Buyer: {mode['buyer']}
Price band: {mode['price_band']}

## Use This Pack To Ask

- Which dishes are best for a menu audit?
- Which records are strongest for catering trays?
- Which ingredients give the most cross-utilisation?
- Which concepts can become Safari Lounge drops?
- Which records are delivery-safe enough for ghost kitchen menus?
- Which items should be converted into a white-label consultant brief?
- Build a 4-week preorder calendar from the scarcity drop records.

## Copyright Boundary

Use this as a commercial intelligence source. Do not ask NotebookLM to reproduce copyrighted cookbook recipes. Use it to retrieve metadata, scoring, concepts, and business-model logic.
"""


def audit_rows(
    limit: int = 25,
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
) -> list[dict]:
    joins, where, params = build_filters(cuisine, ingredient, category, business_model)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT base.*,
              (
                base.commercial_deployability_score
                + base.premium_pricing
                + base.customer_familiarity
                + base.catering_fit
                + base.ghost_kitchen_fit
                + base.saas_dataset_fit
                + CASE WHEN base.labour_intensity >= 4 THEN 4 ELSE 0 END
                + CASE WHEN base.waste_risk >= 3 THEN 4 ELSE 0 END
                + CASE WHEN base.cross_utilisation <= 2 THEN 4 ELSE 0 END
              ) AS audit_priority_score,
              (
                base.labour_intensity
                + base.waste_risk
                + CASE WHEN base.cross_utilisation <= 2 THEN 3 ELSE 0 END
                + CASE WHEN base.holding_reheat <= 2 THEN 2 ELSE 0 END
              ) AS menu_leak_risk_score,
              (
                base.commercial_deployability_score
                + base.cross_utilisation
                + base.batch_suitability
                + base.holding_reheat
                + base.catering_fit
                + base.scarcity_drop_fit
              ) AS hidden_winner_score
            FROM (
              {BASE_SELECT}
              {joins}
              {where}
              GROUP BY r.id
            ) base
            ORDER BY audit_priority_score DESC, hidden_winner_score DESC, base.title
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
    return rows_to_dicts(rows)


def audit_payload(
    consultant_brand: str = "White-Label Hospitality Intelligence",
    client_name: str = "Client Venue",
    account_mode: str | None = "white_label",
    limit: int = 25,
    cuisine: str | None = None,
    ingredient: str | None = None,
    category: str | None = None,
    business_model: str | None = None,
) -> dict:
    rows = audit_rows(limit, cuisine, ingredient, category, business_model)
    mode = account_mode_payload(account_mode)
    return {
        "product_type": "White-Label Menu Audit SaaS",
        "consultant_brand": consultant_brand,
        "client_name": client_name,
        "account_mode": mode,
        "copyright_boundary": "Commercial metadata, scores, and original derivative concepts only. No full copyrighted recipe instructions.",
        "pricing": {
            "self_serve": "$299-$499/mo",
            "consultant": "$750-$1,500/mo",
            "white_label": "$1,000+/mo",
            "audit_delivery": "$500-$2,500 per client audit",
        },
        "subscription_tiers": [
            {
                "tier": "Signal",
                "price": "$299/mo",
                "includes": "Menu audit ranking, top commercial records, Markdown export.",
            },
            {
                "tier": "Consultant",
                "price": "$750/mo",
                "includes": "Client-branded audits, PDF briefs, NotebookLM pack, cross-utilisation analytics.",
            },
            {
                "tier": "White Label",
                "price": "$1,500+/mo",
                "includes": "Resellable API outputs, consultant branding, export bundles, client-ready audit language.",
            },
        ],
        "audit_sections": {
            "menu_leaks": "High labour, high waste, low cross-utilisation, poor holding, or weak delivery signals.",
            "hidden_winners": "High deployability, batch suitability, cross-utilisation, catering fit, and scarcity/drop fit.",
            "catering_conversion": "Rows that can become office trays, family bundles, or high-ticket group orders.",
            "ghost_kitchen_conversion": "Rows that hold/reheat/deliver well with strong familiarity.",
            "scarcity_calendar": "Rows that support preorder allocation and weekly demand rituals.",
        },
        "count": len(rows),
        "records": rows,
    }


def audit_markdown(payload: dict) -> str:
    brand = payload["consultant_brand"]
    client = payload["client_name"]
    lines = [
        f"# {client} Menu Intelligence Audit",
        "",
        f"Prepared by: **{brand}**",
        "",
        f"**Product:** {payload['product_type']}",
        f"**Account mode:** {payload['account_mode']['mode']}",
        f"**Commercial lens:** {payload['account_mode']['lens']}",
        "",
        f"**Copyright boundary:** {payload['copyright_boundary']}",
        "",
        "## Executive Diagnosis",
        "",
        "This audit does not provide recipes. It identifies commercial dish structures that can reduce uncertainty, expose menu leaks, reveal hidden winners, and create new revenue paths through catering, ghost kitchen execution, scarcity drops, or Safari Lounge-style IP.",
        "",
        "## Subscription Packaging",
        "",
        "| Tier | Price | Includes |",
        "|---|---:|---|",
    ]
    for tier in payload["subscription_tiers"]:
        lines.append(f"| {tier['tier']} | {tier['price']} | {tier['includes']} |")
    lines.extend(
        [
            "",
            "## Audit Sections",
            "",
        ]
    )
    for key, value in payload["audit_sections"].items():
        lines.append(f"- **{key.replace('_', ' ').title()}:** {value}")
    lines.extend(
        [
            "",
            "## Ranked Client Opportunities",
            "",
            "| Title | Category | Business Model | Audit Priority | Leak Risk | Hidden Winner |",
            "|---|---|---|---:|---:|---:|",
        ]
    )
    for row in payload["records"]:
        lines.append(
            "| {title} | {category} | {model} | {priority} | {leak} | {winner} |".format(
                title=str(row.get("title", "")).replace("|", "/"),
                category=str(row.get("dish_category", "")).replace("|", "/"),
                model=str(row.get("business_model", "")).replace("|", "/"),
                priority=row.get("audit_priority_score", ""),
                leak=row.get("menu_leak_risk_score", ""),
                winner=row.get("hidden_winner_score", ""),
            )
        )
    lines.extend(
        [
            "",
            "## Client-Facing Close",
            "",
            "The fastest revenue path is to select 5-10 hidden winners, convert them into a focused menu/catering/drop plan, and review performance monthly. The ongoing value is recurring decision support, not one-time recipe delivery.",
        ]
    )
    return "\n".join(lines) + "\n"
