// ─────────────────────────────────────────────────────────────────────────────
// services/clinicalDatabase.ts
//
// MODIFICATION LOG:
//   PRESERVED : SlotDefinition, ClinicalConditionRule, CLINICAL_CONDITIONS
//   PRESERVED : getClinicalRules() — deprecated, kept for backward compat
//               validationService.ts and claudeService.ts import this directly
//   INJECTED  : MISSING_PROTOCOL_FALLBACKS — H_PYLORI, HEPATIC, HTN, PEPTIC_ULCER
//   INJECTED  : getDiagnosisProtocolCode()
//   INJECTED  : getClinicalRulesFromDiagnosis()
//   INJECTED  : getSchemaEnrichedCondition() + EnrichedClinicalRule
// ─────────────────────────────────────────────────────────────────────────────

import {
  DiagnosisType,
  DIAGNOSIS_TO_PROTOCOL_CODE,
  type ProtocolCode,
  type ProtocolConfig,
} from '../types';
import { getProtocolConfig } from './protocolAdapter';

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING CODE — PRESERVED EXACTLY
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotDefinition {
  name: string;
  allowed_categories: string[];
  portion_guideline: string;
}

export interface ClinicalConditionRule {
  allowed_proteins: string[];
  allowed_starches: string[];
  allowed_vegetables: string[];
  allowed_fruits: string[];
  forbidden_tags: string[];
  cooking_methods: string[];
  portion_rules: {
    protein: string;
    starch: string;
    veg: string;
    fruit: string;
  };
  therapeutic_goal: string;
  fluid_requirement: string;
  slots: {
    breakfast: SlotDefinition[];
    lunch: SlotDefinition[];
    dinner: SlotDefinition[];
  };
  operational_standards: {
    hot_holding: string;
    cold_holding: string;
    service_temp: string;
  };
}

export const CLINICAL_CONDITIONS: Record<string, ClinicalConditionRule> = {
  "GASTRIC": {
    allowed_proteins: ["Chicken Breast (Skinless)", "White Fish (Cod, Tilapia, Haddock)", "Tofu (Silken or Firm)", "Eggs (Poached, Boiled, Scrambled)", "Turkey Breast (Lean)"],
    allowed_starches: ["White Rice (Jasmine, Basmati)", "Rice Porridge (Congee)", "Mashed Potato (No Skin)", "White Bread (Crustless)", "Oatmeal (Instant/Well-cooked)", "Rice Noodles"],
    allowed_vegetables: ["Carrots (Steamed/Boiled)", "Pumpkin (Mashed)", "Zucchini (Peeled & Steamed)", "Spinach (Boiled & Chopped)", "Green Beans (Well-cooked)"],
    allowed_fruits: ["Banana (Ripe)", "Papaya (Ripe)", "Melon (Honeydew/Cantaloupe)", "Applesauce (Unsweetened)", "Canned Peaches (in Juice)"],
    forbidden_tags: ["Spicy", "Fried", "Acidic", "High Fiber", "Caffeine", "Raw Vegetables", "Whole Grains", "Citrus", "Tomato-based", "Carbonated"],
    cooking_methods: ["Steaming", "Boiling", "Poaching", "Baking (Covered)", "Stewing"],
    portion_rules: { protein: "90g - 120g", starch: "150g - 200g", veg: "80g - 100g", fruit: "100g - 120g" },
    therapeutic_goal: "Minimize gastric acid secretion, reduce mucosal irritation, and facilitate easy digestion.",
    fluid_requirement: "Small sips between meals, avoid large volumes with food.",
    slots: {
      breakfast: [
        { name: "Base Carbohydrate", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "60g" },
        { name: "Dairy/Substitute", allowed_categories: ["Dairy", "Beverage"], portion_guideline: "100ml" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      lunch: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Soup/Broth", allowed_categories: ["Soup"], portion_guideline: "150ml" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      dinner: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Fruit/Dessert", allowed_categories: ["Fruit"], portion_guideline: "100g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "RENAL": {
    allowed_proteins: ["Egg Whites", "Chicken (limited portion)", "Fish (limited portion)", "Tofu"],
    allowed_starches: ["White Rice", "White Bread", "Pasta (White)", "Couscous"],
    allowed_vegetables: ["Cauliflower", "Onions", "Peppers", "Green Beans", "Cabbage"],
    allowed_fruits: ["Apples", "Berries", "Grapes", "Pineapple"],
    forbidden_tags: ["High Potassium", "High Phosphorus", "High Sodium", "Whole Grains", "Dairy", "Nuts", "Chocolate", "Avocado", "Banana", "Potato", "Tomato"],
    cooking_methods: ["Leaching (for vegetables)", "Boiling", "Roasting"],
    portion_rules: { protein: "60g - 90g (Strict Control)", starch: "150g", veg: "60g (Leached)", fruit: "80g" },
    therapeutic_goal: "Control accumulation of waste products (Urea, Potassium, Phosphorus) and manage fluid balance.",
    fluid_requirement: "Strictly limited (typically 1000ml - 1500ml/day including food moisture).",
    slots: {
      breakfast: [
        { name: "Low-Phos Starch", allowed_categories: ["Starch"], portion_guideline: "1 slice/150g" },
        { name: "High Bio-val Protein", allowed_categories: ["Protein"], portion_guideline: "60g" },
        { name: "Low-K Fruit", allowed_categories: ["Fruit"], portion_guideline: "80g" },
        { name: "Fluid (Restricted)", allowed_categories: ["Beverage"], portion_guideline: "120ml" }
      ],
      lunch: [
        { name: "Low-Phos Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein (Controlled)", allowed_categories: ["Protein"], portion_guideline: "60g" },
        { name: "Leached Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "60g" },
        { name: "Fluid (Restricted)", allowed_categories: ["Beverage"], portion_guideline: "120ml" }
      ],
      dinner: [
        { name: "Low-Phos Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein (Controlled)", allowed_categories: ["Protein"], portion_guideline: "60g" },
        { name: "Leached Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "60g" },
        { name: "Fluid (Restricted)", allowed_categories: ["Beverage"], portion_guideline: "120ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "DIABETIC": {
    allowed_proteins: ["Salmon (Omega-3)", "Chicken Breast", "Turkey", "Lean Beef", "Lentils", "Beans", "Eggs"],
    allowed_starches: ["Quinoa", "Brown Rice", "Sweet Potato (with Skin)", "Whole Grain Bread", "Barley"],
    allowed_vegetables: ["Broccoli", "Leafy Greens", "Asparagus", "Cauliflower", "Brussels Sprouts", "Peppers"],
    allowed_fruits: ["Berries", "Apples (with Skin)", "Pears", "Citrus", "Kiwi"],
    forbidden_tags: ["Added Sugar", "Refined Carbs", "High GI", "Sweetened Beverages", "Trans Fats"],
    cooking_methods: ["Grilling", "Roasting", "Steaming", "Sautéing (Minimal Oil)"],
    portion_rules: { protein: "100g - 150g", starch: "120g (Controlled Carb)", veg: "150g+ (Encouraged)", fruit: "100g" },
    therapeutic_goal: "Maintain stable blood glucose levels through controlled carbohydrate intake and high fiber.",
    fluid_requirement: "Encourage water intake, zero-calorie beverages.",
    slots: {
      breakfast: [
        { name: "High Fiber Carb", allowed_categories: ["Starch"], portion_guideline: "120g" },
        { name: "Lean Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Vegetable/Fiber", allowed_categories: ["Vegetable"], portion_guideline: "100g" },
        { name: "Zero-Cal Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      lunch: [
        { name: "Complex Carb", allowed_categories: ["Starch"], portion_guideline: "120g" },
        { name: "Lean Protein", allowed_categories: ["Protein"], portion_guideline: "120g" },
        { name: "Non-Starchy Veg", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Zero-Cal Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      dinner: [
        { name: "Complex Carb", allowed_categories: ["Starch"], portion_guideline: "120g" },
        { name: "Lean Protein", allowed_categories: ["Protein"], portion_guideline: "120g" },
        { name: "Non-Starchy Veg", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Zero-Cal Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "CARDIAC": {
    allowed_proteins: ["Fatty Fish (Salmon, Mackerel)", "Skinless Poultry", "Legumes", "Nuts (Unsalted)", "Tofu"],
    allowed_starches: ["Oats", "Whole Grains", "Brown Rice", "Quinoa"],
    allowed_vegetables: ["Leafy Greens", "Cruciferous Vegetables", "Carrots", "Tomatoes"],
    allowed_fruits: ["Berries", "Citrus", "Avocado", "Apples"],
    forbidden_tags: ["Saturated Fat", "Trans Fat", "High Sodium", "Processed Meats", "Full-fat Dairy"],
    cooking_methods: ["Grilling", "Poaching", "Steaming", "Baking"],
    portion_rules: { protein: "100g - 120g", starch: "150g", veg: "150g+", fruit: "120g" },
    therapeutic_goal: "Reduce LDL cholesterol and manage blood pressure via low sodium and low saturated fat.",
    fluid_requirement: "Standard hydration, monitor if CHF present.",
    slots: {
      breakfast: [
        { name: "Soluble Fiber Carb", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Lean Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Fruit", allowed_categories: ["Fruit"], portion_guideline: "120g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      lunch: [
        { name: "Whole Grain", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Lean/Omega-3 Protein", allowed_categories: ["Protein"], portion_guideline: "100g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      dinner: [
        { name: "Whole Grain", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Lean/Omega-3 Protein", allowed_categories: ["Protein"], portion_guideline: "100g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Fruit", allowed_categories: ["Fruit"], portion_guideline: "120g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "DYSPHAGIA": {
    allowed_proteins: ["Pureed Meat", "Hummus", "Smooth Nut Butters", "Soufflé"],
    allowed_starches: ["Mashed Potato", "Polenta", "Pureed Pasta"],
    allowed_vegetables: ["Pureed Carrots", "Pureed Peas", "Pureed Squash"],
    allowed_fruits: ["Applesauce", "Mashed Banana", "Pureed Peaches"],
    forbidden_tags: ["Hard", "Crunchy", "Stringy", "Mixed Textures", "Thin Liquids (unless thickened)"],
    cooking_methods: ["Boiling then Pureeing", "Blending", "Mashing"],
    portion_rules: { protein: "Same nutrient density, modified texture", starch: "Modified texture", veg: "Modified texture", fruit: "Modified texture" },
    therapeutic_goal: "Prevent aspiration and ensure safe swallowing via texture modification (IDDSI Levels).",
    fluid_requirement: "Thickened liquids as prescribed (Nectar/Honey/Pudding thick).",
    slots: {
      breakfast: [
        { name: "Texture-Mod Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Texture-Mod Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Thickened Fluid", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      lunch: [
        { name: "Texture-Mod Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Texture-Mod Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Texture-Mod Veg", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Thickened Fluid", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      dinner: [
        { name: "Texture-Mod Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Texture-Mod Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Texture-Mod Veg", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Thickened Fluid", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "GENERAL": {
    allowed_proteins: ["Chicken", "Beef", "Fish", "Pork", "Eggs", "Beans", "Tofu"],
    allowed_starches: ["Rice", "Potatoes", "Pasta", "Bread", "Grains"],
    allowed_vegetables: ["All Vegetables"],
    allowed_fruits: ["All Fruits"],
    forbidden_tags: ["None (unless specific allergy)"],
    cooking_methods: ["All standard methods"],
    portion_rules: { protein: "100g - 150g", starch: "150g - 200g", veg: "100g - 150g", fruit: "100g - 150g" },
    therapeutic_goal: "Maintain balanced nutrition and general well-being.",
    fluid_requirement: "Standard 8 glasses/day.",
    slots: {
      breakfast: [
        { name: "Carbohydrate", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Fruit/Dairy", allowed_categories: ["Fruit", "Dairy"], portion_guideline: "100g" },
        { name: "Beverage", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      lunch: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "120g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Beverage", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      dinner: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "120g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Dessert/Fruit", allowed_categories: ["Fruit"], portion_guideline: "100g" },
        { name: "Beverage", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  }
};

/**
 * @deprecated Use getClinicalRulesFromDiagnosis(DiagnosisType) instead.
 * Preserved for backward compatibility — claudeService.ts and
 * validationService.ts call this function directly. Do not remove.
 *
 * Known issues (do not fix here):
 * - "PEPTIC ULCER" matches "ULCER" → returns GASTRIC (imprecise)
 * - "H. PYLORI", "HEPATIC" have no match → fall through to GENERAL (incorrect)
 */
export const getClinicalRules = (diagnosis: string): ClinicalConditionRule => {
  const normalized = diagnosis.toUpperCase();
  if (normalized.includes("GASTRIC") || normalized.includes("ULCER") || normalized.includes("GERD")) return CLINICAL_CONDITIONS["GASTRIC"];
  if (normalized.includes("RENAL") || normalized.includes("KIDNEY")) return CLINICAL_CONDITIONS["RENAL"];
  if (normalized.includes("DIABETIC") || normalized.includes("SUGAR")) return CLINICAL_CONDITIONS["DIABETIC"];
  if (normalized.includes("CARDIAC") || normalized.includes("HEART") || normalized.includes("CHOLESTEROL") || normalized.includes("HYPERTENSION")) return CLINICAL_CONDITIONS["CARDIAC"];
  if (normalized.includes("DYSPHAGIA") || normalized.includes("SWALLOW")) return CLINICAL_CONDITIONS["DYSPHAGIA"];
  return CLINICAL_CONDITIONS["GENERAL"];
};

// ─────────────────────────────────────────────────────────────────────────────
// INJECTED: FALLBACK RULES FOR SCHEMA-ONLY PROTOCOLS
// H_PYLORI, HEPATIC, HTN, PEPTIC_ULCER are in the schema but absent from
// CLINICAL_CONDITIONS. Not added to CLINICAL_CONDITIONS to avoid breaking
// any code that iterates over that object.
// ─────────────────────────────────────────────────────────────────────────────

const MISSING_PROTOCOL_FALLBACKS: Record<string, ClinicalConditionRule> = {
  "H_PYLORI": {
    allowed_proteins: ["Poached Chicken", "White Fish (Steamed)", "Tofu (Silken)", "Eggs (Boiled)"],
    allowed_starches: ["Plain Oat Porridge", "Arrowroot (Boiled)", "Sweet Potato (Plain Mash)", "Pumpkin Mash"],
    allowed_vegetables: ["Cauliflower (Steamed)", "Zucchini (Peeled, Steamed)", "Carrots (Boiled)"],
    allowed_fruits: ["Banana (Ripe)", "Papaya (Ripe)", "Melon"],
    forbidden_tags: ["Acidic", "Spicy", "Fried", "Carbonated", "Caffeine", "Citrus", "Tomato-based"],
    cooking_methods: ["Steaming", "Boiling", "Poaching"],
    portion_rules: { protein: "90g - 120g", starch: "150g", veg: "80g", fruit: "100g" },
    therapeutic_goal: "Reduce gastric mucosal irritation. Support H. pylori eradication therapy with gut-safe, low-irritation foods.",
    fluid_requirement: "Water between meals. Avoid drinking large volumes with food.",
    slots: {
      breakfast: [
        { name: "Soft Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Soft Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      lunch: [
        { name: "Soft Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Soft Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Soft Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      dinner: [
        { name: "Soft Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Soft Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Soft Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "HEPATIC": {
    allowed_proteins: ["White Fish (Steamed)", "Chicken Breast (Skinless)", "Tofu", "Turkey (Lean)"],
    allowed_starches: ["Brown Rice", "Oats", "Quinoa", "Sweet Potato"],
    allowed_vegetables: ["Broccoli", "Leafy Greens", "Carrots", "Cauliflower"],
    allowed_fruits: ["Apples", "Berries", "Papaya", "Pears"],
    forbidden_tags: ["Processed Meats", "High Fat", "Alcohol", "Fruit Juice (Concentrated)", "Added Sugar"],
    cooking_methods: ["Steaming", "Baking", "Boiling", "Poaching"],
    portion_rules: { protein: "90g - 120g", starch: "150g", veg: "120g", fruit: "100g" },
    therapeutic_goal: "Support hepatic function. Prioritise fresh lean protein. Avoid hepatotoxic food patterns.",
    fluid_requirement: "Standard hydration. Monitor for ascites if indicated.",
    slots: {
      breakfast: [
        { name: "Gentle Carb", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Lean Protein (Optional)", allowed_categories: ["Protein"], portion_guideline: "80g" },
        { name: "Whole Fruit (Optional)", allowed_categories: ["Fruit"], portion_guideline: "100g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      lunch: [
        { name: "Gentle Carb", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Fresh Lean Protein", allowed_categories: ["Protein"], portion_guideline: "100g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "120g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      dinner: [
        { name: "Gentle Carb", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Fresh Lean Protein", allowed_categories: ["Protein"], portion_guideline: "100g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "120g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "HTN": {
    allowed_proteins: ["White Fish (Low Sodium)", "Chicken Breast (Unseasoned)", "Lentils", "Tofu", "Eggs"],
    allowed_starches: ["Brown Rice", "Oats", "Quinoa", "Barley", "Sweet Potato"],
    allowed_vegetables: ["Leafy Greens", "Broccoli", "Carrots", "Cauliflower", "Cucumber"],
    allowed_fruits: ["Bananas", "Berries", "Apples", "Oranges"],
    forbidden_tags: ["High Sodium", "Processed Meats", "Canned Foods (High Salt)", "Pickled", "Added Salt"],
    cooking_methods: ["Steaming", "Baking", "Grilling (No Salt)", "Boiling"],
    portion_rules: { protein: "100g - 120g", starch: "150g", veg: "150g+", fruit: "120g" },
    therapeutic_goal: "Reduce systemic blood pressure through strict sodium restriction (<1500mg/day). DASH-aligned.",
    fluid_requirement: "Standard hydration. Unsalted water only.",
    slots: {
      breakfast: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Fruit (Optional)", allowed_categories: ["Fruit"], portion_guideline: "120g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      lunch: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Lean Protein", allowed_categories: ["Protein"], portion_guideline: "100g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ],
      dinner: [
        { name: "Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Lean Protein", allowed_categories: ["Protein"], portion_guideline: "100g" },
        { name: "Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "150g" },
        { name: "Fluid", allowed_categories: ["Beverage"], portion_guideline: "200ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  },
  "PEPTIC_ULCER": {
    allowed_proteins: ["Poached Chicken", "White Fish (Steamed)", "Tofu (Soft)", "Eggs (Boiled/Poached)"],
    allowed_starches: ["Plain Oat Porridge", "White Rice", "Arrowroot (Boiled)", "Mashed Potato (No Skin)"],
    allowed_vegetables: ["Cauliflower (Steamed)", "Carrots (Boiled)", "Pumpkin (Mashed)", "Green Beans (Well-cooked)"],
    allowed_fruits: ["Banana (Ripe)", "Papaya", "Melon", "Applesauce (Unsweetened)"],
    forbidden_tags: ["Acidic", "Spicy", "Fried", "Caffeine", "Carbonated", "Citrus", "Tomato-based", "NSAIDs", "Alcohol"],
    cooking_methods: ["Steaming", "Boiling", "Poaching", "Baking (Covered)"],
    portion_rules: { protein: "90g - 120g", starch: "150g", veg: "80g", fruit: "100g" },
    therapeutic_goal: "Protect gastric and duodenal mucosa. Reduce acid burden. Support ulcer healing.",
    fluid_requirement: "Water between meals. Small frequent intake. Avoid large boluses.",
    slots: {
      breakfast: [
        { name: "Soft Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Soft Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      lunch: [
        { name: "Soft Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Soft Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Soft Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ],
      dinner: [
        { name: "Soft Starch", allowed_categories: ["Starch"], portion_guideline: "150g" },
        { name: "Soft Protein", allowed_categories: ["Protein"], portion_guideline: "90g" },
        { name: "Soft Vegetable", allowed_categories: ["Vegetable"], portion_guideline: "80g" },
        { name: "Hydration", allowed_categories: ["Beverage"], portion_guideline: "150ml" }
      ]
    },
    operational_standards: { hot_holding: ">= 63°C", cold_holding: "<= 5°C", service_temp: ">= 60°C" }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INJECTED: DETERMINISTIC ROUTING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Maps DiagnosisType to ProtocolCode. Zero string matching. Pure lookup. */
export function getDiagnosisProtocolCode(diagnosis: DiagnosisType): ProtocolCode | null {
  return DIAGNOSIS_TO_PROTOCOL_CODE[diagnosis] ?? null;
}

/**
 * Typed replacement for getClinicalRules().
 * Accepts DiagnosisType — TypeScript enforces correctness at the call site.
 * No string guessing. GENERAL returned only when genuinely nothing matches.
 */
export function getClinicalRulesFromDiagnosis(diagnosis: DiagnosisType): ClinicalConditionRule {
  const DIRECT_MAP: Partial<Record<DiagnosisType, string>> = {
    [DiagnosisType.GASTRIC]:   "GASTRIC",
    [DiagnosisType.RENAL]:     "RENAL",
    [DiagnosisType.DIABETIC]:  "DIABETIC",
    [DiagnosisType.CARDIAC]:   "CARDIAC",
    [DiagnosisType.DYSPHAGIA]: "DYSPHAGIA",
  };

  const FALLBACK_MAP: Partial<Record<DiagnosisType, string>> = {
    [DiagnosisType.H_PYLORI]:  "H_PYLORI",
    [DiagnosisType.HEPATIC]:   "HEPATIC",
    [DiagnosisType.SALT_FREE]: "HTN",
    [DiagnosisType.ULCER]:     "PEPTIC_ULCER",
  };

  const directKey = DIRECT_MAP[diagnosis];
  if (directKey && CLINICAL_CONDITIONS[directKey]) return CLINICAL_CONDITIONS[directKey];

  const fallbackKey = FALLBACK_MAP[diagnosis];
  if (fallbackKey && MISSING_PROTOCOL_FALLBACKS[fallbackKey]) return MISSING_PROTOCOL_FALLBACKS[fallbackKey];

  return CLINICAL_CONDITIONS["GENERAL"];
}

/**
 * Primary function for the enriched pipeline.
 * Returns the legacy ClinicalConditionRule (for existing generator + PDF)
 * AND the ProtocolConfig from the schema (for nutrient targets + safety checks).
 * schemaConfig is null for unmapped diagnoses — pipeline degrades gracefully.
 */
export interface EnrichedClinicalRule {
  legacyRule: ClinicalConditionRule;
  schemaConfig: ProtocolConfig | null;
  protocolCode: ProtocolCode | null;
}

export function getSchemaEnrichedCondition(diagnosis: DiagnosisType): EnrichedClinicalRule {
  const legacyRule = getClinicalRulesFromDiagnosis(diagnosis);
  const protocolCode = getDiagnosisProtocolCode(diagnosis);

  let schemaConfig: ProtocolConfig | null = null;
  if (protocolCode !== null) {
    try {
      schemaConfig = getProtocolConfig(protocolCode);
    } catch {
      console.error(
        `[clinicalDatabase] getProtocolConfig('${protocolCode}') failed for '${diagnosis}'. ` +
        `Falling back to legacy rule only.`
      );
    }
  }

  return { legacyRule, schemaConfig, protocolCode };
}
