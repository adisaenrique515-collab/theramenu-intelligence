// ─────────────────────────────────────────────────────────────────────────────
// config/therapeuticSchema.ts  — NEW FILE
// Location: config/therapeuticSchema.ts
//
// STATIC CONFIGURATION DATA ONLY.
// No logic. No calculations. No AI calls.
// All schema tables as typed, readonly constants.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ClinicalProtocol,
  ProtocolRuleTargets,
  ProtocolFoodRule,
  ProtocolComponentSlot,
  ProtocolSlotCandidate,
  ProtocolServiceRule,
  SchemaFoodItem,
  SchemaMealType,
} from '../types.ts';
import { USDA_FOUNDATION_FOODS, LOCAL_EQUIVALENT_ALIASES } from './usdaFoundationFoods.generated.ts';

// ── clinical_protocols ───────────────────────────────────────────────────────

export const CLINICAL_PROTOCOLS: readonly ClinicalProtocol[] = [
  { protocol_code: "GENERAL_HOSPITAL", protocol_name: "General Hospital Baseline",       family: "general",        default_texture: "regular", default_meal_count: 6, active: true },
  { protocol_code: "T2DM",             protocol_name: "Type 2 Diabetes Glycemic Control", family: "endocrine",      default_texture: "regular", default_meal_count: 6, active: true },
  { protocol_code: "HTN",              protocol_name: "Hypertension Sodium Control",      family: "cardiovascular", default_texture: "regular", default_meal_count: 6, active: true },
  { protocol_code: "CARDIAC",          protocol_name: "Cardiac Protection",               family: "cardiovascular", default_texture: "regular", default_meal_count: 6, active: true },
  { protocol_code: "RENAL_STAGE_3",    protocol_name: "Renal Stage 3 Protection",         family: "renal",          default_texture: "regular", default_meal_count: 6, active: true },
  { protocol_code: "RENAL_STAGE_4",    protocol_name: "Renal Stage 4 Protection",         family: "renal",          default_texture: "regular", default_meal_count: 6, active: true },
  { protocol_code: "H_PYLORI",         protocol_name: "H. Pylori Gastric Protection",     family: "gastric",        default_texture: "soft",    default_meal_count: 6, active: true },
  { protocol_code: "GASTRIC",          protocol_name: "Gastric Sensitivity Protection",   family: "gastric",        default_texture: "soft",    default_meal_count: 6, active: true },
  { protocol_code: "PEPTIC_ULCER",     protocol_name: "Peptic Ulcer Protection",          family: "gastric",        default_texture: "soft",    default_meal_count: 6, active: true },
  { protocol_code: "HEPATIC",          protocol_name: "Hepatic Support Baseline",         family: "hepatic",        default_texture: "regular", default_meal_count: 6, active: true },
] as const;

// ── protocol_rule_targets ────────────────────────────────────────────────────

export const PROTOCOL_RULE_TARGETS: readonly ProtocolRuleTargets[] = [
  { protocol_code: "GENERAL_HOSPITAL", energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.45, carb_pct_max: 0.55, fat_pct_min: 0.25, fat_pct_max: 0.35, fiber_min_g: 25, sodium_max_mg: 2000, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: null, gi_max: 60, fluid_target_ml: "weightKg*30" },
  { protocol_code: "T2DM",             energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.35, carb_pct_max: 0.45, fat_pct_min: 0.30, fat_pct_max: 0.35, fiber_min_g: 30, sodium_max_mg: 1800, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: 30,   gi_max: 55, fluid_target_ml: "weightKg*30" },
  { protocol_code: "HTN",              energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.40, carb_pct_max: 0.50, fat_pct_min: 0.28, fat_pct_max: 0.35, fiber_min_g: 30, sodium_max_mg: 1500, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: null, gi_max: 60, fluid_target_ml: "weightKg*30" },
  { protocol_code: "CARDIAC",          energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.40, carb_pct_max: 0.50, fat_pct_min: 0.28, fat_pct_max: 0.33, fiber_min_g: 30, sodium_max_mg: 1500, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: null, gi_max: 60, fluid_target_ml: "weightKg*30" },
  { protocol_code: "RENAL_STAGE_3",    energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 0.8, carb_pct_min: 0.45, carb_pct_max: 0.55, fat_pct_min: 0.28, fat_pct_max: 0.35, fiber_min_g: 22, sodium_max_mg: 1500, potassium_max_mg: 2000, phosphorus_max_mg: 1000, sugar_max_g: null, gi_max: 60, fluid_target_ml: "1800" },
  { protocol_code: "RENAL_STAGE_4",    energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 0.6, carb_pct_min: 0.48, carb_pct_max: 0.56, fat_pct_min: 0.28, fat_pct_max: 0.35, fiber_min_g: 20, sodium_max_mg: 1500, potassium_max_mg: 1800, phosphorus_max_mg: 800,  sugar_max_g: null, gi_max: 60, fluid_target_ml: "1500" },
  { protocol_code: "H_PYLORI",         energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.45, carb_pct_max: 0.55, fat_pct_min: 0.20, fat_pct_max: 0.30, fiber_min_g: 20, sodium_max_mg: 1800, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: 35,   gi_max: 60, fluid_target_ml: "weightKg*30" },
  { protocol_code: "GASTRIC",          energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.45, carb_pct_max: 0.55, fat_pct_min: 0.20, fat_pct_max: 0.30, fiber_min_g: 20, sodium_max_mg: 1800, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: 35,   gi_max: 60, fluid_target_ml: "weightKg*30" },
  { protocol_code: "PEPTIC_ULCER",     energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.45, carb_pct_max: 0.55, fat_pct_min: 0.20, fat_pct_max: 0.30, fiber_min_g: 20, sodium_max_mg: 1800, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: 35,   gi_max: 60, fluid_target_ml: "weightKg*30" },
  { protocol_code: "HEPATIC",          energy_formula: "BMR*activity*stress", protein_g_per_kg_min: 1.0, carb_pct_min: 0.45, carb_pct_max: 0.55, fat_pct_min: 0.25, fat_pct_max: 0.32, fiber_min_g: 25, sodium_max_mg: 1800, potassium_max_mg: null, phosphorus_max_mg: null, sugar_max_g: 35,   gi_max: 60, fluid_target_ml: "weightKg*30" },
] as const;

// ── protocol_food_rules ──────────────────────────────────────────────────────

export const PROTOCOL_FOOD_RULES: readonly ProtocolFoodRule[] = [
  { protocol_code: "T2DM",          rule_type: "prefer", food_tag: "low_gi",            priority: 10, note: "Prefer low glycemic carbohydrate sources" },
  { protocol_code: "T2DM",          rule_type: "prefer", food_tag: "high_fiber",         priority: 9,  note: "Improve postprandial control" },
  { protocol_code: "T2DM",          rule_type: "avoid",  food_tag: "refined_sugar",      priority: 10, note: "Avoid concentrated sugar load" },
  { protocol_code: "HTN",           rule_type: "avoid",  food_tag: "high_sodium",        priority: 10, note: "Restrict sodium exposure" },
  { protocol_code: "CARDIAC",       rule_type: "avoid",  food_tag: "high_saturated_fat", priority: 10, note: "Reduce saturated fat exposure" },
  { protocol_code: "CARDIAC",       rule_type: "avoid",  food_tag: "processed_meat",     priority: 9,  note: "Penalty for processed meat" },
  { protocol_code: "RENAL_STAGE_3", rule_type: "avoid",  food_tag: "high_potassium",     priority: 10, note: "Reduce potassium burden" },
  { protocol_code: "RENAL_STAGE_3", rule_type: "avoid",  food_tag: "high_phosphorus",    priority: 10, note: "Reduce phosphorus burden" },
  { protocol_code: "RENAL_STAGE_4", rule_type: "avoid",  food_tag: "high_potassium",     priority: 10, note: "Tighter potassium limit" },
  { protocol_code: "RENAL_STAGE_4", rule_type: "avoid",  food_tag: "high_phosphorus",    priority: 10, note: "Tighter phosphorus limit" },
  { protocol_code: "H_PYLORI",      rule_type: "prefer", food_tag: "gut_safe",           priority: 10, note: "Low-irritation gastric-safe foods" },
  { protocol_code: "H_PYLORI",      rule_type: "prefer", food_tag: "soft_texture",       priority: 9,  note: "Easy gastric tolerance" },
  { protocol_code: "H_PYLORI",      rule_type: "avoid",  food_tag: "acidic",             priority: 10, note: "Avoid gastric irritation" },
  { protocol_code: "H_PYLORI",      rule_type: "avoid",  food_tag: "spicy",              priority: 10, note: "Avoid gastric irritation" },
  { protocol_code: "H_PYLORI",      rule_type: "avoid",  food_tag: "fried",              priority: 9,  note: "Reduce gastric load" },
  { protocol_code: "GASTRIC",       rule_type: "prefer", food_tag: "gut_safe",           priority: 10, note: "Low-irritation gastric-safe foods" },
  { protocol_code: "PEPTIC_ULCER",  rule_type: "prefer", food_tag: "gut_safe",           priority: 10, note: "Low-irritation ulcer-safe foods" },
  { protocol_code: "HEPATIC",       rule_type: "prefer", food_tag: "hepatic_safe",       priority: 10, note: "Fresh lean proteins and moderate fat" },
  { protocol_code: "HEPATIC",       rule_type: "avoid",  food_tag: "processed_meat",     priority: 9,  note: "Avoid processed meats" },
  { protocol_code: "HEPATIC",       rule_type: "avoid",  food_tag: "fruit_juice",        priority: 7,  note: "Prefer whole fruit over juice" },
] as const;

// ── protocol_service_rules ───────────────────────────────────────────────────

export const PROTOCOL_SERVICE_RULES: readonly ProtocolServiceRule[] = [
  { protocol_code: "GENERAL_HOSPITAL", rule_name: "beverage_policy", rule_value: "water_or_unsweetened_tea_allowed",  note: "Default institutional hydration" },
  { protocol_code: "H_PYLORI",         rule_name: "beverage_policy", rule_value: "water_between_meals",              note: "Render hydration note instead of blank beverage fields" },
  { protocol_code: "H_PYLORI",         rule_name: "prep_method",     rule_value: "steamed_boiled_poached",           note: "Avoid frying/charring" },
  { protocol_code: "HEPATIC",          rule_name: "protein_ranking", rule_value: "fresh_lean_protein_first",         note: "Prefer fish/chicken/turkey/tofu over processed meats" },
  { protocol_code: "CARDIAC",          rule_name: "prep_method",     rule_value: "baked_steamed_roasted_low_fat",    note: "Cardioprotective preparation" },
  { protocol_code: "RENAL_STAGE_4",    rule_name: "fluid_policy",    rule_value: "strict_fluid_cap_if_indicated",    note: "Apply when patient-specific fluid restrictions exist" },
] as const;

// ── foods ────────────────────────────────────────────────────────────────────

const CURATED_LOCAL_FOODS: readonly SchemaFoodItem[] = [
  { food_id: "rolled_oats",             name: "Rolled Oats",                    category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["whole_grain","low_gi","high_fiber"],                   kcal_per_100: 389, protein_g_per_100: 16.9, carbs_g_per_100: 66.3, fat_g_per_100: 6.9, sodium_mg_per_100: 2 },
  { food_id: "brown_rice_cooked",       name: "Brown Rice Cooked",              category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["whole_grain","low_gi"],                                kcal_per_100: 123, protein_g_per_100: 2.7,  carbs_g_per_100: 25.6, fat_g_per_100: 1.0, sodium_mg_per_100: 4 },
  { food_id: "quinoa_cooked",           name: "Quinoa Cooked",                  category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["whole_grain","low_gi"],                                kcal_per_100: 120, protein_g_per_100: 4.4,  carbs_g_per_100: 21.3, fat_g_per_100: 1.9, sodium_mg_per_100: 7 },
  { food_id: "barley_cooked",           name: "Barley Cooked",                  category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["whole_grain","high_fiber","low_gi"],                   kcal_per_100: 123, protein_g_per_100: 2.3,  carbs_g_per_100: 28.2, fat_g_per_100: 0.4, sodium_mg_per_100: 3 },
  { food_id: "bulgur_cooked",          name: "Bulgur Wheat Cooked",            category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["whole_grain","high_fiber","low_gi"],                   kcal_per_100: 83,  protein_g_per_100: 3.1,  carbs_g_per_100: 18.6, fat_g_per_100: 0.2, sodium_mg_per_100: 5,  potassium_mg_per_100: 68,  phosphorus_mg_per_100: 40,  fiber_g_per_100: 4.5, gi: 46 },
  { food_id: "millet_cooked",          name: "Millet Cooked",                  category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["whole_grain","high_fiber","low_gi"],                   kcal_per_100: 119, protein_g_per_100: 3.5,  carbs_g_per_100: 23.7, fat_g_per_100: 1.0, sodium_mg_per_100: 2,  potassium_mg_per_100: 62,  phosphorus_mg_per_100: 100, fiber_g_per_100: 1.3, gi: 54 },
  { food_id: "white_rice_cooked",      name: "White Rice Cooked",              category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["renal_safe","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 130, protein_g_per_100: 2.7,  carbs_g_per_100: 28.2, fat_g_per_100: 0.3, sodium_mg_per_100: 1,  potassium_mg_per_100: 35,  phosphorus_mg_per_100: 43 },
  { food_id: "rice_porridge_plain",    name: "Rice Porridge Plain",            category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed"],     clinical_tags: ["renal_safe","gut_safe","soft_texture","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 65, protein_g_per_100: 1.3, carbs_g_per_100: 13.9, fat_g_per_100: 0.2, sodium_mg_per_100: 1, potassium_mg_per_100: 18, phosphorus_mg_per_100: 21 },
  { food_id: "chicken_breast",          name: "Chicken Breast Skinless Cooked", category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["lean_protein","fresh_lean_protein","hepatic_safe"],    kcal_per_100: 165, protein_g_per_100: 31,   carbs_g_per_100: 0,    fat_g_per_100: 3.6, sodium_mg_per_100: 74 },
  { food_id: "white_fish",              name: "White Fish Steamed",             category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["lean_protein","fresh_lean_protein","hepatic_safe","gut_safe"], kcal_per_100: 110, protein_g_per_100: 23, carbs_g_per_100: 0, fat_g_per_100: 1.5, sodium_mg_per_100: 80 },
  { food_id: "salmon",                  name: "Salmon Baked",                   category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["omega_3","protein"],                                   kcal_per_100: 208, protein_g_per_100: 20,   carbs_g_per_100: 0,    fat_g_per_100: 13,  sodium_mg_per_100: 59 },
  { food_id: "lentils_cooked",          name: "Lentils Cooked",                 category: "legume",    cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["plant_protein","high_fiber","low_gi"],                 kcal_per_100: 116, protein_g_per_100: 9,    carbs_g_per_100: 20.1, fat_g_per_100: 0.4, sodium_mg_per_100: 2 },
  { food_id: "broccoli",                name: "Broccoli Steamed",               category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","high_fiber","low_gi"],               kcal_per_100: 35,  protein_g_per_100: 2.4,  carbs_g_per_100: 7.2,  fat_g_per_100: 0.4, sodium_mg_per_100: 41 },
  { food_id: "cauliflower",             name: "Cauliflower Steamed",            category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","low_gi"],                            kcal_per_100: 25,  protein_g_per_100: 1.9,  carbs_g_per_100: 5,    fat_g_per_100: 0.3, sodium_mg_per_100: 30 },
  { food_id: "cabbage_steamed",         name: "Cabbage Steamed",                category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","renal_safe","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 23, protein_g_per_100: 1.3, carbs_g_per_100: 5.5, fat_g_per_100: 0.1, sodium_mg_per_100: 8, potassium_mg_per_100: 170, phosphorus_mg_per_100: 26, fiber_g_per_100: 2.2, gi: 15 },
  { food_id: "green_beans_steamed",     name: "Green Beans Steamed",            category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","renal_safe","low_phosphorus","low_sodium"], kcal_per_100: 35, protein_g_per_100: 1.9, carbs_g_per_100: 7.9, fat_g_per_100: 0.3, sodium_mg_per_100: 1, potassium_mg_per_100: 146, phosphorus_mg_per_100: 38, fiber_g_per_100: 3.2, gi: 32 },
  { food_id: "zucchini_peeled_steamed", name: "Zucchini Peeled Steamed",        category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["non_starchy_veg","renal_safe","gut_safe","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 17, protein_g_per_100: 1.2, carbs_g_per_100: 3.1, fat_g_per_100: 0.3, sodium_mg_per_100: 8, potassium_mg_per_100: 150, phosphorus_mg_per_100: 32, fiber_g_per_100: 1.0, gi: 15 },
  { food_id: "carrot_boiled_leached",   name: "Carrot Boiled Leached",          category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["non_starchy_veg","renal_safe","low_phosphorus","low_sodium"], kcal_per_100: 35, protein_g_per_100: 0.8, carbs_g_per_100: 8.2, fat_g_per_100: 0.2, sodium_mg_per_100: 58, potassium_mg_per_100: 180, phosphorus_mg_per_100: 30, fiber_g_per_100: 2.8, gi: 39 },
  { food_id: "cucumber_peeled",         name: "Cucumber Peeled",                category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","renal_safe","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 12, protein_g_per_100: 0.6, carbs_g_per_100: 2.2, fat_g_per_100: 0.2, sodium_mg_per_100: 2, potassium_mg_per_100: 136, phosphorus_mg_per_100: 21, fiber_g_per_100: 0.7, gi: 15 },
  { food_id: "lettuce_shredded",        name: "Lettuce Shredded",               category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","renal_safe","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 15, protein_g_per_100: 1.4, carbs_g_per_100: 2.9, fat_g_per_100: 0.2, sodium_mg_per_100: 28, potassium_mg_per_100: 194, phosphorus_mg_per_100: 29, fiber_g_per_100: 1.3, gi: 15 },
  { food_id: "carrot_boiled_soft",      name: "Carrot Boiled Soft",             category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["non_starchy_veg","gut_safe","soft_texture","low_sodium"], kcal_per_100: 35, protein_g_per_100: 0.8, carbs_g_per_100: 8.2, fat_g_per_100: 0.2, sodium_mg_per_100: 58, potassium_mg_per_100: 235, phosphorus_mg_per_100: 30, fiber_g_per_100: 2.8, gi: 39 },
  { food_id: "green_beans_soft",        name: "Green Beans Soft",               category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","gut_safe","soft_texture","low_sodium"], kcal_per_100: 35, protein_g_per_100: 1.9, carbs_g_per_100: 7.9, fat_g_per_100: 0.3, sodium_mg_per_100: 1, potassium_mg_per_100: 146, phosphorus_mg_per_100: 38, fiber_g_per_100: 3.2, gi: 32 },
  { food_id: "cabbage_soft",            name: "Cabbage Soft",                   category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","gut_safe","soft_texture","low_sodium"], kcal_per_100: 23, protein_g_per_100: 1.3, carbs_g_per_100: 5.5, fat_g_per_100: 0.1, sodium_mg_per_100: 8, potassium_mg_per_100: 170, phosphorus_mg_per_100: 26, fiber_g_per_100: 2.2, gi: 15 },
  { food_id: "squash_mash",             name: "Squash Mash",                    category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["non_starchy_veg","gut_safe","soft_texture","low_sodium"], kcal_per_100: 34, protein_g_per_100: 1.1, carbs_g_per_100: 8.6, fat_g_per_100: 0.1, sodium_mg_per_100: 4, potassium_mg_per_100: 190, phosphorus_mg_per_100: 25, fiber_g_per_100: 1.5, gi: 51 },
  { food_id: "uji_oat_plain",           name: "Plain Oat Uji",                  category: "broth",     cuisine: "KENYAN",   texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 42,  protein_g_per_100: 1.8,  carbs_g_per_100: 7.2,  fat_g_per_100: 1.0, sodium_mg_per_100: 4 },
  { food_id: "arrowroot_boiled_soft",   name: "Arrowroot Boiled Soft",          category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced"],     clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 98,  protein_g_per_100: 1.5,  carbs_g_per_100: 23,   fat_g_per_100: 0.2, sodium_mg_per_100: 4 },
  { food_id: "sweet_potato_mash_plain", name: "Sweet Potato Mash Plain",        category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 86,  protein_g_per_100: 1.4,  carbs_g_per_100: 20,   fat_g_per_100: 0.1, sodium_mg_per_100: 25 },
  { food_id: "pumpkin_mash_plain",      name: "Pumpkin Mash Plain",             category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 34,  protein_g_per_100: 1.1,  carbs_g_per_100: 8,    fat_g_per_100: 0.1, sodium_mg_per_100: 3 },
  { food_id: "tapioca_porridge_plain", name: "Tapioca Porridge Plain",         category: "grain",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed"],     clinical_tags: ["renal_safe","gut_safe","soft_texture","low_potassium","low_phosphorus","low_sodium"], kcal_per_100: 90, protein_g_per_100: 0.2, carbs_g_per_100: 22.6, fat_g_per_100: 0.1, sodium_mg_per_100: 2, potassium_mg_per_100: 11, phosphorus_mg_per_100: 7 },
  { food_id: "cassava_mash_plain",     name: "Cassava Mash Plain",             category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["gut_safe","soft_texture","low_phosphorus","low_sodium"], kcal_per_100: 160, protein_g_per_100: 1.4, carbs_g_per_100: 38.1, fat_g_per_100: 0.3, sodium_mg_per_100: 14, potassium_mg_per_100: 271, phosphorus_mg_per_100: 48 },
  { food_id: "poached_chicken_plain",   name: "Poached Chicken Plain",          category: "protein",   cuisine: "KENYAN",   texture_tags: ["regular","soft","minced"],     clinical_tags: ["gut_safe","soft_texture","lean_protein","fresh_lean_protein"], kcal_per_100: 150, protein_g_per_100: 30, carbs_g_per_100: 0, fat_g_per_100: 3.0, sodium_mg_per_100: 68 },
  { food_id: "turkey_breast_cooked",   name: "Turkey Breast Cooked Skinless",  category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],             clinical_tags: ["lean_protein","fresh_lean_protein","hepatic_safe"],                               kcal_per_100: 135, protein_g_per_100: 29,  carbs_g_per_100: 0,    fat_g_per_100: 1.0, sodium_mg_per_100: 65,  potassium_mg_per_100: 230, phosphorus_mg_per_100: 180 },
  { food_id: "chickpeas_cooked",       name: "Chickpeas Cooked",               category: "legume",    cuisine: "STANDARD", texture_tags: ["regular","soft"],                     clinical_tags: ["plant_protein","high_fiber","low_gi"],                                             kcal_per_100: 164, protein_g_per_100: 8.9, carbs_g_per_100: 27.4, fat_g_per_100: 2.6, sodium_mg_per_100: 7,   potassium_mg_per_100: 291, phosphorus_mg_per_100: 168, fiber_g_per_100: 7.6, gi: 28 },
  { food_id: "tofu_firm_steamed",      name: "Tofu Firm Steamed",              category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],             clinical_tags: ["plant_protein","lean_protein","hepatic_safe","low_sodium"],                        kcal_per_100: 144, protein_g_per_100: 17,  carbs_g_per_100: 2.8,  fat_g_per_100: 8.7, sodium_mg_per_100: 14,  potassium_mg_per_100: 121, phosphorus_mg_per_100: 190 },
  { food_id: "steamed_cod_plain",      name: "Steamed Cod Plain",              category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],             clinical_tags: ["lean_protein","fresh_lean_protein","gut_safe","soft_texture","hepatic_safe"],   kcal_per_100: 90,  protein_g_per_100: 20,  carbs_g_per_100: 0,    fat_g_per_100: 0.7, sodium_mg_per_100: 58,  potassium_mg_per_100: 200, phosphorus_mg_per_100: 160 },
  { food_id: "steamed_tofu_soft",      name: "Steamed Tofu Soft",              category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed"],   clinical_tags: ["plant_protein","lean_protein","gut_safe","soft_texture","low_sodium"],           kcal_per_100: 60,  protein_g_per_100: 7,   carbs_g_per_100: 1.5,  fat_g_per_100: 3.5, sodium_mg_per_100: 8,   potassium_mg_per_100: 80,  phosphorus_mg_per_100: 90 },
  { food_id: "water",                   name: "Purified Water",                 category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed","liquid"], clinical_tags: ["hydration"], kcal_per_100: 0, protein_g_per_100: 0, carbs_g_per_100: 0, fat_g_per_100: 0, sodium_mg_per_100: 0 },
  { food_id: "unsweetened_tea",         name: "Unsweetened Tea",                category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","low_sodium","no_added_sugar"],            kcal_per_100: 1,  protein_g_per_100: 0,    carbs_g_per_100: 0,    fat_g_per_100: 0,   sodium_mg_per_100: 2, potassium_mg_per_100: 20, phosphorus_mg_per_100: 1 },
  { food_id: "chamomile_tea",           name: "Chamomile Tea",                  category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","low_sodium","no_added_sugar","caffeine_free","gut_safe"], kcal_per_100: 1, protein_g_per_100: 0, carbs_g_per_100: 0, fat_g_per_100: 0, sodium_mg_per_100: 1, potassium_mg_per_100: 9, phosphorus_mg_per_100: 0 },
  { food_id: "mint_tea_mild",           name: "Mild Mint Herbal Tea",           category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","low_sodium","no_added_sugar","caffeine_free"], kcal_per_100: 1, protein_g_per_100: 0, carbs_g_per_100: 0, fat_g_per_100: 0, sodium_mg_per_100: 1, potassium_mg_per_100: 12, phosphorus_mg_per_100: 0 },
  { food_id: "low_sodium_veg_broth",    name: "Low Sodium Vegetable Broth",     category: "broth",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["hydration","low_sodium","no_added_sugar"],            kcal_per_100: 8,  protein_g_per_100: 0.5,  carbs_g_per_100: 1.2,  fat_g_per_100: 0,   sodium_mg_per_100: 60, potassium_mg_per_100: 50, phosphorus_mg_per_100: 8 },
  { food_id: "rice_water",              name: "Rice Water",                     category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["hydration","gut_safe","renal_safe","low_sodium"],     kcal_per_100: 15, protein_g_per_100: 0.2,  carbs_g_per_100: 3.5,  fat_g_per_100: 0,   sodium_mg_per_100: 2, potassium_mg_per_100: 8, phosphorus_mg_per_100: 2 },
  { food_id: "renal_herbal_tea",        name: "Renal Herbal Tea",               category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","renal_safe","low_sodium","no_added_sugar","caffeine_free"], kcal_per_100: 1, protein_g_per_100: 0, carbs_g_per_100: 0, fat_g_per_100: 0, sodium_mg_per_100: 1, potassium_mg_per_100: 8, phosphorus_mg_per_100: 0 },
  { food_id: "low_potassium_clear_broth", name: "Low Potassium Clear Broth",    category: "broth",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["hydration","renal_safe","low_sodium"],               kcal_per_100: 6,  protein_g_per_100: 0.4,  carbs_g_per_100: 0.8,  fat_g_per_100: 0,   sodium_mg_per_100: 55, potassium_mg_per_100: 25, phosphorus_mg_per_100: 5 },
  { food_id: "cucumber_water_small",    name: "Cucumber Infused Water",         category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","renal_safe","low_sodium","no_added_sugar"], kcal_per_100: 2, protein_g_per_100: 0, carbs_g_per_100: 0.4, fat_g_per_100: 0, sodium_mg_per_100: 1, potassium_mg_per_100: 10, phosphorus_mg_per_100: 1 },
  { food_id: "apple_infused_water",     name: "Apple Infused Water",            category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","renal_safe","low_sodium","no_added_sugar"], kcal_per_100: 2, protein_g_per_100: 0, carbs_g_per_100: 0.5, fat_g_per_100: 0, sodium_mg_per_100: 1, potassium_mg_per_100: 8, phosphorus_mg_per_100: 1 },
  { food_id: "warm_water",              name: "Warm Water",                     category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["hydration","gut_safe","low_sodium","renal_safe"],     kcal_per_100: 0,  protein_g_per_100: 0,    carbs_g_per_100: 0,    fat_g_per_100: 0,   sodium_mg_per_100: 0, potassium_mg_per_100: 0, phosphorus_mg_per_100: 0 },
  { food_id: "plain_clear_broth",       name: "Plain Clear Broth",              category: "broth",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["hydration","gut_safe","low_sodium"],                  kcal_per_100: 7,  protein_g_per_100: 0.5,  carbs_g_per_100: 0.7,  fat_g_per_100: 0,   sodium_mg_per_100: 65, potassium_mg_per_100: 35, phosphorus_mg_per_100: 6 },
  { food_id: "low_fat_milk_small",      name: "Low Fat Milk Small Portion",     category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","gut_safe","protein","no_added_sugar"],    kcal_per_100: 42, protein_g_per_100: 3.4,  carbs_g_per_100: 5,    fat_g_per_100: 1,   sodium_mg_per_100: 44, potassium_mg_per_100: 150, phosphorus_mg_per_100: 95 },
  { food_id: "oat_uji_thin",            name: "Thin Oat Uji",                   category: "broth",     cuisine: "KENYAN",   texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["hydration","gut_safe","soft_texture","no_added_sugar"], kcal_per_100: 28, protein_g_per_100: 1.1, carbs_g_per_100: 4.8, fat_g_per_100: 0.6, sodium_mg_per_100: 3, potassium_mg_per_100: 45, phosphorus_mg_per_100: 18 },
  { food_id: "unsweetened_soy_milk",    name: "Unsweetened Soy Milk",           category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","liquid"],        clinical_tags: ["hydration","plant_protein","no_added_sugar","low_sodium"], kcal_per_100: 38, protein_g_per_100: 3.5, carbs_g_per_100: 1.3, fat_g_per_100: 2.1, sodium_mg_per_100: 34, potassium_mg_per_100: 120, phosphorus_mg_per_100: 60 },
  { food_id: "banana_ripe",             name: "Banana Ripe",                    category: "fruit",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed"],        clinical_tags: ["whole_fruit","soft_texture","low_sodium"],                                                    kcal_per_100: 89,  protein_g_per_100: 1.1, carbs_g_per_100: 23.0, fat_g_per_100: 0.3, sodium_mg_per_100: 1,  potassium_mg_per_100: 358, phosphorus_mg_per_100: 22,  gi: 51 },
  { food_id: "watermelon_cubed",        name: "Watermelon Cubed",               category: "fruit",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed"],        clinical_tags: ["whole_fruit","gut_safe","renal_safe","low_sodium","low_potassium","low_phosphorus"],         kcal_per_100: 30,  protein_g_per_100: 0.6, carbs_g_per_100: 7.6,  fat_g_per_100: 0.2, sodium_mg_per_100: 1,  potassium_mg_per_100: 112, phosphorus_mg_per_100: 11,  gi: 72 },
  { food_id: "papaya_fresh",            name: "Papaya Fresh",                   category: "fruit",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed"],        clinical_tags: ["whole_fruit","gut_safe","renal_safe","low_sodium","low_potassium","low_phosphorus"],         kcal_per_100: 43,  protein_g_per_100: 0.5, carbs_g_per_100: 11.0, fat_g_per_100: 0.3, sodium_mg_per_100: 8,  potassium_mg_per_100: 182, phosphorus_mg_per_100: 10,  gi: 60 },
  { food_id: "pear_fresh",              name: "Pear Fresh",                     category: "fruit",     cuisine: "STANDARD", texture_tags: ["regular","soft"],                 clinical_tags: ["whole_fruit","gut_safe","renal_safe","low_sodium","low_potassium","low_phosphorus","low_gi"], kcal_per_100: 57,  protein_g_per_100: 0.4, carbs_g_per_100: 15.2, fat_g_per_100: 0.1, sodium_mg_per_100: 1,  potassium_mg_per_100: 93,  phosphorus_mg_per_100: 12,  gi: 38 },
  { food_id: "guava_fresh",             name: "Guava Fresh",                    category: "fruit",     cuisine: "STANDARD", texture_tags: ["regular","soft"],                 clinical_tags: ["whole_fruit","high_fiber","low_gi","low_sodium"],                                             kcal_per_100: 68,  protein_g_per_100: 2.6, carbs_g_per_100: 14.3, fat_g_per_100: 1.0, sodium_mg_per_100: 2,  potassium_mg_per_100: 417, phosphorus_mg_per_100: 40,  gi: 40 },
  { food_id: "low_fat_yogurt_plain",    name: "Low Fat Yogurt Plain",           category: "dairy",     cuisine: "STANDARD", texture_tags: ["regular","soft","pureed"],        clinical_tags: ["protein","no_added_sugar","gut_safe","low_sodium"],                                           kcal_per_100: 63,  protein_g_per_100: 5.7, carbs_g_per_100: 7.0,  fat_g_per_100: 1.6, sodium_mg_per_100: 46, potassium_mg_per_100: 155, phosphorus_mg_per_100: 135, gi: 36 },
] as const;

export const FOODS: readonly SchemaFoodItem[] = [
  ...USDA_FOUNDATION_FOODS,
  ...LOCAL_EQUIVALENT_ALIASES,
  ...CURATED_LOCAL_FOODS,
];

// ── protocol_component_slots ─────────────────────────────────────────────────

const SLOT_OPTIONAL_MARKERS = ["_optional", "veg_or_fruit_optional"] as const;

function isOptional(slotName: string): boolean {
  return SLOT_OPTIONAL_MARKERS.some(m => slotName.endsWith(m) || slotName === m);
}

const RAW_MEAL_SLOTS: Record<string, Record<string, string[]>> = {
  GENERAL_HOSPITAL: { breakfast: ["starch_base","protein_primary","veg_or_fruit_optional","beverage"],          lunch: ["starch_base","protein_primary","vegetable_side","beverage"],          dinner: ["starch_base","protein_primary","vegetable_side","beverage"],          snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  T2DM:             { breakfast: ["controlled_carb_base","protein_primary","fiber_side_optional","beverage"],   lunch: ["controlled_carb_base","protein_primary","vegetable_side","beverage"], dinner: ["controlled_carb_base","protein_primary","vegetable_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  HTN:              { breakfast: ["starch_base","protein_primary","fruit_optional","beverage"],                  lunch: ["starch_base","lean_protein_primary","vegetable_side","beverage"],    dinner: ["starch_base","lean_protein_primary","vegetable_side","beverage"],    snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  CARDIAC:          { breakfast: ["wholegrain_base","protein_primary","fruit_optional","beverage"],              lunch: ["wholegrain_base","lean_protein_primary","vegetable_side","beverage"], dinner: ["wholegrain_base","lean_protein_primary","vegetable_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  RENAL_STAGE_3:    { breakfast: ["renal_carb_base","renal_protein_primary","beverage"],                        lunch: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"], dinner: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  RENAL_STAGE_4:    { breakfast: ["renal_carb_base","renal_protein_primary","beverage"],                        lunch: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"], dinner: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  H_PYLORI:         { breakfast: ["soft_starch_base","soft_protein_primary","beverage"],                        lunch: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], dinner: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  GASTRIC:          { breakfast: ["soft_starch_base","soft_protein_primary","beverage"],                        lunch: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], dinner: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  PEPTIC_ULCER:     { breakfast: ["soft_starch_base","soft_protein_primary","beverage"],                        lunch: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], dinner: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
  HEPATIC:          { breakfast: ["gentle_carb_base","fresh_lean_protein_optional","whole_fruit_optional","beverage"], lunch: ["gentle_carb_base","fresh_lean_protein_primary","vegetable_side","beverage"], dinner: ["gentle_carb_base","fresh_lean_protein_primary","vegetable_side","beverage"], snack_am: ["snack_item"], snack_pm: ["snack_item"], snack_eve: ["snack_item"] },
};

function buildSlots(): ProtocolComponentSlot[] {
  const rows: ProtocolComponentSlot[] = [];
  for (const [protocol, meals] of Object.entries(RAW_MEAL_SLOTS)) {
    for (const [meal_type, slots] of Object.entries(meals)) {
      slots.forEach((slot_name, idx) => {
        const opt = isOptional(slot_name);
        rows.push({
          protocol_code: protocol as ProtocolComponentSlot["protocol_code"],
          meal_type: meal_type as SchemaMealType,
          slot_name,
          required: !opt,
          min_items: opt ? 0 : 1,
          max_items: 1,
          slot_order: idx + 1,
        });
      });
    }
  }
  return rows;
}
export const PROTOCOL_COMPONENT_SLOTS: readonly ProtocolComponentSlot[] = buildSlots();

// ── protocol_slot_candidates ─────────────────────────────────────────────────

type CKey = string; // "PROTOCOL|meal|slot"
const RAW_CANDIDATES: Record<CKey, [string, number][]> = {
  "H_PYLORI|breakfast|soft_starch_base":      [["uji_oat_plain",10],["arrowroot_boiled_soft",9],["sweet_potato_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "H_PYLORI|breakfast|soft_protein_primary":  [["steamed_cod_plain",8],["poached_chicken_plain",7],["white_fish",6],["steamed_tofu_soft",5]],
  "H_PYLORI|breakfast|beverage":              [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "H_PYLORI|lunch|soft_starch_base":          [["arrowroot_boiled_soft",10],["sweet_potato_mash_plain",9],["pumpkin_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "H_PYLORI|lunch|soft_protein_primary":      [["poached_chicken_plain",10],["white_fish",9],["steamed_cod_plain",8],["steamed_tofu_soft",7]],
  "H_PYLORI|lunch|soft_veg_side":             [["cauliflower",10],["carrot_boiled_soft",9],["zucchini_peeled_steamed",8],["green_beans_soft",7],["cabbage_soft",6],["squash_mash",5]],
  "H_PYLORI|lunch|beverage":                  [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "H_PYLORI|dinner|soft_starch_base":         [["sweet_potato_mash_plain",10],["arrowroot_boiled_soft",9],["pumpkin_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "H_PYLORI|dinner|soft_protein_primary":     [["poached_chicken_plain",10],["white_fish",9],["steamed_cod_plain",8],["steamed_tofu_soft",7]],
  "H_PYLORI|dinner|soft_veg_side":            [["cauliflower",10],["carrot_boiled_soft",9],["zucchini_peeled_steamed",8],["green_beans_soft",7],["cabbage_soft",6],["squash_mash",5]],
  "H_PYLORI|dinner|beverage":                 [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "GASTRIC|breakfast|soft_starch_base":       [["uji_oat_plain",10],["arrowroot_boiled_soft",9],["sweet_potato_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "GASTRIC|breakfast|soft_protein_primary":   [["steamed_cod_plain",8],["poached_chicken_plain",7],["white_fish",6],["steamed_tofu_soft",5]],
  "GASTRIC|breakfast|beverage":               [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "GASTRIC|lunch|soft_starch_base":           [["arrowroot_boiled_soft",10],["sweet_potato_mash_plain",9],["pumpkin_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "GASTRIC|lunch|soft_protein_primary":       [["poached_chicken_plain",10],["white_fish",9],["steamed_cod_plain",8],["steamed_tofu_soft",7]],
  "GASTRIC|lunch|soft_veg_side":              [["cauliflower",10],["carrot_boiled_soft",9],["zucchini_peeled_steamed",8],["green_beans_soft",7],["cabbage_soft",6],["squash_mash",5]],
  "GASTRIC|lunch|beverage":                   [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "GASTRIC|dinner|soft_starch_base":          [["sweet_potato_mash_plain",10],["arrowroot_boiled_soft",9],["pumpkin_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "GASTRIC|dinner|soft_protein_primary":      [["poached_chicken_plain",10],["white_fish",9],["steamed_cod_plain",8],["steamed_tofu_soft",7]],
  "GASTRIC|dinner|soft_veg_side":             [["cauliflower",10],["carrot_boiled_soft",9],["zucchini_peeled_steamed",8],["green_beans_soft",7],["cabbage_soft",6],["squash_mash",5]],
  "GASTRIC|dinner|beverage":                  [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "PEPTIC_ULCER|breakfast|soft_starch_base":  [["uji_oat_plain",10],["arrowroot_boiled_soft",9],["sweet_potato_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "PEPTIC_ULCER|breakfast|soft_protein_primary": [["steamed_cod_plain",8],["poached_chicken_plain",7],["white_fish",6],["steamed_tofu_soft",5]],
  "PEPTIC_ULCER|breakfast|beverage":          [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "PEPTIC_ULCER|lunch|soft_starch_base":      [["arrowroot_boiled_soft",10],["sweet_potato_mash_plain",9],["pumpkin_mash_plain",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "PEPTIC_ULCER|lunch|soft_protein_primary":  [["poached_chicken_plain",10],["white_fish",9],["steamed_cod_plain",8],["steamed_tofu_soft",7]],
  "PEPTIC_ULCER|lunch|soft_veg_side":         [["cauliflower",10],["carrot_boiled_soft",9],["zucchini_peeled_steamed",8],["green_beans_soft",7],["cabbage_soft",6],["squash_mash",5]],
  "PEPTIC_ULCER|lunch|beverage":              [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "PEPTIC_ULCER|dinner|soft_starch_base":     [["sweet_potato_mash_plain",10],["pumpkin_mash_plain",9],["arrowroot_boiled_soft",8],["rice_porridge_plain",7],["cassava_mash_plain",6]],
  "PEPTIC_ULCER|dinner|soft_protein_primary": [["poached_chicken_plain",10],["white_fish",9],["steamed_cod_plain",8],["steamed_tofu_soft",7]],
  "PEPTIC_ULCER|dinner|soft_veg_side":        [["cauliflower",10],["carrot_boiled_soft",9],["zucchini_peeled_steamed",8],["green_beans_soft",7],["cabbage_soft",6],["squash_mash",5]],
  "PEPTIC_ULCER|dinner|beverage":             [["water",10],["warm_water",9],["chamomile_tea",8],["rice_water",7],["plain_clear_broth",6],["oat_uji_thin",5],["low_fat_milk_small",4]],
  "GENERAL_HOSPITAL|breakfast|starch_base":   [["rolled_oats",10],["quinoa_cooked",9],["brown_rice_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "GENERAL_HOSPITAL|breakfast|protein_primary":[["chicken_breast",10],["white_fish",9],["lentils_cooked",8],["salmon",7],["tofu_firm_steamed",6]],
  "GENERAL_HOSPITAL|breakfast|beverage":      [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "GENERAL_HOSPITAL|lunch|starch_base":       [["brown_rice_cooked",10],["quinoa_cooked",9],["barley_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "GENERAL_HOSPITAL|lunch|protein_primary":   [["chicken_breast",10],["white_fish",9],["salmon",8],["lentils_cooked",7],["tofu_firm_steamed",6]],
  "GENERAL_HOSPITAL|lunch|vegetable_side":    [["broccoli",10],["cauliflower",9]],
  "GENERAL_HOSPITAL|lunch|beverage":          [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "GENERAL_HOSPITAL|dinner|starch_base":      [["brown_rice_cooked",10],["barley_cooked",9],["quinoa_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "GENERAL_HOSPITAL|dinner|protein_primary":  [["chicken_breast",10],["white_fish",9],["lentils_cooked",8],["salmon",7],["tofu_firm_steamed",6]],
  "GENERAL_HOSPITAL|dinner|vegetable_side":   [["broccoli",10],["cauliflower",9]],
  "GENERAL_HOSPITAL|dinner|beverage":         [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "T2DM|breakfast|controlled_carb_base":      [["rolled_oats",10],["barley_cooked",9],["bulgur_cooked",8],["millet_cooked",7],["quinoa_cooked",6]],
  "T2DM|breakfast|protein_primary":           [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["chickpeas_cooked",7]],
  "T2DM|breakfast|beverage":                  [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "T2DM|lunch|controlled_carb_base":          [["barley_cooked",10],["quinoa_cooked",9],["lentils_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "T2DM|lunch|protein_primary":               [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["chickpeas_cooked",7]],
  "T2DM|lunch|vegetable_side":                [["broccoli",10],["cauliflower",9]],
  "T2DM|lunch|beverage":                      [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "T2DM|dinner|controlled_carb_base":         [["lentils_cooked",10],["barley_cooked",9],["quinoa_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "T2DM|dinner|protein_primary":              [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["chickpeas_cooked",7]],
  "T2DM|dinner|vegetable_side":               [["broccoli",10],["cauliflower",9]],
  "T2DM|dinner|beverage":                     [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "CARDIAC|breakfast|wholegrain_base":        [["rolled_oats",10],["barley_cooked",9],["bulgur_cooked",8],["millet_cooked",7],["brown_rice_cooked",6]],
  "CARDIAC|breakfast|protein_primary":        [["white_fish",10],["chicken_breast",9],["turkey_breast_cooked",8]],
  "CARDIAC|breakfast|beverage":               [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "CARDIAC|lunch|wholegrain_base":            [["brown_rice_cooked",10],["quinoa_cooked",9],["barley_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "CARDIAC|lunch|lean_protein_primary":       [["salmon",10],["white_fish",9],["chicken_breast",8]],
  "CARDIAC|lunch|vegetable_side":             [["broccoli",10],["cauliflower",9]],
  "CARDIAC|lunch|beverage":                   [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "CARDIAC|dinner|wholegrain_base":           [["quinoa_cooked",10],["barley_cooked",9],["bulgur_cooked",8],["millet_cooked",7],["brown_rice_cooked",6]],
  "CARDIAC|dinner|lean_protein_primary":      [["salmon",10],["white_fish",9],["turkey_breast_cooked",7]],
  "CARDIAC|dinner|vegetable_side":            [["broccoli",10],["cauliflower",9]],
  "CARDIAC|dinner|beverage":                  [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "HTN|breakfast|starch_base":               [["rolled_oats",10],["barley_cooked",9],["bulgur_cooked",8],["millet_cooked",7],["brown_rice_cooked",6]],
  "HTN|breakfast|protein_primary":           [["white_fish",10],["chicken_breast",9],["turkey_breast_cooked",8]],
  "HTN|breakfast|beverage":                  [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "HTN|lunch|starch_base":                   [["brown_rice_cooked",10],["quinoa_cooked",9],["bulgur_cooked",8],["millet_cooked",7],["barley_cooked",6]],
  "HTN|lunch|lean_protein_primary":          [["white_fish",10],["chicken_breast",9],["turkey_breast_cooked",8]],
  "HTN|lunch|vegetable_side":                [["broccoli",10],["cauliflower",9]],
  "HTN|lunch|beverage":                      [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "HTN|dinner|starch_base":                  [["quinoa_cooked",10],["barley_cooked",9],["bulgur_cooked",8],["millet_cooked",7],["brown_rice_cooked",6]],
  "HTN|dinner|lean_protein_primary":         [["white_fish",10],["chicken_breast",9],["turkey_breast_cooked",8]],
  "HTN|dinner|vegetable_side":               [["cauliflower",10],["broccoli",9]],
  "HTN|dinner|beverage":                     [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "RENAL_STAGE_3|breakfast|renal_carb_base":      [["rolled_oats",10],["brown_rice_cooked",9],["white_rice_cooked",8],["rice_porridge_plain",7],["tapioca_porridge_plain",6]],
  "RENAL_STAGE_3|breakfast|renal_protein_primary":[["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8]],
  "RENAL_STAGE_3|breakfast|beverage":             [["water",10],["renal_herbal_tea",9],["rice_water",8],["low_potassium_clear_broth",7],["chamomile_tea",6],["cucumber_water_small",5],["apple_infused_water",4],["warm_water",3]],
  "RENAL_STAGE_3|lunch|renal_carb_base":          [["brown_rice_cooked",10],["quinoa_cooked",9],["white_rice_cooked",8],["rice_porridge_plain",7],["tapioca_porridge_plain",6]],
  "RENAL_STAGE_3|lunch|renal_protein_primary":    [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["steamed_cod_plain",7]],
  "RENAL_STAGE_3|lunch|renal_veg_side":           [["cauliflower",10],["cabbage_steamed",9],["green_beans_steamed",8],["zucchini_peeled_steamed",7],["carrot_boiled_leached",6],["cucumber_peeled",5],["lettuce_shredded",4]],
  "RENAL_STAGE_3|lunch|beverage":                 [["water",10],["renal_herbal_tea",9],["rice_water",8],["low_potassium_clear_broth",7],["chamomile_tea",6],["cucumber_water_small",5],["apple_infused_water",4],["warm_water",3]],
  "RENAL_STAGE_3|dinner|renal_carb_base":         [["brown_rice_cooked",10],["quinoa_cooked",9],["white_rice_cooked",8],["rice_porridge_plain",7],["tapioca_porridge_plain",6]],
  "RENAL_STAGE_3|dinner|renal_protein_primary":   [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["steamed_cod_plain",7]],
  "RENAL_STAGE_3|dinner|renal_veg_side":          [["cauliflower",10],["cabbage_steamed",9],["green_beans_steamed",8],["zucchini_peeled_steamed",7],["carrot_boiled_leached",6],["cucumber_peeled",5],["lettuce_shredded",4]],
  "RENAL_STAGE_3|dinner|beverage":                [["water",10],["renal_herbal_tea",9],["rice_water",8],["low_potassium_clear_broth",7],["chamomile_tea",6],["cucumber_water_small",5],["apple_infused_water",4],["warm_water",3]],
  "RENAL_STAGE_4|breakfast|renal_carb_base":      [["rolled_oats",10],["sweet_potato_mash_plain",9],["white_rice_cooked",8],["rice_porridge_plain",7],["tapioca_porridge_plain",6]],
  "RENAL_STAGE_4|breakfast|renal_protein_primary":[["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8]],
  "RENAL_STAGE_4|breakfast|beverage":             [["water",10],["renal_herbal_tea",9],["rice_water",8],["low_potassium_clear_broth",7],["chamomile_tea",6],["cucumber_water_small",5],["apple_infused_water",4],["warm_water",3]],
  "RENAL_STAGE_4|lunch|renal_carb_base":          [["brown_rice_cooked",10],["arrowroot_boiled_soft",9],["white_rice_cooked",8],["rice_porridge_plain",7],["tapioca_porridge_plain",6]],
  "RENAL_STAGE_4|lunch|renal_protein_primary":    [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["steamed_cod_plain",7]],
  "RENAL_STAGE_4|lunch|renal_veg_side":           [["cauliflower",10],["cabbage_steamed",9],["green_beans_steamed",8],["zucchini_peeled_steamed",7],["carrot_boiled_leached",6],["cucumber_peeled",5],["lettuce_shredded",4]],
  "RENAL_STAGE_4|lunch|beverage":                 [["water",10],["renal_herbal_tea",9],["rice_water",8],["low_potassium_clear_broth",7],["chamomile_tea",6],["cucumber_water_small",5],["apple_infused_water",4],["warm_water",3]],
  "RENAL_STAGE_4|dinner|renal_carb_base":         [["sweet_potato_mash_plain",10],["arrowroot_boiled_soft",9],["white_rice_cooked",8],["rice_porridge_plain",7],["tapioca_porridge_plain",6]],
  "RENAL_STAGE_4|dinner|renal_protein_primary":   [["chicken_breast",10],["white_fish",9],["turkey_breast_cooked",8],["steamed_cod_plain",7]],
  "RENAL_STAGE_4|dinner|renal_veg_side":          [["cauliflower",10],["cabbage_steamed",9],["green_beans_steamed",8],["zucchini_peeled_steamed",7],["carrot_boiled_leached",6],["cucumber_peeled",5],["lettuce_shredded",4]],
  "RENAL_STAGE_4|dinner|beverage":                [["water",10],["renal_herbal_tea",9],["rice_water",8],["low_potassium_clear_broth",7],["chamomile_tea",6],["cucumber_water_small",5],["apple_infused_water",4],["warm_water",3]],
  "HEPATIC|breakfast|gentle_carb_base":            [["rolled_oats",10],["brown_rice_cooked",9],["barley_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "HEPATIC|breakfast|fresh_lean_protein_optional": [["chicken_breast",8],["white_fish",7],["tofu_firm_steamed",6]],
  "HEPATIC|breakfast|whole_fruit_optional":        [["broccoli",5]],
  "HEPATIC|breakfast|beverage":                    [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "HEPATIC|lunch|gentle_carb_base":               [["brown_rice_cooked",10],["quinoa_cooked",9],["barley_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "HEPATIC|lunch|fresh_lean_protein_primary":      [["white_fish",10],["chicken_breast",9],["salmon",8]],
  "HEPATIC|lunch|vegetable_side":                  [["broccoli",10],["cauliflower",9]],
  "HEPATIC|lunch|beverage":                        [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  "HEPATIC|dinner|gentle_carb_base":              [["quinoa_cooked",10],["brown_rice_cooked",9],["barley_cooked",8],["bulgur_cooked",7],["millet_cooked",6]],
  "HEPATIC|dinner|fresh_lean_protein_primary":     [["white_fish",10],["chicken_breast",9],["turkey_breast_cooked",8],["tofu_firm_steamed",7]],
  "HEPATIC|dinner|vegetable_side":                 [["broccoli",10],["cauliflower",9]],
  "HEPATIC|dinner|beverage":                       [["water",10],["unsweetened_tea",9],["chamomile_tea",8],["mint_tea_mild",7],["low_sodium_veg_broth",6],["cucumber_water_small",5],["apple_infused_water",4],["unsweetened_soy_milk",3]],
  // ── snack_am candidates ────────────────────────────────────────────────────
  "GENERAL_HOSPITAL|snack_am|snack_item": [["banana_ripe",10],["pear_fresh",9],["rolled_oats",8],["barley_cooked",7],["guava_fresh",6]],
  "T2DM|snack_am|snack_item":             [["barley_cooked",10],["rolled_oats",9],["pear_fresh",8],["guava_fresh",7],["bulgur_cooked",6]],
  "HTN|snack_am|snack_item":              [["banana_ripe",10],["pear_fresh",9],["rolled_oats",8],["barley_cooked",7],["guava_fresh",6]],
  "CARDIAC|snack_am|snack_item":          [["rolled_oats",10],["barley_cooked",9],["pear_fresh",8],["banana_ripe",7],["bulgur_cooked",6]],
  "RENAL_STAGE_3|snack_am|snack_item":    [["rice_porridge_plain",10],["tapioca_porridge_plain",9],["watermelon_cubed",8],["papaya_fresh",7],["white_rice_cooked",6]],
  "RENAL_STAGE_4|snack_am|snack_item":    [["rice_porridge_plain",10],["tapioca_porridge_plain",9],["watermelon_cubed",8],["papaya_fresh",7],["white_rice_cooked",6]],
  "H_PYLORI|snack_am|snack_item":         [["rice_porridge_plain",10],["tapioca_porridge_plain",9],["arrowroot_boiled_soft",8],["uji_oat_plain",7],["sweet_potato_mash_plain",6]],
  "GASTRIC|snack_am|snack_item":          [["rice_porridge_plain",10],["tapioca_porridge_plain",9],["arrowroot_boiled_soft",8],["uji_oat_plain",7],["sweet_potato_mash_plain",6]],
  "PEPTIC_ULCER|snack_am|snack_item":     [["rice_porridge_plain",10],["arrowroot_boiled_soft",9],["tapioca_porridge_plain",8],["sweet_potato_mash_plain",7],["uji_oat_plain",6]],
  "HEPATIC|snack_am|snack_item":          [["rolled_oats",10],["barley_cooked",9],["pear_fresh",8],["papaya_fresh",7],["banana_ripe",6]],
  // ── snack_pm candidates ────────────────────────────────────────────────────
  "GENERAL_HOSPITAL|snack_pm|snack_item": [["lentils_cooked",10],["chickpeas_cooked",9],["steamed_tofu_soft",8],["low_fat_yogurt_plain",7],["turkey_breast_cooked",6]],
  "T2DM|snack_pm|snack_item":             [["lentils_cooked",10],["chickpeas_cooked",9],["steamed_tofu_soft",8],["low_fat_yogurt_plain",7],["turkey_breast_cooked",6]],
  "HTN|snack_pm|snack_item":              [["lentils_cooked",10],["chickpeas_cooked",9],["steamed_tofu_soft",8],["low_fat_yogurt_plain",7],["turkey_breast_cooked",6]],
  "CARDIAC|snack_pm|snack_item":          [["lentils_cooked",10],["chickpeas_cooked",9],["steamed_tofu_soft",8],["low_fat_yogurt_plain",7],["steamed_cod_plain",6]],
  "RENAL_STAGE_3|snack_pm|snack_item":    [["steamed_tofu_soft",10],["steamed_cod_plain",9],["turkey_breast_cooked",8]],
  "RENAL_STAGE_4|snack_pm|snack_item":    [["steamed_tofu_soft",10],["steamed_cod_plain",9],["turkey_breast_cooked",8]],
  "H_PYLORI|snack_pm|snack_item":         [["steamed_tofu_soft",10],["steamed_cod_plain",9],["poached_chicken_plain",8],["papaya_fresh",7],["pear_fresh",6]],
  "GASTRIC|snack_pm|snack_item":          [["steamed_tofu_soft",10],["steamed_cod_plain",9],["poached_chicken_plain",8],["papaya_fresh",7],["pear_fresh",6]],
  "PEPTIC_ULCER|snack_pm|snack_item":     [["steamed_tofu_soft",10],["poached_chicken_plain",9],["steamed_cod_plain",8],["pear_fresh",7],["papaya_fresh",6]],
  "HEPATIC|snack_pm|snack_item":          [["white_fish",10],["lentils_cooked",9],["steamed_tofu_soft",8],["low_fat_yogurt_plain",7],["chickpeas_cooked",6]],
  // ── snack_eve candidates ───────────────────────────────────────────────────
  "GENERAL_HOSPITAL|snack_eve|snack_item":[["pear_fresh",10],["watermelon_cubed",9],["banana_ripe",8],["rice_porridge_plain",7],["sweet_potato_mash_plain",6]],
  "T2DM|snack_eve|snack_item":            [["pear_fresh",10],["barley_cooked",9],["bulgur_cooked",8],["rice_porridge_plain",7],["rolled_oats",6]],
  "HTN|snack_eve|snack_item":             [["pear_fresh",10],["watermelon_cubed",9],["banana_ripe",8],["rice_porridge_plain",7],["sweet_potato_mash_plain",6]],
  "CARDIAC|snack_eve|snack_item":         [["pear_fresh",10],["watermelon_cubed",9],["barley_cooked",8],["rolled_oats",7],["bulgur_cooked",6]],
  "RENAL_STAGE_3|snack_eve|snack_item":   [["rice_porridge_plain",10],["pear_fresh",9],["papaya_fresh",8],["tapioca_porridge_plain",7],["watermelon_cubed",6]],
  "RENAL_STAGE_4|snack_eve|snack_item":   [["tapioca_porridge_plain",10],["rice_porridge_plain",9],["pear_fresh",8],["papaya_fresh",7],["watermelon_cubed",6]],
  "H_PYLORI|snack_eve|snack_item":        [["papaya_fresh",10],["pear_fresh",9],["watermelon_cubed",8],["rice_porridge_plain",7],["arrowroot_boiled_soft",6]],
  "GASTRIC|snack_eve|snack_item":         [["papaya_fresh",10],["pear_fresh",9],["watermelon_cubed",8],["rice_porridge_plain",7],["arrowroot_boiled_soft",6]],
  "PEPTIC_ULCER|snack_eve|snack_item":    [["papaya_fresh",10],["pear_fresh",9],["watermelon_cubed",8],["rice_porridge_plain",7],["arrowroot_boiled_soft",6]],
  "HEPATIC|snack_eve|snack_item":         [["pear_fresh",10],["papaya_fresh",9],["watermelon_cubed",8],["rice_porridge_plain",7],["barley_cooked",6]],
};

function buildCandidates(): ProtocolSlotCandidate[] {
  const rows: ProtocolSlotCandidate[] = [];
  for (const [key, pairs] of Object.entries(RAW_CANDIDATES)) {
    const [protocol_code, meal_type, slot_name] = key.split("|");
    for (const [food_id, priority] of pairs) {
      rows.push({
        protocol_code: protocol_code as ProtocolSlotCandidate["protocol_code"],
        meal_type: meal_type as SchemaMealType,
        slot_name,
        food_id,
        priority,
      });
    }
  }
  return rows;
}
export const PROTOCOL_SLOT_CANDIDATES: readonly ProtocolSlotCandidate[] = buildCandidates();
