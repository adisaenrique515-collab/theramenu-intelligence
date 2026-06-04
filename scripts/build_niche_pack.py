#!/usr/bin/env python
from __future__ import annotations

import csv
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "niche_pack"
MANUAL = OUT / "Safari_Lounge_Commercial_Fusion_Niche_Pack.md"
CSV_OUT = OUT / "production_items.csv"


def dedent(s: str) -> str:
    return textwrap.dedent(s).strip() + "\n"


items: list[dict] = []


def add_item(
    module: str,
    name: str,
    role: str,
    yield_: str,
    ingredients: list[tuple[str, str]],
    method: list[str],
    prep_holding: str,
    finish: str,
    packaging: str,
    allergens: str,
    cost_logic: str,
    pricing_logic: str,
    cross_apps: str,
    tags: str,
) -> str:
    items.append(
        {
            "module": module,
            "item_name": name,
            "venue_role": role,
            "standard_batch_yield": yield_,
            "allergens": allergens,
            "notebooklm_tags": tags,
        }
    )
    ingredient_rows = "\n".join(f"| {ing} | {qty} |" for ing, qty in ingredients)
    method_rows = "\n".join(f"{i}. {step}" for i, step in enumerate(method, 1))
    return dedent(
        f"""
        ### {name}

        **Commercial position / venue role:** {role}

        **Standard batch yield:** {yield_}

        | Ingredient | Metric quantity |
        |---|---:|
        {ingredient_rows}

        **Production method**

        {method_rows}

        **Prep-ahead and holding notes:** {prep_holding}

        **Reheating or service finish notes:** {finish}

        **Packaging/plating notes:** {packaging}

        **Allergen notes:** {allergens}

        **Food cost logic:** {cost_logic}

        **Menu pricing logic:** {pricing_logic}

        **Cross-application opportunities:** {cross_apps}

        **NotebookLM tags / future retrieval relevance:** {tags}
        """
    )


def module_header(letter: str, title: str, function: str) -> str:
    return dedent(
        f"""
        ## Module {letter} - {title}

        **Commercial function inside the venue:** {function}
        """
    )


def commercial_control_appendices() -> str:
    return dedent(
        """
        # Commercial Control Appendices

        These appendices turn the production recipes into a sellable hospitality system. They are designed for a chef-owner, consultant, operator, or NotebookLM user who needs to move from culinary ideas into execution, pricing, bundling, staff training, and repeat revenue.

        ## Appendix 1 - Venue Operating Model

        The pack is built around a three-lane venue model:

        | Lane | Function | Revenue Type | Prep Dependency | Customer Psychology |
        |---|---|---|---|---|
        | Daily Trade | bowls, wraps, snacks, sides | repeat cash flow | sauces, rice, pan proteins | low-thought yes, familiar comfort |
        | Catering Trade | trays, office bundles, family packs | high-ticket orders | rice bases, proteins, sauces, packaging | group justification, abundance, convenience |
        | Ritual Drops | weekly specials, WhatsApp preorders, VIP allocations | demand control | hero proteins, limited sauce batches | scarcity, visible allocation, urgency |

        The strategic advantage comes from making these lanes share the same mise en place. A weak food business creates new prep for every channel. A strong one turns the same prep into different buying contexts. The customer sees variety; the kitchen sees repetition.

        ## Appendix 2 - Master Prep Dependency Map

        | Prep Component | Feeds Daily Trade | Feeds Catering | Feeds Weekly Drops | Feeds Retail/Product IP |
        |---|---|---|---|---|
        | Safari Char-Grill Master Marinade | skewers, bowls, wraps | grilled trays | Thursday char-grill boxes | bottled marinade / consulting IP |
        | Gochu-BBQ Sticky Glaze | wings, pork, beef, fries | sauce flight, tray finish | sticky wing drop | bottled sauce / dip flight |
        | Coconut Curry Wet Fry Base | curry bowls, fish, veg | family curry trays | goat/fish allocation | frozen curry base |
        | Green Herb Lime Crema | wraps, fish, fries | sauce side packs | snack upgrades | cold sauce / dressing line |
        | Base Wet Fry Aromatic Mix | beef/goat/chicken pan finish | hot tray proteins | wet fry limited specials | chef prep system |
        | Coconut Turmeric Rice Base | bowls | office trays | family bundles | low-cost base formula |
        | Smoky Tomato Pilau Rice | BBQ bowls, Tex-Mex wraps | event trays | roast beef specials | venue menu architecture |
        | Crispy Potato Hash Base | snacks, breakfast, sides | family tray add-on | loaded hash drop | brunch and bar system |

        Operational rule: any new item must use at least two existing components or it remains a test item only. Permanent menu space is earned by cross-utilisation.

        ## Appendix 3 - Weekly Production Rhythm

        ### Monday - Data and prep reset

        - Review previous week: top sellers, waste, sold-out points, prep shortages, customer requests.
        - Decide one ritual drop for the week.
        - Confirm supplier availability for hero protein.
        - Produce sauce bank: glaze, crema, curry base, marinade.
        - Publish first teaser if running preorder.

        ### Tuesday - Protein commitment

        - Trim and marinate proteins.
        - Cook wet fry aromatic base.
        - Cook goat/beef/fish prep if drop requires longer lead time.
        - Push VIP preorder or office admin message.
        - Update allocation count based on real prep capacity.

        ### Wednesday - Carbohydrate and packaging lock

        - Cook rice bases if orders are known, or prep dry measured batches.
        - Confirm packaging inventory: trays, bowls, labels, sauce cups, allergen cards.
        - Close large office orders by 4pm.
        - Start waitlist capture for overflow demand.

        ### Thursday - Daily trade plus drop production

        - Finish proteins in controlled batches.
        - Pack office bowls or lunch drops.
        - Record actual labour time per batch.
        - Photograph finished trays for future sales proof.

        ### Friday/Saturday - family tray and bar snack push

        - Run high-margin snack specials.
        - Sell sauce flight upgrades.
        - Convert leftover proteins into controlled secondary items: wraps, hash, staff meal, or next-day fried rice only if food-safe.

        ### Sunday - private intelligence review

        - Score each item: sales, waste, labour, customer comments, repeat demand.
        - Update NotebookLM/database tags.
        - Decide what becomes permanent, what becomes seasonal, and what dies.

        ## Appendix 4 - Station Breakdown

        ### Sauce Station

        Responsibilities:

        - Produce marinade, glaze, crema, curry base, sauce flight portions.
        - Label allergens and date codes.
        - Maintain sauce bottle par levels.
        - Record sauce usage against sales channels.

        Critical controls:

        - Never reuse raw-protein marinade as service sauce.
        - Keep cold sauces below 5 C.
        - Keep hot sauces above 63 C during service.
        - Separate sesame/soy/dairy sauces for allergen clarity.

        ### Protein Station

        Responsibilities:

        - Trim and portion proteins.
        - Marinate according to protein-specific time limits.
        - Cook hero proteins and pan proteins.
        - Track yield loss before and after cooking.

        Critical controls:

        - Chicken and fish require tighter batch planning than beef/goat.
        - Hero proteins should create trim usage plans before production begins.
        - High-crisp items should not be placed into delivery menus unless packaging protects texture.

        ### Base Station

        Responsibilities:

        - Cook rice bases, potato hash, flatbread crisps, and carrier systems.
        - Protect margin through exact portion control.
        - Build tray base layers quickly during catering assembly.

        Critical controls:

        - Rice cooling must follow food-safety rules.
        - Potatoes must be held dry if crispness is part of the value.
        - Carbohydrate portion creep destroys margin quietly.

        ### Assembly Station

        Responsibilities:

        - Build bowls, wraps, boxes, trays, and drop packages.
        - Apply visual abundance: base first, protein visible, sauce gloss, garnish contrast.
        - Check allergen cards and labels.

        Critical controls:

        - Sauce side-car for delivery unless gloss is central to the sell.
        - Number allocation trays where scarcity is part of the ritual.
        - Photograph real finished products for future demand signalling.

        ## Appendix 5 - Menu Engineering Logic

        A dish earns menu space if it scores well across these commercial dimensions:

        | Dimension | High Score Signal | Low Score Risk |
        |---|---|---|
        | Familiarity | customers understand it quickly | needs too much explanation |
        | Novelty | sauce or format feels fresh | feels generic or copied |
        | Batchability | can be cooked in controlled batches | only works one-by-one |
        | Holding | survives delivery/hot hold | collapses after 10 minutes |
        | Cross-utilisation | uses shared prep | needs unique inventory |
        | Margin | base and sauce protect protein cost | protein-heavy and labour-heavy |
        | Visual value | looks abundant and glossy | appears small or dry |
        | Ritual potential | can be limited by true prep capacity | no reason to preorder |

        Permanent menu items must satisfy familiarity, margin, and cross-utilisation. Weekly specials may carry more novelty, but they still need operational sense. Catering products must satisfy holding, packaging, and group justification.

        ## Appendix 6 - Channel-Specific Menu Architecture

        ### Daily Lunch

        Core offer:

        - 3 bowls: chicken, beef, vegetarian.
        - 3 wraps: chicken, beef, curry vegetable.
        - 2 sides: potato hash and pickles.
        - 3 sauces: glaze, crema, curry sauce.

        Function:

        Daily lunch should be easy to order, fast to assemble, and built from existing prep. It creates steady sales and collects signal for what can become a drop or catering tray.

        ### Bar / Evening

        Core offer:

        - Sticky wings.
        - Loaded wet fry potato hash.
        - Pickle and sauce flight.
        - Crispy fish bites.

        Function:

        Bar food should increase dwell time and drink spend. The menu should be salty, shareable, saucy, and visually satisfying. Avoid overly complex plated dishes during bar trade.

        ### Catering / Office

        Core offer:

        - Office Power Bowl Tray.
        - Sauce and Protein Catering Pack.
        - Family Allocation Tray.

        Function:

        Catering converts operational repetition into high-ticket orders. It should use the same sauces, proteins, rice bases, and sides as daily trade, only in different packaging and quantity logic.

        ### Weekly Drop

        Core offer:

        - One hero protein.
        - One base.
        - One sauce identity.
        - One allocation count.
        - One pickup or delivery window.

        Function:

        Weekly drops create ritual demand and reduce production uncertainty. The drop is not just a dish. It is a demand measurement tool.

        ## Appendix 7 - Food Cost Logic Templates

        ### Bowl Price Logic

        Formula:

        - Base cost: rice or potato portion.
        - Protein cost: exact cooked portion weight.
        - Sauce cost: 20-40 ml controlled portion.
        - Garnish cost: pickles/herbs/sesame.
        - Packaging cost: bowl, lid, label, napkin.
        - Labour factor: prep and assembly minutes.

        Target:

        - Food cost: 24-32%.
        - Gross margin: 68-76%.
        - Upsell: extra sauce, egg, extra protein, premium side.

        ### Wrap Price Logic

        Formula:

        - Wrap bread cost.
        - Rice/filler cost.
        - Protein portion lower than bowl.
        - Sauce and pickle portion.
        - Packaging cost.

        Target:

        - Food cost: 22-30%.
        - Margin improves because protein portion is controlled by format.

        ### Catering Tray Logic

        Formula:

        - Ingredient cost x target multiplier.
        - Add packaging.
        - Add delivery.
        - Add labour.
        - Add admin and contingency.
        - Add premium for preorder convenience and reliability.

        Target:

        - Minimum order protects labour.
        - Separate delivery line prevents hidden margin erosion.
        - Require deposit or full prepayment for high-risk proteins.

        ### Sauce Retail Logic

        Formula:

        - Ingredient cost.
        - Bottle/jar/sachet.
        - Label.
        - Compliance/testing.
        - Labour.
        - Spoilage allowance.
        - Retail margin.

        Target:

        - Sauce should be proven in venue first.
        - Only bottle sauces that customers already request extra.

        ## Appendix 8 - NotebookLM Retrieval Ontology

        Use consistent tags so the manual becomes a retrieval source:

        | Tag Family | Examples | Retrieval Use |
        |---|---|---|
        | component | marinade-bank, sauce-bank, rice-base, wet-fry-base | find reusable prep systems |
        | channel | lunch-trade, bar-snack, catering, weekly-drop | build menus by revenue channel |
        | economics | margin-absorber, premium-pricing, high-ticket, low-cost-variety | answer business questions |
        | operations | batchable, delivery-friendly, prep-ahead, holding | answer kitchen execution questions |
        | psychology | scarcity-drop, abundance-illusion, shareability, low-thought-yes | answer demand design questions |
        | risk | allergen, seafood-risk, crispness-risk, rice-safety | answer safety and execution risk questions |
        | brand | Safari-Lounge-IP, Afro-Asian-Latin, fusion-special | answer brand/IP questions |

        Suggested NotebookLM questions:

        - Which components support the most revenue channels?
        - Build a three-day prep plan for the weekly drop system.
        - Which items are best for corporate catering and why?
        - Which sauces can become retail products?
        - What is the lowest-inventory menu that still feels abundant?
        - Build a bar snack menu that increases drink spend.
        - Build a Friday WhatsApp preorder offer from existing prep.
        - Which modules create Safari Lounge IP?

        ## Appendix 9 - Consulting Product Packaging

        This niche pack can be sold as a consulting product without selling recipes directly.

        ### Product 1: Menu Profit Compression Audit

        Buyer:

        - Small restaurant.
        - Caterer.
        - Ghost kitchen.
        - Bar with weak food program.

        Promise:

        - Reduce menu complexity while increasing perceived variety.

        Deliverables:

        - Current menu component map.
        - Cross-utilisation audit.
        - Sauce bank recommendation.
        - Base/starch margin map.
        - Three weekly drop concepts.
        - Catering conversion plan.

        Price:

        - Entry: $500-$1,000.
        - Implementation: $2,500-$7,500.
        - Monthly support: $750-$2,500.

        ### Product 2: Catering Tray Revenue Blueprint

        Buyer:

        - Caterer.
        - Cafe near offices.
        - Restaurant with slow weekdays.

        Promise:

        - Turn existing prep into higher-ticket office and family trays.

        Deliverables:

        - Three tray products.
        - Pricing sheet.
        - Packaging list.
        - Preorder script.
        - Allergen card.
        - Production schedule.

        Price:

        - Template: $99-$299.
        - Custom build: $1,500-$5,000.
        - Monthly tray calendar: $299-$1,000.

        ### Product 3: Weekly Food Drop Operating System

        Buyer:

        - Home chef.
        - Pop-up.
        - Food creator.
        - Small venue needing attention.

        Promise:

        - Make demand visible before production through preorder ritual.

        Deliverables:

        - Four-week drop calendar.
        - WhatsApp scripts.
        - Allocation rules.
        - Production prep list.
        - Waitlist system.
        - Post-drop data review sheet.

        Price:

        - Starter: $49-$149.
        - Done-with-you: $500-$1,500.
        - Monthly command: $299-$999.

        ## Appendix 10 - Preorder and WhatsApp Scripts

        ### Office Lunch Drop

        Message:

        "Thursday office lunch allocation is open. This week's box is Safari char-grill chicken over coconut turmeric rice with pickles and green herb crema. 40 boxes only because production closes Wednesday 4pm. Reply with name, quantity, and delivery location."

        Follow-up:

        "Allocation update: 27/40 boxes reserved. Preorder closes at 4pm or when the remaining 13 are gone."

        Close:

        "Orders are locked. If you missed this round, reply WAITLIST and you will get first access next week."

        ### Family Tray Drop

        Message:

        "Weekend family tray allocation opens today for VIPs. Coconut goat wet fry, turmeric rice, potato hash, pickles, and sauce flight. 20 trays only because goat production is capped. Deposit confirms allocation."

        Follow-up:

        "12/20 family trays confirmed. Public waitlist opens tomorrow if any remain."

        Close:

        "Sold out. Waitlist is open for next Friday. Waitlist demand decides whether we repeat goat or switch to fish."

        ### Sauce Flight Bar Push

        Message:

        "Tonight's sauce flight: sticky gochu-BBQ, green herb lime crema, coconut curry dip. Add to wings, fish bites, or loaded hash. Limited flight portions because sauces were batched fresh today."

        ## Appendix 11 - Allergen and Food Safety Control

        Key allergen risks:

        - Soy: marinades and glazes.
        - Sesame: gochu glaze and Korean-style finishes.
        - Dairy/egg: crema and mayonnaise-based sauces.
        - Fish: fish trays and fish bites.
        - Gluten: wraps, flatbreads, some gochujang, soy sauce.
        - Coconut: curry base and coconut rice.

        Food-safety controls:

        - Raw marinade never becomes service sauce.
        - Rice must be cooled rapidly and reheated thoroughly.
        - Seafood should be cooked close to service and controlled by preorder.
        - Cold sauces must remain chilled.
        - Hot wet-fry items must be hot-held safely or cooled quickly.
        - Fried/crispy items should not be sealed too early or texture will collapse.

        Label requirements:

        - Item name.
        - Production date.
        - Use-by date.
        - Major allergens.
        - Reheat instructions for take-home trays.
        - Allocation number for preorder drops.

        ## Appendix 12 - Supplier and Procurement Logic

        Proteins:

        - Chicken thigh: daily volume item, stable cost, good reheating.
        - Beef: premium signal, use in controlled portions.
        - Goat: cultural strength and scarcity value, preorder only.
        - Fish: premium but higher waste risk, preorder or limited service.
        - Wings: bar snack and drop item, strong demand signal.

        Dry goods:

        - Rice, potatoes, flatbreads, spices, sugar, vinegars, oils.
        - These are margin stabilizers. Buy in volume only after usage is proven.

        Sauces and condiments:

        - Soy/tamari.
        - Gochujang or chili paste.
        - Coconut milk.
        - Tomato paste.
        - Vinegars.
        - Honey or brown sugar.

        Packaging:

        - Black bowls for visual contrast.
        - Kraft wrap paper.
        - Numbered tray labels.
        - Sauce cups.
        - Allergen cards.
        - Reheat cards.

        ## Appendix 13 - Staff Training Notes

        Staff should understand the pack as a system:

        - Sauce bank creates identity.
        - Protein lanes create menu value.
        - Rice and potato bases protect margin.
        - Wraps convert prep into lunch.
        - Snacks convert prep into alcohol spend.
        - Catering converts prep into large orders.
        - Drops convert prep into demand data.

        Staff language:

        - Do not describe items as "just chicken" or "just rice."
        - Say "char-grill marinade," "sticky gochu glaze," "coconut turmeric rice," "limited family allocation."
        - Sell sauces as the identity of the menu.
        - Offer sauce upgrades naturally.
        - Mention preorder cutoffs clearly.

        ## Appendix 14 - AI Retrieval and Future API Readiness

        Every item in this pack can later become a structured API object:

        - `item_name`
        - `module`
        - `venue_role`
        - `batch_yield`
        - `ingredients`
        - `method`
        - `holding`
        - `packaging`
        - `allergens`
        - `cost_logic`
        - `pricing_logic`
        - `cross_applications`
        - `tags`

        Retrieval use cases:

        - Generate a catering quote from available prep.
        - Build a weekly drop menu from sauce inventory.
        - Suggest a lunch wrap from leftover pan protein.
        - Find all items containing soy/sesame.
        - Find all products suitable for bottled sauce development.
        - Find all high-margin bar snacks.
        - Build an office bundle using one rice base and two proteins.

        The manual therefore serves both human operations and future AI retrieval.
        """
    )


def build_manual() -> str:
    parts: list[str] = []
    parts.append(
        dedent(
            """
            # Safari Lounge Commercial Fusion Niche Pack

            **Format:** NotebookLM-ready private culinary intelligence source, chef production manual, restaurant consulting asset, menu development commercialization product, catering and bundle revenue blueprint.

            **Commercial thesis:** This is not a cookbook. It is a reusable hospitality operating system built from sauce banks, batchable proteins, starch profit absorbers, portable lunch formats, bar snacks, catering trays, and weekly preorder rituals. Every formulation below is original, metric, scalable, and designed for venue execution.

            **Copyright boundary:** The pack does not reproduce protected cookbook recipes. It extracts commercial patterns from the current Recipe Intelligence Database and turns them into original production formulas and monetizable hospitality systems.

            **Venue concept:** Afro-Asian-Latin commercial fusion with Safari Lounge positioning: familiar proteins, bold sauces, rice and wrap bases, shareable trays, visible abundance, delivery viability, and limited weekly allocation drops.

            **Operating logic:** One marinade feeds several proteins. One wet fry base feeds multiple dishes. One rice engine supports trays, bowls, and staff meals. One wrap engine supports lunch. One snack system lifts beverage spend. One catering system converts prep into large-ticket orders. One weekly special system creates repeat demand.
            """
        )
    )

    parts.append(module_header("A", "Core Marinade and Sauce Bank", "This module creates the economic engine. Sauces and marinades convert low-cost base inventory into multiple high-perceived-value dishes. They reduce menu complexity, increase cross-utilisation, create upsells, and become future bottled or licensed IP."))
    parts.append(add_item(
        "A",
        "Safari Char-Grill Master Marinade",
        "Primary protein marinade for chicken, beef, pork, goat, skewers, wings, and grilled tray specials.",
        "10 kg trimmed protein marinade load; approx. 22-28 portions depending cut.",
        [
            ("Light soy sauce", "900 ml"),
            ("Fresh lime juice", "450 ml"),
            ("Neutral oil", "650 ml"),
            ("Brown sugar", "480 g"),
            ("Fresh garlic, crushed", "280 g"),
            ("Fresh ginger, grated", "220 g"),
            ("Tomato paste", "350 g"),
            ("Smoked paprika", "120 g"),
            ("Ground coriander", "80 g"),
            ("Ground cumin", "70 g"),
            ("Black pepper", "55 g"),
            ("Fine salt", "95 g"),
            ("Water", "600 ml"),
        ],
        [
            "Blend all liquid ingredients with garlic, ginger, sugar, tomato paste, spices, and salt until smooth.",
            "Pour over 10 kg trimmed protein in food-safe tubs and mix until fully coated.",
            "Marinate chicken 6-18 hours, beef/goat/pork 12-24 hours.",
            "Drain before grilling; reserve no used marinade for service.",
            "Grill over high heat, then finish in oven if pieces are thick.",
        ],
        "Hold raw marinated proteins covered at 0-4 C. Label by protein and use within 24 hours for chicken or 48 hours for red meat.",
        "Finish with Gochu-BBQ Glaze or Coconut Curry Mop depending menu family.",
        "Use black tray liners for BBQ drops, rice bowls, skewers, and catering trays. Garnish with lime, pickled onion, and herbs.",
        "Contains soy. Can be made gluten-free with tamari.",
        "High cross-utilisation lowers prep cost: one batch supports at least six menu items. Marinade cost should remain below 6-9% of finished item selling price.",
        "Proteins using this marinade can carry 68-75% gross margin when paired with rice, wraps, or fries.",
        "Chicken skewers, beef bowls, goat wet fry, pork belly bites, family trays, bar snacks, bottled marinade pilot.",
        "marinade-bank; grill-engine; cross-utilisation; Safari-Lounge-IP; batch-protein; soy-allergen",
    ))
    parts.append(add_item(
        "A",
        "Gochu-BBQ Sticky Glaze",
        "Premium gloss sauce for grilled meats, wings, pork belly, brisket-style beef, and scarcity drops.",
        "5 litres glaze; coats approx. 18-24 kg cooked protein.",
        [
            ("Gochujang", "1.2 kg"),
            ("Tomato ketchup", "1.4 kg"),
            ("Honey", "900 g"),
            ("Light soy sauce", "650 ml"),
            ("Rice vinegar", "500 ml"),
            ("Brown sugar", "650 g"),
            ("Garlic puree", "220 g"),
            ("Ginger puree", "150 g"),
            ("Sesame oil", "120 ml"),
            ("Water", "900 ml"),
        ],
        [
            "Combine all ingredients except sesame oil in a heavy pot.",
            "Simmer gently for 18-22 minutes, whisking regularly until glossy.",
            "Finish with sesame oil off heat.",
            "Cool rapidly in shallow pans and store chilled.",
            "Brush on proteins during final 3-5 minutes of cooking or toss hot cooked pieces in glaze.",
        ],
        "Keeps 7 days chilled. Hot-hold only the service amount; keep bulk chilled.",
        "Reheat gently with a splash of water. Do not boil hard or sugars may scorch.",
        "Use visible glaze: lacquered skewers, sticky wings, shiny rice bowls, family tray drizzle.",
        "Contains soy, sesame, and chili. Check gochujang for wheat.",
        "Transforms standard proteins into premium visual products. Sweet-heat gloss increases perceived value with low added cost per portion.",
        "Use as a +$2 sauce upgrade, premium wing flavour, or Friday limited tray feature.",
        "Wings, ribs, pork belly, beef bowls, loaded fries, bottled sauce, VIP drop.",
        "sticky-glaze; gochujang; BBQ; premium-pricing; visual-abundance; scarcity-drop",
    ))
    parts.append(add_item(
        "A",
        "Coconut Curry Wet Fry Base",
        "Batchable mother sauce for chicken, fish, goat, vegetables, beans, rice bowls, and family trays.",
        "8 litres base; enough for 32-40 wet-fry portions before protein addition.",
        [
            ("Neutral oil", "450 ml"),
            ("Onion, fine dice", "2.2 kg"),
            ("Garlic puree", "260 g"),
            ("Ginger puree", "220 g"),
            ("Tomato paste", "650 g"),
            ("Crushed tomato", "2.5 kg"),
            ("Curry powder", "240 g"),
            ("Ground turmeric", "60 g"),
            ("Ground cumin", "80 g"),
            ("Ground coriander", "90 g"),
            ("Coconut milk", "3.2 litres"),
            ("Water or stock", "1.6 litres"),
            ("Fine salt", "110 g"),
            ("Lime juice", "180 ml"),
        ],
        [
            "Sweat onion in oil until soft and lightly golden.",
            "Add garlic and ginger; cook 2 minutes.",
            "Add tomato paste and spices; fry 4-5 minutes until oil separates.",
            "Add crushed tomato, coconut milk, water, and salt.",
            "Simmer 25 minutes, blend half if smoother texture is needed, then finish with lime.",
        ],
        "Blast chill in 2 litre containers. Shelf life 4 days chilled or 3 months frozen.",
        "Reheat base to 75 C before adding cooked protein or vegetables. Adjust thickness with stock.",
        "Serve in black bowls, rice trays, or lidded delivery bowls. Garnish with herb oil and pickled chili.",
        "Contains coconut. Gluten-free if stock and curry powder are verified.",
        "Mother sauce supports high menu variety from one prep batch and protects margin through rice pairing.",
        "Price as comfort-premium: bowl, tray, or family pot. Use protein tiering for margin control.",
        "Chicken curry bowl, coconut fish, goat wet fry, vegetable curry, curry fries, catering tray.",
        "mother-sauce; coconut-curry; wet-fry-engine; batchable; delivery-friendly; low-inventory-variety",
    ))
    parts.append(add_item(
        "A",
        "Green Herb Lime Crema",
        "Cold finishing sauce for wraps, grilled fish, rice bowls, bar snacks, and premium plating contrast.",
        "3 litres crema; approx. 150 x 20 ml portions.",
        [
            ("Greek yoghurt", "1.8 kg"),
            ("Mayonnaise", "700 g"),
            ("Fresh coriander", "220 g"),
            ("Fresh parsley", "120 g"),
            ("Lime juice", "300 ml"),
            ("Garlic", "80 g"),
            ("Jalapeno or green chili", "90 g"),
            ("Fine salt", "45 g"),
            ("Water", "250 ml"),
        ],
        [
            "Blend herbs, lime, garlic, chili, salt, and water until bright green.",
            "Whisk into yoghurt and mayonnaise.",
            "Pass through coarse sieve if using squeeze bottles.",
            "Store in dated bottles under refrigeration.",
        ],
        "Keep chilled at 0-4 C. Use within 3 days for best colour.",
        "Serve cold only. Do not heat.",
        "Use squeeze-bottle zigzag over bowls, wraps, fish, fries, and snack platters.",
        "Contains dairy and egg unless vegan mayo/yoghurt are used.",
        "Low portion cost with high perceived freshness. Helps justify premium pricing on fried or grilled items.",
        "Charge as included premium finish or +$1 extra sauce.",
        "Wraps, fish tacos, loaded fries, rice bowls, skewers, staff meal upgrade.",
        "cold-sauce; crema; wrap-system; visual-finish; upsell-sauce; dairy-egg-allergen",
    ))

    parts.append(module_header("B", "Pan Protein / Wet Fry Engine", "This module converts cooked or semi-cooked proteins into fast service items. Wet fry creates comfort, sauce gloss, aroma, and delivery durability. It also lets the venue run controlled protein batches and finish them to order."))
    parts.append(add_item(
        "B",
        "Base Wet Fry Aromatic Mix",
        "Universal pan-finish base for beef, goat, chicken, mushrooms, and beans.",
        "6 kg aromatic base; enough for 60-75 portions.",
        [
            ("Neutral oil", "500 ml"),
            ("Red onion, sliced", "3.5 kg"),
            ("Green capsicum, sliced", "1.2 kg"),
            ("Tomato, diced", "2.2 kg"),
            ("Garlic puree", "260 g"),
            ("Ginger puree", "180 g"),
            ("Green chili, sliced", "120 g"),
            ("Tomato paste", "450 g"),
            ("Fine salt", "95 g"),
            ("Black pepper", "45 g"),
        ],
        [
            "Heat oil in tilt pan or rondeau.",
            "Cook onions until translucent with light colour.",
            "Add capsicum, garlic, ginger, chili, and tomato paste; fry until aromatic.",
            "Add tomato and seasoning; cook until thick and jammy.",
            "Cool rapidly and portion into 600 g service packs.",
        ],
        "Hold chilled 3 days or freeze in packs. This is a base, not a finished sauce.",
        "Reheat 600 g base in pan, add 1 kg cooked protein, loosen with 150 ml stock, finish with sauce.",
        "Visible onion and pepper strips signal abundance in bowls and trays.",
        "No major allergens unless stock additions contain allergens.",
        "Aromatic base adds perceived volume and reduces protein load per portion without making the dish feel cheap.",
        "Wet fry items should sell at 3.2-4x ingredient cost due to labour and aroma value.",
        "Beef wet fry, goat wet fry, mushroom wet fry, breakfast bowls, loaded fries.",
        "wet-fry-base; pan-engine; cross-utilisation; labour-control; abundance-illusion",
    ))
    parts.append(add_item(
        "B",
        "Black Pepper Beef Wet Fry",
        "Fast premium beef pan protein for rice bowls, wraps, bar plates, and office trays.",
        "20 portions x 180 g finished beef mix.",
        [
            ("Cooked sliced beef", "3.0 kg"),
            ("Base Wet Fry Aromatic Mix", "1.2 kg"),
            ("Safari Char-Grill Master Marinade", "350 ml"),
            ("Beef stock", "450 ml"),
            ("Cracked black pepper", "45 g"),
            ("Gochu-BBQ Sticky Glaze", "300 ml"),
            ("Spring onion", "180 g"),
        ],
        [
            "Heat wet fry base in wide pan until bubbling.",
            "Add beef and stock; toss until hot throughout.",
            "Add marinade, black pepper, and glaze; reduce until glossy.",
            "Finish with spring onion.",
            "Hold for short service or portion directly.",
        ],
        "Cook beef ahead and chill sliced. Finish wet fry in 10-12 portion batches for best texture.",
        "Reheat in pan with splash of stock. Avoid microwave reheating for premium service.",
        "Rice bowl: 180 g beef mix over 250 g rice. Tray: 2.5 kg beef mix over rice with pickles.",
        "Contains soy and sesame if glaze is used.",
        "Uses moderate beef volume with sauce and onion bulk. Premium perception comes from pepper aroma and gloss.",
        "Menu at premium bowl price; tray price should include labour and sauce premium.",
        "Rice bowl, wrap, loaded fries, office tray, Friday beef drop.",
        "black-pepper-beef; wet-fry; rice-bowl; office-tray; premium-protein",
    ))
    parts.append(add_item(
        "B",
        "Coconut Goat Wet Fry",
        "Culturally strong slow-cooked protein lane for weekend allocation and family trays.",
        "24 portions x 200 g finished goat mix.",
        [
            ("Cooked goat meat, boneless chunks", "4.0 kg"),
            ("Base Wet Fry Aromatic Mix", "1.5 kg"),
            ("Coconut Curry Wet Fry Base", "2.0 litres"),
            ("Goat cooking stock", "700 ml"),
            ("Lime juice", "120 ml"),
            ("Fresh coriander", "180 g"),
            ("Fine salt", "as needed"),
        ],
        [
            "Heat aromatic mix with goat stock.",
            "Add goat and coconut curry base.",
            "Simmer gently 18-22 minutes until sauce clings.",
            "Finish with lime and coriander.",
            "Check seasoning after reduction.",
        ],
        "Cook goat one day ahead until tender. Chill in stock to reduce waste and improve texture.",
        "Reheat covered with stock or curry base. Holds well in hot cabinet for 90 minutes.",
        "Serve as rice tray, family curry pot, or chapati/wrap filling.",
        "Contains coconut. Check curry powder for allergens.",
        "High perceived value and strong cultural pull. Use limited allocation because goat prep time is real.",
        "Price above chicken and below premium steak. Use weekend scarcity to protect margin.",
        "Family tray, staff meal special, Sunday preorder, wrap filling, catering protein.",
        "goat-wet-fry; coconut-curry; weekend-drop; family-bundle; cultural-strength",
    ))
    parts.append(add_item(
        "B",
        "Korean Soy Chicken Pan Protein",
        "High-familiarity chicken system for lunch bowls, wraps, kids trays, and delivery.",
        "30 portions x 160 g finished chicken.",
        [
            ("Cooked chicken thigh strips", "4.2 kg"),
            ("Light soy sauce", "500 ml"),
            ("Brown sugar", "350 g"),
            ("Garlic puree", "180 g"),
            ("Ginger puree", "120 g"),
            ("Water", "500 ml"),
            ("Sesame oil", "90 ml"),
            ("Toasted sesame seeds", "120 g"),
            ("Spring onion", "250 g"),
        ],
        [
            "Combine soy, sugar, garlic, ginger, and water; simmer 8 minutes.",
            "Add chicken strips and reduce until lightly glazed.",
            "Finish with sesame oil, sesame seeds, and spring onion.",
            "Cool in shallow trays or hold hot for immediate service.",
        ],
        "Chicken can be cooked and sliced in bulk. Sauce can be made 5 days ahead.",
        "Reheat in pan or combi with splash of water; finish with fresh spring onion.",
        "Use in bowls, wraps, lunch boxes, and office trays with pickled vegetables.",
        "Contains soy and sesame.",
        "Chicken thigh keeps cost stable, reheats well, and absorbs sauce. Excellent high-volume lunch item.",
        "Base price moderate; upsell with egg, extra sauce, or premium rice.",
        "Lunch bowls, wraps, bento-style trays, family bundle, kids rice box.",
        "korean-soy-chicken; lunch-system; delivery-friendly; chicken-thigh; soy-sesame",
    ))

    parts.append(module_header("C", "Fish or Signature Hero Protein Lane", "Hero proteins create brand memory. This module gives the venue a signature plate that can be photographed, run as a limited drop, and used for premium pricing while still relying on the same sauce bank and starch bases."))
    parts.append(add_item(
        "C",
        "Tamarind Coconut Fish Tray",
        "Signature fish lane for premium rice trays, Friday specials, and lighter catering.",
        "18 portions x 180 g fish plus sauce.",
        [
            ("Firm white fish fillets", "3.6 kg"),
            ("Fine salt", "45 g"),
            ("Lime juice", "180 ml"),
            ("Neutral oil", "180 ml"),
            ("Coconut Curry Wet Fry Base", "2.8 litres"),
            ("Tamarind paste", "220 g"),
            ("Brown sugar", "160 g"),
            ("Fresh tomato wedges", "900 g"),
            ("Coriander", "150 g"),
        ],
        [
            "Season fish with salt, lime, and oil for 20 minutes.",
            "Roast or pan-sear fish until just cooked.",
            "Simmer curry base with tamarind and sugar until balanced.",
            "Add tomato wedges for final 3 minutes.",
            "Tray fish over rice and spoon sauce over only at service.",
        ],
        "Cook sauce ahead. Fish should be cooked close to service; avoid long hot holding.",
        "Reheat sauce separately. Finish fish in oven at 160 C until just hot.",
        "Use shallow trays: rice base, fish portions, sauce, tomato, herb garnish.",
        "Contains fish and coconut.",
        "Fish has higher waste risk, so run as preorder or controlled Friday allocation.",
        "Price as premium seafood tray with minimum order or limited special.",
        "Friday fish drop, catering tray, rice bowl, Safari Lounge hero plate.",
        "fish-lane; tamarind-coconut; premium-tray; preorder-control; seafood-allergen",
    ))
    parts.append(add_item(
        "C",
        "Crispy Gochu Fish Bites",
        "Bar snack and lunch protein designed for visual sauce gloss and shareability.",
        "80 pieces; approx. 20 snack portions.",
        [
            ("Firm white fish chunks", "2.4 kg"),
            ("Rice flour", "600 g"),
            ("Cornflour", "500 g"),
            ("Fine salt", "45 g"),
            ("Smoked paprika", "35 g"),
            ("Cold soda water", "1.1 litres"),
            ("Gochu-BBQ Sticky Glaze", "750 ml"),
            ("Lime wedges", "20 portions"),
        ],
        [
            "Mix rice flour, cornflour, salt, and paprika.",
            "Whisk in soda water to make light batter.",
            "Coat fish and fry at 180 C until crisp.",
            "Drain well and toss lightly with warm glaze or serve glaze side-car.",
            "Serve immediately.",
        ],
        "Batter dry mix can be scaled and stored. Fish must stay chilled and dry before frying.",
        "Not ideal for reheating. Sell for dine-in, bar, or immediate pickup.",
        "Serve in metal trays or paper boats with lime, crema, and pickles.",
        "Contains fish. Gluten-free if flour sources are verified.",
        "High perceived value and strong beverage pairing; manage waste by portioning fish before service.",
        "Snack price should target 75%+ gross margin; charge extra for sauce flight.",
        "Bar snack, taco filling, loaded fries topping, limited happy-hour drop.",
        "crispy-fish; bar-snack; sauce-gloss; shareability; dine-in-priority",
    ))
    parts.append(add_item(
        "C",
        "Safari Smoke-Rub Roast Beef",
        "Hero roast protein for slicing into trays, wraps, bowls, and premium bar plates.",
        "5 kg raw beef yields approx. 3.6-4.0 kg cooked; 24-30 portions.",
        [
            ("Beef rump cap or topside", "5.0 kg"),
            ("Fine salt", "95 g"),
            ("Brown sugar", "80 g"),
            ("Smoked paprika", "70 g"),
            ("Black pepper", "55 g"),
            ("Ground coriander", "45 g"),
            ("Garlic powder", "45 g"),
            ("Neutral oil", "180 ml"),
        ],
        [
            "Mix dry rub and oil into paste.",
            "Coat beef evenly and refrigerate 12-24 hours.",
            "Roast at 150 C to internal 54-58 C depending desired doneness.",
            "Rest 45 minutes before slicing.",
            "Chill for thin slicing or serve warm for trays.",
        ],
        "Cook ahead for cold slicing. Keep trim for fried rice, staff meals, or wet fry.",
        "Reheat sliced beef with stock or glaze; avoid drying in hot cabinet.",
        "Slice thin for abundance; fan over rice or flatbread with crema.",
        "No major allergens in base rub.",
        "Roast beef creates premium perception while trim supports secondary revenue items.",
        "Sell as premium protein add-on or limited roast tray.",
        "Wraps, rice bowls, roast beef platter, VIP tray, beef fried rice.",
        "roast-beef; smoke-rub; hero-protein; trim-utilisation; premium-add-on",
    ))

    parts.append(module_header("D", "Carbohydrate / Rice / Base Profit Absorbers", "Carbohydrates protect margin, carry sauces, create visual abundance, and make trays feel generous. They are the profit absorbers that allow premium proteins to be portion-controlled without making the customer feel shorted."))
    parts.append(add_item(
        "D",
        "Coconut Turmeric Rice Base",
        "Default tray and bowl base for curry, fish, wet fry, and vegetarian systems.",
        "10 kg cooked rice; approx. 40 x 250 g portions.",
        [
            ("Long grain rice", "4.0 kg"),
            ("Water", "5.2 litres"),
            ("Coconut milk", "1.6 litres"),
            ("Turmeric", "35 g"),
            ("Fine salt", "75 g"),
            ("Neutral oil", "120 ml"),
            ("Bay leaves", "8 g"),
        ],
        [
            "Rinse rice until water runs mostly clear.",
            "Combine water, coconut milk, turmeric, salt, oil, and bay.",
            "Cook in rice cooker or covered gastronorm until tender.",
            "Rest 15 minutes, fluff, and spread for safe cooling if not serving.",
        ],
        "Cook in two 5 kg cooked batches for easier cooling. Chill below 5 C within food-safety limits.",
        "Reheat with steam or microwave covered. Do not dry-fry reheated rice unless fully chilled first.",
        "Use as yellow visual base in black bowls and family trays.",
        "Contains coconut.",
        "Low cost base supports high-margin protein and sauce sales.",
        "Price bowls/trays around protein; rice creates volume and perceived generosity.",
        "Curry bowls, fish trays, wet fry trays, staff meal, vegetarian bowls.",
        "rice-base; coconut-rice; profit-absorber; tray-base; delivery-friendly",
    ))
    parts.append(add_item(
        "D",
        "Smoky Tomato Pilau Rice",
        "High-aroma rice base for beef, BBQ, Tex-Mex, and bar snack conversion.",
        "12 kg cooked rice; approx. 48 x 250 g portions.",
        [
            ("Long grain rice", "5.0 kg"),
            ("Crushed tomato", "2.0 kg"),
            ("Water or stock", "5.8 litres"),
            ("Onion, fine dice", "1.2 kg"),
            ("Neutral oil", "350 ml"),
            ("Smoked paprika", "90 g"),
            ("Ground cumin", "70 g"),
            ("Fine salt", "95 g"),
            ("Frozen peas or corn", "1.5 kg"),
        ],
        [
            "Sweat onion in oil.",
            "Add paprika and cumin; cook 1 minute.",
            "Add tomato, stock, salt, and rice.",
            "Cook covered until rice is tender.",
            "Fold in peas or corn during final steaming.",
        ],
        "Batch cooks well. Chill quickly in shallow trays.",
        "Reheat by steam. Can become fried rice next day if properly chilled.",
        "Works under beef, pork, BBQ chicken, and salsa toppings.",
        "Check stock for allergens.",
        "Adds colour and aroma with cheap inputs, making bowls feel more complete.",
        "Use as premium base upgrade or included in tray pricing.",
        "BBQ beef bowls, Tex-Mex trays, staff fried rice, wrap filling.",
        "pilau-rice; tomato-rice; BBQ-base; low-cost-abundance; cross-utilisation",
    ))
    parts.append(add_item(
        "D",
        "Crispy Potato Hash Base",
        "Breakfast, bar snack, loaded fries, and family tray extender.",
        "8 kg cooked potato hash; approx. 32 x 250 g portions.",
        [
            ("Potato, 2 cm dice", "8.0 kg"),
            ("Neutral oil", "600 ml"),
            ("Fine salt", "110 g"),
            ("Smoked paprika", "70 g"),
            ("Garlic powder", "45 g"),
            ("Black pepper", "35 g"),
            ("Spring onion", "400 g"),
        ],
        [
            "Steam or parboil potatoes until just tender.",
            "Cool and dry thoroughly.",
            "Toss with oil, salt, paprika, garlic, and pepper.",
            "Roast at 210 C until crisp-edged.",
            "Finish with spring onion.",
        ],
        "Parcook potatoes one day ahead. Roast to order for best texture.",
        "Reheat in hot oven or air fryer. Avoid covered hot holding for crisp applications.",
        "Serve in snack trays, breakfast bowls, loaded bases, or side boxes.",
        "No major allergens.",
        "Potato base absorbs premium toppings and sauces while protecting protein portion costs.",
        "Sell as side, loaded snack, or breakfast base with high margin.",
        "Loaded beef hash, breakfast bowls, bar snacks, family side trays.",
        "potato-base; bar-snack-base; breakfast-system; margin-absorber; loaded-fries",
    ))

    parts.append(module_header("E", "Portable Street / Wrap / Lunch Systems", "Portable systems turn the same prep into lunch trade, delivery, staff meals, and office bundles. The goal is speed, low decision friction, and repeatable assembly."))
    parts.append(add_item(
        "E",
        "Korean Soy Chicken Rice Wrap",
        "High-volume lunch wrap using existing chicken, rice, pickles, and crema.",
        "25 wraps.",
        [
            ("Large tortillas or flatbreads", "25 pieces"),
            ("Korean Soy Chicken Pan Protein", "3.5 kg"),
            ("Coconut Turmeric Rice Base", "3.0 kg"),
            ("Pickled onion or cucumber", "1.2 kg"),
            ("Green Herb Lime Crema", "750 ml"),
            ("Shredded lettuce", "1.0 kg"),
        ],
        [
            "Warm wraps briefly to prevent cracking.",
            "Lay 120 g rice, 140 g chicken, 45 g pickles, 40 g lettuce, and 30 ml crema.",
            "Roll tightly, seam down.",
            "Toast seam side if serving hot.",
            "Cut only for dine-in; keep whole for delivery.",
        ],
        "All fillings prepared ahead. Assemble close to service to protect texture.",
        "Wrap can be held warm 20 minutes max or served chilled as lunch box if food-safe.",
        "Wrap in branded paper, label sauce/allergen, add pickle side for premium feel.",
        "Contains wheat/gluten, soy, sesame, dairy, egg.",
        "Uses same chicken and rice as bowls, reducing inventory while opening lunch trade.",
        "Price slightly below bowl but protect margin through controlled protein weight.",
        "Office lunch box, student lunch, staff meal, delivery combo.",
        "wrap-system; lunch-trade; korean-chicken; portable; office-bundle",
    ))
    parts.append(add_item(
        "E",
        "Black Pepper Beef Street Wrap",
        "Premium portable beef format for lunch and late-night delivery.",
        "20 wraps.",
        [
            ("Large tortillas or chapati", "20 pieces"),
            ("Black Pepper Beef Wet Fry", "3.2 kg"),
            ("Smoky Tomato Pilau Rice", "2.5 kg"),
            ("Green Herb Lime Crema", "600 ml"),
            ("Pickled red onion", "800 g"),
            ("Crispy potato hash", "1.5 kg"),
        ],
        [
            "Warm wrap.",
            "Add rice, beef, potato hash, pickles, and crema.",
            "Roll tightly and toast until sealed.",
            "Rest 1 minute before packaging.",
        ],
        "Keep beef and rice hot, crema cold. Assemble to order.",
        "Best served hot; reheats in sandwich press.",
        "Use foil-lined wrap paper for heat retention. Do not over-sauce.",
        "Contains gluten, dairy, egg, soy, sesame depending sauce.",
        "Beef wrap gives premium perception with lower beef weight than plated main.",
        "Menu as premium wrap combo with side and drink.",
        "Lunch wrap, late-night item, office bundle, ghost kitchen hero.",
        "beef-wrap; portable-premium; wet-fry; lunch-system; ghost-kitchen",
    ))
    parts.append(add_item(
        "E",
        "Coconut Curry Vegetable Pocket",
        "Vegetarian portable item using curry base and rice for low-cost menu breadth.",
        "24 pockets.",
        [
            ("Flatbreads", "24 pieces"),
            ("Coconut Curry Wet Fry Base", "2.4 litres"),
            ("Cooked chickpeas", "2.0 kg"),
            ("Roasted vegetables", "2.4 kg"),
            ("Coconut Turmeric Rice Base", "2.4 kg"),
            ("Pickled chili", "400 g"),
        ],
        [
            "Simmer chickpeas and roasted vegetables in curry base until thick.",
            "Cool filling slightly so wraps do not steam apart.",
            "Fill each flatbread with rice and curry mix.",
            "Fold into pocket and toast until sealed.",
        ],
        "Curry filling holds 3 days chilled and freezes well.",
        "Reheat filling to 75 C. Toast pocket to order.",
        "Pack with napkin and small crema or chili sauce side.",
        "Contains coconut and gluten unless gluten-free wrap is used.",
        "Vegetarian item has strong margin and improves group ordering acceptance.",
        "Price as standard wrap; upsell extra sauce or side.",
        "Vegetarian lunch, catering inclusion, staff meal, delivery option.",
        "vegetarian-wrap; curry-base; low-cost-high-variety; group-ordering; coconut",
    ))

    parts.append(module_header("F", "Bar Snack and Share Plate Layer", "Bar snacks increase dwell time and beverage spend. They should be salty, saucy, shareable, fast to plate, and made from existing prep streams."))
    parts.append(add_item(
        "F",
        "Sticky Gochu Wings",
        "High-craving bar snack and weekly drop anchor.",
        "100 wings; 20 snack portions.",
        [
            ("Chicken wings", "8.0 kg"),
            ("Fine salt", "95 g"),
            ("Baking powder", "80 g"),
            ("Smoked paprika", "70 g"),
            ("Gochu-BBQ Sticky Glaze", "1.5 litres"),
            ("Toasted sesame seeds", "150 g"),
            ("Spring onion", "250 g"),
        ],
        [
            "Toss wings with salt, baking powder, and paprika.",
            "Air-dry uncovered under refrigeration 8-18 hours.",
            "Roast or fry until crisp and fully cooked.",
            "Toss in warm glaze.",
            "Finish with sesame and spring onion.",
        ],
        "Dry-season wings one day ahead. Cook in waves to control texture.",
        "Reheat unglazed wings in oven, then glaze fresh.",
        "Serve in share trays with wet wipes, lime, and extra sauce.",
        "Contains sesame, soy, possible gluten in glaze.",
        "Wings have strong dopamine/craving signal and beverage pairing. Manage portion count tightly.",
        "Price by portion count and sauce premium. Offer extra dip upsell.",
        "Bar snack, game night tray, WhatsApp drop, family add-on.",
        "wings; bar-snack; gochu-bbq; share-plate; scarcity-drop",
    ))
    parts.append(add_item(
        "F",
        "Loaded Wet Fry Potato Hash",
        "Low-cost high-abundance share plate using potato, sauce, and controlled protein garnish.",
        "20 share portions.",
        [
            ("Crispy Potato Hash Base", "5.0 kg"),
            ("Black Pepper Beef Wet Fry", "2.0 kg"),
            ("Green Herb Lime Crema", "700 ml"),
            ("Gochu-BBQ Sticky Glaze", "500 ml"),
            ("Pickled onion", "700 g"),
            ("Spring onion", "250 g"),
        ],
        [
            "Re-crisp potato hash in hot oven.",
            "Heat beef wet fry separately.",
            "Tray potatoes, top with beef, drizzle sauces, add pickles and spring onion.",
            "Serve immediately.",
        ],
        "All components prepped separately; assemble on order.",
        "Reheat potatoes dry and beef moist. Do not hold assembled.",
        "Use wide shallow tray for visual abundance.",
        "Contains soy, sesame, dairy, egg depending sauces.",
        "Potato absorbs perceived volume while beef functions as premium signal, not bulk.",
        "Price as share plate. Add egg or extra beef as upsell.",
        "Bar snack, office side, late-night special, family tray add-on.",
        "loaded-hash; abundance-illusion; bar-spend; wet-fry; margin-protector",
    ))
    parts.append(add_item(
        "F",
        "Pickle and Sauce Flight",
        "Low-labour board that monetizes sauce bank and creates tasting behaviour.",
        "20 boards.",
        [
            ("Assorted house pickles", "2.0 kg"),
            ("Green Herb Lime Crema", "600 ml"),
            ("Gochu-BBQ Sticky Glaze", "600 ml"),
            ("Coconut Curry Wet Fry Base, thickened", "700 ml"),
            ("Flatbread crisps", "1.5 kg"),
            ("Lime wedges", "20 portions"),
        ],
        [
            "Portion pickles and sauces into ramekins.",
            "Warm flatbread crisps.",
            "Arrange with colour contrast and clear sauce labels.",
        ],
        "Pickles and sauces are prep-ahead. Board assembly is 2-3 minutes.",
        "Serve sauces cold or warm depending type; keep curry dip above 63 C if hot.",
        "Use small boards or trays; labels help sell the sauce system.",
        "Contains dairy/egg/soy/sesame depending sauces.",
        "Very high margin. Also educates customers into buying sauce add-ons.",
        "Sell as bar board or free VIP tasting that leads to bottled sauce sales.",
        "Bar snack, sauce sampling, retail sauce test, VIP club teaser.",
        "sauce-flight; pickle-board; high-margin; productization; bar-snack",
    ))

    parts.append(module_header("G", "Catering Tray and Family Bundle Systems", "Catering turns prep into high-ticket orders. The system must convert existing components into controlled bundles with clear yields, preorder deadlines, packaging standards, and margin logic."))
    parts.append(add_item(
        "G",
        "Office Power Bowl Tray System",
        "Corporate lunch tray designed for predictable prep, easy service, and high perceived abundance.",
        "Feeds 20 people.",
        [
            ("Coconut Turmeric Rice Base", "5.0 kg"),
            ("Korean Soy Chicken Pan Protein", "3.2 kg"),
            ("Black Pepper Beef Wet Fry", "2.0 kg"),
            ("Pickled vegetables", "1.5 kg"),
            ("Green Herb Lime Crema", "800 ml"),
            ("Gochu-BBQ Sticky Glaze", "600 ml"),
        ],
        [
            "Tray rice in two large catering pans.",
            "Place chicken on one side and beef on the other for choice architecture.",
            "Add pickles in separate inserts to protect texture.",
            "Pack sauces separately in labelled bottles.",
            "Include service spoons and allergen card.",
        ],
        "Requires preorder by 4pm previous day. Proteins cooked and chilled, finished morning of service.",
        "Deliver hot above 63 C or chilled with reheat instructions depending client setup.",
        "Use black catering trays, garnish after delivery if possible.",
        "Contains soy, sesame, dairy/egg if crema used.",
        "Two proteins and one base create variety without complex production.",
        "Price per head with minimum 20; charge delivery and premium sauce add-ons.",
        "Office lunch, meeting catering, recurring Friday corporate plan.",
        "corporate-catering; office-bundle; rice-tray; recurring-revenue; preorder",
    ))
    parts.append(add_item(
        "G",
        "Weekend Family Allocation Tray",
        "Scarcity-driven family meal with real production cap.",
        "Feeds 6-8 people.",
        [
            ("Coconut Turmeric Rice Base", "2.5 kg"),
            ("Coconut Goat Wet Fry", "2.0 kg"),
            ("Tamarind Coconut Fish or chicken substitute", "1.2 kg"),
            ("Crispy Potato Hash Base", "1.2 kg"),
            ("Pickles", "600 g"),
            ("Sauce flight", "600 ml total"),
        ],
        [
            "Pack rice as base layer.",
            "Pack goat wet fry and fish/chicken in separate sealed trays.",
            "Pack potato hash separately to preserve texture.",
            "Add sauce flight and garnish pack.",
            "Include reheat card and allocation number.",
        ],
        "Sell by preorder only. Cap based on goat/fish production capacity.",
        "Customer reheats wet items covered; potatoes uncovered in hot oven.",
        "Use numbered labels: Allocation 01/20, 02/20, etc. Only use true counts.",
        "Contains fish/coconut/soy/sesame/dairy depending chosen sauces.",
        "High ticket order from existing components. Preorder eliminates speculative waste.",
        "Price as family experience, not per item. Use deposit to lock demand.",
        "Weekend drop, holiday tray, VIP club, family dinner subscription.",
        "family-bundle; allocation-tray; weekend-drop; preorder; high-ticket",
    ))
    parts.append(add_item(
        "G",
        "Safari Lounge Sauce and Protein Catering Pack",
        "White-label catering product for small events and venue consulting clients.",
        "Feeds 30 people.",
        [
            ("Safari Char-Grill marinated chicken", "6.0 kg cooked"),
            ("Black Pepper Beef Wet Fry", "4.0 kg"),
            ("Coconut Turmeric Rice Base", "8.0 kg"),
            ("Smoky Tomato Pilau Rice", "5.0 kg"),
            ("Gochu-BBQ Sticky Glaze", "1.2 litres"),
            ("Green Herb Lime Crema", "1.2 litres"),
            ("Pickled vegetables", "2.0 kg"),
        ],
        [
            "Prepare proteins as separate lanes.",
            "Pack two rice bases to create variety.",
            "Serve sauces separately with labels.",
            "Provide menu cards explaining each sauce and protein lane.",
        ],
        "Requires 48-hour preorder for staffing and procurement.",
        "Hot delivery or chilled reheat pack depending event site.",
        "Catering labels should sell the IP: marinade bank, sauce bank, protein lanes.",
        "Contains soy, sesame, dairy, egg, coconut depending sauces.",
        "This is a consulting demo in edible form: client tastes the system and sees the operational architecture.",
        "Price as premium catering plus IP demonstration. Upsell consulting audit.",
        "Venue demo, corporate tasting, consulting lead magnet, white-label catering pack.",
        "catering-pack; consulting-demo; sauce-bank; protein-lanes; Safari-Lounge-IP",
    ))

    parts.append(module_header("H", "Weekly Specials / Preorder / WhatsApp Ritual Drops", "Weekly drops train demand. The point is not random specials; it is a predictable commercial ritual using real allocation limits, preorder cutoffs, waitlists, and visible fulfillment."))
    parts.append(add_item(
        "H",
        "Thursday Char Siu Rice Box Drop",
        "Weekly office and WhatsApp lunch ritual built from pork/chicken glaze pattern.",
        "40 boxes.",
        [
            ("Char-grill marinated pork or chicken", "6.4 kg cooked"),
            ("Gochu-BBQ Sticky Glaze", "1.2 litres"),
            ("Coconut Turmeric Rice Base", "10.0 kg"),
            ("Pickled cucumber", "2.0 kg"),
            ("Green Herb Lime Crema", "1.0 litre"),
            ("Sesame garnish", "120 g"),
        ],
        [
            "Announce menu Monday with 40-box allocation.",
            "Close preorder Wednesday 4pm.",
            "Cook protein Thursday morning, glaze hot.",
            "Pack rice, protein, pickles, sauce, garnish.",
            "Post sold count honestly as orders close.",
        ],
        "All components except protein finish are prep-ahead. Allocation cap is based on packing labour.",
        "Boxes are best served same day. Reheat protein/rice covered if needed.",
        "Use numbered stickers and branded drop language.",
        "Contains soy, sesame, dairy/egg depending crema.",
        "Prepaid boxes reduce waste and create weekly habit.",
        "Price as premium lunch drop. Offer office bundle discount at 10+ boxes.",
        "Office lunch, WhatsApp drop, ghost kitchen test, VIP preview.",
        "weekly-drop; char-siu-pattern; WhatsApp-preorder; office-box; ritual-demand",
    ))
    parts.append(add_item(
        "H",
        "Friday Coconut Goat Family Pot",
        "High-ticket weekend allocation using slow-cooked protein scarcity.",
        "20 family pots; each feeds 4.",
        [
            ("Coconut Goat Wet Fry", "24.0 kg finished"),
            ("Coconut Turmeric Rice Base", "20.0 kg"),
            ("Pickled chili", "2.0 kg"),
            ("Flatbread", "80 pieces"),
            ("Green Herb Lime Crema", "2.0 litres"),
        ],
        [
            "Open preorder Tuesday to VIP list.",
            "Open public waitlist Wednesday if capacity remains.",
            "Cook goat Thursday, finish Friday.",
            "Pack family pots with reheat instructions.",
            "Record waitlist demand for next week's allocation.",
        ],
        "Goat cookery is the real bottleneck; cap honestly.",
        "Reheat goat covered to 75 C. Rice steams separately.",
        "Number each family pot and include garnish pack.",
        "Contains coconut, dairy/egg depending crema, gluten if flatbread included.",
        "Slow protein and family format justify higher basket size.",
        "Bundle price with optional extra flatbread, sauce, or potato side.",
        "VIP club, family subscription, holiday preorder, catering lead.",
        "goat-drop; family-pot; weekend-allocation; high-ticket; slow-protein",
    ))
    parts.append(add_item(
        "H",
        "Saturday Sticky Wing and Sauce Flight",
        "Bar and delivery drop designed to sell sauces and drive beverage spend.",
        "60 snack portions.",
        [
            ("Sticky Gochu Wings", "300 wings prepared"),
            ("Green Herb Lime Crema", "1.5 litres"),
            ("Gochu-BBQ Sticky Glaze", "2.0 litres"),
            ("Pickles", "2.0 kg"),
            ("Flatbread crisps or fries", "6.0 kg"),
        ],
        [
            "Pre-announce sauce flavours Thursday.",
            "Run two pickup windows Saturday.",
            "Cook wings in waves; never hold sauced wings too long.",
            "Offer sauce flight as paid upgrade.",
        ],
        "Dry-season wings day before. Sauce packs portioned before service.",
        "Reheat unsauced wings only. Sauce after reheating.",
        "Use share boxes with sauces side-car.",
        "Contains soy, sesame, dairy/egg depending sauce.",
        "Wings create craving and sauce sampling; sauces become future retail IP.",
        "Price wings competitively; earn margin on sauce flight and sides.",
        "Bar night, delivery drop, sauce launch, game-day preorder.",
        "wing-drop; sauce-flight; bar-revenue; shareable; retail-sauce-test",
    ))

    parts.append(commercial_control_appendices())

    parts.append(
        dedent(
            """
            ## Final Commercial Architecture

            This niche pack becomes monetizable because every module feeds the next:

            - Module A creates the proprietary taste bank.
            - Module B creates repeatable hot protein revenue.
            - Module C creates hero products and brand memory.
            - Module D protects margin and visual abundance.
            - Module E converts prep into lunch and delivery.
            - Module F converts prep into beverage and snack spend.
            - Module G converts prep into high-ticket catering.
            - Module H converts prep into ritual demand and preorder certainty.

            ## NotebookLM Source Strategy

            Upload this manual alongside the database schema, sample API responses, and production CSV. Use NotebookLM queries such as:

            - Which sauce feeds the most revenue channels?
            - Build a Friday preorder menu from existing prep.
            - Which items are best for office catering?
            - What is the lowest-inventory menu with highest variety?
            - Which components can become bottled products?
            - Build a Safari Lounge weekly drop from Module A, D, and H.

            ## Pricing Control Formula

            Target menu price should be set by channel:

            - Dine-in bar snacks: ingredient cost x 4.0 to 5.5.
            - Lunch wraps/bowls: ingredient cost x 3.2 to 4.2.
            - Family trays: ingredient cost x 3.0 to 3.8 plus packaging and preorder convenience.
            - Catering: ingredient cost x 3.5 plus labour, delivery, equipment, and admin.
            - Sauce retail: ingredient cost x 5.0+ after packaging and compliance.

            ## Operational Control Rules

            1. Never launch a dish unless it reuses at least two existing components.
            2. Every weekly special must produce either preorder data, sauce demand data, or catering lead data.
            3. Every catering tray must be built from the same prep streams used by daily trade.
            4. Every sauce must have at least three applications before it earns menu space.
            5. Every hero protein must produce a secondary use for trim, leftovers, or controlled overproduction.
            """
        )
    )
    return "\n\n".join(parts)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manual = build_manual()
    for marker in ["**", "|", "1.", "2.", "3.", "4.", "5."]:
        manual = manual.replace(f"\n        {marker}", f"\n{marker}")
    MANUAL.write_text(manual, encoding="utf-8")
    with CSV_OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["module", "item_name", "venue_role", "standard_batch_yield", "allergens", "notebooklm_tags"],
        )
        writer.writeheader()
        writer.writerows(items)
    print(f"manual={MANUAL}")
    print(f"items={len(items)}")
    print(f"csv={CSV_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
