-- =============================================================================
-- THERAMENU: HOSPITAL-GRADE THERAPEUTIC NUTRITION ENGINE SCHEMA
-- =============================================================================
-- This schema transforms the application into a clinical decision support system
-- for generating medically prescribed diet plans. It focuses on condition-specific
-- rules, therapeutic scoring, and strict validation of meal plans against
-- medical constraints.
--
-- Key Features:
-- 1. Normalized Clinical Data: Separates ingredients, recipes, and conditions.
-- 2. Therapeutic Scoring: Tracks acidity, irritants, and digestibility.
-- 3. Rule-Based Validation: Enforces inclusion/exclusion rules per condition.
-- 4. Audit Trail: Logs validation results for generated plans.
-- =============================================================================

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. CORE CLINICAL ENTITIES
-- =============================================================================

-- Table: therapeutic_conditions
-- Represents medical conditions (e.g., Gastric, Renal, Diabetic) that require
-- specific dietary interventions.
CREATE TABLE therapeutic_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'GASTRIC', 'RENAL_STAGE_3'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    clinical_guidelines TEXT, -- Summary of medical guidelines
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: patients
-- Stores patient demographic and clinical data relevant to nutrition.
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mrn VARCHAR(50) UNIQUE NOT NULL, -- Medical Record Number
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    primary_diagnosis_id UUID REFERENCES therapeutic_conditions(id),
    secondary_diagnoses UUID[], -- Array of condition IDs
    allergies TEXT[],
    height_cm NUMERIC(5, 2),
    weight_kg NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: condition_food_rules
-- Defines specific dietary rules for each condition (e.g., "Avoid Caffeine" for Gastric).
-- These rules drive the validation engine.
CREATE TABLE condition_food_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    condition_id UUID REFERENCES therapeutic_conditions(id) ON DELETE CASCADE,
    rule_type VARCHAR(20) CHECK (rule_type IN ('EXCLUDE', 'LIMIT', 'ENCOURAGE', 'REQUIRED')),
    category VARCHAR(50), -- e.g., 'BEVERAGE', 'SPICE', 'FIBER'
    description TEXT NOT NULL,
    threshold_value NUMERIC, -- e.g., limit to 200mg
    threshold_unit VARCHAR(20), -- e.g., 'mg', 'g'
    severity_level VARCHAR(20) CHECK (severity_level IN ('ABSOLUTE', 'HIGH', 'MODERATE', 'LOW')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. INGREDIENT & NUTRITION DATABASE
-- =============================================================================

-- Table: ingredients
-- Base library of raw food items.
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50), -- e.g., 'Vegetable', 'Dairy', 'Grain'
    is_allergen BOOLEAN DEFAULT FALSE,
    allergen_type VARCHAR(50), -- e.g., 'GLUTEN', 'DAIRY', 'NUT'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: ingredient_nutrition
-- Nutritional data per 100g of ingredient.
CREATE TABLE ingredient_nutrition (
    ingredient_id UUID PRIMARY KEY REFERENCES ingredients(id) ON DELETE CASCADE,
    calories_kcal NUMERIC(6, 2) DEFAULT 0,
    protein_g NUMERIC(6, 2) DEFAULT 0,
    fat_total_g NUMERIC(6, 2) DEFAULT 0,
    carbs_total_g NUMERIC(6, 2) DEFAULT 0,
    fiber_g NUMERIC(6, 2) DEFAULT 0,
    sugar_g NUMERIC(6, 2) DEFAULT 0,
    sodium_mg NUMERIC(8, 2) DEFAULT 0,
    potassium_mg NUMERIC(8, 2) DEFAULT 0,
    cholesterol_mg NUMERIC(8, 2) DEFAULT 0,
    water_g NUMERIC(6, 2) DEFAULT 0
);

-- Table: ingredient_tags
-- Clinical tags for ingredients to support rule matching (e.g., 'ACIDIC', 'SPICY').
CREATE TABLE ingredient_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL, -- e.g., 'HIGH_FIBER', 'ACIDIC', 'GAS_FORMING'
    UNIQUE(ingredient_id, tag)
);

-- =============================================================================
-- 3. RECIPE MANAGEMENT & THERAPEUTIC PROFILING
-- =============================================================================

-- Table: recipes
-- Culinary instructions and metadata for dishes.
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    preparation_method VARCHAR(100), -- e.g., 'Steamed', 'Fried', 'Baked'
    portion_size_g NUMERIC(6, 2),
    preparation_time_minutes INT,
    iddsi_level VARCHAR(20), -- Texture modification level (0-7)
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: recipe_ingredients
-- Mapping of ingredients to recipes with quantities.
CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    amount_g NUMERIC(8, 2) NOT NULL,
    notes TEXT -- e.g., 'Finely chopped', 'Peeled'
);

-- Table: recipe_clinical_profile
-- Advanced therapeutic scoring for recipes. This is the core of the "Hospital Grade" logic.
-- Scores are typically 0-10 or normalized values.
CREATE TABLE recipe_clinical_profile (
    recipe_id UUID PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
    acidity_score NUMERIC(3, 1) DEFAULT 0, -- 0 (Alkaline) to 10 (Highly Acidic)
    irritant_score NUMERIC(3, 1) DEFAULT 0, -- 0 (Bland) to 10 (Highly Irritating)
    digestibility_score NUMERIC(3, 1) DEFAULT 10, -- 0 (Hard) to 10 (Easy)
    spice_score NUMERIC(3, 1) DEFAULT 0, -- 0 (None) to 10 (Hot)
    gastric_load_score NUMERIC(5, 2) DEFAULT 0, -- Calculated load metric
    renal_load_score NUMERIC(5, 2) DEFAULT 0, -- Calculated renal solute load
    glycemic_index_estimate NUMERIC(5, 2),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: recipe_condition_compatibility
-- Pre-computed suitability of a recipe for a specific condition.
-- Helps fast filtering during meal plan generation.
CREATE TABLE recipe_condition_compatibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    condition_id UUID REFERENCES therapeutic_conditions(id) ON DELETE CASCADE,
    suitability_score NUMERIC(3, 2) CHECK (suitability_score BETWEEN 0 AND 1), -- 0.0 to 1.0 (1.0 = Perfect Match)
    is_approved BOOLEAN DEFAULT FALSE,
    contraindication_reason TEXT, -- Why it might be bad (if score is low)
    UNIQUE(recipe_id, condition_id)
);

-- =============================================================================
-- 4. MEAL PLANNING & GENERATION
-- =============================================================================

-- Table: meal_plan_templates
-- Structural templates for hospital menus (e.g., "Standard 3-Meal + 2-Snack").
CREATE TABLE meal_plan_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    days_duration INT DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: meal_plan_template_slots
-- Defines the structure of a day (e.g., Day 1 Breakfast, Day 1 Lunch).
CREATE TABLE meal_plan_template_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES meal_plan_templates(id) ON DELETE CASCADE,
    day_number INT NOT NULL, -- 1-7
    meal_type VARCHAR(20) CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK_AM', 'SNACK_PM')),
    target_calories_kcal NUMERIC(6, 2),
    target_protein_g NUMERIC(6, 2)
);

-- Table: generated_meal_plans
-- The actual plan assigned to a patient or generated for a condition.
CREATE TABLE generated_meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id), -- Optional (can be generic for a condition)
    condition_id UUID REFERENCES therapeutic_conditions(id),
    start_date DATE,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, APPROVED, REJECTED
    created_by VARCHAR(100), -- User/System
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: generated_meal_plan_items
-- The specific recipes assigned to slots in a generated plan.
CREATE TABLE generated_meal_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id UUID REFERENCES generated_meal_plans(id) ON DELETE CASCADE,
    day_number INT NOT NULL,
    meal_type VARCHAR(20) NOT NULL,
    recipe_id UUID REFERENCES recipes(id),
    portion_multiplier NUMERIC(3, 2) DEFAULT 1.0, -- Adjust for patient needs
    notes TEXT
);

-- Table: plan_validation_results
-- Audit log of clinical rule checks run against a generated plan.
CREATE TABLE plan_validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id UUID REFERENCES generated_meal_plans(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES condition_food_rules(id),
    is_violation BOOLEAN DEFAULT FALSE,
    severity VARCHAR(20),
    message TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. INDEXES & CONSTRAINTS
-- =============================================================================

CREATE INDEX idx_recipes_name ON recipes(name);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_recipe_compatibility_score ON recipe_condition_compatibility(condition_id, suitability_score);
CREATE INDEX idx_food_rules_condition ON condition_food_rules(condition_id);

-- =============================================================================
-- 6. SEED DATA (GASTRIC FOCUS)
-- =============================================================================

-- 6.1 Condition
INSERT INTO therapeutic_conditions (code, name, description, clinical_guidelines)
VALUES (
    'GASTRIC', 
    'Gastric / Peptic Ulcer Diet', 
    'Diet designed to reduce gastric acidity and irritation.',
    'Avoid gastric irritants like caffeine, alcohol, and spicy foods. Small frequent meals. Low fiber initially if symptomatic.'
);

-- 6.2 Food Rules (10+)
INSERT INTO condition_food_rules (condition_id, rule_type, category, description, severity_level)
VALUES 
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'SPICE', 'Avoid Chili Powder and Cayenne', 'HIGH'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'SPICE', 'Avoid Black Pepper', 'MODERATE'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'BEVERAGE', 'Avoid Caffeine (Coffee, Tea, Soda)', 'HIGH'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'BEVERAGE', 'Avoid Alcohol', 'ABSOLUTE'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'FRUIT', 'Avoid Citrus Fruits and Juices', 'MODERATE'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'VEGETABLE', 'Avoid Raw Onions and Garlic', 'MODERATE'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'EXCLUDE', 'MEAT', 'Avoid Fried or Fatty Meats', 'HIGH'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'ENCOURAGE', 'TEXTURE', 'Consume soft, cooked vegetables', 'MODERATE'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'ENCOURAGE', 'PROTEIN', 'Choose lean meats (Chicken, Fish)', 'HIGH'),
    ((SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 'REQUIRED', 'PREPARATION', 'Steaming, Boiling, or Baking only', 'HIGH');

-- 6.3 Ingredients (8+)
INSERT INTO ingredients (name, category) VALUES 
    ('Chicken Breast', 'Meat'),
    ('White Rice', 'Grain'),
    ('Carrot', 'Vegetable'),
    ('Potato', 'Vegetable'),
    ('Banana', 'Fruit'),
    ('Oatmeal', 'Grain'),
    ('Yogurt (Low Fat)', 'Dairy'),
    ('Ginger', 'Spice'), -- Good for digestion
    ('Chili Powder', 'Spice'); -- Bad for gastric

-- 6.4 Ingredient Nutrition (Sample)
INSERT INTO ingredient_nutrition (ingredient_id, calories_kcal, protein_g, fat_total_g)
SELECT id, 165, 31, 3.6 FROM ingredients WHERE name = 'Chicken Breast';
INSERT INTO ingredient_nutrition (ingredient_id, calories_kcal, protein_g, fat_total_g)
SELECT id, 130, 2.7, 0.3 FROM ingredients WHERE name = 'White Rice';

-- 6.5 Recipes (4+)
INSERT INTO recipes (name, description, preparation_method, portion_size_g, iddsi_level) VALUES
    ('Steamed Chicken with Carrots', 'Gentle steamed chicken breast with soft carrots.', 'Steamed', 250, 'Soft & Bite-Sized'),
    ('Rice Porridge (Congee)', 'Soft rice porridge, easy to digest.', 'Boiled', 300, 'Pureed'),
    ('Baked Potato with Yogurt', 'Plain baked potato topped with low-fat yogurt.', 'Baked', 200, 'Soft'),
    ('Oatmeal with Banana', 'Warm oatmeal with sliced ripe banana.', 'Boiled', 250, 'Soft'),
    ('Spicy Fried Chicken', 'Fried chicken with chili coating.', 'Fried', 250, 'Regular'); -- Contraindicated

-- 6.6 Recipe Clinical Profiles
-- Scoring: Acidity (0-10), Irritant (0-10), Digestibility (0-10, 10=Best)
INSERT INTO recipe_clinical_profile (recipe_id, acidity_score, irritant_score, digestibility_score, gastric_load_score)
VALUES
    ((SELECT id FROM recipes WHERE name = 'Steamed Chicken with Carrots'), 1.0, 0.0, 9.5, 1.0),
    ((SELECT id FROM recipes WHERE name = 'Rice Porridge (Congee)'), 0.5, 0.0, 10.0, 0.5),
    ((SELECT id FROM recipes WHERE name = 'Baked Potato with Yogurt'), 2.0, 0.5, 9.0, 1.5),
    ((SELECT id FROM recipes WHERE name = 'Oatmeal with Banana'), 1.0, 0.0, 9.5, 1.0),
    ((SELECT id FROM recipes WHERE name = 'Spicy Fried Chicken'), 4.0, 9.0, 3.0, 8.5);

-- 6.7 Recipe Compatibility (Gastric)
INSERT INTO recipe_condition_compatibility (recipe_id, condition_id, suitability_score, is_approved, contraindication_reason)
VALUES
    ((SELECT id FROM recipes WHERE name = 'Steamed Chicken with Carrots'), (SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 1.0, TRUE, NULL),
    ((SELECT id FROM recipes WHERE name = 'Rice Porridge (Congee)'), (SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 1.0, TRUE, NULL),
    ((SELECT id FROM recipes WHERE name = 'Baked Potato with Yogurt'), (SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 0.9, TRUE, NULL),
    ((SELECT id FROM recipes WHERE name = 'Oatmeal with Banana'), (SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 0.95, TRUE, NULL),
    ((SELECT id FROM recipes WHERE name = 'Spicy Fried Chicken'), (SELECT id FROM therapeutic_conditions WHERE code = 'GASTRIC'), 0.1, FALSE, 'Contains Chili Powder; Preparation method Fried is excluded.');

-- =============================================================================
-- 7. HELPER VIEWS & QUERIES
-- =============================================================================

-- View: v_gastric_approved_recipes
-- Lists all recipes explicitly approved for the GASTRIC condition.
CREATE OR REPLACE VIEW v_gastric_approved_recipes AS
SELECT 
    r.name AS recipe_name,
    r.preparation_method,
    rcp.digestibility_score,
    rcc.suitability_score
FROM recipes r
JOIN recipe_condition_compatibility rcc ON r.id = rcc.recipe_id
JOIN therapeutic_conditions tc ON rcc.condition_id = tc.id
JOIN recipe_clinical_profile rcp ON r.id = rcp.recipe_id
WHERE tc.code = 'GASTRIC' AND rcc.is_approved = TRUE
ORDER BY rcc.suitability_score DESC;

-- View: v_meal_plan_gastric_load
-- Calculates the average gastric load per day for generated meal plans.
CREATE OR REPLACE VIEW v_meal_plan_gastric_load AS
SELECT 
    gmp.id AS meal_plan_id,
    gmpi.day_number,
    AVG(rcp.gastric_load_score) AS avg_daily_gastric_load,
    SUM(rcp.gastric_load_score) AS total_daily_gastric_load
FROM generated_meal_plans gmp
JOIN generated_meal_plan_items gmpi ON gmp.id = gmpi.meal_plan_id
JOIN recipe_clinical_profile rcp ON gmpi.recipe_id = rcp.recipe_id
GROUP BY gmp.id, gmpi.day_number;

-- Query: Check for Rule Violations (Example Logic)
-- This query identifies meal plan items that violate 'EXCLUDE' rules for their condition.
-- (Note: This is a conceptual query pattern for the application backend)
/*
SELECT 
    gmp.id AS plan_id,
    r.name AS recipe_name,
    cfr.description AS violated_rule
FROM generated_meal_plans gmp
JOIN generated_meal_plan_items gmpi ON gmp.id = gmpi.meal_plan_id
JOIN recipes r ON gmpi.recipe_id = r.id
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
JOIN ingredient_tags it ON i.id = it.ingredient_id
JOIN condition_food_rules cfr ON gmp.condition_id = cfr.condition_id
WHERE 
    cfr.rule_type = 'EXCLUDE' 
    AND (
        (cfr.category = 'SPICE' AND it.tag = 'SPICY') OR
        (cfr.category = 'PREPARATION' AND r.preparation_method = 'Fried')
    );
*/

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
