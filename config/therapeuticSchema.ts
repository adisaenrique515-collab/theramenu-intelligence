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
  { food_id: "chicken_breast",          name: "Chicken Breast Skinless Cooked", category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["lean_protein","fresh_lean_protein","hepatic_safe"],    kcal_per_100: 165, protein_g_per_100: 31,   carbs_g_per_100: 0,    fat_g_per_100: 3.6, sodium_mg_per_100: 74 },
  { food_id: "white_fish",              name: "White Fish Steamed",             category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["lean_protein","fresh_lean_protein","hepatic_safe","gut_safe"], kcal_per_100: 110, protein_g_per_100: 23, carbs_g_per_100: 0, fat_g_per_100: 1.5, sodium_mg_per_100: 80 },
  { food_id: "salmon",                  name: "Salmon Baked",                   category: "protein",   cuisine: "STANDARD", texture_tags: ["regular","soft"],              clinical_tags: ["omega_3","protein"],                                   kcal_per_100: 208, protein_g_per_100: 20,   carbs_g_per_100: 0,    fat_g_per_100: 13,  sodium_mg_per_100: 59 },
  { food_id: "lentils_cooked",          name: "Lentils Cooked",                 category: "legume",    cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["plant_protein","high_fiber","low_gi"],                 kcal_per_100: 116, protein_g_per_100: 9,    carbs_g_per_100: 20.1, fat_g_per_100: 0.4, sodium_mg_per_100: 2 },
  { food_id: "broccoli",                name: "Broccoli Steamed",               category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","high_fiber","low_gi"],               kcal_per_100: 35,  protein_g_per_100: 2.4,  carbs_g_per_100: 7.2,  fat_g_per_100: 0.4, sodium_mg_per_100: 41 },
  { food_id: "cauliflower",             name: "Cauliflower Steamed",            category: "vegetable", cuisine: "STANDARD", texture_tags: ["regular","soft","minced"],     clinical_tags: ["non_starchy_veg","low_gi"],                            kcal_per_100: 25,  protein_g_per_100: 1.9,  carbs_g_per_100: 5,    fat_g_per_100: 0.3, sodium_mg_per_100: 30 },
  { food_id: "uji_oat_plain",           name: "Plain Oat Uji",                  category: "broth",     cuisine: "KENYAN",   texture_tags: ["regular","soft","pureed","liquid"], clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 42,  protein_g_per_100: 1.8,  carbs_g_per_100: 7.2,  fat_g_per_100: 1.0, sodium_mg_per_100: 4 },
  { food_id: "arrowroot_boiled_soft",   name: "Arrowroot Boiled Soft",          category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced"],     clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 98,  protein_g_per_100: 1.5,  carbs_g_per_100: 23,   fat_g_per_100: 0.2, sodium_mg_per_100: 4 },
  { food_id: "sweet_potato_mash_plain", name: "Sweet Potato Mash Plain",        category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 86,  protein_g_per_100: 1.4,  carbs_g_per_100: 20,   fat_g_per_100: 0.1, sodium_mg_per_100: 25 },
  { food_id: "pumpkin_mash_plain",      name: "Pumpkin Mash Plain",             category: "starch",    cuisine: "KENYAN",   texture_tags: ["regular","soft","minced","pureed"], clinical_tags: ["gut_safe","soft_texture","regular_soft_flexible"],     kcal_per_100: 34,  protein_g_per_100: 1.1,  carbs_g_per_100: 8,    fat_g_per_100: 0.1, sodium_mg_per_100: 3 },
  { food_id: "poached_chicken_plain",   name: "Poached Chicken Plain",          category: "protein",   cuisine: "KENYAN",   texture_tags: ["regular","soft","minced"],     clinical_tags: ["gut_safe","soft_texture","lean_protein","fresh_lean_protein"], kcal_per_100: 150, protein_g_per_100: 30, carbs_g_per_100: 0, fat_g_per_100: 3.0, sodium_mg_per_100: 68 },
  { food_id: "water",                   name: "Purified Water",                 category: "beverage",  cuisine: "STANDARD", texture_tags: ["regular","soft","minced","pureed","liquid"], clinical_tags: ["hydration"], kcal_per_100: 0, protein_g_per_100: 0, carbs_g_per_100: 0, fat_g_per_100: 0, sodium_mg_per_100: 0 },
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
  GENERAL_HOSPITAL: { breakfast: ["starch_base","protein_primary","veg_or_fruit_optional","beverage"],          lunch: ["starch_base","protein_primary","vegetable_side","beverage"],          dinner: ["starch_base","protein_primary","vegetable_side","beverage"] },
  T2DM:             { breakfast: ["controlled_carb_base","protein_primary","fiber_side_optional","beverage"],   lunch: ["controlled_carb_base","protein_primary","vegetable_side","beverage"], dinner: ["controlled_carb_base","protein_primary","vegetable_side","beverage"] },
  HTN:              { breakfast: ["starch_base","protein_primary","fruit_optional","beverage"],                  lunch: ["starch_base","lean_protein_primary","vegetable_side","beverage"],    dinner: ["starch_base","lean_protein_primary","vegetable_side","beverage"] },
  CARDIAC:          { breakfast: ["wholegrain_base","protein_primary","fruit_optional","beverage"],              lunch: ["wholegrain_base","lean_protein_primary","vegetable_side","beverage"], dinner: ["wholegrain_base","lean_protein_primary","vegetable_side","beverage"] },
  RENAL_STAGE_3:    { breakfast: ["renal_carb_base","renal_protein_primary","beverage"],                        lunch: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"], dinner: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"] },
  RENAL_STAGE_4:    { breakfast: ["renal_carb_base","renal_protein_primary","beverage"],                        lunch: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"], dinner: ["renal_carb_base","renal_protein_primary","renal_veg_side","beverage"] },
  H_PYLORI:         { breakfast: ["soft_starch_base","soft_protein_primary","beverage"],                        lunch: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], dinner: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"] },
  GASTRIC:          { breakfast: ["soft_starch_base","soft_protein_primary","beverage"],                        lunch: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], dinner: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"] },
  PEPTIC_ULCER:     { breakfast: ["soft_starch_base","soft_protein_primary","beverage"],                        lunch: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"], dinner: ["soft_starch_base","soft_protein_primary","soft_veg_side","beverage"] },
  HEPATIC:          { breakfast: ["gentle_carb_base","fresh_lean_protein_optional","whole_fruit_optional","beverage"], lunch: ["gentle_carb_base","fresh_lean_protein_primary","vegetable_side","beverage"], dinner: ["gentle_carb_base","fresh_lean_protein_primary","vegetable_side","beverage"] },
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
  "H_PYLORI|breakfast|soft_starch_base":      [["uji_oat_plain",10],["arrowroot_boiled_soft",9],["sweet_potato_mash_plain",8]],
  "H_PYLORI|breakfast|soft_protein_primary":  [["poached_chicken_plain",7],["white_fish",6]],
  "H_PYLORI|breakfast|beverage":              [["water",10]],
  "H_PYLORI|lunch|soft_starch_base":          [["arrowroot_boiled_soft",10],["sweet_potato_mash_plain",9],["pumpkin_mash_plain",8]],
  "H_PYLORI|lunch|soft_protein_primary":      [["poached_chicken_plain",10],["white_fish",9]],
  "H_PYLORI|lunch|soft_veg_side":             [["cauliflower",8]],
  "H_PYLORI|lunch|beverage":                  [["water",10]],
  "H_PYLORI|dinner|soft_starch_base":         [["sweet_potato_mash_plain",10],["arrowroot_boiled_soft",9],["pumpkin_mash_plain",8]],
  "H_PYLORI|dinner|soft_protein_primary":     [["poached_chicken_plain",10],["white_fish",9]],
  "H_PYLORI|dinner|soft_veg_side":            [["cauliflower",8]],
  "H_PYLORI|dinner|beverage":                 [["water",10]],
  "GASTRIC|breakfast|soft_starch_base":       [["uji_oat_plain",10],["arrowroot_boiled_soft",9],["sweet_potato_mash_plain",8]],
  "GASTRIC|breakfast|soft_protein_primary":   [["poached_chicken_plain",7],["white_fish",6]],
  "GASTRIC|breakfast|beverage":               [["water",10]],
  "GASTRIC|lunch|soft_starch_base":           [["arrowroot_boiled_soft",10],["sweet_potato_mash_plain",9],["pumpkin_mash_plain",8]],
  "GASTRIC|lunch|soft_protein_primary":       [["poached_chicken_plain",10],["white_fish",9]],
  "GASTRIC|lunch|soft_veg_side":              [["cauliflower",8]],
  "GASTRIC|lunch|beverage":                   [["water",10]],
  "GASTRIC|dinner|soft_starch_base":          [["sweet_potato_mash_plain",10],["arrowroot_boiled_soft",9]],
  "GASTRIC|dinner|soft_protein_primary":      [["poached_chicken_plain",10],["white_fish",9]],
  "GASTRIC|dinner|soft_veg_side":             [["cauliflower",8]],
  "GASTRIC|dinner|beverage":                  [["water",10]],
  "PEPTIC_ULCER|breakfast|soft_starch_base":  [["uji_oat_plain",10],["arrowroot_boiled_soft",9],["sweet_potato_mash_plain",8]],
  "PEPTIC_ULCER|breakfast|soft_protein_primary": [["poached_chicken_plain",7],["white_fish",6]],
  "PEPTIC_ULCER|breakfast|beverage":          [["water",10]],
  "PEPTIC_ULCER|lunch|soft_starch_base":      [["arrowroot_boiled_soft",10],["sweet_potato_mash_plain",9]],
  "PEPTIC_ULCER|lunch|soft_protein_primary":  [["poached_chicken_plain",10],["white_fish",9]],
  "PEPTIC_ULCER|lunch|soft_veg_side":         [["cauliflower",8]],
  "PEPTIC_ULCER|lunch|beverage":              [["water",10]],
  "PEPTIC_ULCER|dinner|soft_starch_base":     [["sweet_potato_mash_plain",10],["pumpkin_mash_plain",9]],
  "PEPTIC_ULCER|dinner|soft_protein_primary": [["poached_chicken_plain",10],["white_fish",9]],
  "PEPTIC_ULCER|dinner|soft_veg_side":        [["cauliflower",8]],
  "PEPTIC_ULCER|dinner|beverage":             [["water",10]],
  "GENERAL_HOSPITAL|breakfast|starch_base":   [["rolled_oats",10],["quinoa_cooked",9],["brown_rice_cooked",8]],
  "GENERAL_HOSPITAL|breakfast|protein_primary":[["chicken_breast",10],["white_fish",9],["lentils_cooked",8]],
  "GENERAL_HOSPITAL|breakfast|beverage":      [["water",10]],
  "GENERAL_HOSPITAL|lunch|starch_base":       [["brown_rice_cooked",10],["quinoa_cooked",9],["barley_cooked",8]],
  "GENERAL_HOSPITAL|lunch|protein_primary":   [["chicken_breast",10],["white_fish",9],["salmon",8]],
  "GENERAL_HOSPITAL|lunch|vegetable_side":    [["broccoli",10],["cauliflower",9]],
  "GENERAL_HOSPITAL|lunch|beverage":          [["water",10]],
  "GENERAL_HOSPITAL|dinner|starch_base":      [["brown_rice_cooked",10],["barley_cooked",9],["quinoa_cooked",8]],
  "GENERAL_HOSPITAL|dinner|protein_primary":  [["chicken_breast",10],["white_fish",9],["lentils_cooked",8]],
  "GENERAL_HOSPITAL|dinner|vegetable_side":   [["broccoli",10],["cauliflower",9]],
  "GENERAL_HOSPITAL|dinner|beverage":         [["water",10]],
  "T2DM|breakfast|controlled_carb_base":      [["rolled_oats",10],["barley_cooked",9]],
  "T2DM|breakfast|protein_primary":           [["chicken_breast",10],["white_fish",9]],
  "T2DM|breakfast|beverage":                  [["water",10]],
  "T2DM|lunch|controlled_carb_base":          [["barley_cooked",10],["quinoa_cooked",9],["lentils_cooked",8]],
  "T2DM|lunch|protein_primary":               [["chicken_breast",10],["white_fish",9]],
  "T2DM|lunch|vegetable_side":                [["broccoli",10],["cauliflower",9]],
  "T2DM|lunch|beverage":                      [["water",10]],
  "T2DM|dinner|controlled_carb_base":         [["lentils_cooked",10],["barley_cooked",9],["quinoa_cooked",8]],
  "T2DM|dinner|protein_primary":              [["chicken_breast",10],["white_fish",9]],
  "T2DM|dinner|vegetable_side":               [["broccoli",10],["cauliflower",9]],
  "T2DM|dinner|beverage":                     [["water",10]],
  "CARDIAC|breakfast|wholegrain_base":        [["rolled_oats",10],["barley_cooked",9]],
  "CARDIAC|breakfast|protein_primary":        [["white_fish",10],["chicken_breast",9]],
  "CARDIAC|breakfast|beverage":               [["water",10]],
  "CARDIAC|lunch|wholegrain_base":            [["brown_rice_cooked",10],["quinoa_cooked",9],["barley_cooked",8]],
  "CARDIAC|lunch|lean_protein_primary":       [["salmon",10],["white_fish",9],["chicken_breast",8]],
  "CARDIAC|lunch|vegetable_side":             [["broccoli",10],["cauliflower",9]],
  "CARDIAC|lunch|beverage":                   [["water",10]],
  "CARDIAC|dinner|wholegrain_base":           [["quinoa_cooked",10],["barley_cooked",9]],
  "CARDIAC|dinner|lean_protein_primary":      [["salmon",10],["white_fish",9]],
  "CARDIAC|dinner|vegetable_side":            [["broccoli",10],["cauliflower",9]],
  "CARDIAC|dinner|beverage":                  [["water",10]],
  "HTN|breakfast|starch_base":               [["rolled_oats",10],["barley_cooked",9]],
  "HTN|breakfast|protein_primary":           [["white_fish",10],["chicken_breast",9]],
  "HTN|breakfast|beverage":                  [["water",10]],
  "HTN|lunch|starch_base":                   [["brown_rice_cooked",10],["quinoa_cooked",9]],
  "HTN|lunch|lean_protein_primary":          [["white_fish",10],["chicken_breast",9]],
  "HTN|lunch|vegetable_side":                [["broccoli",10],["cauliflower",9]],
  "HTN|lunch|beverage":                      [["water",10]],
  "HTN|dinner|starch_base":                  [["quinoa_cooked",10],["barley_cooked",9]],
  "HTN|dinner|lean_protein_primary":         [["white_fish",10],["chicken_breast",9]],
  "HTN|dinner|vegetable_side":               [["cauliflower",10],["broccoli",9]],
  "HTN|dinner|beverage":                     [["water",10]],
  "RENAL_STAGE_3|breakfast|renal_carb_base":      [["rolled_oats",10],["brown_rice_cooked",9]],
  "RENAL_STAGE_3|breakfast|renal_protein_primary":[["chicken_breast",10],["white_fish",9]],
  "RENAL_STAGE_3|breakfast|beverage":             [["water",10]],
  "RENAL_STAGE_3|lunch|renal_carb_base":          [["brown_rice_cooked",10],["quinoa_cooked",9]],
  "RENAL_STAGE_3|lunch|renal_protein_primary":    [["chicken_breast",10],["white_fish",9]],
  "RENAL_STAGE_3|lunch|renal_veg_side":           [["cauliflower",10]],
  "RENAL_STAGE_3|lunch|beverage":                 [["water",10]],
  "RENAL_STAGE_3|dinner|renal_carb_base":         [["brown_rice_cooked",10],["quinoa_cooked",9]],
  "RENAL_STAGE_3|dinner|renal_protein_primary":   [["chicken_breast",10],["white_fish",9]],
  "RENAL_STAGE_3|dinner|renal_veg_side":          [["cauliflower",10]],
  "RENAL_STAGE_3|dinner|beverage":                [["water",10]],
  "RENAL_STAGE_4|breakfast|renal_carb_base":      [["rolled_oats",10],["sweet_potato_mash_plain",9]],
  "RENAL_STAGE_4|breakfast|renal_protein_primary":[["chicken_breast",10],["white_fish",9]],
  "RENAL_STAGE_4|breakfast|beverage":             [["water",10]],
  "RENAL_STAGE_4|lunch|renal_carb_base":          [["brown_rice_cooked",10],["arrowroot_boiled_soft",9]],
  "RENAL_STAGE_4|lunch|renal_protein_primary":    [["chicken_breast",10],["white_fish",9]],
  "RENAL_STAGE_4|lunch|renal_veg_side":           [["cauliflower",10]],
  "RENAL_STAGE_4|lunch|beverage":                 [["water",10]],
  "RENAL_STAGE_4|dinner|renal_carb_base":         [["sweet_potato_mash_plain",10],["arrowroot_boiled_soft",9]],
  "RENAL_STAGE_4|dinner|renal_protein_primary":   [["chicken_breast",10],["white_fish",9]],
  "RENAL_STAGE_4|dinner|renal_veg_side":          [["cauliflower",10]],
  "RENAL_STAGE_4|dinner|beverage":                [["water",10]],
  "HEPATIC|breakfast|gentle_carb_base":            [["rolled_oats",10],["brown_rice_cooked",9]],
  "HEPATIC|breakfast|fresh_lean_protein_optional": [["chicken_breast",8],["white_fish",7]],
  "HEPATIC|breakfast|whole_fruit_optional":        [["broccoli",5]],
  "HEPATIC|breakfast|beverage":                    [["water",10]],
  "HEPATIC|lunch|gentle_carb_base":               [["brown_rice_cooked",10],["quinoa_cooked",9]],
  "HEPATIC|lunch|fresh_lean_protein_primary":      [["white_fish",10],["chicken_breast",9],["salmon",8]],
  "HEPATIC|lunch|vegetable_side":                  [["broccoli",10],["cauliflower",9]],
  "HEPATIC|lunch|beverage":                        [["water",10]],
  "HEPATIC|dinner|gentle_carb_base":              [["quinoa_cooked",10],["brown_rice_cooked",9]],
  "HEPATIC|dinner|fresh_lean_protein_primary":     [["white_fish",10],["chicken_breast",9]],
  "HEPATIC|dinner|vegetable_side":                 [["broccoli",10],["cauliflower",9]],
  "HEPATIC|dinner|beverage":                       [["water",10]],
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
