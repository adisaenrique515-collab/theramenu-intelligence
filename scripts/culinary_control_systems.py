#!/usr/bin/env python
"""
Generate deeper culinary monetization control systems from extracted recipe
commercial intelligence.

This script does not sell recipes. It turns scored dish structures into
subscription, licensing, audit, membership, preorder, and backend data systems.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "data" / "master" / "recipe_commercial_intelligence.csv"
OUT_DIR = ROOT / "data" / "reports" / "control_systems"

GENERIC_TITLES = {
    "acknowledgments",
    "preparation",
    "license",
    "reader",
    "menu",
    "recipe",
    "recipes",
    "ingredients",
    "method",
    "notes",
    "contents",
    "index",
}


def i(row: dict, key: str) -> int:
    try:
        return int(row.get(key, 0))
    except ValueError:
        return 0


def clean_title(title: str) -> bool:
    t = (title or "").strip().lower()
    if not t or t in GENERIC_TITLES:
        return False
    if len(t) < 5:
        return False
    if "copyright" in t or "all rights" in t or "isbn" in t:
        return False
    if t.endswith(".") and "," in t:
        return False
    return True


def load_rows(path: Path) -> list[dict]:
    rows = list(csv.DictReader(path.open("r", encoding="utf-8-sig", newline="")))
    filtered = []
    for row in rows:
        if not clean_title(row.get("recipe_title", "")):
            continue
        if row.get("needs_review", "").lower() == "yes":
            continue
        filtered.append(row)
    return filtered


def score_dependency(row: dict) -> int:
    return (
        i(row, "cross_utilisation_1_5")
        + i(row, "saas_dataset_fit")
        + i(row, "consulting_value_fit")
        + i(row, "commercial_deployability_score")
        + i(row, "batch_suitability_1_5")
    )


def score_ritual(row: dict) -> int:
    return (
        i(row, "scarcity_drop_potential") * 3
        + i(row, "shareability_score") * 2
        + i(row, "abundance_illusion_score") * 2
        + i(row, "consumer_craving_score")
        + i(row, "holding_reheat_score_1_5")
    )


def score_license(row: dict) -> int:
    return (
        i(row, "safari_lounge_fit") * 2
        + i(row, "consulting_value_fit") * 2
        + i(row, "productization_potential") * 2
        + i(row, "commercial_deployability_score")
    )


def score_audit(row: dict) -> int:
    risk = i(row, "labour_intensity_1_5") + i(row, "waste_risk_1_5") - i(row, "cross_utilisation_1_5")
    opportunity = i(row, "premium_pricing_1_5") + i(row, "customer_familiarity_1_5") + i(row, "commercial_deployability_score")
    return opportunity + max(0, risk)


def top(rows: list[dict], scorer, n: int) -> list[dict]:
    return sorted(rows, key=lambda r: (scorer(r), i(r, "commercial_deployability_score")), reverse=True)[:n]


def table(rows: list[dict], cols: list[str], scorer=None, limit: int = 25) -> str:
    header = "| " + " | ".join(cols + (["control_score"] if scorer else [])) + " |"
    sep = "| " + " | ".join(["---"] * (len(cols) + (1 if scorer else 0))) + " |"
    body = []
    for row in rows[:limit]:
        vals = []
        for col in cols:
            val = str(row.get(col, "")).replace("|", "/")
            if len(val) > 72:
                val = val[:69] + "..."
            vals.append(val)
        if scorer:
            vals.append(str(scorer(row)))
        body.append("| " + " | ".join(vals) + " |")
    return "\n".join([header, sep, *body]) + "\n"


def write_csv(path: Path, rows: list[dict], extra_score_name: str, scorer) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    fields = list(rows[0].keys()) + [extra_score_name]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            out = dict(row)
            out[extra_score_name] = scorer(row)
            writer.writerow(out)


def model_counts(rows: list[dict]) -> str:
    counts = Counter(row.get("best_business_model", "") for row in rows)
    return "\n".join(f"- {name}: {count}" for name, count in counts.most_common() if name)


def monthly_dependency_subscription(rows: list[dict]) -> str:
    ranked = top(rows, score_dependency, 40)
    lines = ["# Monthly Menu Dependency Subscription Products For Venues\n"]
    lines.append("## Control Thesis\n")
    lines.append(
        "Venues do not stay subscribed for recipes. They stay subscribed when the product becomes their monthly decision engine: what to push, what to retire, what to batch, what to price, what to photograph, and what to run as a limited release.\n"
    )
    lines.append("## Product Architecture\n")
    lines.extend(
        [
            "- Monthly Menu Command Brief: 8-12 deployable dish structures scored by margin, labour, holding, delivery, and craving.",
            "- Dependency Hook: each month references the venue's previous winners and updates the next deployment map, making cancellation costly because the learning loop is held in the intelligence layer.",
            "- Inventory Compression Map: tells the venue how to create variety from fewer SKUs.",
            "- Staff Execution Pack: prep burden, station load, holding logic, and service risk notes.",
            "- Demand Ritual Calendar: weekly drop hooks and preorder windows for the month.",
            "- Owner Fear Reducer: a short list of menu leaks: waste, low-margin labour traps, and confusing dishes that slow decisions.",
        ]
    )
    lines.append("\n## Subscription Tiers\n")
    lines.append("| Tier | Buyer | Price | Deliverable | Dependency Mechanism |")
    lines.append("|---|---|---:|---|---|")
    lines.append("| Signal | cafe/ghost kitchen | $199-$399/mo | 1 monthly brief + 4 drop ideas | keeps their calendar full |")
    lines.append("| Command | restaurant/caterer | $750-$1,500/mo | menu map, costing priorities, staff pack | you become their menu planning department |")
    lines.append("| Control Room | multi-site/venue group | $2,500-$7,500/mo | dataset, quarterly strategy, implementation call | proprietary benchmark and history layer |")
    lines.append("\n## Rows Best Suited To Subscription Rotation\n")
    lines.append(table(ranked, ["recipe_title", "dish_category", "best_business_model", "commercial_deployability_score", "cross_utilisation_1_5"], score_dependency, 30))
    return "\n".join(lines)


def recurring_ritual_calendar(rows: list[dict]) -> str:
    ranked = top(rows, score_ritual, 52)
    hooks = [
        ("Mon", "Office list opens", "team preorder list; admin collects names"),
        ("Tue", "Insider reveal", "VIP members see the dish before public posting"),
        ("Wed", "Allocation count", "real capacity count published with cutoff"),
        ("Thu", "Preorder closes at 4pm", "production lock and payment confirmation"),
        ("Fri", "Pickup/delivery event", "visible fulfillment and next waitlist"),
        ("Sat", "Family tray release", "limited trays based on prep capacity"),
        ("Sun", "Next week tease", "one sensory hook, no full menu"),
    ]
    lines = ["# Recurring Demand Ritual Calendar\n"]
    lines.append("This calendar uses real operational limits: batch size, labour capacity, pickup windows, and prep deadlines. Do not fake demand signals.\n")
    lines.append("| Week | Day | Dish System | Scarcity Hook | Preorder Mechanism | Control Objective |")
    lines.append("|---:|---|---|---|---|---|")
    for idx, row in enumerate(ranked[:28], start=1):
        day, hook, mechanism = hooks[(idx - 1) % len(hooks)]
        lines.append(
            f"| {((idx - 1) // 7) + 1} | {day} | {row['recipe_title']} | {hook} | {mechanism} | shift demand before production, reduce waste, and train weekly attention |"
        )
    lines.append("\n## Demand Controls\n")
    lines.extend(
        [
            "- Use allocation because kitchen capacity is finite, not because scarcity is pretend.",
            "- Make preorder cutoff strict so production can be planned.",
            "- Use waitlists to capture unsatisfied demand and choose next week's drop.",
            "- Sell repeat ritual, not novelty alone: same weekday rhythm, changing dish system.",
        ]
    )
    return "\n".join(lines)


def private_intelligence_bank(rows: list[dict]) -> str:
    ranked = top(rows, score_license, 60)
    by_model = defaultdict(list)
    for row in ranked:
        by_model[row.get("best_business_model", "")].append(row)
    lines = ["# Private Winning-Dish Intelligence Bank For Licensing\n"]
    lines.append("## What Is Licensed\n")
    lines.extend(
        [
            "- The scorecard, taxonomy, deployment notes, drop timing, menu-positioning logic, and operational interpretation.",
            "- Original derivative concepts and execution systems built from the intelligence layer.",
            "- Not third-party recipe text, book layouts, photos, or copied recipe collections.",
        ]
    )
    lines.append("\n## License Models\n")
    lines.append("| License | Buyer | Price | Rights | Renewal Trigger |")
    lines.append("|---|---|---:|---|---|")
    lines.append("| Category Pack | one restaurant/caterer | $500-$2,000 | use one dish family internally | quarterly refresh |")
    lines.append("| Territory Pack | local operator | $2,500-$10,000 | exclusive local use of selected deployment ideas | seasonal menu update |")
    lines.append("| White-Label Intelligence | consultant/agency | $1,000-$5,000/mo | use reports under their brand | dataset refresh |")
    lines.append("| Safari Lounge IP Module | internal/licensee | $5,000+ | branded fusion/drop system | campaign cycle |")
    for model, items in by_model.items():
        lines.append(f"\n## Bank: {model}\n")
        lines.append(table(items, ["recipe_title", "dish_category", "safari_lounge_fit", "productization_potential", "consulting_value_fit"], score_license, 12))
    return "\n".join(lines)


def buyer_uncertainty_audits(rows: list[dict]) -> str:
    ranked = top(rows, score_audit, 50)
    lines = ["# Buyer Uncertainty Menu Audit Offers\n"]
    lines.append("## Offer Logic\n")
    lines.append(
        "Sell certainty to operators who suspect their menu is leaking profit, confusing customers, overloading staff, or hiding better products inside the same inventory. The fear trigger must be evidence-based: waste, low margin, labour bottlenecks, unclear menu architecture, and weak preorder capture.\n"
    )
    lines.append("## Audit Offers\n")
    lines.append("| Offer | Buyer fear | Deliverable | Price | Close Script |")
    lines.append("|---|---|---|---:|---|")
    lines.append("| Menu Leak Scan | 'I am busy but profit is thin' | 10 leaks + 5 fixes | $250-$750 | 'I will show where margin is being lost before you add more items.' |")
    lines.append("| Labour Drag Audit | 'My kitchen is overloaded' | station-load and prep-risk map | $750-$1,500 | 'Your problem may not be sales. It may be the wrong dishes absorbing labour.' |")
    lines.append("| Hidden Winner Audit | 'I don't know what to promote' | top dishes to push/drop/bundle | $1,000-$2,500 | 'We identify the few dishes that can carry demand and reduce noise.' |")
    lines.append("| Preorder Revenue Audit | 'Demand is unpredictable' | ritual calendar + allocation rules | $1,500-$3,500 | 'We move orders before production so demand becomes visible.' |")
    lines.append("\n## Intelligence Rows For Audit Demonstrations\n")
    lines.append(table(ranked, ["recipe_title", "dish_category", "labour_intensity_1_5", "waste_risk_1_5", "premium_pricing_1_5", "commercial_deployability_score"], score_audit, 30))
    return "\n".join(lines)


def insider_membership(rows: list[dict]) -> str:
    ranked = top(rows, score_dependency, 36)
    lines = ["# Insider Confidential Hospitality Intelligence Membership\n"]
    lines.append("## Positioning\n")
    lines.append("A private intelligence room for operators who want menu signals before the market sees them: winners, weak signals, drop concepts, supplier/component ideas, and staff execution notes.\n")
    lines.append("## Membership Stack\n")
    lines.append("| Layer | Content | Price | Retention Lock |")
    lines.append("|---|---|---:|---|")
    lines.append("| Signal Room | monthly winner list + drop hooks | $49-$149/mo | novelty and speed |")
    lines.append("| Operator Room | templates, audit sheets, preorder scripts | $299-$799/mo | implementation assets |")
    lines.append("| Confidential Benchmarks | anonymized menu patterns and score trends | $1,000-$3,000/mo | proprietary comparison data |")
    lines.append("| Private Advisory | monthly call + custom venue map | $2,500+/mo | direct dependency on your judgement |")
    lines.append("\n## Monthly Confidential Brief Template\n")
    lines.extend(
        [
            "1. Three dish structures gaining commercial weight.",
            "2. Three labour traps to avoid.",
            "3. One weekly scarcity ritual to test.",
            "4. One sauce/component system to productize.",
            "5. One low-inventory high-variety menu architecture.",
        ]
    )
    lines.append("\n## Seed Intelligence Rows\n")
    lines.append(table(ranked, ["recipe_title", "best_business_model", "saas_dataset_fit", "consulting_value_fit", "cross_utilisation_1_5"], score_dependency, 20))
    return "\n".join(lines)


def preorder_herd_system(rows: list[dict]) -> str:
    ranked = top(rows, score_ritual, 40)
    lines = ["# Preorder Herd-Event Food Systems\n"]
    lines.append("## System Design\n")
    lines.extend(
        [
            "- One public release slot per week, same weekday, same time.",
            "- One visible but truthful capacity number based on production constraints.",
            "- One group-buy mechanism: office list, family tray, WhatsApp cohort, or VIP club.",
            "- One payment cutoff before procurement/prep.",
            "- One waitlist that decides the next release.",
        ]
    )
    lines.append("\n## Event Types\n")
    lines.append("| Event | Best dish structure | Mechanism | Monetization |")
    lines.append("|---|---|---|---|")
    lines.append("| Office Herd Lunch | bowls, sauced mains, trays | admin collects names | per-head bundle + delivery fee |")
    lines.append("| Family Tray Allocation | braises, roast meats, curries | 20 tray cap | deposit + premium add-ons |")
    lines.append("| Sauce Drop | rubs, dips, marinades | batch count | jars, sachets, refill club |")
    lines.append("| Safari Lounge Insider Plate | premium fusion special | VIP first access | high-margin limited item |")
    lines.append("\n## Best Rows For Herd Events\n")
    lines.append(table(ranked, ["recipe_title", "dish_category", "shareability_score", "abundance_illusion_score", "scarcity_drop_potential", "best_business_model"], score_ritual, 30))
    return "\n".join(lines)


def backend_intelligence_layer(rows: list[dict]) -> str:
    fields = [
        "recipe_id",
        "recipe_title",
        "dish_category",
        "cuisine_family",
        "commercial_deployability_score",
        "consumer_craving_score",
        "scarcity_drop_potential",
        "productization_potential",
        "safari_lounge_fit",
        "ghost_kitchen_fit",
        "catering_fit",
        "consulting_value_fit",
        "saas_dataset_fit",
    ]
    lines = ["# One Backend Intelligence Layer Feeding Multiple Brands And Clients\n"]
    lines.append("## Architecture\n")
    lines.append("```mermaid")
    lines.append("flowchart LR")
    lines.append('  A["Recipe/Book/Menu Sources"] --> B["Extraction + Scoring Pipeline"]')
    lines.append('  B --> C["Master Intelligence Dataset"]')
    lines.append('  C --> D["Safari Lounge Drop Calendar"]')
    lines.append('  C --> E["Venue Subscription Briefs"]')
    lines.append('  C --> F["Consulting Audit Reports"]')
    lines.append('  C --> G["White-Label Caterer Systems"]')
    lines.append('  C --> H["SaaS/API Scoring Module"]')
    lines.append('  C --> I["Private Intelligence Membership"]')
    lines.append("```")
    lines.append("\n## Data Contract\n")
    lines.append("| Field | Use |")
    lines.append("|---|---|")
    for field in fields:
        lines.append(f"| `{field}` | filter, score, rank, personalize, or package offers |")
    lines.append("\n## Multi-Brand Outputs\n")
    lines.append("| Brand/client | Same backend data becomes | Recurring rent mechanism |")
    lines.append("|---|---|---|")
    lines.append("| Safari Lounge | limited mainstream-fusion drops | weekly allocation calendar |")
    lines.append("| Caterer | office/family tray systems | monthly menu dependency subscription |")
    lines.append("| Restaurant | menu leak and hidden winner audits | quarterly re-audit |")
    lines.append("| Consultant | white-label intelligence packs | license fee |")
    lines.append("| SaaS | deployability and craving scores | API/data subscription |")
    lines.append("\n## Current Dataset Mix\n")
    lines.append(model_counts(rows))
    return "\n".join(lines)


def scripts_and_client_models(rows: list[dict]) -> str:
    ranked_dependency = top(rows, score_dependency, 12)
    ranked_ritual = top(rows, score_ritual, 12)
    lines = ["# Scripts, Offers, Client Models, And Monetization Architecture\n"]
    lines.append("## Core Offer Stack\n")
    lines.append("| Offer | Entry Promise | Client Type | Price | Delivery | Recurrence Lock |")
    lines.append("|---|---|---|---:|---|---|")
    lines.append("| Menu Leak Scan | find hidden menu profit leaks | cafe/restaurant | $250-$750 | PDF + 30 min call | re-scan every 60 days |")
    lines.append("| Monthly Menu Command Brief | know what to push next month | venue/caterer | $750-$1,500/mo | monthly PDF + sheets | next-month dependency |")
    lines.append("| Drop Calendar Operator Pack | make demand visible before prep | pop-up/home chef | $299-$999/mo | weekly drop scripts | preorder rhythm |")
    lines.append("| Private Dish Intelligence License | access proven dish structures | consultants/agencies | $1,000-$5,000/mo | data bank + usage rights | refreshed bank |")
    lines.append("| Safari Lounge Fusion Control Room | create limited high-margin drops | internal/licensee | $2,500-$7,500/mo | concept map + rollout | campaign calendar |")

    lines.append("\n## Sales Scripts\n")
    lines.append("### Menu Leak Scan")
    lines.append(
        "> Your menu may not need more items. It may need fewer labour traps, clearer winners, and better preorder visibility. I run a Menu Leak Scan that shows which dishes are likely absorbing labour, hiding margin, or confusing customer choice. You get a ranked action map, not a recipe document."
    )
    lines.append("\n### Monthly Dependency Subscription")
    lines.append(
        "> Every month I give you a venue-specific command brief: what to push, what to retire, what to bundle, what to run as a limited release, and how to compress inventory while making the menu feel bigger. The value is not ideas; it is decision control."
    )
    lines.append("\n### Scarcity Drop System")
    lines.append(
        "> We make demand visible before you cook. You get a weekly preorder ritual, a real allocation cap based on kitchen capacity, cutoff scripts, and a waitlist loop that tells us what to release next."
    )
    lines.append("\n### Intelligence License")
    lines.append(
        "> You can license the intelligence layer: ranked dish structures, deployment logic, drop timing, menu audit frameworks, and commercial scoring. You are not buying recipes. You are buying a decision engine you can apply to your own clients or venues."
    )

    lines.append("\n## Client Models\n")
    lines.append("| Client | Pain | What They Buy | Dependency Created |")
    lines.append("|---|---|---|---|")
    lines.append("| Independent restaurant | busy but low margin | Menu Leak Scan + monthly command brief | they need recurring menu decisions |")
    lines.append("| Caterer | unpredictable demand | office/family tray preorder system | they need monthly packages and quote logic |")
    lines.append("| Ghost kitchen | delivery menu uncertainty | high holding/delivery dish bank | they need scored launch items |")
    lines.append("| Pop-up/home chef | attention decay | scarcity drop calendar | they need weekly ritual and allocation scripts |")
    lines.append("| Consultant/agency | needs proprietary edge | white-label intelligence bank | they need data they cannot easily recreate |")
    lines.append("| Safari Lounge | needs differentiated mainstream fusion | fusion drop control room | recurring campaign IP |")

    lines.append("\n## Monetization Architecture")
    lines.append("1. Dataset creates signal.")
    lines.append("2. Signal creates audit.")
    lines.append("3. Audit reveals uncertainty.")
    lines.append("4. Uncertainty sells monthly command.")
    lines.append("5. Monthly command generates drop rituals.")
    lines.append("6. Drop results feed the dataset.")
    lines.append("7. Dataset becomes more proprietary with every client.")

    lines.append("\n## First 12 Dependency Candidates")
    lines.append(table(ranked_dependency, ["recipe_title", "best_business_model", "commercial_deployability_score", "saas_dataset_fit", "consulting_value_fit"], score_dependency, 12))
    lines.append("\n## First 12 Ritual Candidates")
    lines.append(table(ranked_ritual, ["recipe_title", "best_business_model", "scarcity_drop_potential", "shareability_score", "abundance_illusion_score"], score_ritual, 12))
    return "\n".join(lines)


def strategic_master_plan(rows: list[dict]) -> str:
    lines = ["# Culinary Monetization Control Systems Master Plan\n"]
    lines.append("## Operating Doctrine\n")
    lines.extend(
        [
            "- You are not selling recipes. You are selling reduced uncertainty, recurring decision support, demand visibility, operational compression, and proprietary pattern recognition.",
            "- The asset is the intelligence layer: scoring, taxonomy, deployment logic, client history, and conversion rituals.",
            "- Scarcity must be grounded in real constraints: prep capacity, batch size, staff availability, pickup windows, and ingredient procurement.",
            "- The strongest model is one backend dataset repackaged into multiple front-end products.",
        ]
    )
    lines.append("\n## Seven Control Systems\n")
    systems = [
        ("Venue Dependency Subscription", "monthly decision engine", "$199-$7,500/mo"),
        ("Scarcity Ritual Calendar", "preorder and allocation rhythm", "$29-$3,500/mo"),
        ("Private Winning-Dish Bank", "licensed intelligence access", "$500-$10,000+"),
        ("Buyer Uncertainty Audit", "fear of hidden menu leakage", "$250-$3,500"),
        ("Insider Intelligence Membership", "confidential signal room", "$49-$3,000/mo"),
        ("Preorder Herd Event System", "visible group demand before production", "margin + deposits"),
        ("Backend Intelligence Layer", "same data feeds many brands", "SaaS/API/license"),
    ]
    lines.append("| System | Control point | Monetization |")
    lines.append("|---|---|---:|")
    for row in systems:
        lines.append("| " + " | ".join(row) + " |")
    lines.append("\n## Immediate Build Order\n")
    lines.extend(
        [
            "1. Clean the top 100 rows manually into a private winning-dish bank.",
            "2. Sell a Menu Leak Scan to one venue using the audit script.",
            "3. Convert the best 12 rows into a monthly drop calendar.",
            "4. Build one Safari Lounge fusion drop from a high `safari_lounge_fit` row.",
            "5. Package the same outputs as a venue subscription sample issue.",
        ]
    )
    return "\n".join(lines)


def write_outputs(rows: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "00_master_control_systems_plan.md": strategic_master_plan(rows),
        "01_monthly_menu_dependency_subscription.md": monthly_dependency_subscription(rows),
        "02_recurring_demand_ritual_calendar.md": recurring_ritual_calendar(rows),
        "03_private_winning_dish_intelligence_bank.md": private_intelligence_bank(rows),
        "04_buyer_uncertainty_menu_audit_offers.md": buyer_uncertainty_audits(rows),
        "05_insider_confidential_hospitality_membership.md": insider_membership(rows),
        "06_preorder_herd_event_food_systems.md": preorder_herd_system(rows),
        "07_backend_intelligence_layer_architecture.md": backend_intelligence_layer(rows),
        "08_scripts_offers_client_models.md": scripts_and_client_models(rows),
    }
    for filename, body in outputs.items():
        (OUT_DIR / filename).write_text(body, encoding="utf-8")

    banks = {
        "dependency_subscription_bank.csv": (top(rows, score_dependency, 100), "dependency_control_score", score_dependency),
        "ritual_drop_bank.csv": (top(rows, score_ritual, 100), "ritual_control_score", score_ritual),
        "licensing_intelligence_bank.csv": (top(rows, score_license, 100), "license_control_score", score_license),
        "audit_offer_bank.csv": (top(rows, score_audit, 100), "audit_control_score", score_audit),
    }
    for filename, (bank_rows, score_name, scorer) in banks.items():
        write_csv(OUT_DIR / filename, bank_rows, score_name, scorer)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", default=str(MASTER))
    args = parser.parse_args()
    rows = load_rows(Path(args.master))
    write_outputs(rows)
    print(f"clean_rows={len(rows)}")
    print(f"out_dir={OUT_DIR}")
    for row in top(rows, score_dependency, 5):
        print(f"- {row['recipe_title']} | dependency={score_dependency(row)} | model={row['best_business_model']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
