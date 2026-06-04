#!/usr/bin/env python
"""
Authoritative seed for the Recipe Intelligence Database.
Data represents notebooks: 55, 56, 74, 81, 90, 107, 108.
Copyright rule: procedures are summarised as concise operational steps.
"""
from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "recipe_intelligence.sqlite"
SCHEMA = ROOT / "database" / "schema.sql"


# ─────────────────────────── helpers ────────────────────────────

def rid(title: str, source: str) -> str:
    return "rcp_" + hashlib.md5(f"{source}::{title}".encode()).hexdigest()[:12]


def allergen(name: str) -> int:
    flags = {"egg","milk","cream","butter","cheese","wheat","flour","shrimp",
              "prawn","crab","fish","peanut","nut","sesame","soy","yogurt"}
    n = name.lower()
    return 1 if any(f in n for f in flags) else 0


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def reset(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    for t in ["derived_concepts","monetization_tags","commercial_scores",
              "cooking_steps","methods","recipe_ingredients","ingredients","recipes"]:
        conn.execute(f"DROP TABLE IF EXISTS {t}")
    conn.commit()
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()


def upsert_ingredient(conn: sqlite3.Connection, name: str, category: str) -> int:
    conn.execute(
        "INSERT OR IGNORE INTO ingredients(name,category,allergen_flag) VALUES(?,?,?)",
        (name, category, allergen(name)),
    )
    return conn.execute("SELECT id FROM ingredients WHERE name=?", (name,)).fetchone()["id"]


# ─────────────────────────── recipe data ────────────────────────

RECIPES: list[dict] = [

    # ════════════════════════════════════════════════════
    # NB-055  RECIPE DATA BASE  (general base recipes)
    # ════════════════════════════════════════════════════
    {
        "title": "Classic Beef Burger",
        "source": "nb055_recipe_database",
        "cuisine": "American",
        "category": "Hot Main",
        "summary": "Hand-formed beef patty with brioche bun, classic condiments.",
        "yield": "4 burgers", "prep": 15, "cook": 12,
        "ingredients": [
            ("beef mince 80/20","protein","800","g","main",""),
            ("brioche burger buns","starch","4","ea","bun",""),
            ("cheddar cheese","dairy","4","slices","topping",""),
            ("iceberg lettuce","vegetable","4","leaves","garnish",""),
            ("tomato","vegetable","2","ea","garnish","sliced"),
            ("red onion","vegetable","1","ea","garnish","sliced thin"),
            ("burger sauce","condiment","60","ml","sauce",""),
        ],
        "steps": [
            (1,"Season mince with salt and pepper; divide into 200 g balls and press flat.","seasoning","hands",2,None,None),
            (2,"Sear patties on hot cast iron 3 min per side; add cheese last 60 sec.","searing","cast iron pan",6,None,"Internal temp ≥71 °C"),
            (3,"Toast buns cut-side down 1 min until golden.","toasting","grill/pan",1,None,None),
            (4,"Assemble: sauce on base, lettuce, patty, tomato, onion, sauce on lid.","assembly","none",2,None,None),
        ],
        "method": "Grilling / Pan-fry", "equipment": "Cast iron, grill",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,3,5,3,5,2,4,26),
        "tags": (4,4,3,3,2,4),
        "concept": ("Burger Stack Menu Drop","ghost_kitchen","Pop-up ghost kitchen burger menu with weekly flavour drops","Ghost Kitchen / DTC","High volume, low complexity"),
    },
    {
        "title": "Chicken Caesar Salad",
        "source": "nb055_recipe_database",
        "cuisine": "American / Italian",
        "category": "Cold / Salad",
        "summary": "Grilled chicken breast on romaine with Caesar dressing and croutons.",
        "yield": "2 portions", "prep": 15, "cook": 12,
        "ingredients": [
            ("chicken breast","protein","300","g","main",""),
            ("romaine lettuce","vegetable","1","head","base","torn"),
            ("parmesan cheese","dairy","40","g","topping","shaved"),
            ("croutons","starch","60","g","garnish",""),
            ("Caesar dressing","condiment","80","ml","dressing",""),
            ("lemon","produce","1","ea","garnish","wedge"),
        ],
        "steps": [
            (1,"Season chicken; grill 6 min per side until cooked through.","grilling","grill pan",12,None,"Internal temp ≥74 °C"),
            (2,"Rest chicken 5 min; slice on bias.","resting","board",5,None,None),
            (3,"Toss romaine in Caesar dressing; plate and top with chicken, parmesan, croutons.","assembly","bowl",3,None,None),
        ],
        "method": "Grilling", "equipment": "Grill pan, oven",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,3,4,2,4,1,3,21),
        "tags": (3,4,3,2,1,4),
        "concept": ("Caesar Salad Catering Box","catering","Individual sealed box format for corporate catering events","Catering / Events","Cold-hold safe 4 h"),
    },
    {
        "title": "Pasta Carbonara",
        "source": "nb055_recipe_database",
        "cuisine": "Italian",
        "category": "Pasta Main",
        "summary": "Spaghetti with guanciale, egg yolk, pecorino, black pepper.",
        "yield": "2 portions", "prep": 10, "cook": 15,
        "ingredients": [
            ("spaghetti","starch","200","g","pasta",""),
            ("guanciale","protein","120","g","main","diced"),
            ("egg yolks","dairy","4","ea","sauce",""),
            ("pecorino romano","dairy","60","g","sauce","grated"),
            ("black pepper","spice","5","g","seasoning","coarsely ground"),
        ],
        "steps": [
            (1,"Boil pasta in well-salted water; reserve 200 ml pasta water.","boiling","stockpot",10,None,None),
            (2,"Render guanciale in dry pan until crisp; remove and reserve fat.","rendering","sauté pan",6,None,None),
            (3,"Whisk egg yolks with pecorino and generous black pepper.","mixing","bowl",2,None,None),
            (4,"Off heat, toss hot pasta with fat, add egg mixture and splash of pasta water; toss rapidly to emulsify.","emulsifying","pan",2,None,"Pan must be off heat to avoid scrambling"),
            (5,"Plate; top with guanciale, more pecorino and cracked pepper.","plating","plate",1,None,None),
        ],
        "method": "Boiling / Sauté", "equipment": "Stockpot, sauté pan",
        "prep_complexity": 3, "labour": 3,
        "scores": (4,4,3,2,2,2,3,20),
        "tags": (2,3,4,3,1,5),
        "concept": ("Carbonara Meal Kit","productization","Portioned vacuum-packed kit for home cook","Meal Kit / Retail","Shelf-stable dry components"),
    },
    {
        "title": "Margherita Pizza",
        "source": "nb055_recipe_database",
        "cuisine": "Italian",
        "category": "Pizza",
        "summary": "Neapolitan-style pizza with San Marzano tomato, fior di latte, basil.",
        "yield": "2 x 30 cm", "prep": 20, "cook": 10,
        "ingredients": [
            ("pizza dough","starch","500","g","base","proofed"),
            ("San Marzano tomatoes","vegetable","200","g","sauce","crushed"),
            ("fior di latte mozzarella","dairy","250","g","topping","torn"),
            ("fresh basil","herb","10","leaves","garnish",""),
            ("extra virgin olive oil","fat","30","ml","finish",""),
        ],
        "steps": [
            (1,"Stretch dough to 30 cm rounds on floured surface.","shaping","hands",5,None,None),
            (2,"Spread crushed tomatoes thinly; season with salt.","spreading","ladle",1,None,None),
            (3,"Top with torn mozzarella; bake on stone 450 °C for 90 sec.","baking","pizza oven / stone",2,450,"Stone temp ≥400 °C"),
            (4,"Finish with fresh basil and olive oil; serve immediately.","finishing","none",1,None,None),
        ],
        "method": "Baking", "equipment": "Pizza oven, stone",
        "prep_complexity": 3, "labour": 3,
        "scores": (5,4,5,3,4,2,3,26),
        "tags": (4,4,3,4,3,4),
        "concept": ("Frozen Margherita SKU","productization","Blast-freeze par-baked base for retail frozen pizza line","Retail / FMCG","Par-bake to 70%, freeze"),
    },
    {
        "title": "French Onion Soup",
        "source": "nb055_recipe_database",
        "cuisine": "French",
        "category": "Soup",
        "summary": "Slowly caramelised onion broth topped with crouton and melted gruyère.",
        "yield": "4 portions", "prep": 15, "cook": 60,
        "ingredients": [
            ("brown onions","vegetable","1000","g","main","thinly sliced"),
            ("beef stock","liquid","1200","ml","base",""),
            ("dry white wine","liquid","150","ml","deglaze",""),
            ("gruyère cheese","dairy","200","g","topping","grated"),
            ("sourdough bread","starch","4","slices","crouton",""),
            ("butter","fat","60","g","fat",""),
            ("fresh thyme","herb","5","sprigs","aromatic",""),
        ],
        "steps": [
            (1,"Melt butter; add sliced onions and cook on low 45 min, stirring every 5 min, until deep amber.","caramelising","heavy pot",45,None,"Low and slow — do not rush"),
            (2,"Deglaze with wine; reduce 2 min. Add stock and thyme; simmer 15 min. Season.","simmering","pot",17,None,None),
            (3,"Ladle into oven-safe bowls; float crouton; top with gruyère.","assembly","bowls",3,None,None),
            (4,"Grill under broiler 3–4 min until cheese bubbles and browns.","grilling","broiler/salamander",4,250,None),
        ],
        "method": "Caramelising / Braising", "equipment": "Heavy pot, broiler",
        "prep_complexity": 3, "labour": 3,
        "scores": (4,4,3,4,2,2,3,22),
        "tags": (2,4,3,2,2,4),
        "concept": ("French Onion Soup Retail Jar","productization","High-quality jarred caramelised onion soup base for retail","Retail / Wholesale","12-month shelf life with proper canning"),
    },
    {
        "title": "Grilled Salmon with Lemon Butter",
        "source": "nb055_recipe_database",
        "cuisine": "European",
        "category": "Fish Main",
        "summary": "Pan-seared salmon fillet with compound lemon-herb butter and asparagus.",
        "yield": "2 portions", "prep": 10, "cook": 10,
        "ingredients": [
            ("salmon fillet","protein","2 x 180","g","main","skin-on"),
            ("butter","fat","60","g","sauce",""),
            ("lemon","produce","1","ea","sauce","zest and juice"),
            ("fresh dill","herb","10","g","garnish",""),
            ("asparagus","vegetable","200","g","side","trimmed"),
        ],
        "steps": [
            (1,"Score skin; season flesh side. Heat oil in pan until smoking.","prep","pan",2,None,None),
            (2,"Place skin-down; press gently 10 sec. Cook 4 min until skin crisps. Flip; cook 2 min more.","searing","pan",6,None,"Internal temp 54 °C for medium"),
            (3,"Meanwhile blanch asparagus 2 min; season.","blanching","pot",2,100,None),
            (4,"Melt butter in same pan; add lemon and dill; baste fish 30 sec.","basting","pan",1,None,None),
        ],
        "method": "Pan-searing", "equipment": "Heavy pan, pot",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,5,3,2,3,3,3,23),
        "tags": (3,4,4,3,3,4),
        "concept": ("Premium Salmon Meal Box","catering","Plated fine-dining salmon for corporate events","Catering / Events","Portion-control and temp control critical"),
    },
    {
        "title": "Chocolate Fondant",
        "source": "nb055_recipe_database",
        "cuisine": "French",
        "category": "Dessert",
        "summary": "Warm dark-chocolate molten cake with liquid centre, served with vanilla ice cream.",
        "yield": "4 portions", "prep": 20, "cook": 12,
        "ingredients": [
            ("dark chocolate 70%","produce","200","g","main","chopped"),
            ("butter","fat","120","g","fat",""),
            ("eggs","dairy","4","ea","binding",""),
            ("caster sugar","dry","80","g","sweetener",""),
            ("plain flour","starch","40","g","structure",""),
            ("vanilla ice cream","dairy","4","scoops","side",""),
        ],
        "steps": [
            (1,"Melt chocolate and butter together over bain-marie; cool slightly.","melting","bain-marie",8,None,None),
            (2,"Whisk eggs and sugar to ribbon stage; fold in chocolate mix, then sifted flour.","mixing","bowl",5,None,None),
            (3,"Butter and flour 4 ramekins; fill ¾ full. Refrigerate up to 24 h or bake immediately.","filling","ramekins",5,None,"Can hold raw in fridge 24 h"),
            (4,"Bake 200 °C for 12 min; edges firm, centre soft. Turn out immediately.","baking","oven",12,200,"Critical: do not overbake"),
        ],
        "method": "Baking", "equipment": "Ramekins, oven, bain-marie",
        "prep_complexity": 3, "labour": 3,
        "scores": (5,5,5,4,2,2,2,25),
        "tags": (2,4,4,3,5,4),
        "concept": ("Fondant À La Minute Service","safari_lounge","Signature dessert on premium tasting menu with theatre presentation","Fine Dining / Events","Pre-mix batter up to 24 h ahead"),
    },
    {
        "title": "Beef Tacos",
        "source": "nb055_recipe_database",
        "cuisine": "Mexican",
        "category": "Handheld / Street Food",
        "summary": "Seasoned ground beef in corn tortillas with fresh toppings.",
        "yield": "8 tacos", "prep": 10, "cook": 15,
        "ingredients": [
            ("beef mince","protein","500","g","main",""),
            ("corn tortillas","starch","8","ea","base",""),
            ("taco spice blend","spice","20","g","seasoning",""),
            ("white cabbage","vegetable","100","g","topping","shredded"),
            ("tomato","vegetable","2","ea","topping","diced"),
            ("sour cream","dairy","60","ml","sauce",""),
            ("lime","produce","2","ea","garnish","wedge"),
        ],
        "steps": [
            (1,"Brown mince in hot pan, breaking up; drain fat.","browning","sauté pan",8,None,None),
            (2,"Add spice blend and 60 ml water; simmer 5 min until fragrant.","simmering","pan",5,None,None),
            (3,"Warm tortillas directly on flame 20 sec per side.","toasting","flame / pan",2,None,None),
            (4,"Fill tortillas with meat; top with cabbage, tomato, sour cream, lime.","assembly","none",3,None,None),
        ],
        "method": "Sauté / Dry heat", "equipment": "Sauté pan, open flame",
        "prep_complexity": 1, "labour": 1,
        "scores": (5,3,5,4,5,2,4,28),
        "tags": (5,4,3,4,4,3),
        "concept": ("Taco Tuesday Ghost Kitchen","ghost_kitchen","Weekly taco drop with rotating fillings via delivery platform","Ghost Kitchen / DTC","High velocity, simple ops"),
    },

    # ════════════════════════════════════════════════════
    # NB-056  COMMERCIAL CULINARY INTELLIGENCE
    # ════════════════════════════════════════════════════
    {
        "title": "Beef Wellington",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "British / French",
        "category": "Premium Main",
        "summary": "Centre-cut beef tenderloin wrapped in mushroom duxelles and puff pastry.",
        "yield": "4 portions", "prep": 60, "cook": 25,
        "ingredients": [
            ("beef tenderloin","protein","800","g","main","trimmed centre cut"),
            ("puff pastry","starch","400","g","wrapper",""),
            ("mushrooms","vegetable","400","g","duxelles","finely chopped"),
            ("prosciutto","protein","100","g","layer","thin sliced"),
            ("dijon mustard","condiment","30","ml","binder",""),
            ("egg yolks","dairy","2","ea","egg-wash",""),
        ],
        "steps": [
            (1,"Sear tenderloin all sides in hot oil 2 min; brush with mustard; chill.","searing","pan",10,None,"Must cool completely before wrapping"),
            (2,"Cook mushrooms until all moisture evaporates to form dry duxelles; season; cool.","reducing","pan",20,None,"Wet duxelles ruins pastry"),
            (3,"Lay prosciutto on film; spread duxelles; place beef at edge; roll tight; refrigerate 30 min.","rolling","cling film",35,None,None),
            (4,"Wrap in puff pastry; egg-wash; score top; refrigerate 15 min.","pastry wrapping","board",20,None,None),
            (5,"Bake 220 °C for 25 min until pastry golden and beef 54 °C internal.","baking","oven",25,220,"Check internal temp: 54 °C medium-rare"),
            (6,"Rest 10 min; slice thick with sharp knife.","resting","board",10,None,None),
        ],
        "method": "Baking / Searing", "equipment": "Pan, oven, probe thermometer",
        "prep_complexity": 5, "labour": 5,
        "scores": (4,5,3,2,2,4,2,22),
        "tags": (1,3,4,5,5,4),
        "concept": ("Wellington Scarcity Drop","scarcity_drop","Limited Saturday service only — advance booking required","Premium Events / Scarcity","12-portion cap builds exclusivity"),
    },
    {
        "title": "Lobster Bisque",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "French",
        "category": "Soup / Premium",
        "summary": "Rich crustacean bisque from whole lobster shells, cream-finished.",
        "yield": "6 portions", "prep": 30, "cook": 60,
        "ingredients": [
            ("whole lobster","protein","2","ea","main","shells reserved"),
            ("heavy cream","dairy","300","ml","finish",""),
            ("cognac","liquid","60","ml","flambé",""),
            ("tomato paste","condiment","30","g","colour",""),
            ("mirepoix","vegetable","300","g","aromatic","diced"),
            ("fish stock","liquid","1000","ml","base",""),
            ("tarragon","herb","5","g","aromatic",""),
        ],
        "steps": [
            (1,"Remove meat from lobster; reserve. Roast shells in oven 200 °C 15 min.","roasting","oven/pan",20,200,None),
            (2,"Sauté mirepoix; add tomato paste; flambé with cognac.","flambéing","pot",8,None,"Fire safety — controlled flambé"),
            (3,"Add roasted shells and fish stock; simmer 40 min; strain well.","simmering","stockpot",40,None,None),
            (4,"Blend strained liquid; return to heat; add cream; reduce to coating consistency. Season.","finishing","blender/pot",15,None,None),
            (5,"Add reserved lobster meat just before service; do not reboil.","finishing","ladle",2,None,"Reboiling toughens lobster"),
        ],
        "method": "Simmering / Reducing", "equipment": "Stockpot, blender, oven",
        "prep_complexity": 4, "labour": 4,
        "scores": (3,5,3,3,2,4,2,22),
        "tags": (1,3,5,5,5,5),
        "concept": ("Lobster Bisque Jarred Premium","productization","High-end retort-pouch bisque for gourmet retail or airline catering","Retail / Airline Catering","Premium margin product"),
    },
    {
        "title": "Duck Confit",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "French",
        "category": "Hot Main",
        "summary": "Slow-cooked duck legs in seasoned fat until tender, crisped to order.",
        "yield": "4 portions", "prep": 1440, "cook": 180,
        "ingredients": [
            ("duck legs","protein","4","ea","main",""),
            ("duck fat","fat","800","g","cooking fat",""),
            ("sea salt","mineral","30","g","cure",""),
            ("garlic","vegetable","6","cloves","cure","crushed"),
            ("fresh thyme","herb","10","sprigs","cure",""),
            ("bay leaves","herb","4","ea","cure",""),
        ],
        "steps": [
            (1,"Rub legs with salt, garlic, thyme, bay; cure overnight refrigerated.","curing","tray/fridge",1440,4,"Minimum 12 h cure"),
            (2,"Rinse cure; dry legs. Submerge in duck fat; cook 82 °C for 3 h.","confit","deep tray/oven",180,82,"Temp must stay 80–85 °C throughout"),
            (3,"Cool in fat; store up to 2 weeks refrigerated.","cooling","container",60,4,None),
            (4,"To serve: remove from fat; sear skin-down in dry hot pan until crisp.","crisping","pan",8,None,"Skin must be crisp before plating"),
        ],
        "method": "Confit / Pan-searing", "equipment": "Deep tray, oven, pan",
        "prep_complexity": 3, "labour": 2,
        "scores": (3,5,5,5,3,2,3,26),
        "tags": (2,4,5,5,4,5),
        "concept": ("Duck Confit Batch Programme","catering","Pre-confit in bulk, crisp to order — ideal for high-volume fine dining","Catering / Fine Dining","Holds 2 weeks in fat"),
    },
    {
        "title": "Truffle Risotto",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "Italian",
        "category": "Pasta / Rice Main",
        "summary": "Parmesan-finished arborio risotto with black truffle oil and shaved truffle.",
        "yield": "4 portions", "prep": 10, "cook": 25,
        "ingredients": [
            ("arborio rice","starch","320","g","base",""),
            ("chicken stock","liquid","1200","ml","base","warm"),
            ("parmesan cheese","dairy","80","g","finish","grated"),
            ("black truffle oil","fat","20","ml","flavour",""),
            ("shallots","vegetable","60","g","aromatic","finely diced"),
            ("dry white wine","liquid","100","ml","deglaze",""),
            ("butter","fat","40","g","finish","cold diced"),
        ],
        "steps": [
            (1,"Sweat shallots in butter until translucent; toast rice 2 min.","sweating","pan",5,None,None),
            (2,"Deglaze with wine; stir until absorbed. Add warm stock one ladle at a time, stirring constantly.","simmering","pan",18,None,"Never add cold stock"),
            (3,"When rice is al dente, remove from heat; beat in cold butter and parmesan vigorously.","mantecatura","pan",2,None,"Off heat, rapid beating gives creamy texture"),
            (4,"Plate immediately; finish with truffle oil and shaved truffle.","plating","plate",1,None,None),
        ],
        "method": "Simmering / Stirring", "equipment": "Wide pan, ladle",
        "prep_complexity": 3, "labour": 4,
        "scores": (3,5,3,2,2,3,3,21),
        "tags": (2,4,5,5,4,5),
        "concept": ("Truffle Risotto Premium Event","safari_lounge","Tableside truffle shaving for immersive dining theatre","Fine Dining / Events","Truffle shaving adds 40% perceived value"),
    },
    {
        "title": "Eggs Benedict",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "American / French",
        "category": "Brunch",
        "summary": "Poached eggs on Canadian bacon and toasted English muffin, hollandaise.",
        "yield": "2 portions", "prep": 10, "cook": 15,
        "ingredients": [
            ("eggs","dairy","4","ea","main",""),
            ("Canadian bacon","protein","4","slices","main",""),
            ("English muffins","starch","2","ea","base","halved"),
            ("butter","fat","150","g","hollandaise","clarified"),
            ("egg yolks","dairy","3","ea","hollandaise",""),
            ("lemon juice","produce","15","ml","hollandaise",""),
            ("white wine vinegar","liquid","30","ml","poaching",""),
        ],
        "steps": [
            (1,"Make hollandaise: whisk yolks over bain-marie to ribbon; drizzle in warm butter; season with lemon, salt.","emulsifying","bain-marie",10,None,"Never exceed 70 °C or eggs will scramble"),
            (2,"Poach eggs in simmering acidulated water 3 min; drain on cloth.","poaching","pot",5,None,"Fresh eggs hold shape best"),
            (3,"Pan-fry bacon; toast muffin halves until golden.","toasting","pan",5,None,None),
            (4,"Stack: muffin, bacon, egg; spoon hollandaise over; finish with paprika.","assembly","plate",2,None,None),
        ],
        "method": "Poaching / Emulsifying", "equipment": "Bain-marie, pot",
        "prep_complexity": 3, "labour": 4,
        "scores": (5,4,4,3,3,2,3,24),
        "tags": (3,4,3,3,2,4),
        "concept": ("Brunch Catering Package","catering","Eggs benny as anchor in premium brunch catering menu","Catering / Events","Hollandaise holding critical — keep warm 63 °C"),
    },
    {
        "title": "Crème Brûlée",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "French",
        "category": "Dessert",
        "summary": "Classic vanilla custard with caramelised sugar crust.",
        "yield": "6 ramekins", "prep": 15, "cook": 45,
        "ingredients": [
            ("heavy cream","dairy","600","ml","base",""),
            ("egg yolks","dairy","6","ea","binder",""),
            ("caster sugar","dry","120","g","sweetener",""),
            ("vanilla bean","spice","2","ea","flavour","split"),
        ],
        "steps": [
            (1,"Infuse cream with vanilla on low heat; do not boil.","infusing","pot",10,None,None),
            (2,"Whisk yolks and 80 g sugar; slowly temper in warm cream; strain.","tempering","bowl",5,None,"Add hot cream slowly to prevent scrambling"),
            (3,"Pour into ramekins; bake bain-marie 150 °C for 40 min until just set.","baking","oven/bain-marie",40,150,"Jiggle test: wobble in centre only"),
            (4,"Chill 4 h minimum. Before service, dust with sugar; torch to caramel.","torching","blowtorch",3,None,"Even caramel layer — no scorching"),
        ],
        "method": "Baking / Bain-marie", "equipment": "Oven, ramekins, blowtorch",
        "prep_complexity": 3, "labour": 2,
        "scores": (5,5,5,5,2,1,2,25),
        "tags": (2,4,5,4,4,5),
        "concept": ("Brûlée Retail Tub","productization","Pre-set custard in branded pot, torch packet included — retail FMCG","Retail / Gift","Branded torch-at-home experience"),
    },
    {
        "title": "Pan-Roasted Sea Bass",
        "source": "nb056_commercial_culinary_intelligence",
        "cuisine": "European / Mediterranean",
        "category": "Fish Main",
        "summary": "Crispy-skin sea bass with beurre blanc, capers and samphire.",
        "yield": "2 portions", "prep": 10, "cook": 12,
        "ingredients": [
            ("sea bass fillet","protein","2 x 200","g","main","skin-on, scaled"),
            ("samphire","vegetable","80","g","side",""),
            ("capers","condiment","20","g","sauce",""),
            ("shallots","vegetable","30","g","sauce","finely diced"),
            ("dry white wine","liquid","80","ml","sauce",""),
            ("butter","fat","100","g","sauce","cold diced"),
        ],
        "steps": [
            (1,"Score skin lightly; dry thoroughly. Season flesh only.","prep","board",5,None,"Dry skin = crispy skin"),
            (2,"Heat oil until smoking; lay fish skin-down; hold flat with spatula 15 sec; cook 4 min without moving.","searing","pan",5,None,None),
            (3,"Flip; cook 2 min. Remove to rest.","resting","board",3,None,None),
            (4,"In same pan: sweat shallots, deglaze wine, reduce by half; mount cold butter off heat; add capers.","beurre blanc","pan",6,None,"Off heat for butter mounting"),
                (5,"Blanch samphire 1 min; drain. Plate fish, samphire, sauce.","plating","plate",2,None,None),
        ],
        "method": "Pan-searing", "equipment": "Heavy pan",
        "prep_complexity": 3, "labour": 3,
        "scores": (3,5,2,2,3,4,2,21),
        "tags": (2,3,4,5,4,5),
        "concept": ("Sea Bass Fine Dining Feature","safari_lounge","Signature fish course for high-end event menus with tableside sauce","Fine Dining / Safari Lounge","Limited catch — creates natural scarcity"),
    },

    # ════════════════════════════════════════════════════
    # NB-074  SALSA RECIPES
    # ════════════════════════════════════════════════════
    {
        "title": "Pico de Gallo",
        "source": "nb074_salsa_recipes",
        "cuisine": "Mexican",
        "category": "Sauce / Condiment",
        "summary": "Fresh tomato, white onion, jalapeño, coriander, lime — classic uncooked salsa.",
        "yield": "500 g", "prep": 15, "cook": 0,
        "ingredients": [
            ("roma tomatoes","vegetable","500","g","base","seeded, small dice"),
            ("white onion","vegetable","100","g","base","small dice"),
            ("jalapeño","vegetable","2","ea","heat","seeded, minced"),
            ("fresh coriander","herb","20","g","herb","chopped"),
            ("lime juice","produce","30","ml","acid","fresh"),
            ("sea salt","mineral","5","g","seasoning",""),
        ],
        "steps": [
            (1,"Dice tomatoes, onion and jalapeño uniform small; combine in bowl.","cutting","board",10,None,None),
            (2,"Add coriander, lime juice and salt; toss gently. Taste and adjust acid/heat.","mixing","bowl",3,None,None),
            (3,"Rest 10 min for flavours to meld. Use within 24 h.","resting","bowl",10,None,"Best same-day; liquid separates after 24 h"),
        ],
        "method": "Raw / No-cook", "equipment": "Board, bowl",
        "prep_complexity": 1, "labour": 1,
        "scores": (5,3,5,3,4,2,4,26),
        "tags": (4,4,4,4,3,5),
        "concept": ("Pico de Gallo Fresh Tub","productization","Modified atmosphere 200 g retail tub, 5-day shelf life","Retail / Deli","MAP packaging extends to 7 days"),
    },
    {
        "title": "Roasted Tomatillo Salsa Verde",
        "source": "nb074_salsa_recipes",
        "cuisine": "Mexican",
        "category": "Sauce / Condiment",
        "summary": "Charred tomatillos, serrano chilli, garlic and white onion blended to a tangy green sauce.",
        "yield": "400 g", "prep": 10, "cook": 15,
        "ingredients": [
            ("tomatillos","vegetable","500","g","base","husked"),
            ("serrano chilli","vegetable","3","ea","heat",""),
            ("garlic","vegetable","4","cloves","aromatic",""),
            ("white onion","vegetable","80","g","base","quartered"),
            ("fresh coriander","herb","15","g","herb",""),
            ("lime juice","produce","20","ml","acid",""),
        ],
        "steps": [
            (1,"Place tomatillos, serrano, garlic, onion on dry hot comal or griddle; char all sides.","charring","comal / griddle",10,None,"Charring adds smoky depth"),
            (2,"Blend charred vegetables with coriander and lime to coarse texture. Season.","blending","blender",3,None,None),
            (3,"Taste; adjust salt and lime. Serve warm or chilled.","seasoning","bowl",2,None,None),
        ],
        "method": "Charring / Raw blend", "equipment": "Comal, blender",
        "prep_complexity": 2, "labour": 1,
        "scores": (4,3,5,4,4,2,4,26),
        "tags": (4,4,4,3,3,5),
        "concept": ("Salsa Verde Jarred SKU","productization","Jarred salsa verde for Mexican restaurant chains and retail","Retail / Wholesale","Hot-fill 6-month shelf life"),
    },
    {
        "title": "Mango Habanero Salsa",
        "source": "nb074_salsa_recipes",
        "cuisine": "Mexican / Caribbean",
        "category": "Sauce / Condiment",
        "summary": "Fresh mango with habanero heat, red onion and lime — sweet-fire balance.",
        "yield": "350 g", "prep": 15, "cook": 0,
        "ingredients": [
            ("ripe mango","produce","2","ea","base","small dice"),
            ("habanero chilli","vegetable","1","ea","heat","seeded, minced"),
            ("red onion","vegetable","50","g","base","small dice"),
            ("fresh coriander","herb","10","g","herb",""),
            ("lime juice","produce","25","ml","acid",""),
            ("sea salt","mineral","3","g","seasoning",""),
        ],
        "steps": [
            (1,"Dice mango and red onion; mince habanero (wear gloves).","cutting","board",12,None,"Habanero is very hot — wear gloves"),
            (2,"Combine all; add coriander, lime and salt. Taste carefully for heat.","mixing","bowl",3,None,None),
        ],
        "method": "Raw / No-cook", "equipment": "Board, bowl",
        "prep_complexity": 1, "labour": 1,
        "scores": (4,4,5,3,4,2,3,25),
        "tags": (4,4,5,4,4,5),
        "concept": ("Mango Habanero Hot Sauce","productization","Bottled hot sauce with craft label — premium margin product","Retail / DTC","Fermented version extends shelf life"),
    },
    {
        "title": "Chipotle Salsa Roja",
        "source": "nb074_salsa_recipes",
        "cuisine": "Mexican",
        "category": "Sauce / Condiment",
        "summary": "Smoky tomato base with chipotle in adobo, ancho chilli and roasted garlic.",
        "yield": "500 g", "prep": 10, "cook": 20,
        "ingredients": [
            ("roma tomatoes","vegetable","400","g","base","halved"),
            ("chipotle in adobo","condiment","2","ea","smoke/heat",""),
            ("ancho chilli","vegetable","2","ea","depth","dried, soaked"),
            ("garlic","vegetable","5","cloves","aromatic",""),
            ("white onion","vegetable","100","g","base","quartered"),
            ("cumin","spice","3","g","seasoning","ground"),
        ],
        "steps": [
            (1,"Dry-roast tomatoes, garlic and onion in pan until charred and softened.","roasting","pan",15,None,None),
            (2,"Rehydrate ancho in hot water 10 min; drain.","rehydrating","bowl",10,None,None),
            (3,"Blend roasted veg, ancho, chipotle, cumin until smooth. Season.","blending","blender",5,None,None),
            (4,"Optional: simmer 5 min more to deepen colour.","simmering","pot",5,None,None),
        ],
        "method": "Roasting / Blending", "equipment": "Pan, blender",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,4,5,5,4,2,4,28),
        "tags": (5,4,4,4,3,5),
        "concept": ("Smoky Salsa Roja Wholesale","productization","5 L bulk catering pack for Mexican chains and ghost kitchens","Wholesale / Ghost Kitchen","Freeze in 1 L packs"),
    },
    {
        "title": "Corn and Black Bean Salsa",
        "source": "nb074_salsa_recipes",
        "cuisine": "Mexican / Tex-Mex",
        "category": "Sauce / Condiment",
        "summary": "Charred corn, black beans, capsicum, lime — substantial chunky salsa / side.",
        "yield": "600 g", "prep": 15, "cook": 10,
        "ingredients": [
            ("corn cobs","vegetable","2","ea","base","kernels removed"),
            ("black beans","legume","400","g","base","canned, drained"),
            ("red capsicum","vegetable","1","ea","base","small dice"),
            ("red onion","vegetable","60","g","base","small dice"),
            ("fresh coriander","herb","15","g","herb",""),
            ("lime juice","produce","30","ml","acid",""),
            ("cumin","spice","4","g","seasoning","ground"),
        ],
        "steps": [
            (1,"Char corn kernels in dry hot pan until caramel patches form.","charring","pan",8,None,None),
            (2,"Cool; combine with black beans, capsicum, onion, coriander.","mixing","bowl",3,None,None),
            (3,"Dress with lime juice, cumin, salt. Rest 10 min before serving.","dressing","bowl",10,None,None),
        ],
        "method": "Charring / Raw", "equipment": "Pan, board, bowl",
        "prep_complexity": 2, "labour": 1,
        "scores": (4,3,5,4,5,2,4,27),
        "tags": (5,4,4,3,3,5),
        "concept": ("Corn Black Bean Cup","catering","Portion cup for burrito bar / catering event side station","Catering / Events","Holds 4 h at room temperature"),
    },
    {
        "title": "Pineapple Jalapeño Salsa",
        "source": "nb074_salsa_recipes",
        "cuisine": "Mexican / Tropical",
        "category": "Sauce / Condiment",
        "summary": "Grilled pineapple with jalapeño and red onion — sweet, caramelised and spicy.",
        "yield": "400 g", "prep": 15, "cook": 10,
        "ingredients": [
            ("fresh pineapple","produce","300","g","base","small dice"),
            ("jalapeño","vegetable","2","ea","heat","minced"),
            ("red onion","vegetable","50","g","base","small dice"),
            ("fresh coriander","herb","10","g","herb",""),
            ("lime juice","produce","20","ml","acid",""),
        ],
        "steps": [
            (1,"Grill or pan-char pineapple slices until caramelised; cool and dice.","charring","grill/pan",8,None,None),
            (2,"Combine with jalapeño, onion, coriander and lime. Season with salt.","mixing","bowl",5,None,None),
        ],
        "method": "Grilling / Raw", "equipment": "Grill, board",
        "prep_complexity": 1, "labour": 1,
        "scores": (3,4,4,3,4,2,3,23),
        "tags": (3,3,4,5,4,5),
        "concept": ("Safari Lounge Pineapple Salsa","safari_lounge","Tropical condiment for grilled seafood and BBQ on safari menu","Safari Lounge / Events","Pairs with grilled fish and prawns"),
    },

    # ════════════════════════════════════════════════════
    # NB-081  NOLAN RYAN'S BEEF & BARBECUE
    # ════════════════════════════════════════════════════
    {
        "title": "Texas Smoked Brisket",
        "source": "nb081_nolan_ryan_beef_bbq",
        "cuisine": "American BBQ / Texan",
        "category": "BBQ Main",
        "summary": "Whole packer brisket with salt-pepper bark, smoked low-and-slow over oak.",
        "yield": "16–20 portions", "prep": 30, "cook": 900,
        "ingredients": [
            ("whole beef brisket","protein","6000","g","main","packer, fat cap trimmed to 6 mm"),
            ("coarse sea salt","mineral","60","g","rub",""),
            ("coarse black pepper","spice","60","g","rub",""),
            ("oak wood chunks","produce","6","ea","smoke",""),
        ],
        "steps": [
            (1,"Trim fat cap to 6 mm; apply salt and pepper rub liberally all surfaces.","prep/trimming","knife/board",30,None,None),
            (2,"Set smoker to 107 °C with oak; place brisket fat-side up.","smoking","offset smoker",300,107,None),
            (3,"Smoke unwrapped until bark forms and internal reaches 74 °C (~6 h).","smoking","smoker",360,107,None),
            (4,"Wrap in butcher paper; return to smoker until probe-tender ~96 °C internal.","wrapped smoke","smoker",240,107,"Probe should slide in like butter"),
            (5,"Rest wrapped in cooler 1–2 h before slicing against the grain.","resting","cooler",90,None,"Rest is non-negotiable for juicy brisket"),
        ],
        "method": "Low-and-slow smoke", "equipment": "Offset smoker, probe thermometer",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,5,4,4,4,3,4,28),
        "tags": (4,4,4,5,4,5),
        "concept": ("Brisket Catering Platter","catering","Whole brisket batch for large-format events and corporate BBQ","Catering / Events","Slice to order — holding temp 63 °C"),
    },
    {
        "title": "Texas Baby Back Ribs",
        "source": "nb081_nolan_ryan_beef_bbq",
        "cuisine": "American BBQ",
        "category": "BBQ Main",
        "summary": "3-2-1 smoked pork ribs with dry rub and Texas mop sauce.",
        "yield": "4 portions", "prep": 20, "cook": 360,
        "ingredients": [
            ("pork baby back ribs","protein","2","racks","main","membrane removed"),
            ("brown sugar","dry","30","g","rub",""),
            ("paprika","spice","20","g","rub",""),
            ("garlic powder","spice","10","g","rub",""),
            ("cumin","spice","5","g","rub",""),
            ("apple juice","liquid","200","ml","mop",""),
            ("BBQ sauce","condiment","150","ml","glaze",""),
        ],
        "steps": [
            (1,"Remove membrane from bone side; apply dry rub generously; rest 30 min.","prep","board",30,None,None),
            (2,"Smoke at 107 °C for 3 h spraying with apple juice every 45 min.","smoking","smoker",180,107,None),
            (3,"Wrap in foil with apple juice; smoke 2 h more.","wrapped smoke","smoker",120,107,"Braising phase — makes tender"),
            (4,"Unwrap; glaze with BBQ sauce; smoke 1 h final to set glaze.","glazing","smoker",60,107,None),
            (5,"Rest 15 min; cut between bones.","cutting","board",15,None,None),
        ],
        "method": "3-2-1 smoke method", "equipment": "Smoker, foil",
        "prep_complexity": 2, "labour": 2,
        "scores": (5,4,5,5,4,3,4,30),
        "tags": (5,5,4,5,4,4),
        "concept": ("Ribs Delivery Batch","ghost_kitchen","Par-smoked ribs finished to order for delivery platform operations","Ghost Kitchen / Delivery","Par-cook 3+2 h; finish 1 h to order"),
    },
    {
        "title": "Beef Fajitas",
        "source": "nb081_nolan_ryan_beef_bbq",
        "cuisine": "Tex-Mex",
        "category": "Handheld / Hot Main",
        "summary": "Marinated skirt steak sliced thin with sizzling peppers and onions on flour tortillas.",
        "yield": "4 portions", "prep": 480, "cook": 15,
        "ingredients": [
            ("beef skirt steak","protein","600","g","main",""),
            ("flour tortillas","starch","8","ea","base",""),
            ("green capsicum","vegetable","2","ea","side","sliced"),
            ("red capsicum","vegetable","1","ea","side","sliced"),
            ("white onion","vegetable","1","ea","side","sliced"),
            ("lime juice","produce","30","ml","marinade",""),
            ("cumin","spice","5","g","marinade",""),
            ("garlic","vegetable","3","cloves","marinade","minced"),
        ],
        "steps": [
            (1,"Combine lime, cumin, garlic, oil, salt; marinate steak 8 h refrigerated.","marinating","bowl/bag",480,4,None),
            (2,"Grill steak on very hot grill 3 min per side for medium-rare; rest 5 min.","grilling","grill",11,None,"Internal 57 °C medium-rare"),
            (3,"While steak rests, sauté peppers and onions on high until charred.","sautéing","cast iron",5,None,None),
            (4,"Slice steak thin against grain; serve sizzling with peppers on flour tortillas.","slicing","board",3,None,None),
        ],
        "method": "Grilling / Sauté", "equipment": "Grill, cast iron pan",
        "prep_complexity": 2, "labour": 2,
        "scores": (5,4,5,4,5,2,4,29),
        "tags": (5,5,4,4,4,4),
        "concept": ("Fajita Bar Catering Station","catering","Live-action fajita carving station for corporate and weddings","Catering / Events","High guest interaction and visual appeal"),
    },
    {
        "title": "Cowboy Ribeye",
        "source": "nb081_nolan_ryan_beef_bbq",
        "cuisine": "American BBQ / Steakhouse",
        "category": "Steak",
        "summary": "Bone-in 1 kg ribeye — seasoned simply, reverse-seared to perfect crust.",
        "yield": "2 portions", "prep": 10, "cook": 75,
        "ingredients": [
            ("bone-in ribeye","protein","1000","g","main","2.5 cm thick"),
            ("coarse sea salt","mineral","20","g","seasoning",""),
            ("coarse black pepper","spice","10","g","seasoning",""),
            ("butter","fat","40","g","basting",""),
            ("garlic","vegetable","3","cloves","basting","smashed"),
            ("fresh thyme","herb","4","sprigs","basting",""),
        ],
        "steps": [
            (1,"Season steak generously with salt and pepper; air-dry uncovered 1 h at room temp.","seasoning","rack",60,None,None),
            (2,"Reverse sear: place on rack in oven 120 °C until internal reaches 49 °C.","reverse sear","oven",50,120,None),
            (3,"Rest 5 min while heating cast iron until smoking.","resting","pan",7,None,None),
            (4,"Sear in cast iron 90 sec per side; baste with butter, garlic, thyme continuously.","searing","cast iron",4,None,"Target crust: dark mahogany"),
            (5,"Rest 10 min; slice and serve with bone presented.","resting","board",10,None,None),
        ],
        "method": "Reverse sear", "equipment": "Oven, cast iron, probe thermometer",
        "prep_complexity": 3, "labour": 3,
        "scores": (3,5,2,2,3,4,2,21),
        "tags": (2,3,4,5,5,4),
        "concept": ("Cowboy Steak Scarcity Drop","scarcity_drop","Weekend-only bone-in ribeye — limited allocation per service","Scarcity Drop / Premium","12 steaks max per service — sold out by Thursday"),
    },
    {
        "title": "Chuck Roast Chili",
        "source": "nb081_nolan_ryan_beef_bbq",
        "cuisine": "American / Texan",
        "category": "Wet Main / Bowl",
        "summary": "Slow-braised beef chuck with dried chilli paste — no beans, Texas style.",
        "yield": "8 portions", "prep": 30, "cook": 240,
        "ingredients": [
            ("beef chuck","protein","2000","g","main","2.5 cm cubes"),
            ("ancho chilli","vegetable","6","ea","sauce","dried"),
            ("guajillo chilli","vegetable","4","ea","sauce","dried"),
            ("beef stock","liquid","800","ml","braising",""),
            ("white onion","vegetable","2","ea","base","diced"),
            ("garlic","vegetable","8","cloves","base",""),
            ("cumin","spice","10","g","seasoning",""),
            ("oregano","herb","5","g","seasoning","dried"),
        ],
        "steps": [
            (1,"Toast and rehydrate dried chillies 20 min; blend with garlic to smooth paste.","chilli paste","pan/blender",25,None,None),
            (2,"Sear chuck in batches until deeply browned; remove.","searing","dutch oven",20,None,"Deep colour = deep flavour"),
            (3,"Sweat onions in pot; add chilli paste; cook 5 min.","sautéing","dutch oven",10,None,None),
            (4,"Return beef; add stock; braise covered at 160 °C for 3–4 h until tender.","braising","oven",240,160,None),
            (5,"Break beef into chunks; adjust seasoning; reduce gravy if needed.","finishing","pot",15,None,None),
        ],
        "method": "Braising", "equipment": "Dutch oven, blender",
        "prep_complexity": 3, "labour": 3,
        "scores": (4,4,5,5,5,3,4,30),
        "tags": (5,5,4,4,4,5),
        "concept": ("Chili Batch Freeze Programme","ghost_kitchen","2 L sealed pouches for ghost kitchen reheat-to-order ops","Ghost Kitchen / Meal Prep","Freezes 3 months without quality loss"),
    },
    {
        "title": "Smoked Beef Tenderloin",
        "source": "nb081_nolan_ryan_beef_bbq",
        "cuisine": "American BBQ",
        "category": "Premium BBQ",
        "summary": "Whole beef tenderloin cold-smoked then seared to a perfect crust.",
        "yield": "6 portions", "prep": 20, "cook": 60,
        "ingredients": [
            ("beef tenderloin","protein","1200","g","main","trimmed"),
            ("sea salt","mineral","20","g","seasoning",""),
            ("black pepper","spice","10","g","seasoning",""),
            ("hickory chips","produce","2","cups","smoke",""),
            ("butter","fat","40","g","basting",""),
        ],
        "steps": [
            (1,"Tie tenderloin with butcher's twine for even shape; season heavily.","prep","board",15,None,None),
            (2,"Cold-smoke at 93 °C with hickory 30 min until internal reaches 43 °C.","cold smoke","smoker",30,93,None),
            (3,"Increase smoker to 230 °C; sear all sides 2 min each until crust forms.","searing","smoker/pan",12,230,None),
            (4,"Rest 15 min; remove twine; slice 2.5 cm medallions.","resting","board",15,None,"Internal should be 57 °C (medium-rare)"),
        ],
        "method": "Cold smoke / Sear", "equipment": "Smoker, probe thermometer",
        "prep_complexity": 3, "labour": 2,
        "scores": (3,5,3,2,2,4,2,21),
        "tags": (2,3,5,5,4,5),
        "concept": ("Tenderloin Event Centrepiece","catering","Whole smoked tenderloin sliced tableside at premium events","Fine Dining / Catering","Theatre + premium protein = high perceived value"),
    },

    # ════════════════════════════════════════════════════
    # NB-090  FERMENTED FOOD
    # ════════════════════════════════════════════════════
    {
        "title": "Traditional Kimchi",
        "source": "nb090_fermented_food",
        "cuisine": "Korean",
        "category": "Fermented / Condiment",
        "summary": "Lacto-fermented napa cabbage with gochugaru, garlic, ginger and fish sauce.",
        "yield": "2 kg jar", "prep": 60, "cook": 0,
        "ingredients": [
            ("napa cabbage","vegetable","2000","g","base","quartered"),
            ("sea salt","mineral","100","g","brine",""),
            ("gochugaru","spice","80","g","paste","Korean red pepper flakes"),
            ("garlic","vegetable","40","g","paste","minced"),
            ("fresh ginger","vegetable","20","g","paste","grated"),
            ("fish sauce","condiment","30","ml","seasoning",""),
            ("spring onions","vegetable","100","g","add-in","sliced"),
        ],
        "steps": [
            (1,"Salt cabbage; toss well; let wilt 2 h. Rinse thoroughly; squeeze dry.","salting/wilting","bowl",120,None,"Proper wilt = correct texture"),
            (2,"Blend garlic, ginger, fish sauce and gochugaru into paste.","paste","blender",5,None,None),
            (3,"Combine cabbage, spring onion and paste; massage thoroughly (use gloves).","mixing","bowl",10,None,"Wear gloves — gochugaru stains"),
            (4,"Pack tightly into sterilised jar; press down to eliminate air pockets.","packing","jar",10,None,"Air pockets cause bad fermentation"),
            (5,"Ferment at room temp 1–5 days; press daily. Refrigerate when tangy and bubbly.","fermenting","jar",1440,None,"Taste daily — stop when desired sourness reached"),
        ],
        "method": "Lacto-fermentation", "equipment": "Large bowl, sterilised jar",
        "prep_complexity": 3, "labour": 3,
        "scores": (3,4,5,5,3,1,4,25),
        "tags": (3,3,5,3,4,5),
        "concept": ("Kimchi Artisan Jar Retail","productization","200 g and 500 g branded artisan jars for deli and health food retail","Retail / Health Food","Probiotic positioning — premium premium margin"),
    },
    {
        "title": "Classic Sauerkraut",
        "source": "nb090_fermented_food",
        "cuisine": "German / European",
        "category": "Fermented / Condiment",
        "summary": "Two-ingredient lacto-fermented white cabbage — salt and time.",
        "yield": "1 kg jar", "prep": 20, "cook": 0,
        "ingredients": [
            ("white cabbage","vegetable","1200","g","base","finely shredded"),
            ("fine sea salt","mineral","24","g","brine","2% of cabbage weight"),
        ],
        "steps": [
            (1,"Shred cabbage finely; weigh and add 2% salt by weight.","prep","board/scale",15,None,None),
            (2,"Massage salt into cabbage 5–10 min until brine is released.","massaging","bowl",10,None,"Need to see brine pool — enough to submerge"),
            (3,"Pack tightly into jar; ensure brine covers all cabbage; weigh down.","packing","jar",5,None,"Cabbage must stay submerged to prevent mould"),
            (4,"Ferment at 18–21 °C for 3–6 weeks; press and taste weekly.","fermenting","jar",10080,None,"Longer = more sour and complex"),
        ],
        "method": "Lacto-fermentation", "equipment": "Bowl, jar, weight",
        "prep_complexity": 2, "labour": 2,
        "scores": (3,4,5,5,3,1,4,25),
        "tags": (3,3,5,2,4,5),
        "concept": ("Sauerkraut Bulk Supply","productization","5 kg bulk pails for food service — burger bars, delis, ferment retailers","Wholesale / B2B","18-month shelf life refrigerated"),
    },
    {
        "title": "Wild Sourdough Starter",
        "source": "nb090_fermented_food",
        "cuisine": "European / Artisan",
        "category": "Fermented / Base",
        "summary": "Live wild-yeast flour and water culture for sourdough bread leavening.",
        "yield": "200 g active starter", "prep": 10, "cook": 0,
        "ingredients": [
            ("wholemeal flour","starch","200","g","base",""),
            ("filtered water","liquid","200","ml","hydration","room temp, unchlorinated"),
        ],
        "steps": [
            (1,"Day 1: mix 50 g flour + 50 ml water in clean jar; cover loosely; rest 24 h at 24 °C.","mixing","jar",5,24,None),
            (2,"Days 2–7: discard 75%; feed with equal parts flour and water daily.","feeding","jar",5,24,"Wild yeast needs 5–7 days to establish"),
            (3,"Starter is ready when it doubles in 4–8 h after feeding and smells pleasantly sour.","testing","jar",None,None,"Float test: drop in water — if it floats, it's active"),
        ],
        "method": "Wild fermentation", "equipment": "Clean jar",
        "prep_complexity": 2, "labour": 1,
        "scores": (2,4,4,4,2,1,3,20),
        "tags": (2,2,5,2,3,5),
        "concept": ("Artisan Starter Retail Kit","productization","Branded starter kit with dehydrated culture + flour + instruction booklet","Retail / DTC Gift","Sourdough starter kits are a proven gift product"),
    },
    {
        "title": "Preserved Lemon",
        "source": "nb090_fermented_food",
        "cuisine": "North African / Middle Eastern",
        "category": "Fermented / Condiment",
        "summary": "Whole lemons salt-cured in their own juice — essential in Moroccan cooking.",
        "yield": "1 jar (8 lemons)", "prep": 20, "cook": 0,
        "ingredients": [
            ("unwaxed lemons","produce","8","ea","base","quartered but attached at base"),
            ("coarse sea salt","mineral","120","g","cure",""),
            ("lemon juice","produce","200","ml","brine","extra, if needed"),
        ],
        "steps": [
            (1,"Quarter lemons without cutting through base; pack salt generously between cuts.","prep","board",15,None,None),
            (2,"Pack tightly into sterilised jar; press until juice runs; seal.","packing","jar",5,None,None),
            (3,"Cure at room temp for 4 weeks, shaking daily. Top with extra lemon juice if lemons not submerged.","curing","jar",20160,None,"Must stay submerged throughout"),
            (4,"Refrigerate after opening; use rinds only — rinse before use.","storing","fridge",None,4,"Keeps 6 months refrigerated"),
        ],
        "method": "Salt cure / Lacto-ferment", "equipment": "Sterilised jar",
        "prep_complexity": 2, "labour": 1,
        "scores": (3,4,5,5,3,1,4,25),
        "tags": (2,3,5,3,4,5),
        "concept": ("Preserved Lemon Artisan Range","productization","Artisan preserved lemon jars for Moroccan, Middle Eastern and gourmet market","Retail / Deli","North African cuisine growing market in Australia"),
    },
    {
        "title": "Tepache",
        "source": "nb090_fermented_food",
        "cuisine": "Mexican",
        "category": "Fermented Drink",
        "summary": "Lightly fermented pineapple skin and core beverage — tangy, sweet, effervescent.",
        "yield": "2 litres", "prep": 15, "cook": 0,
        "ingredients": [
            ("pineapple rinds and core","produce","1","ea","base","well-washed"),
            ("piloncillo or brown sugar","dry","200","g","ferment fuel",""),
            ("cinnamon stick","spice","1","ea","flavour",""),
            ("cloves","spice","3","ea","flavour",""),
            ("filtered water","liquid","2000","ml","base",""),
        ],
        "steps": [
            (1,"Combine pineapple rinds, sugar, cinnamon and cloves in a large jar.","combining","jar",10,None,None),
            (2,"Add water; stir to dissolve sugar; cover with cloth and secure.","filling","jar",5,None,None),
            (3,"Ferment at room temp 2–3 days, stirring twice daily; strain and bottle when lightly effervescent.","fermenting","jar",2880,None,"Taste daily — over-fermenting makes vinegar"),
            (4,"Refrigerate; consume within 5 days. Serve over ice.","serving","glass",None,4,None),
        ],
        "method": "Wild fermentation", "equipment": "Large jar, cloth",
        "prep_complexity": 1, "labour": 1,
        "scores": (3,4,5,4,3,1,3,23),
        "tags": (3,3,4,4,4,4),
        "concept": ("Tepache Craft Drinks Range","productization","Bottled craft tepache for café and health food market — functional beverage","Retail / Café","Low ABV — sells into no-alcohol drinks segment"),
    },
    {
        "title": "Miso Ramen Broth",
        "source": "nb090_fermented_food",
        "cuisine": "Japanese",
        "category": "Soup / Broth",
        "summary": "Tonkotsu-style ramen base enriched with white miso — fermented depth.",
        "yield": "2 litres", "prep": 20, "cook": 240,
        "ingredients": [
            ("pork trotters","protein","1000","g","stock",""),
            ("pork back fat","fat","200","g","richness",""),
            ("white miso","fermented","100","g","seasoning",""),
            ("garlic","vegetable","8","cloves","aromatic",""),
            ("fresh ginger","vegetable","40","g","aromatic","sliced"),
            ("spring onions","vegetable","4","ea","aromatic",""),
            ("soy sauce","condiment","60","ml","seasoning",""),
        ],
        "steps": [
            (1,"Blanch trotters 5 min; rinse cold; discard blanching water.","blanching","pot",10,100,None),
            (2,"Simmer trotters, fat, garlic, ginger and spring onions vigorously 4 h with lid.","simmering","large pot",240,100,"Vigorous boil emulsifies fat for milky broth"),
            (3,"Strain through fine mesh; season with miso and soy sauce.","finishing","strainer",10,None,"Miso added off boil to preserve probiotics"),
            (4,"Store in batches; reheat broth only — miso added per bowl to order.","portioning","containers",15,None,None),
        ],
        "method": "Long simmer", "equipment": "Large stockpot, fine strainer",
        "prep_complexity": 3, "labour": 3,
        "scores": (4,5,5,5,4,2,4,29),
        "tags": (4,4,4,4,3,5),
        "concept": ("Ramen Broth Pouch","ghost_kitchen","Frozen 500 ml broth pouches for ramen ghost kitchen or retail","Ghost Kitchen / Retail","Reheat from frozen in 8 min — ideal delivery product"),
    },

    # ════════════════════════════════════════════════════
    # NB-107  SRI LANKAN CUISINE
    # ════════════════════════════════════════════════════
    {
        "title": "Kottu Roti",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Street Food / Hot Main",
        "summary": "Chopped godamba roti stir-fried with egg, vegetables and curry — Sri Lanka's iconic street food.",
        "yield": "2 portions", "prep": 15, "cook": 10,
        "ingredients": [
            ("godamba roti","starch","4","ea","base","shredded/chopped"),
            ("eggs","dairy","2","ea","protein",""),
            ("leeks","vegetable","100","g","vegetable","thinly sliced"),
            ("carrots","vegetable","1","ea","vegetable","julienne"),
            ("chicken curry","protein","200","g","main","pre-cooked"),
            ("kottu spice mix","spice","10","g","seasoning",""),
            ("coconut oil","fat","30","ml","cooking fat",""),
        ],
        "steps": [
            (1,"Heat tawa or flat iron on high until smoking; add oil.","heating","tawa / flat iron",3,None,"Must be extremely hot for proper kottu"),
            (2,"Add vegetables and fry 2 min. Crack in eggs; scramble through.","frying","tawa",3,None,None),
            (3,"Add shredded roti; chop repeatedly with two flat spatulas while frying.","chopping/frying","tawa/blades",3,None,"The chopping rhythm is the technique"),
            (4,"Add curry and spice mix; fold through and serve immediately with curry gravy.","finishing","tawa",2,None,None),
        ],
        "method": "Tawa fry / Chop-technique", "equipment": "Tawa or flat iron, dual blades",
        "prep_complexity": 3, "labour": 4,
        "scores": (3,4,4,4,4,2,4,25),
        "tags": (4,3,4,5,4,4),
        "concept": ("Kottu Ghost Kitchen","ghost_kitchen","Sri Lankan street food ghost kitchen — kottu as hero SKU","Ghost Kitchen / Delivery","Interactive live video preparation builds social content"),
    },
    {
        "title": "Egg Hoppers",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Breakfast / Street Food",
        "summary": "Fermented rice and coconut milk bowl crepe with a soft egg set in the centre.",
        "yield": "8 hoppers", "prep": 480, "cook": 30,
        "ingredients": [
            ("rice flour","starch","300","g","base",""),
            ("coconut milk","liquid","400","ml","base",""),
            ("active yeast","fermented","5","g","leavening",""),
            ("sugar","dry","5","g","yeast food",""),
            ("eggs","dairy","8","ea","filling",""),
            ("salt","mineral","5","g","seasoning",""),
        ],
        "steps": [
            (1,"Dissolve yeast in warm water with sugar; rest 10 min.","proofing","bowl",10,None,None),
            (2,"Combine rice flour, coconut milk, yeast mix and salt; whisk smooth; ferment 8 h.","fermenting","bowl",480,None,"Overnight ferment develops flavour"),
            (3,"Heat hopper pan on medium; ladle batter; swirl to coat sides; crack egg in centre.","cooking","hopper pan",4,None,"Pan must be seasoned cast iron"),
            (4,"Cover; cook 3–4 min until edges crisp and egg just set.","steaming","pan with lid",4,None,"Egg should be soft-set, not hard"),
        ],
        "method": "Fermented batter / Steaming", "equipment": "Hopper pan (appa chatty)",
        "prep_complexity": 3, "labour": 3,
        "scores": (3,4,3,3,3,2,3,21),
        "tags": (3,3,4,4,3,4),
        "concept": ("Hopper Brunch Pop-Up","safari_lounge","Sri Lankan brunch pop-up — hopper station as live theatre for events","Events / Pop-up","Unique visual — strong social media content"),
    },
    {
        "title": "Dhal Curry",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Curry / Side",
        "summary": "Red lentils slow-simmered with coconut milk, curry leaves and tempered spices.",
        "yield": "6 portions", "prep": 10, "cook": 30,
        "ingredients": [
            ("red lentils","legume","300","g","base",""),
            ("coconut milk","liquid","200","ml","finish",""),
            ("brown onion","vegetable","1","ea","base","sliced"),
            ("garlic","vegetable","4","cloves","base","minced"),
            ("fresh curry leaves","herb","15","ea","temper",""),
            ("mustard seeds","spice","5","g","temper",""),
            ("turmeric","spice","5","g","seasoning",""),
            ("cumin","spice","5","g","seasoning",""),
            ("coconut oil","fat","30","ml","fat",""),
        ],
        "steps": [
            (1,"Rinse lentils; simmer with turmeric and water 20 min until soft.","simmering","pot",20,None,None),
            (2,"Add coconut milk; simmer 5 min; season.","simmering","pot",5,None,None),
            (3,"In separate pan, heat oil; splutter mustard seeds; add curry leaves, onion, garlic; cook 5 min.","tempering","small pan",5,None,"Tempering must be done hot and fast"),
            (4,"Pour temper over dhal; stir gently; serve.","finishing","pot",1,None,None),
        ],
        "method": "Simmering / Tempering", "equipment": "Pot, small pan",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,3,5,5,4,1,5,27),
        "tags": (4,5,5,3,2,5),
        "concept": ("Dhal Retail Pouch","productization","400 g retort pouch — Sri Lankan dhal for supermarket ready-meal range","Retail / Ready Meal","Vegan — growing market segment"),
    },
    {
        "title": "Chicken Devilled",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Hot Main / Bar Snack",
        "summary": "Deep-fried chicken pieces tossed in sweet-hot chilli sauce — Sri Lankan party staple.",
        "yield": "4 portions", "prep": 60, "cook": 20,
        "ingredients": [
            ("chicken thighs","protein","600","g","main","boneless, cubed"),
            ("chilli flakes","spice","10","g","sauce",""),
            ("tomato ketchup","condiment","40","ml","sauce",""),
            ("soy sauce","condiment","20","ml","sauce",""),
            ("capsicum","vegetable","2","ea","sauce","diced"),
            ("white onion","vegetable","1","ea","sauce","chunked"),
            ("cornflour","starch","50","g","coating",""),
        ],
        "steps": [
            (1,"Marinate chicken with salt, pepper, soy; coat in cornflour.","marinating","bowl",60,None,None),
            (2,"Deep-fry in oil at 180 °C for 5 min until golden and cooked through.","deep frying","wok/fryer",5,180,"Internal 74 °C"),
            (3,"In separate pan, fry onion and capsicum; add ketchup, soy, chilli flakes; reduce 2 min.","sauce","wok",5,None,None),
            (4,"Add fried chicken to sauce; toss on high heat 1 min; serve immediately.","tossing","wok",1,None,None),
        ],
        "method": "Deep fry / Toss", "equipment": "Wok, deep fryer",
        "prep_complexity": 2, "labour": 3,
        "scores": (4,4,5,3,4,2,4,26),
        "tags": (4,4,4,4,4,4),
        "concept": ("Devilled Chicken Share Plate","catering","Sri Lankan canape/share plate for events and pop-ups","Catering / Safari Lounge","Can be held warm 30 min — reliable catering product"),
    },
    {
        "title": "Pol Sambol",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Condiment / Relish",
        "summary": "Freshly grated coconut with red onion, chilli, lime and Maldive fish.",
        "yield": "300 g", "prep": 15, "cook": 0,
        "ingredients": [
            ("fresh coconut","produce","200","g","base","finely grated"),
            ("red onion","vegetable","60","g","base","finely diced"),
            ("dried chilli flakes","spice","10","g","heat",""),
            ("lime juice","produce","20","ml","acid",""),
            ("Maldive fish flakes","protein","15","g","umami","optional — omit for vegan"),
            ("sea salt","mineral","5","g","seasoning",""),
        ],
        "steps": [
            (1,"Combine grated coconut, onion, chilli and Maldive fish.","mixing","mortar/bowl",5,None,None),
            (2,"Grind or crush lightly in mortar to release coconut oil and blend flavours.","grinding","mortar",5,None,"Hand grind brings out oils — food processor makes it pasty"),
            (3,"Season with lime juice and salt; taste and adjust heat.","seasoning","bowl",5,None,None),
        ],
        "method": "Raw / Grinding", "equipment": "Mortar and pestle or bowl",
        "prep_complexity": 1, "labour": 2,
        "scores": (3,3,5,4,3,1,4,23),
        "tags": (3,3,5,4,3,5),
        "concept": ("Pol Sambol Retail Tub","productization","Chilled fresh coconut sambol in branded tub for Asian grocery retail","Retail / Asian Grocery","3-day shelf life in MAP packaging"),
    },
    {
        "title": "Fish Ambul Thiyal",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Fish Curry",
        "summary": "Dry sour fish curry with goraka (gamboge) — Southern Sri Lankan classic.",
        "yield": "4 portions", "prep": 15, "cook": 40,
        "ingredients": [
            ("tuna steaks","protein","600","g","main","cubed"),
            ("goraka pieces","produce","8","ea","souring agent",""),
            ("black pepper","spice","15","g","seasoning","coarsely ground"),
            ("garlic","vegetable","6","cloves","base",""),
            ("fresh curry leaves","herb","15","ea","aromatic",""),
            ("sea salt","mineral","10","g","seasoning",""),
        ],
        "steps": [
            (1,"Dissolve goraka in warm water; combine with garlic, pepper, salt into paste.","paste","bowl",10,None,None),
            (2,"Coat tuna pieces in paste; marinate 15 min.","marinating","bowl",15,None,None),
            (3,"Place in pan with 100 ml water and curry leaves; cook on medium with lid 15 min.","steaming","pan",15,None,None),
            (4,"Remove lid; reduce on low heat 20 min until sauce dries and coats fish.","reducing","pan",20,None,"Dry curry — sauce should be almost gone"),
        ],
        "method": "Dry braise / Reduce", "equipment": "Clay pot or pan",
        "prep_complexity": 2, "labour": 2,
        "scores": (2,4,3,4,3,3,3,22),
        "tags": (2,3,4,5,3,5),
        "concept": ("Ambul Thiyal Jarred Paste","productization","Goraka-pepper paste in jar — cook-at-home Sri Lankan fish curry base","Retail / Specialty","Niche but strong diaspora market globally"),
    },
    {
        "title": "Sri Lankan Crab Curry",
        "source": "nb107_srilankan_cuisine",
        "cuisine": "Sri Lankan",
        "category": "Seafood Curry / Premium",
        "summary": "Whole mud crabs in coconut milk curry with Sri Lankan spice paste.",
        "yield": "2 portions", "prep": 20, "cook": 25,
        "ingredients": [
            ("mud crabs","protein","2","ea","main","cleaned, halved"),
            ("coconut milk","liquid","400","ml","base",""),
            ("brown onion","vegetable","1","ea","base","sliced"),
            ("garlic","vegetable","5","cloves","paste",""),
            ("fresh ginger","vegetable","20","g","paste",""),
            ("Sri Lankan curry powder","spice","15","g","seasoning",""),
            ("fresh curry leaves","herb","20","ea","aromatic",""),
            ("tomato","vegetable","2","ea","acid","chopped"),
        ],
        "steps": [
            (1,"Blend garlic and ginger to paste; fry with onion and curry leaves in oil 5 min.","base","pot",5,None,None),
            (2,"Add curry powder and tomato; cook 5 min until oil separates.","masala","pot",5,None,"Oil separating indicates cooked-out spices"),
            (3,"Add crab pieces; toss in masala; add coconut milk; cover and cook 15 min.","curry","pot",15,None,"Crab is cooked when shell turns orange-red"),
            (4,"Adjust seasoning; serve with rice or bread.","finishing","pot",3,None,None),
        ],
        "method": "Curry / Braising", "equipment": "Deep pot or wok",
        "prep_complexity": 3, "labour": 3,
        "scores": (2,5,2,3,3,4,2,21),
        "tags": (2,3,4,5,5,4),
        "concept": ("Crab Curry Safari Lounge Feature","safari_lounge","Signature whole-crab curry for premium events — limited availability","Safari Lounge / Scarcity","Live crab = theatre + freshness signal"),
    },

    # ════════════════════════════════════════════════════
    # NB-108  MEAT COOKING
    # ════════════════════════════════════════════════════
    {
        "title": "Pan-Seared Ribeye Steak",
        "source": "nb108_meat_cooking",
        "cuisine": "European / Steakhouse",
        "category": "Steak",
        "summary": "Dry-aged ribeye with classic butter basting — technique-focused primer for meat cookery.",
        "yield": "1 steak", "prep": 5, "cook": 12,
        "ingredients": [
            ("ribeye steak","protein","350","g","main","2.5 cm thick, dry-aged preferred"),
            ("coarse sea salt","mineral","10","g","seasoning",""),
            ("black pepper","spice","5","g","seasoning",""),
            ("butter","fat","30","g","basting",""),
            ("garlic","vegetable","2","cloves","basting","smashed"),
            ("fresh thyme","herb","3","sprigs","basting",""),
        ],
        "steps": [
            (1,"Season steak generously 30 min before cooking; bring to room temp.","seasoning","board",30,None,None),
            (2,"Heat cast iron until smoking. Sear steak 3 min without moving; flip; sear 3 min.","searing","cast iron",6,None,"No pressing — let Maillard work"),
            (3,"Reduce heat; add butter, garlic, thyme; tilt pan; baste continuously 2 min.","basting","cast iron",2,None,"Constant basting builds crust layer"),
            (4,"Rest on rack 5 min; slice against grain.","resting","rack",5,None,"Resting retains juices"),
        ],
        "method": "Pan-searing / Basting", "equipment": "Cast iron pan, probe",
        "prep_complexity": 2, "labour": 3,
        "scores": (4,5,3,2,3,3,3,23),
        "tags": (3,3,4,5,4,5),
        "concept": ("Steak Masterclass SKU","productization","Online meat cookery masterclass bundled with premium steak delivery","DTC / Subscription","Video + protein bundle = high LTV"),
    },
    {
        "title": "Slow-Braised Pork Shoulder",
        "source": "nb108_meat_cooking",
        "cuisine": "European / American",
        "category": "Hot Main",
        "summary": "Bone-in pork shoulder braised in aromatics until pull-apart tender.",
        "yield": "8 portions", "prep": 20, "cook": 300,
        "ingredients": [
            ("pork shoulder bone-in","protein","2500","g","main",""),
            ("brown onion","vegetable","2","ea","base","quartered"),
            ("garlic","vegetable","8","cloves","base",""),
            ("apple cider vinegar","liquid","60","ml","acid",""),
            ("chicken stock","liquid","500","ml","braise",""),
            ("fresh rosemary","herb","3","sprigs","aromatic",""),
            ("bay leaves","herb","3","ea","aromatic",""),
        ],
        "steps": [
            (1,"Score fat cap; season all sides heavily with salt and pepper.","seasoning","board",10,None,None),
            (2,"Sear in Dutch oven on all sides until deep brown; remove.","searing","dutch oven",15,None,None),
            (3,"Sweat onion and garlic; deglaze with vinegar; add stock, rosemary, bay.","base","dutch oven",5,None,None),
            (4,"Return pork; roast covered 150 °C for 5 h until internal 90 °C and probe-tender.","braising","oven",300,150,"Check at 4 h — done when bone slides free"),
            (5,"Rest 30 min; shred with forks.","resting/shredding","board",30,None,None),
        ],
        "method": "Braising", "equipment": "Dutch oven, oven",
        "prep_complexity": 2, "labour": 2,
        "scores": (4,4,5,5,5,2,4,29),
        "tags": (5,5,4,4,3,4),
        "concept": ("Pulled Pork Batch Ops","ghost_kitchen","Weekly 20 kg pork shoulder batch for pulled pork delivery menu","Ghost Kitchen / Meal Prep","Shredded pork holds 5 days refrigerated"),
    },
    {
        "title": "Herb-Crusted Rack of Lamb",
        "source": "nb108_meat_cooking",
        "cuisine": "European / Fine Dining",
        "category": "Premium Main",
        "summary": "French-trimmed rack with dijon-herb crust, roasted to medium-rare.",
        "yield": "2 portions", "prep": 20, "cook": 25,
        "ingredients": [
            ("lamb rack French-trimmed","protein","600","g","main","2 racks, 3–4 bones each"),
            ("dijon mustard","condiment","30","ml","binder",""),
            ("breadcrumbs","starch","60","g","crust","panko"),
            ("fresh rosemary","herb","10","g","crust","finely chopped"),
            ("fresh thyme","herb","5","g","crust",""),
            ("garlic","vegetable","3","cloves","crust","minced"),
            ("olive oil","fat","30","ml","crust",""),
        ],
        "steps": [
            (1,"Season racks; sear fat-side down in pan 3 min until golden.","searing","pan",5,None,None),
            (2,"Combine breadcrumbs, herbs, garlic, oil into crust paste.","crust","bowl",5,None,None),
            (3,"Brush racks with mustard; press crust firmly over meat.","coating","board",5,None,"Mustard anchors crust"),
            (4,"Roast 200 °C for 18–20 min until internal 57 °C (medium-rare).","roasting","oven",20,200,"Probe check critical — lamb overcooks fast"),
            (5,"Rest 10 min; cut between bones to serve.","resting","board",10,None,None),
        ],
        "method": "Searing / Roasting", "equipment": "Pan, oven, probe",
        "prep_complexity": 3, "labour": 3,
        "scores": (3,5,2,2,2,4,2,20),
        "tags": (2,3,4,5,5,5),
        "concept": ("Lamb Rack Fine Dining Feature","safari_lounge","Signature rack carving for premium events with tableside theatre","Fine Dining / Events","Rack presentation has high visual premium"),
    },
    {
        "title": "Beef Short Rib Braise",
        "source": "nb108_meat_cooking",
        "cuisine": "European / American",
        "category": "Premium Main",
        "summary": "Bone-in beef short ribs braised in red wine until fall-off-bone tender.",
        "yield": "4 portions", "prep": 20, "cook": 210,
        "ingredients": [
            ("beef short ribs bone-in","protein","1800","g","main","trimmed"),
            ("red wine","liquid","500","ml","braise","robust variety"),
            ("beef stock","liquid","500","ml","braise",""),
            ("brown onion","vegetable","1","ea","mirepoix",""),
            ("carrot","vegetable","2","ea","mirepoix",""),
            ("celery","vegetable","2","stalks","mirepoix",""),
            ("tomato paste","condiment","30","g","depth",""),
            ("garlic","vegetable","5","cloves","base",""),
        ],
        "steps": [
            (1,"Season ribs heavily; sear all sides until dark crust forms.","searing","dutch oven",20,None,None),
            (2,"Sweat mirepoix; add tomato paste; cook 5 min.","base","dutch oven",8,None,None),
            (3,"Deglaze with wine; reduce by half; add stock.","deglaze","dutch oven",10,None,None),
            (4,"Return ribs; cover and braise 160 °C for 3 h 30 min until probe-tender.","braising","oven",210,160,"Pull when probe meets no resistance"),
            (5,"Remove ribs; strain and reduce sauce by half; glaze ribs before serving.","sauce","pot",15,None,None),
        ],
        "method": "Braising", "equipment": "Dutch oven, oven, probe",
        "prep_complexity": 3, "labour": 3,
        "scores": (3,5,4,4,4,3,3,26),
        "tags": (3,4,5,5,4,5),
        "concept": ("Short Rib Premium Box","catering","Pre-braised short rib with sauce pouch for premium event catering","Catering / Events","Reheat in sauce pouch — zero quality loss"),
    },
    {
        "title": "Roast Chicken with Garlic and Herbs",
        "source": "nb108_meat_cooking",
        "cuisine": "European",
        "category": "Hot Main / Roast",
        "summary": "Whole roast chicken with herb butter under skin, roasted to perfect doneness.",
        "yield": "4 portions", "prep": 20, "cook": 75,
        "ingredients": [
            ("whole chicken","protein","1800","g","main",""),
            ("butter","fat","80","g","herb butter","softened"),
            ("garlic","vegetable","6","cloves","base","3 minced, 3 whole"),
            ("fresh thyme","herb","10","g","herb butter",""),
            ("fresh rosemary","herb","5","g","herb butter",""),
            ("lemon","produce","1","ea","cavity","halved"),
        ],
        "steps": [
            (1,"Mix softened butter with minced garlic, thyme and rosemary.","herb butter","bowl",10,None,None),
            (2,"Loosen skin over breasts; push butter under skin and over thighs.","stuffing","board",10,None,None),
            (3,"Season cavity; stuff with lemon and whole garlic; truss loosely.","trussing","board",5,None,None),
            (4,"Roast at 220 °C 15 min to brown skin; reduce to 180 °C; roast 60 min.","roasting","oven",75,180,"Internal breast 74 °C, thigh 82 °C"),
            (5,"Rest 15 min before carving.","resting","board",15,None,"Rest is essential — carving hot loses all juices"),
        ],
        "method": "Roasting", "equipment": "Oven, roasting tray, probe",
        "prep_complexity": 2, "labour": 2,
        "scores": (5,4,4,4,4,2,4,27),
        "tags": (4,5,4,4,3,4),
        "concept": ("Rotisserie Batch Programme","catering","16-bird rotisserie batch for catering and corporate lunch programmes","Catering / B2B","4 h warm hold at 63 °C without quality loss"),
    },
    {
        "title": "Pork Belly Confit",
        "source": "nb108_meat_cooking",
        "cuisine": "European / Asian Fusion",
        "category": "Hot Main",
        "summary": "Slow-cooked pork belly braised in seasoned stock until tender, pressed and crisped.",
        "yield": "4 portions", "prep": 1440, "cook": 180,
        "ingredients": [
            ("pork belly","protein","1200","g","main","skin-on"),
            ("soy sauce","condiment","60","ml","braise",""),
            ("ginger","vegetable","30","g","braise","sliced"),
            ("star anise","spice","3","ea","braise",""),
            ("Chinese five-spice","spice","5","g","rub",""),
            ("brown sugar","dry","20","g","glaze",""),
            ("chicken stock","liquid","400","ml","braise",""),
        ],
        "steps": [
            (1,"Score skin; rub with five-spice and salt; refrigerate uncovered overnight.","curing","fridge",1440,4,"Drying skin = super-crisp crackling"),
            (2,"Braise skin-side-up in soy, ginger, star anise, stock at 150 °C for 3 h.","braising","oven/tray",180,150,None),
            (3,"Remove; press between two trays overnight refrigerated.","pressing","fridge",1440,4,"Pressing firms texture for clean portioning"),
            (4,"Portion; roast skin-side-up 220 °C 15 min until crackling puffs; glaze with sugar.","crisping","oven",15,220,"Crackling must be completely dry before crisping"),
        ],
        "method": "Braise / Press / Crisp", "equipment": "Oven, tray press, probe",
        "prep_complexity": 4, "labour": 3,
        "scores": (3,5,4,4,3,3,3,25),
        "tags": (3,4,5,5,4,5),
        "concept": ("Pork Belly Catering Star","catering","Pressed and portioned pork belly — plates perfectly, looks premium","Catering / Fine Dining","2-day prep means zero day-of stress"),
    },
]


# ─────────────────────────── seeding ────────────────────────────

def seed() -> dict:
    conn = connect()
    reset(conn)

    for r in RECIPES:
        recipe_id = rid(r["title"], r["source"])
        total_time = (r.get("prep") or 0) + (r.get("cook") or 0)

        conn.execute(
            """
            INSERT INTO recipes(id,title,source_file,cuisine_family,dish_category,
              summary,yield_amount,prep_time,cook_time,total_time)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            """,
            (recipe_id, r["title"], r["source"], r["cuisine"], r["category"],
             r["summary"], r.get("yield"), r.get("prep"), r.get("cook"), total_time),
        )

        for (name, cat, qty, unit, role, prep_note) in r["ingredients"]:
            iid = upsert_ingredient(conn, name, cat)
            try:
                qty_num = float(str(qty).split()[0]) if qty else None
            except ValueError:
                qty_num = None
            conn.execute(
                """
                INSERT OR IGNORE INTO recipe_ingredients
                  (recipe_id,ingredient_id,role,quantity,unit,preparation_note)
                VALUES(?,?,?,?,?,?)
                """,
                (recipe_id, iid, role, qty_num, unit, prep_note),
            )

        for (num, summary, tech, equip, est_time, temp, ccn) in r["steps"]:
            conn.execute(
                """
                INSERT INTO cooking_steps
                  (recipe_id,step_number,step_summary,technique,equipment,
                   estimated_time_minutes,temperature,critical_control_note)
                VALUES(?,?,?,?,?,?,?,?)
                """,
                (recipe_id, num, summary, tech, equip, est_time, temp, ccn),
            )

        s = r["scores"]  # (familiarity,premium,batch,hold,delivery,waste,cross,composite)
        conn.execute(
            """
            INSERT INTO commercial_scores
              (recipe_id,customer_familiarity,premium_pricing,batch_suitability,
               holding_reheat,delivery_suitability,waste_risk,cross_utilisation,
               commercial_deployability_score)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (recipe_id, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]),
        )

        t = r["tags"]  # (ghost,catering,product,safari,scarcity,saas)
        conn.execute(
            """
            INSERT INTO monetization_tags
              (recipe_id,ghost_kitchen_fit,catering_fit,productization_fit,
               safari_lounge_fit,scarcity_drop_fit,saas_dataset_fit)
            VALUES(?,?,?,?,?,?,?)
            """,
            (recipe_id, t[0], t[1], t[2], t[3], t[4], t[5]),
        )

        conn.execute(
            """
            INSERT INTO methods(recipe_id,cooking_method,equipment,prep_complexity,labour_intensity)
            VALUES(?,?,?,?,?)
            """,
            (recipe_id, r["method"], r["equipment"], r["prep_complexity"], r["labour"]),
        )

        c = r["concept"]
        conn.execute(
            """
            INSERT INTO derived_concepts
              (recipe_id,concept_title,concept_type,original_derivative_description,
               business_model,notes)
            VALUES(?,?,?,?,?,?)
            """,
            (recipe_id, c[0], c[1], c[2], c[3], c[4]),
        )

    conn.commit()

    counts = {}
    for table in ["recipes","ingredients","recipe_ingredients","cooking_steps",
                  "methods","commercial_scores","monetization_tags","derived_concepts"]:
        counts[table] = conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"]

    top = conn.execute(
        """
        SELECT r.title, cs.commercial_deployability_score
        FROM recipes r
        JOIN commercial_scores cs ON cs.recipe_id = r.id
        ORDER BY cs.commercial_deployability_score DESC
        LIMIT 5
        """
    ).fetchall()
    conn.close()
    return {"counts": counts, "top": [dict(row) for row in top]}


if __name__ == "__main__":
    result = seed()
    print("SEED OK")
    for k, v in result["counts"].items():
        print(f"  {k}: {v}")
    print("Top commercial scores:")
    for row in result["top"]:
        print(f"  {row['commercial_deployability_score']:>3}  {row['title']}")
