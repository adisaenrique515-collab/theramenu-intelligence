# Weekly Plan Generator Query Strategy

The weekly plan generator should follow a multi-step process to query the database effectively:

1.  **Retrieve Patient & Condition Context**:
    *   Query `patients` to get the `primary_diagnosis_id` and `secondary_diagnoses`.
    *   Join with `therapeutic_conditions` to understand the core medical constraints (e.g., 'GASTRIC').

2.  **Fetch Clinical Rules**:
    *   Query `condition_food_rules` for the active condition(s).
    *   Categorize rules into `EXCLUDE` (hard filters), `LIMIT` (soft constraints), and `ENCOURAGE` (prioritization weights).

3.  **Filter Candidate Recipes**:
    *   **Primary Filter**: Query `recipe_condition_compatibility` where `condition_id` matches and `is_approved = TRUE`.
    *   **Secondary Filter (Dynamic)**: If pre-computed compatibility is missing, query `recipes` joined with `recipe_ingredients` and `ingredient_tags`. Exclude recipes containing ingredients tagged with `EXCLUDE` rules (e.g., 'SPICY' for Gastric).

4.  **Score & Rank Candidates**:
    *   Use `recipe_clinical_profile` to score remaining recipes.
    *   Prioritize recipes with high `digestibility_score` and low `irritant_score` for Gastric patients.
    *   Apply `ENCOURAGE` rules to boost the score of matching recipes (e.g., "Steamed" preparation).

5.  **Assemble the Plan**:
    *   Select recipes to fill the 7-day slots defined in `meal_plan_templates`.
    *   Ensure variety by checking `recipe_ingredients` to avoid repeating main ingredients too frequently.

6.  **Validate the Plan**:
    *   Run a final pass using the logic in `v_meal_plan_gastric_load` to ensure daily limits (e.g., total gastric load) are not exceeded.
    *   Insert the final plan into `generated_meal_plans` and `generated_meal_plan_items`.
    *   Log any warnings or soft-rule breaches in `plan_validation_results`.
