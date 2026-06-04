PRAGMA foreign_keys = ON;

-- ─────────────────────────────── core tables ───────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id             TEXT    PRIMARY KEY,
  title          TEXT    NOT NULL,
  source_file    TEXT    NOT NULL,
  cuisine_family TEXT,
  dish_category  TEXT,
  summary        TEXT,
  yield_amount   TEXT,
  prep_time      INTEGER,   -- minutes
  cook_time      INTEGER,   -- minutes
  total_time     INTEGER,   -- minutes
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingredients (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  category      TEXT,
  allergen_flag INTEGER NOT NULL DEFAULT 0 CHECK (allergen_flag IN (0,1))
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id        TEXT    NOT NULL,
  ingredient_id    INTEGER NOT NULL,
  role             TEXT,
  quantity         REAL,
  unit             TEXT,
  preparation_note TEXT,
  optional_flag    INTEGER NOT NULL DEFAULT 0 CHECK (optional_flag IN (0,1)),
  PRIMARY KEY (recipe_id, ingredient_id, role),
  FOREIGN KEY (recipe_id)     REFERENCES recipes(id)     ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cooking_steps (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id              TEXT    NOT NULL,
  step_number            INTEGER NOT NULL,
  step_summary           TEXT,
  technique              TEXT,
  equipment              TEXT,
  estimated_time_minutes INTEGER,
  temperature            TEXT,
  critical_control_note  TEXT,
  UNIQUE (recipe_id, step_number),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS methods (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id        TEXT NOT NULL UNIQUE,
  cooking_method   TEXT,
  equipment        TEXT,
  prep_complexity  INTEGER CHECK (prep_complexity  BETWEEN 1 AND 5),
  labour_intensity INTEGER CHECK (labour_intensity BETWEEN 1 AND 5),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ──────────────────────────── intelligence tables ──────────────────────────

CREATE TABLE IF NOT EXISTS commercial_scores (
  recipe_id                      TEXT PRIMARY KEY,
  customer_familiarity           INTEGER CHECK (customer_familiarity  BETWEEN 1 AND 5),
  premium_pricing                INTEGER CHECK (premium_pricing       BETWEEN 1 AND 5),
  batch_suitability              INTEGER CHECK (batch_suitability     BETWEEN 1 AND 5),
  holding_reheat                 INTEGER CHECK (holding_reheat        BETWEEN 1 AND 5),
  delivery_suitability           INTEGER CHECK (delivery_suitability  BETWEEN 1 AND 5),
  waste_risk                     INTEGER CHECK (waste_risk            BETWEEN 1 AND 5),
  cross_utilisation              INTEGER CHECK (cross_utilisation     BETWEEN 1 AND 5),
  commercial_deployability_score INTEGER,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monetization_tags (
  recipe_id          TEXT PRIMARY KEY,
  ghost_kitchen_fit  INTEGER CHECK (ghost_kitchen_fit  BETWEEN 1 AND 5),
  catering_fit       INTEGER CHECK (catering_fit       BETWEEN 1 AND 5),
  productization_fit INTEGER CHECK (productization_fit BETWEEN 1 AND 5),
  safari_lounge_fit  INTEGER CHECK (safari_lounge_fit  BETWEEN 1 AND 5),
  scarcity_drop_fit  INTEGER CHECK (scarcity_drop_fit  BETWEEN 1 AND 5),
  saas_dataset_fit   INTEGER CHECK (saas_dataset_fit   BETWEEN 1 AND 5),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS derived_concepts (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id                       TEXT NOT NULL,
  concept_title                   TEXT NOT NULL,
  concept_type                    TEXT,
  original_derivative_description TEXT,
  business_model                  TEXT,
  notes                           TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- ───────────────────────────────── indexes ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_recipes_cuisine      ON recipes(cuisine_family);
CREATE INDEX IF NOT EXISTS idx_recipes_category     ON recipes(dish_category);
CREATE INDEX IF NOT EXISTS idx_ingredients_name     ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_steps_recipe         ON cooking_steps(recipe_id, step_number);
CREATE INDEX IF NOT EXISTS idx_scores_commercial    ON commercial_scores(commercial_deployability_score DESC);
CREATE INDEX IF NOT EXISTS idx_tags_catering        ON monetization_tags(catering_fit DESC);
CREATE INDEX IF NOT EXISTS idx_tags_ghost           ON monetization_tags(ghost_kitchen_fit DESC);
CREATE INDEX IF NOT EXISTS idx_tags_productization  ON monetization_tags(productization_fit DESC);
CREATE INDEX IF NOT EXISTS idx_tags_safari          ON monetization_tags(safari_lounge_fit DESC);
CREATE INDEX IF NOT EXISTS idx_tags_scarcity        ON monetization_tags(scarcity_drop_fit DESC);
