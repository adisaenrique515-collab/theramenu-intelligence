#!/usr/bin/env python
"""
Recipe commercial intelligence extraction pipeline.

The pipeline extracts recipe-like candidates as business data, not cookbook text.
It writes machine-readable records and monetization reports while avoiding
verbatim recipe reproduction from third-party books.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import statistics
import textwrap
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from html import unescape
from pathlib import Path
from typing import Iterable

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT / "Culinary_Monetization_Workspace"
MASTER_REGISTER = WORKSPACE / "00_Inbox_Index" / "culinary_asset_register.csv"

BOOK_CATEGORIES = {
    "Culinary Books And Techniques",
    "World Cuisines",
    "Ingredients And Product Knowledge",
    "Productized Menus",
    "Recipe And Costing Systems",
}

FIELDNAMES = [
    "recipe_id",
    "source_file",
    "recipe_title",
    "cuisine_family",
    "dish_category",
    "protein",
    "starch",
    "vegetables",
    "sauce_or_marinade",
    "core_ingredients",
    "cooking_method",
    "equipment",
    "prep_complexity_1_5",
    "labour_intensity_1_5",
    "batch_suitability_1_5",
    "holding_reheat_score_1_5",
    "delivery_suitability_1_5",
    "customer_familiarity_1_5",
    "premium_pricing_1_5",
    "waste_risk_1_5",
    "cross_utilisation_1_5",
    "commercial_deployability_score",
    "consumer_craving_score",
    "abundance_illusion_score",
    "shareability_score",
    "scarcity_drop_potential",
    "productization_potential",
    "safari_lounge_fit",
    "ghost_kitchen_fit",
    "catering_fit",
    "consulting_value_fit",
    "saas_dataset_fit",
    "best_business_model",
    "derivative_original_ideas",
    "commercial_notes",
    "needs_review",
]


PROTEINS = {
    "beef": ["beef", "steak", "brisket", "short rib", "oxtail", "ground beef", "ossobuco"],
    "chicken": ["chicken", "hen", "wings", "thigh"],
    "pork": ["pork", "bacon", "ham", "sausage", "rib"],
    "goat": ["goat", "mutton"],
    "lamb": ["lamb"],
    "seafood": ["fish", "shrimp", "prawn", "salmon", "tuna", "crab", "cod"],
    "egg": ["egg", "omelet", "omelette"],
    "vegetarian": ["tofu", "beans", "lentil", "chickpea", "mushroom"],
}

STARCHES = {
    "rice": ["rice", "risotto", "pilaf"],
    "noodle": ["noodle", "ramen", "udon", "soba", "pasta", "spaghetti", "macaroni"],
    "bread": ["bread", "bun", "roll", "tortilla", "flatbread", "chapati", "naan"],
    "potato": ["potato", "fries", "chips"],
    "grain": ["corn", "maize", "polenta", "couscous", "quinoa"],
}

VEGETABLES = [
    "onion",
    "garlic",
    "tomato",
    "pepper",
    "capsicum",
    "carrot",
    "cabbage",
    "spinach",
    "kale",
    "mushroom",
    "eggplant",
    "zucchini",
    "lettuce",
    "cucumber",
]

SAUCES = [
    "sauce",
    "marinade",
    "rub",
    "salsa",
    "dressing",
    "gravy",
    "curry",
    "glaze",
    "dip",
    "chutney",
    "relish",
    "aioli",
]

METHODS = {
    "grilled": ["grill", "barbecue", "bbq", "chargrill"],
    "fried": ["fry", "fried", "stir-fry", "stir fry", "deep-fry"],
    "braised": ["braise", "stew", "slow cook", "crock"],
    "roasted": ["roast", "bake"],
    "boiled": ["boil", "simmer", "soup"],
    "raw/cold": ["salad", "pickle", "salsa", "dressing"],
}

EQUIPMENT = {
    "wok": ["wok", "stir-fry", "stir fry"],
    "grill": ["grill", "barbecue", "bbq"],
    "oven": ["oven", "bake", "roast"],
    "slow cooker": ["slow cooker", "crock pot", "crock-pot"],
    "stock pot": ["soup", "stew", "boil", "simmer"],
    "fryer": ["deep-fry", "deep fry", "fried"],
    "blender": ["salsa", "sauce", "dip", "dressing"],
}

CUISINES = {
    "Korean": ["korean", "kimchi", "gochujang", "bulgogi", "bibimbap"],
    "French": ["french", "ragout", "confit", "cassoulet", "bechamel"],
    "Sri Lankan / Curry": ["sri lanka", "curry", "coconut milk", "spice leaves"],
    "Latin / Tex-Mex": ["tex-mex", "salsa", "taco", "enchilada", "latin", "barrios"],
    "Japanese": ["japanese", "ramen", "udon", "soba", "miso"],
    "Chinese / Wok": ["wok", "stir-fry", "stir fry", "soy sauce"],
    "South African": ["south african", "boerewors", "bobotie"],
    "American BBQ": ["bbq", "barbecue", "old west", "beef"],
}

HIGH_VALUE_WORDS = [
    "brisket",
    "rib",
    "steak",
    "seafood",
    "shrimp",
    "salmon",
    "truffle",
    "short rib",
    "ossobuco",
    "platter",
    "feast",
]

VISUAL_WORDS = [
    "crispy",
    "crisp",
    "fried",
    "glazed",
    "sticky",
    "loaded",
    "cheesy",
    "sauce",
    "salsa",
    "platter",
    "bowl",
]


@dataclass
class RecipeRecord:
    recipe_id: str
    source_file: str
    recipe_title: str
    cuisine_family: str
    dish_category: str
    protein: str
    starch: str
    vegetables: str
    sauce_or_marinade: str
    core_ingredients: str
    cooking_method: str
    equipment: str
    prep_complexity_1_5: int
    labour_intensity_1_5: int
    batch_suitability_1_5: int
    holding_reheat_score_1_5: int
    delivery_suitability_1_5: int
    customer_familiarity_1_5: int
    premium_pricing_1_5: int
    waste_risk_1_5: int
    cross_utilisation_1_5: int
    commercial_deployability_score: int
    consumer_craving_score: int
    abundance_illusion_score: int
    shareability_score: int
    scarcity_drop_potential: int
    productization_potential: int
    safari_lounge_fit: int
    ghost_kitchen_fit: int
    catering_fit: int
    consulting_value_fit: int
    saas_dataset_fit: int
    best_business_model: str
    derivative_original_ideas: str
    commercial_notes: str
    needs_review: str


def clamp(value: int, lo: int = 1, hi: int = 5) -> int:
    return max(lo, min(hi, value))


def contains_any(text: str, words: Iterable[str]) -> bool:
    return any(w in text for w in words)


def find_family(text: str, families: dict[str, list[str]], default: str = "") -> str:
    matches = [family for family, words in families.items() if contains_any(text, words)]
    return "; ".join(matches) if matches else default


def list_hits(text: str, words: Iterable[str]) -> list[str]:
    return sorted({w for w in words if w in text})


def read_sources(register: Path, limit_files: int | None, categories: set[str] | None) -> list[dict]:
    if not register.exists():
        raise FileNotFoundError(f"Missing register: {register}")
    rows = list(csv.DictReader(register.open("r", encoding="utf-8-sig", newline="")))
    out = []
    for row in rows:
        path = Path(row.get("SourcePath", ""))
        ext = path.suffix.lower()
        cat = row.get("Category", "")
        if categories and cat not in categories:
            continue
        if ext not in {".pdf", ".epub", ".txt", ".md", ".doc", ".docx", ".html", ".csv", ".xls", ".xlsx"}:
            continue
        if path.exists():
            out.append(row)
    return out[:limit_files] if limit_files else out


def pdf_text(path: Path, max_pages: int) -> str:
    if PdfReader is None:
        return ""
    try:
        reader = PdfReader(str(path))
        texts = []
        for page in reader.pages[:max_pages]:
            try:
                texts.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(texts)
    except Exception:
        return ""


def epub_text(path: Path, max_chars: int) -> str:
    try:
        chunks = []
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith((".html", ".xhtml", ".htm"))]
            for name in names:
                raw = zf.read(name).decode("utf-8", errors="ignore")
                raw = re.sub(r"<script\b.*?</script>", " ", raw, flags=re.I | re.S)
                raw = re.sub(r"<style\b.*?</style>", " ", raw, flags=re.I | re.S)
                raw = re.sub(r"<[^>]+>", " ", raw)
                chunks.append(unescape(raw))
                if sum(len(c) for c in chunks) > max_chars:
                    break
        return "\n".join(chunks)[:max_chars]
    except Exception:
        return ""


def generic_text(path: Path, max_chars: int) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")[:max_chars]
    except Exception:
        return ""


def extract_text(path: Path, max_pages: int, max_chars: int) -> str:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return pdf_text(path, max_pages)[:max_chars]
    if ext == ".epub":
        return epub_text(path, max_chars)
    return generic_text(path, max_chars)


def clean_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line).strip(" -\t\r\n")
    line = re.sub(r"^[0-9]+\s+", "", line)
    return line.strip()


def recipe_candidates(text: str, source_name: str, max_candidates: int) -> list[str]:
    lines = [clean_line(line) for line in text.splitlines()]
    candidates = []
    noise = re.compile(r"^(chapter|contents|index|copyright|introduction|acknowledg|page|serves|makes|yield)\b", re.I)
    generic_heading = {
        "preparation",
        "license",
        "reader",
        "menu",
        "recipe",
        "recipes",
        "ingredients",
        "method",
        "notes",
        "basics",
    }
    quantity_line = re.compile(
        r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|ounces?|oz|grams?|g|kg|ml|litres?|liters?|pounds?|lbs?|cloves?|slices?)\b",
        re.I,
    )
    prep_fragment = re.compile(r"\b(chopped|sliced|minced|peeled|boneless|skinless|large pieces|finely|roughly)\b", re.I)
    unit_start = re.compile(r"^(cups?|tbsp|tablespoons?|tsp|teaspoons?|ounces?|oz|grams?|pounds?|lbs?|cloves?)\b", re.I)
    titleish = re.compile(
        r"\b(sauce|salsa|marinade|rub|dressing|soup|stew|curry|pasta|beef|chicken|goat|pork|fish|rice|noodle|pickle|salad|bbq|barbecue|fried|braised|roasted|grilled|bowl|platter|taco|kimchi|noodles?)\b",
        re.I,
    )
    for line in lines:
        if not 4 <= len(line) <= 95:
            continue
        if line.lower() in generic_heading:
            continue
        if noise.search(line):
            continue
        if quantity_line.search(line) or prep_fragment.search(line) or unit_start.search(line):
            continue
        if line.endswith((",", ";", ":")):
            continue
        letters = sum(c.isalpha() for c in line)
        if letters < max(4, len(line) * 0.45):
            continue
        if titleish.search(line) or line.istitle() or line.isupper():
            candidates.append(line.title() if line.isupper() else line)
    if not candidates:
        stem = Path(source_name).stem
        candidates = [stem]
    deduped = []
    seen = set()
    for item in candidates:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= max_candidates:
            break
    return deduped


def infer_category(title: str, text: str) -> str:
    title_hay = title.lower()
    hay = f"{title} {text}".lower()
    target = title_hay if len(title_hay.split()) >= 2 else hay
    if contains_any(target, ["sauce", "salsa", "dip", "dressing", "marinade", "rub", "gravy"]):
        return "Sauce / Condiment"
    if contains_any(target, ["soup", "stew", "curry", "braise", "broth"]):
        return "Wet Main / Bowl"
    if contains_any(target, ["platter", "feast", "tray", "share"]):
        return "Share Platter"
    if contains_any(target, ["pasta", "noodle", "rice"]):
        return "Starch Main"
    if contains_any(target, ["salad", "pickle"]):
        return "Cold / Prep Ahead"
    if contains_any(target, ["bbq", "barbecue", "grill", "fried", "roast", "pork", "beef", "chicken", "goat", "lamb"]):
        return "Hot Main"
    return "Recipe Candidate"


def score_record(title: str, context: str) -> dict[str, int | str]:
    hay = f"{title} {context}".lower()
    method = find_family(hay, METHODS, "mixed/unknown")
    equipment = find_family(hay, EQUIPMENT, "standard kitchen")
    protein = find_family(hay, PROTEINS, "")
    starch = find_family(hay, STARCHES, "")
    vegetables = "; ".join(list_hits(hay, VEGETABLES))
    sauce = "; ".join(list_hits(hay, SAUCES))
    cuisine = find_family(hay, CUISINES, "General / Fusion")
    dish_category = infer_category(title, context)

    high_heat = contains_any(hay, ["fried", "crispy", "grill", "bbq", "barbecue", "roast"])
    wet_hold = contains_any(hay, ["stew", "soup", "curry", "braise", "slow cooker", "sauce"])
    cold_batch = contains_any(hay, ["pickle", "salsa", "dressing", "marinade", "rub", "dip"])
    premium = contains_any(hay, HIGH_VALUE_WORDS)
    visual = sum(1 for word in VISUAL_WORDS if word in hay)
    share = contains_any(hay, ["platter", "tray", "family", "feast", "bbq", "barbecue", "taco", "wings"])

    prep_complexity = 2 + int(high_heat) + int(wet_hold) + int("stuffed" in hay or "layer" in hay)
    labour = 2 + int(high_heat) + int("dumpling" in hay or "handmade" in hay or "wrapped" in hay)
    batch = 3 + int(wet_hold) + int(cold_batch) + int(share) - int("minute" in hay or "omelet" in hay)
    holding = 2 + int(wet_hold) + int(cold_batch) + int("braise" in hay) - int("crispy" in hay)
    delivery = 3 + int(wet_hold) + int(cold_batch) + int(starch != "") - int("crispy" in hay)
    familiarity = 3 + int(contains_any(hay, ["beef", "chicken", "pasta", "rice", "soup", "bbq", "salsa", "curry"])) - int(
        contains_any(hay, ["offal", "wild game"])
    )
    premium_pricing = 2 + int(premium) + int(share) + int(contains_any(hay, ["korean", "french", "bbq", "barbecue"]))
    waste = 2 + int(contains_any(hay, ["seafood", "salad", "fresh herb"])) - int(wet_hold or cold_batch)
    cross = 2 + int(sauce != "") + int(starch != "") + int(vegetables != "") + int(wet_hold or cold_batch)

    prep_complexity = clamp(prep_complexity)
    labour = clamp(labour)
    batch = clamp(batch)
    holding = clamp(holding)
    delivery = clamp(delivery)
    familiarity = clamp(familiarity)
    premium_pricing = clamp(premium_pricing)
    waste = clamp(waste)
    cross = clamp(cross)
    deploy = familiarity + premium_pricing + batch + holding + delivery + cross - labour - waste

    craving = clamp(2 + int(high_heat) + int(sauce != "") + int(wet_hold) + min(2, visual // 2) + int(share))
    abundance = clamp(2 + int(share) + int(starch != "") + int(wet_hold) + int(contains_any(hay, ["loaded", "family", "tray"])))
    shareability = clamp(2 + int(share) + int(batch >= 4) + int(contains_any(hay, ["dip", "salsa", "bbq", "taco", "platter"])))
    scarcity = clamp(1 + int(premium) + int(craving >= 4) + int(share) + int(contains_any(hay, ["bbq", "barbecue", "braise", "curry"])))
    productization = clamp(1 + int(cold_batch) + int(sauce != "") + int(wet_hold) + int(contains_any(hay, ["dry", "rub", "mix", "soup"])))
    safari = clamp(2 + int(cuisine != "General / Fusion") + int(share) + int(premium_pricing >= 4) + int(craving >= 4))
    ghost = clamp(2 + int(delivery >= 4) + int(batch >= 4) + int(familiarity >= 4) + int(cross >= 4))
    catering = clamp(2 + int(batch >= 4) + int(holding >= 4) + int(shareability >= 4) + int(abundance >= 4))
    consulting = clamp(2 + int(productization >= 4) + int(cross >= 4) + int(safari >= 4))
    saas = clamp(2 + int(sauce != "") + int(starch != "") + int(protein != "") + int(cross >= 4))

    if productization >= 4 and sauce and dish_category == "Sauce / Condiment":
        model = "bottled sauce / rub / dry mix"
    elif catering >= 4:
        model = "catering tray / office bundle"
    elif ghost >= 4:
        model = "ghost kitchen menu item"
    elif safari >= 4:
        model = "Safari Lounge fusion special"
    else:
        model = "menu intelligence / consulting dataset"

    return {
        "cuisine_family": cuisine,
        "dish_category": dish_category,
        "protein": protein,
        "starch": starch,
        "vegetables": vegetables,
        "sauce_or_marinade": sauce,
        "core_ingredients": "; ".join(x for x in [protein, starch, vegetables, sauce] if x),
        "cooking_method": method,
        "equipment": equipment,
        "prep_complexity_1_5": prep_complexity,
        "labour_intensity_1_5": labour,
        "batch_suitability_1_5": batch,
        "holding_reheat_score_1_5": holding,
        "delivery_suitability_1_5": delivery,
        "customer_familiarity_1_5": familiarity,
        "premium_pricing_1_5": premium_pricing,
        "waste_risk_1_5": waste,
        "cross_utilisation_1_5": cross,
        "commercial_deployability_score": deploy,
        "consumer_craving_score": craving,
        "abundance_illusion_score": abundance,
        "shareability_score": shareability,
        "scarcity_drop_potential": scarcity,
        "productization_potential": productization,
        "safari_lounge_fit": safari,
        "ghost_kitchen_fit": ghost,
        "catering_fit": catering,
        "consulting_value_fit": consulting,
        "saas_dataset_fit": saas,
        "best_business_model": model,
    }


def build_record(source: dict, title: str, context: str) -> RecipeRecord:
    source_path = source.get("SourcePath", "")
    recipe_id = "rcp_" + hashlib.sha1(f"{source_path}|{title}".encode("utf-8")).hexdigest()[:12]
    scores = score_record(title, context)
    notes = []
    if scores["commercial_deployability_score"] >= 15:
        notes.append("strong commercial deployability")
    if scores["scarcity_drop_potential"] >= 4:
        notes.append("good scarcity-drop candidate")
    if scores["productization_potential"] >= 4:
        notes.append("component/product line candidate")
    if scores["catering_fit"] >= 4:
        notes.append("works as tray, bundle, or group-buy format")
    derivative = derivative_ideas(title, scores)
    review = "yes" if len(title) < 6 or scores["dish_category"] == "Recipe Candidate" else "no"
    return RecipeRecord(
        recipe_id=recipe_id,
        source_file=source_path,
        recipe_title=title,
        derivative_original_ideas=derivative,
        commercial_notes="; ".join(notes) or "usable as intelligence datapoint; review before productization",
        needs_review=review,
        **scores,
    )


def derivative_ideas(title: str, scores: dict) -> str:
    model = scores["best_business_model"]
    base = re.sub(r"\s+", " ", title).strip()
    if "sauce" in model or "rub" in model:
        return f"Original signature component inspired by the category: Safari Lounge {base} sauce flight; dry rub sachet; catering condiment upsell."
    if "catering" in model:
        return f"{base} office tray; family allocation tray; weekend preorder bundle with premium add-ons."
    if "ghost" in model:
        return f"{base} bowl/wrap combo; delivery-safe sauce-on-side variant; lunch subscription item."
    if "Safari" in model:
        return f"Safari Lounge fusion special using familiar base, premium garnish, and limited weekly drop language."
    return f"Convert {base} into a scored consulting insight, menu engineering example, or structured SaaS datapoint."


def extract_records(sources: list[dict], max_pages: int, max_chars: int, max_candidates: int) -> tuple[list[RecipeRecord], list[dict]]:
    records = []
    manifest = []
    for source in sources:
        path = Path(source["SourcePath"])
        text = extract_text(path, max_pages=max_pages, max_chars=max_chars)
        manifest.append(
            {
                "source_file": str(path),
                "category": source.get("Category", ""),
                "bytes": path.stat().st_size if path.exists() else 0,
                "chars_extracted": len(text),
                "status": "extracted" if text else "no_text",
            }
        )
        if not text:
            continue
        candidates = recipe_candidates(text, path.name, max_candidates=max_candidates)
        low_text = text.lower()
        for title in candidates:
            idx = low_text.find(title.lower())
            if idx >= 0:
                context = text[max(0, idx - 800) : idx + 1600]
            else:
                context = text[:2200]
            records.append(build_record(source, title, context))
    return records, manifest


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def top(rows: list[dict], field: str, n: int) -> list[dict]:
    return sorted(rows, key=lambda r: (int(r.get(field, 0)), int(r.get("commercial_deployability_score", 0))), reverse=True)[:n]


def markdown_table(rows: list[dict], cols: list[str], limit: int = 20) -> str:
    rows = rows[:limit]
    if not rows:
        return "_No rows._\n"
    header = "| " + " | ".join(cols) + " |"
    sep = "| " + " | ".join(["---"] * len(cols)) + " |"
    body = []
    for row in rows:
        vals = []
        for col in cols:
            val = str(row.get(col, "")).replace("|", "/")
            if len(val) > 75:
                val = val[:72] + "..."
            vals.append(val)
        body.append("| " + " | ".join(vals) + " |")
    return "\n".join([header, sep, *body]) + "\n"


def pattern_report(rows: list[dict]) -> str:
    counters = {
        "ingredient_families": Counter(),
        "methods": Counter(),
        "models": Counter(),
        "categories": Counter(),
        "cuisines": Counter(),
    }
    for row in rows:
        for token in str(row.get("core_ingredients", "")).split(";"):
            token = token.strip()
            if token:
                counters["ingredient_families"][token] += 1
        counters["methods"][row.get("cooking_method", "")] += 1
        counters["models"][row.get("best_business_model", "")] += 1
        counters["categories"][row.get("dish_category", "")] += 1
        counters["cuisines"][row.get("cuisine_family", "")] += 1
    lines = ["# Pattern Recognition Intelligence\n"]
    sections = [
        ("Recurring ingredient families with cross-utilisation", "ingredient_families"),
        ("Recurring low-cost high perceived value structures", "categories"),
        ("Recurring methods / bases", "methods"),
        ("Recurring business models", "models"),
        ("Cuisine families with novelty balance", "cuisines"),
    ]
    for title, key in sections:
        lines.append(f"## {title}\n")
        for name, count in counters[key].most_common(15):
            if name:
                lines.append(f"- {name}: {count}")
        lines.append("")
    lines.append("## Intelligence Reads\n")
    lines.extend(
        [
            "- Sauce, marinade, rub, salsa, and dressing records are the highest-friction reducers: they create variety without expanding the kitchen footprint.",
            "- Wet mains such as curries, stews, braises, soups, and sauced bowls score well for batch production, reheating, delivery, and group ordering.",
            "- BBQ, beef, crispy/fried, and sauce-gloss cues create strong visual value signals and support scarcity drops.",
            "- Starch carriers such as rice, noodles, pasta, bread, and tortillas allow low inventory high variety menus.",
        ]
    )
    return "\n".join(lines) + "\n"


def monetization_report(rows: list[dict]) -> str:
    lines = ["# Monetizable Output Generation\n"]
    report_specs = [
        ("Top High Margin Low Labour Dishes", top([r for r in rows if int(r["labour_intensity_1_5"]) <= 3], "commercial_deployability_score", 100)),
        ("Top Ghost Kitchen Opportunities", top(rows, "ghost_kitchen_fit", 100)),
        ("Top Corporate Catering Opportunities", top(rows, "catering_fit", 100)),
        ("Top Productizable Sauces / Rubs / Dry Mixes", top(rows, "productization_potential", 50)),
        ("Top Frozen or Vacuum Pack Opportunities", top([r for r in rows if int(r["holding_reheat_score_1_5"]) >= 4], "holding_reheat_score_1_5", 50)),
        ("Top Safari Lounge Mainstream Fusion Opportunities", top(rows, "safari_lounge_fit", 50)),
        ("Consumer Wallet-Opening Dish Systems", top(rows, "consumer_craving_score", 50)),
        ("SaaS Hospitality Dataset Readiness", top(rows, "saas_dataset_fit", 50)),
    ]
    cols = ["recipe_title", "dish_category", "best_business_model", "commercial_deployability_score", "consumer_craving_score"]
    for title, data in report_specs:
        lines.append(f"## {title}\n")
        lines.append(markdown_table(data, cols, limit=20))
    lines.append("## Productization Notes\n")
    lines.extend(
        [
            "- PDF product: sell ranked reports, sauce/component libraries, menu engineering audits, and drop calendars.",
            "- Consulting service: sell restaurant/caterer menu simplification, food-cost diagnostics, and catering package design.",
            "- Subscription: monthly scarcity-drop menu concepts, supplier/spec sheets, and office bundle calendars.",
            "- Software module: structured recipe scoring dataset, menu deployability score, and catering quote recommender.",
            "- Fastest first revenue: package a 20-dish menu audit plus 5 scarcity-drop concepts for one local food business.",
        ]
    )
    return "\n".join(lines) + "\n"


def scarcity_report(rows: list[dict]) -> str:
    candidates = top(rows, "scarcity_drop_potential", 60)
    lines = ["# Nyandia Gachago Scarcity Food Commerce Calendar\n"]
    lines.append("## Weekly Ritual Drop Concepts\n")
    rituals = [
        ("Thursday", "Only this Thursday", "office lunch preorder closes at 4pm"),
        ("Friday", "Weekend allocation", "family tray allocation for Friday pickup"),
        ("Saturday", "20 trays only", "visible demand update after every 5 trays"),
        ("Sunday", "Insider VIP food club", "members get first choice of next week's drop"),
    ]
    for i, row in enumerate(candidates[:12]):
        day, hook, mechanism = rituals[i % len(rituals)]
        lines.append(f"- {day}: {hook} - {row['recipe_title']} as {row['best_business_model']}; {mechanism}.")
    lines.append("\n## Best Demand Engineering Rows\n")
    lines.append(markdown_table(candidates, ["recipe_title", "scarcity_drop_potential", "shareability_score", "abundance_illusion_score", "best_business_model"], 25))
    lines.append("## Operating Rules\n")
    lines.extend(
        [
            "- Publish allocation count before menu detail to create visible constraint.",
            "- Require preorder close time even if stock remains.",
            "- Use group language: office tray, family tray, VIP allocation, weekend slot.",
            "- Post demand signals: slots left, sold out, next waitlist, private club first access.",
        ]
    )
    return "\n".join(lines) + "\n"


def commercialization_report(rows: list[dict]) -> str:
    lines = ["# Consulting / Digital Product / SaaS Commercialization\n"]
    assets = [
        ("High Margin Low Labour Dish Report", "restaurant owners, caterers, ghost kitchen operators", "$49-$299 PDF or $750 audit", "PDF + consulting", "use extracted top list and sell a 20-item menu audit"),
        ("Ghost Kitchen Opportunity Pack", "delivery-first food founders", "$99 PDF / $1,500 setup", "PDF + service", "launch 10-item delivery menu from high delivery + holding scores"),
        ("Corporate Catering Blueprint", "caterers and office food operators", "$149 PDF / $2,500 implementation", "playbook + consulting", "sell office bundle menu and quotation templates"),
        ("Sauce And Component Library", "cafes, caterers, private label food brands", "$79-$399", "digital product / physical product R&D", "standardize sauce/rub bases and costing sheets"),
        ("Scarcity Food Commerce Calendar", "home chefs, food creators, pop-ups", "$29 monthly / $300 setup", "subscription", "ship weekly drop hooks and allocation scripts"),
        ("Hospitality Dataset API", "software builders and menu consultants", "$99-$499 monthly", "software module", "package scores as CSV/JSON and build query endpoints"),
    ]
    lines.append("| Asset | Who buys | Price point | Format | Fastest first revenue |")
    lines.append("|---|---|---|---|---|")
    for row in assets:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines) + "\n"


def write_reports(rows: list[dict]) -> None:
    reports = ROOT / "data" / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    (reports / "01_pattern_recognition_intelligence.md").write_text(pattern_report(rows), encoding="utf-8")
    (reports / "02_monetizable_outputs.md").write_text(monetization_report(rows), encoding="utf-8")
    (reports / "03_nyandia_gachago_scarcity_calendar.md").write_text(scarcity_report(rows), encoding="utf-8")
    (reports / "04_commercialization_paths.md").write_text(commercialization_report(rows), encoding="utf-8")
    report_map = {
        "top_100_high_margin_low_labour_dishes.md": top([r for r in rows if int(r["labour_intensity_1_5"]) <= 3], "commercial_deployability_score", 100),
        "top_100_ghost_kitchen_opportunities.md": top(rows, "ghost_kitchen_fit", 100),
        "top_100_corporate_catering_opportunities.md": top(rows, "catering_fit", 100),
        "top_50_productizable_sauces_rubs_dry_mixes.md": top(rows, "productization_potential", 50),
        "top_50_frozen_vacuum_pack_opportunities.md": top([r for r in rows if int(r["holding_reheat_score_1_5"]) >= 4], "holding_reheat_score_1_5", 50),
        "top_50_safari_lounge_fusion_opportunities.md": top(rows, "safari_lounge_fit", 50),
        "consumer_wallet_opening_dish_report.md": top(rows, "consumer_craving_score", 100),
        "saas_hospitality_dataset_readiness_report.md": top(rows, "saas_dataset_fit", 100),
    }
    cols = [
        "recipe_title",
        "dish_category",
        "best_business_model",
        "commercial_deployability_score",
        "consumer_craving_score",
        "scarcity_drop_potential",
        "needs_review",
    ]
    for filename, data in report_map.items():
        title = filename.replace("_", " ").replace(".md", "").title()
        body = f"# {title}\n\n" + markdown_table(data, cols, limit=100)
        body += "\n## Commercialization\n\n"
        body += "- Buyer: food founders, caterers, restaurant operators, culinary consultants, or Safari Lounge internal product development.\n"
        body += "- Format: PDF intelligence asset, consulting audit, spreadsheet pack, or SaaS scoring module.\n"
        body += "- Fastest path to revenue: convert the top 10 rows into one paid audit, preorder menu, or component library pilot.\n"
        (reports / filename).write_text(body, encoding="utf-8")
    (reports / "low_inventory_high_variety_menu_blueprint.md").write_text(low_inventory_blueprint(rows), encoding="utf-8")
    (reports / "food_venture_arbitrage_report.md").write_text(arbitrage_report(rows), encoding="utf-8")
    (reports / "zero_kitchen_hospitality_intelligence_products.md").write_text(zero_kitchen_report(), encoding="utf-8")


def low_inventory_blueprint(rows: list[dict]) -> str:
    methods = Counter(r["cooking_method"] for r in rows)
    sauces = [r for r in rows if r["dish_category"] == "Sauce / Condiment" or int(r["productization_potential"]) >= 4]
    carriers = [r for r in rows if r["starch"]]
    mains = [r for r in rows if r["protein"]]
    lines = ["# Low Inventory High Variety Menu Blueprint\n"]
    lines.append("## Menu Architecture\n")
    lines.extend(
        [
            "- Use 3 carriers: rice/noodle/bread or wrap.",
            "- Use 4 proteins: one braised beef, one chicken, one vegetarian, one weekly premium.",
            "- Use 6 sauces/components to create perceived variety without expanding prep.",
            "- Use one weekly scarcity drop to test demand before adding permanent menu items.",
        ]
    )
    lines.append("\n## Best Component Candidates\n")
    lines.append(markdown_table(top(sauces, "productization_potential", 20), ["recipe_title", "dish_category", "productization_potential", "best_business_model"], 20))
    lines.append("\n## Best Carrier / Bowl Candidates\n")
    lines.append(markdown_table(top(carriers, "delivery_suitability_1_5", 20), ["recipe_title", "starch", "delivery_suitability_1_5", "best_business_model"], 20))
    lines.append("\n## Dominant Production Methods\n")
    for method, count in methods.most_common(10):
        lines.append(f"- {method}: {count}")
    return "\n".join(lines) + "\n"


def arbitrage_report(rows: list[dict]) -> str:
    ranked = sorted(
        rows,
        key=lambda r: (
            int(r["premium_pricing_1_5"])
            + int(r["customer_familiarity_1_5"])
            + int(r["abundance_illusion_score"])
            - int(r["labour_intensity_1_5"])
            - int(r["waste_risk_1_5"])
        ),
        reverse=True,
    )
    lines = ["# Food Venture Arbitrage Report\n"]
    lines.append("Arbitrage means high perceived value with low operational penalty.\n")
    lines.append(markdown_table(ranked[:50], ["recipe_title", "dish_category", "premium_pricing_1_5", "abundance_illusion_score", "labour_intensity_1_5", "waste_risk_1_5"], 50))
    lines.append("\n## Plays\n")
    lines.extend(
        [
            "- Convert high-abundance wet mains into family trays and office bundles.",
            "- Convert sauce-heavy records into add-on flights, bottled components, and margin-protecting upsells.",
            "- Use familiar proteins with novel sauces for the best familiarity/novelty balance.",
            "- Avoid fresh seafood and highly crisp items for delivery unless packaging is solved.",
        ]
    )
    return "\n".join(lines) + "\n"


def zero_kitchen_report() -> str:
    return textwrap.dedent(
        """\
        # Zero-Kitchen Hospitality Intelligence Products I Can Sell

        | Product | Buyer | Price point | Format | Fastest path |
        |---|---|---|---|---|
        | Menu Profit Audit | Restaurants and cafes | $500-$2,500 | Consulting report | Analyze their menu using this scoring schema |
        | Scarcity Drop Calendar | Home chefs and pop-ups | $29-$99/month | Subscription PDF | Sell weekly drop concepts and preorder scripts |
        | Catering Quote Builder | Caterers | $99-$499 | Spreadsheet/template | Package quote logic with sample menus |
        | Sauce Component Library | Food operators | $79-$399 | Digital product | Sell original sauce/rub framework and costing model |
        | Ghost Kitchen Menu Map | Delivery founders | $149-$1,500 | Report + consulting | Build 10-item delivery-safe menu |
        | Hospitality Dataset CSV | Software builders | $99-$499/month | Data subscription | License cleaned scoring records and taxonomy |
        | Safari Lounge IP Pack | Internal or licensee | $2,500+ | Brand/menu system | Turn top fusion ideas into limited releases |
        """
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--register", default=str(MASTER_REGISTER))
    parser.add_argument("--limit-files", type=int, default=8)
    parser.add_argument("--max-pages", type=int, default=12)
    parser.add_argument("--max-chars", type=int, default=120000)
    parser.add_argument("--max-candidates", type=int, default=18)
    parser.add_argument("--categories", default=",".join(sorted(BOOK_CATEGORIES)))
    args = parser.parse_args()

    categories = {x.strip() for x in args.categories.split(",") if x.strip()}
    sources = read_sources(Path(args.register), args.limit_files, categories)
    records, manifest = extract_records(sources, args.max_pages, args.max_chars, args.max_candidates)
    rows = [asdict(r) for r in records]

    write_csv(ROOT / "data" / "raw_books" / "source_manifest.csv", manifest, ["source_file", "category", "bytes", "chars_extracted", "status"])
    write_csv(ROOT / "data" / "extracted" / "recipe_candidates.csv", rows, FIELDNAMES)
    write_csv(ROOT / "data" / "master" / "recipe_commercial_intelligence.csv", rows, FIELDNAMES)
    write_jsonl(ROOT / "data" / "master" / "recipe_commercial_intelligence.jsonl", rows)
    write_reports(rows)

    print(f"sources={len(sources)}")
    print(f"records={len(rows)}")
    print(f"master={ROOT / 'data' / 'master' / 'recipe_commercial_intelligence.csv'}")
    print(f"reports={ROOT / 'data' / 'reports'}")
    if rows:
        print("sample:")
        for row in top(rows, "commercial_deployability_score", 5):
            print(f"- {row['recipe_title']} | deploy={row['commercial_deployability_score']} | model={row['best_business_model']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
