/**
 * USDA FoodData Central API Integration
 * Key: configured via process.env.USDA_API_KEY
 * Docs: https://fdc.nal.usda.gov/api-guide.html
 *
 * Enriches each SlotItem in the generated WeeklyTherapeuticPlan with real
 * per-100g nutrient data sourced from the USDA Foundation Foods / SR Legacy
 * datasets.
 */

import { WeeklyTherapeuticPlan, UsdaFoodNutrients } from '../types';

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Standard USDA FDC nutrient IDs (stable across dataset versions)
const NUTRIENT_IDS = {
  calories:   1008, // Energy (kcal)
  protein:    1003, // Protein
  fat:        1004, // Total lipid (fat)
  carbs:      1005, // Carbohydrate, by difference
  fiber:      1079, // Fiber, total dietary
  sugar:      2000, // Sugars, total including NLEA
  sodium:     1093, // Sodium, Na
  potassium:  1092, // Potassium, K
  phosphorus: 1091, // Phosphorus, P
  calcium:    1087, // Calcium, Ca
  iron:       1089, // Iron, Fe
  vitaminC:   1162, // Vitamin C, total ascorbic acid
  vitaminA:   1106, // Vitamin A, RAE (mcg)
  saturatedFat: 1258, // Fatty acids, total saturated
  cholesterol:  1253, // Cholesterol
} as const;

// In-memory cache – keyed by lowercased food name to avoid duplicate API calls
// within a single session.
const _cache = new Map<string, UsdaFoodNutrients | null>();

/** Fetch nutrient data from USDA FDC for a single food name. Returns null if
 *  the API key is missing, the search yields no results, or a network error
 *  occurs (fail-soft: the rest of the plan is unaffected).
 */
export async function searchUsdaFood(
  foodName: string,
): Promise<UsdaFoodNutrients | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  const key = foodName.toLowerCase().trim();
  if (_cache.has(key)) return _cache.get(key) ?? null;

  try {
    const url =
      `${USDA_BASE_URL}/foods/search` +
      `?query=${encodeURIComponent(foodName)}` +
      `&api_key=${apiKey}` +
      `&pageSize=1` +
      `&dataType=Foundation,SR%20Legacy`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[USDA] Search failed for "${foodName}" – HTTP ${res.status}`);
      _cache.set(key, null);
      return null;
    }

    const data = await res.json();
    const food = data?.foods?.[0];
    if (!food) {
      _cache.set(key, null);
      return null;
    }

    const result = _extractNutrients(food);
    _cache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`[USDA] Network error for "${foodName}":`, err);
    _cache.set(key, null);
    return null;
  }
}

/** Extract and normalise the flat nutrient array returned by the FDC search
 *  endpoint into a typed UsdaFoodNutrients record. */
function _extractNutrients(food: Record<string, unknown>): UsdaFoodNutrients {
  type RawNutrient = {
    nutrientId?: number;
    nutrient?: { id?: number; name?: string; unitName?: string };
    nutrientName?: string;
    unitName?: string;
    value?: number;
  };

  const rawNutrients: RawNutrient[] = Array.isArray(food.foodNutrients)
    ? (food.foodNutrients as RawNutrient[])
    : [];

  // Build lookup map by nutrient ID
  const byId = new Map<number, number>();
  rawNutrients.forEach((n) => {
    const id = n.nutrientId ?? n.nutrient?.id;
    if (id !== undefined && n.value !== undefined) byId.set(id, n.value);
  });

  const get = (id: number) => byId.get(id);

  return {
    fdcId:        food.fdcId as number,
    description:  food.description as string,
    calories:     get(NUTRIENT_IDS.calories),
    protein:      get(NUTRIENT_IDS.protein),
    carbs:        get(NUTRIENT_IDS.carbs),
    fat:          get(NUTRIENT_IDS.fat),
    fiber:        get(NUTRIENT_IDS.fiber),
    sugar:        get(NUTRIENT_IDS.sugar),
    sodium:       get(NUTRIENT_IDS.sodium),
    potassium:    get(NUTRIENT_IDS.potassium),
    phosphorus:   get(NUTRIENT_IDS.phosphorus),
    calcium:      get(NUTRIENT_IDS.calcium),
    iron:         get(NUTRIENT_IDS.iron),
    vitaminC:     get(NUTRIENT_IDS.vitaminC),
    vitaminA:     get(NUTRIENT_IDS.vitaminA),
    saturatedFat: get(NUTRIENT_IDS.saturatedFat),
    cholesterol:  get(NUTRIENT_IDS.cholesterol),
  };
}

/**
 * Walk every SlotItem in the plan, look up each unique food name in the USDA
 * FDC API in parallel, and return an enriched copy of the plan.  Operates
 * fail-soft: if an individual lookup fails the item is returned unchanged.
 */
export async function enrichPlanWithUsdaData(
  plan: WeeklyTherapeuticPlan,
): Promise<WeeklyTherapeuticPlan> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return plan;

  // 1. Collect unique, lookup-worthy food names
  const foodNames = new Set<string>();
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const slot of meal.slots ?? []) {
        const name = slot.item?.name?.trim();
        if (name && name !== 'N/A' && name !== 'Purified Water' && name !== 'Water') {
          // Strip texture modifiers like " (soft)" before searching
          foodNames.add(name.replace(/\s*\([^)]+\)\s*$/, '').trim());
        }
      }
    }
  }

  // 2. Resolve USDA lookups with a concurrency cap to avoid rate-limit 429s
  const BATCH_SIZE = 10;
  const names = Array.from(foodNames);
  const entries: [string, UsdaFoodNutrients | null][] = [];
  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (name) => [name, await searchUsdaFood(name)] as const),
    );
    entries.push(...batchResults);
  }
  const usdaMap = new Map<string, UsdaFoodNutrients | null>(entries);

  // 3. Deep-clone plan and attach usdaNutrients to each matching SlotItem
  const enrichedDays = plan.days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      slots: (meal.slots ?? []).map((slot) => {
        if (!slot.item?.name) return slot;
        const cleanName = slot.item.name.replace(/\s*\([^)]+\)\s*$/, '').trim();
        const usdaData = usdaMap.get(cleanName);
        if (!usdaData) return slot;
        return { ...slot, item: { ...slot.item, usdaNutrients: usdaData } };
      }),
    })),
  }));

  return {
    ...plan,
    days: enrichedDays,
    notes: [
      ...(plan.notes ?? []),
      `USDA FDC nutrient enrichment applied to ${usdaMap.size} unique food items.`,
    ],
  };
}
