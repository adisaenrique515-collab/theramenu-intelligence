/**
 * server/import-usda-food.ts — Phase 8: USDA FoodData Central import pipeline.
 *
 * Fetches a single food record by FDC ID from the USDA FDC REST API,
 * normalises its nutrients into a NutrientVector, and returns a FoodItem
 * ready for clinical review.
 *
 * Security rules (non-negotiable):
 *   - API key is read from server-side process.env only.
 *   - This module must never be imported by client code.
 *   - If the API key is absent, the function throws immediately.
 *   - The raw FDC payload is preserved for audit purposes.
 *
 * Governance rules:
 *   - All imported foods are set to approvalStatus: 'pending_review'.
 *   - Automatic approval is explicitly prohibited.
 *   - fluidMl is always recorded as a missing nutrient (FDC has no per-food
 *     fluid content field).
 */

import type { NutrientVector } from '../types.ts';

import type {
  FoodItem,
  FoodCategory,
  MealTypeKey,
  PreparationState,
  TextureLevel,
  ServingRule,
} from '../types-clinical.ts';

import { EMPTY_NUTRIENTS } from './nutrientUtils.ts';

// ── Constants ─────────────────────────────────────────────────────────────

export const USDA_FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

/**
 * FDC nutrient IDs that map to NutrientVector fields.
 * These are stable across FDC dataset releases.
 */
export const FDC_NUTRIENT_IDS = {
  caloriesKcal:  1008, // Energy, kcal
  proteinG:      1003, // Protein
  carbsG:        1005, // Carbohydrate, by difference
  fatG:          1004, // Total lipid (fat)
  fiberG:        1079, // Fiber, total dietary
  sodiumMg:      1093, // Sodium, Na
  potassiumMg:   1092, // Potassium, K
  phosphorusMg:  1091, // Phosphorus, P
  cholesterolMg: 1253, // Cholesterol
  saturatedFatG: 1258, // Fatty acids, total saturated
  sugarG:        2000, // Sugars, total including NLEA
  // fluidMl has no FDC mapping — always flagged as missing
} as const satisfies Partial<Record<keyof NutrientVector, number>>;

// ── API key ───────────────────────────────────────────────────────────────

/**
 * resolveApiKey — reads the USDA API key from server-side environment only.
 * Throws if neither env var is set.
 *
 * Env vars checked (in order):
 *   VITE_USDA_FDC_API_KEY  — set by Vite for dev-server injection
 *   USDA_FDC_API_KEY       — alternative for standalone Node usage
 */
export function resolveApiKey(): string {
  const key = (
    process.env['VITE_USDA_FDC_API_KEY'] ??
    process.env['USDA_FDC_API_KEY'] ??
    ''
  ).trim();

  if (!key) {
    throw new Error(
      '[USDA Import] API key is not configured. ' +
      'Set VITE_USDA_FDC_API_KEY or USDA_FDC_API_KEY in .env.local. ' +
      'The key must never be passed from the frontend.',
    );
  }

  return key;
}

// ── FDC response types ────────────────────────────────────────────────────

export interface FdcNutrientEntry {
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
  nutrientId?: number;
  amount?: number;
  value?: number;
}

export interface FdcFoodResponse {
  fdcId?: number;
  description?: string;
  dataType?: string;
  publicationDate?: string;
  foodCategory?: { description?: string; code?: string };
  foodClass?: string;
  foodNutrients?: FdcNutrientEntry[];
  [key: string]: unknown;
}

// ── Nutrient extraction ───────────────────────────────────────────────────

/**
 * buildNutrientMap — extract nutrient id → value from the FDC food payload.
 * Handles both per-food-detail format ({ nutrient: { id }, amount }) and the
 * search-result format ({ nutrientId, value }).
 */
function buildNutrientMap(entries: FdcNutrientEntry[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const entry of entries) {
    const id = entry.nutrient?.id ?? entry.nutrientId;
    const value = entry.amount ?? entry.value;
    if (id !== undefined && value !== undefined) {
      map.set(id, value);
    }
  }
  return map;
}

/**
 * normaliseNutrients — map FDC nutrient values into a NutrientVector and
 * return the list of fields that had no data from FDC.
 *
 * fluidMl is always missing (no FDC equivalent).
 * Zero values from FDC are preserved (they differ from "no data").
 */
export function normaliseNutrients(entries: FdcNutrientEntry[]): {
  nutrients: NutrientVector;
  missingNutrients: Array<keyof NutrientVector>;
} {
  const nutrientMap = buildNutrientMap(entries);
  const missing: Array<keyof NutrientVector> = [];

  const get = (
    key: keyof typeof FDC_NUTRIENT_IDS,
  ): number => {
    const id = FDC_NUTRIENT_IDS[key];
    const v = nutrientMap.get(id);
    if (v === undefined) {
      missing.push(key);
      return 0;
    }
    return v;
  };

  const nutrients: NutrientVector = {
    caloriesKcal:  get('caloriesKcal'),
    proteinG:      get('proteinG'),
    carbsG:        get('carbsG'),
    fatG:          get('fatG'),
    fiberG:        get('fiberG'),
    sodiumMg:      get('sodiumMg'),
    potassiumMg:   get('potassiumMg'),
    phosphorusMg:  get('phosphorusMg'),
    cholesterolMg: get('cholesterolMg'),
    saturatedFatG: get('saturatedFatG'),
    sugarG:        get('sugarG'),
    fluidMl:       0,  // always missing — FDC has no per-food fluid field
  };

  missing.push('fluidMl');

  return { nutrients, missingNutrients: missing };
}

// ── Category and preparation inference ───────────────────────────────────

/**
 * inferCategory — map FDC foodCategory description to FoodCategory.
 * Falls back to description-based keywords, then 'protein' as a safe default.
 */
export function inferCategory(fdc: FdcFoodResponse): FoodCategory {
  const cat = (fdc.foodCategory?.description ?? '').toLowerCase();
  const desc = (fdc.description ?? '').toLowerCase();

  if (/poultry|beef|pork|lamb|veal|game|fish|seafood|shellfish|meat|sausage|organ/i.test(cat)) return 'protein';
  if (/egg/i.test(cat) && /dairy/i.test(cat)) {
    // "Dairy and Egg Products" contains both — use the food description to disambiguate.
    // Egg-named foods are protein; everything else (cheese, milk, yoghurt…) is dairy.
    return /\begg\b/i.test(desc) ? 'protein' : 'dairy';
  }
  if (/\begg\b/i.test(cat)) return 'protein';
  if (/dairy/i.test(cat))   return 'dairy';
  if (/cereal|grain|pasta|baked|bread|rice|flour/i.test(cat)) return 'grain';
  if (/legume|bean|lentil|pea|chickpea|pulse/i.test(cat)) return 'legume';
  if (/vegetable/i.test(cat)) return 'vegetable';
  if (/fruit/i.test(cat)) return 'fruit';
  if (/beverage|juice|water|tea|coffee|drink/i.test(cat)) return 'beverage';
  if (/fat|oil|butter|margarine|nut|seed/i.test(cat)) return 'fat';
  if (/soup|broth|stock|gravy/i.test(cat)) return 'broth';
  if (/spice|herb|condiment|sauce|vinegar|mustard/i.test(cat)) return 'condiment';

  // Fallback: keyword scan of the description
  if (/chicken|turkey|beef|pork|fish|salmon|tuna|egg|shrimp/i.test(desc)) return 'protein';
  if (/rice|bread|pasta|oat|wheat|corn|barley/i.test(desc)) return 'grain';
  if (/milk|cheese|yogurt|cream/i.test(desc)) return 'dairy';
  if (/bean|lentil|chickpea|tofu|tempeh/i.test(desc)) return 'legume';
  if (/water|juice|tea|coffee/i.test(desc)) return 'beverage';

  return 'protein'; // safe clinical default
}

/**
 * inferPreparationState — infer from the FDC description string.
 * Conservative: unknown → 'cooked' (safer than raw for clinical use).
 */
export function inferPreparationState(description: string): PreparationState {
  const d = description.toLowerCase();
  if (/\braw\b/.test(d))                                               return 'raw';
  if (/canned/.test(d))                                                return 'canned';
  if (/dried|dehydrated/.test(d))                                      return 'dried';
  if (/frozen/.test(d))                                                return 'frozen';
  if (/cooked|roasted|baked|boiled|steamed|grilled|fried|poached|broiled/.test(d)) {
    return 'cooked';
  }
  return 'cooked'; // conservative default
}

/**
 * inferMealTypes — infer applicable meal types from category.
 * Defaults to all main meal types for protein/grain/starch/legume.
 * Beverages and condiments span all slots.
 */
function inferMealTypes(category: FoodCategory): ReadonlyArray<MealTypeKey> {
  const all: MealTypeKey[] = ['Breakfast', 'Snack AM', 'Lunch', 'Snack PM', 'Dinner', 'Snack Eve'];
  const main: MealTypeKey[] = ['Breakfast', 'Lunch', 'Dinner'];

  if (category === 'beverage' || category === 'broth' || category === 'condiment') return all;
  if (category === 'fruit' || category === 'vegetable') return all;
  return main;
}

/**
 * defaultServingRules — per-category defaults.
 * Conservative: the dietitian must verify before approving.
 */
function defaultServingRules(category: FoodCategory): ServingRule {
  const rules: Partial<Record<FoodCategory, ServingRule>> = {
    beverage:  { minGrams: 100, maxGrams: 500, defaultGrams: 200, unit: 'ml' },
    broth:     { minGrams: 100, maxGrams: 400, defaultGrams: 200, unit: 'ml' },
    protein:   { minGrams: 60,  maxGrams: 200, defaultGrams: 120, unit: 'g' },
    grain:     { minGrams: 80,  maxGrams: 280, defaultGrams: 150, unit: 'g' },
    starch:    { minGrams: 80,  maxGrams: 280, defaultGrams: 150, unit: 'g' },
    vegetable: { minGrams: 60,  maxGrams: 200, defaultGrams: 100, unit: 'g' },
    fruit:     { minGrams: 60,  maxGrams: 200, defaultGrams: 100, unit: 'g' },
    legume:    { minGrams: 80,  maxGrams: 200, defaultGrams: 120, unit: 'g' },
    dairy:     { minGrams: 60,  maxGrams: 250, defaultGrams: 150, unit: 'g' },
    fat:       { minGrams: 5,   maxGrams: 30,  defaultGrams: 10,  unit: 'g' },
    condiment: { minGrams: 5,   maxGrams: 50,  defaultGrams: 15,  unit: 'g' },
  };
  return rules[category] ?? { minGrams: 30, maxGrams: 300, defaultGrams: 100, unit: 'g' };
}

// ── Import result ─────────────────────────────────────────────────────────

export type FetchFn = (url: string) => Promise<Response>;

export interface UsdaImportSuccess {
  readonly ok: true;
  readonly food: FoodItem;
  readonly fdcId: number;
  readonly importedAt: string;
}

export interface UsdaImportFailure {
  readonly ok: false;
  readonly fdcId: number;
  readonly error: string;
  readonly httpStatus?: number;
}

export type UsdaImportResult = UsdaImportSuccess | UsdaImportFailure;

// ── Main import function ──────────────────────────────────────────────────

/**
 * importUsdaFood — fetch a single food from USDA FDC and return a
 * pending-review FoodItem.
 *
 * @param fdcId  - USDA FoodData Central food ID (positive integer)
 * @param fetcher - optional fetch override for testing; defaults to global fetch
 *
 * Throws synchronously if the API key is not configured.
 * Returns an UsdaImportFailure (not a throw) for HTTP or network errors.
 */
export async function importUsdaFood(
  fdcId: number,
  fetcher: FetchFn = (url) => fetch(url),
): Promise<UsdaImportResult> {
  const apiKey = resolveApiKey(); // throws if missing
  const importedAt = new Date().toISOString();

  const url = `${USDA_FDC_BASE}/food/${fdcId}?api_key=${apiKey}&format=full`;

  let response: Response;
  try {
    response = await fetcher(url);
  } catch (networkErr) {
    return {
      ok: false,
      fdcId,
      error: `Network error fetching FDC ID ${fdcId}: ${String(networkErr)}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      fdcId,
      error: `USDA FDC API returned HTTP ${response.status} for FDC ID ${fdcId}.`,
      httpStatus: response.status,
    };
  }

  let raw: FdcFoodResponse;
  try {
    raw = await response.json() as FdcFoodResponse;
  } catch {
    return {
      ok: false,
      fdcId,
      error: `FDC ID ${fdcId}: response body is not valid JSON.`,
      httpStatus: response.status,
    };
  }

  if (!raw.fdcId || !raw.description) {
    return {
      ok: false,
      fdcId,
      error: `FDC ID ${fdcId}: response missing required fields (fdcId, description).`,
      httpStatus: response.status,
    };
  }

  const { nutrients, missingNutrients } = normaliseNutrients(raw.foodNutrients ?? []);
  const category = inferCategory(raw);
  const preparationState = inferPreparationState(raw.description ?? '');

  const food: FoodItem = {
    id:               `usda_${fdcId}`,
    canonicalName:    raw.description,
    category,
    mealTypes:        inferMealTypes(category),
    preparationState,
    nutrientsPer100g: nutrients,
    missingNutrients,
    textureLevels:    ['regular'] as TextureLevel[],  // conservative; dietitian sets actual
    allergens:        [],                              // FDC has no allergen field
    contraindicatedFor: [],                            // requires clinical review
    allowedFor:       [],
    servingRules:     defaultServingRules(category),
    source:           'USDA_FDC',
    confidence:       'unverified',                    // not yet clinician-reviewed
    approvalStatus:   'pending_review',                // NEVER auto-approve
    fdcId:            raw.fdcId,
    rawProviderPayload: raw as Readonly<Record<string, unknown>>,
    tags:             [],
  };

  return { ok: true, food, fdcId: raw.fdcId, importedAt };
}
