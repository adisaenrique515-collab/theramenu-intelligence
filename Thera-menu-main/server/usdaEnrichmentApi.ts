/**
 * Server-side USDA FoodData Central (FDC) enrichment module.
 * Runs inside the Vite dev-server middleware so the USDA_API_KEY never
 * touches the browser.
 *
 * API docs: https://fdc.nal.usda.gov/api-guide.html
 * Key env var: VITE_USDA_FDC_API_KEY  (also checked as USDA_API_KEY)
 */

import type { WeeklyTherapeuticPlan, UsdaFoodNutrients } from '../types.ts';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// Standard FDC nutrient IDs (stable across dataset releases)
const NID = {
  calories:     1008, // Energy, kcal
  protein:      1003, // Protein
  fat:          1004, // Total lipid (fat)
  carbs:        1005, // Carbohydrate, by difference
  fiber:        1079, // Fiber, total dietary
  sugar:        2000, // Sugars, total including NLEA
  sodium:       1093, // Sodium, Na
  potassium:    1092, // Potassium, K
  phosphorus:   1091, // Phosphorus, P
  calcium:      1087, // Calcium, Ca
  iron:         1089, // Iron, Fe
  vitaminC:     1162, // Vitamin C, total ascorbic acid
  vitaminA:     1106, // Vitamin A, RAE
  saturatedFat: 1258, // Fatty acids, total saturated
  cholesterol:  1253, // Cholesterol
} as const;

function getApiKey(): string {
  return (process.env.VITE_USDA_FDC_API_KEY || process.env.USDA_API_KEY || '').trim();
}

export function isUsdaConfigured(): boolean {
  return getApiKey().length > 0;
}

interface FdcNutrientEntry {
  nutrientId?: number;
  nutrient?: { id?: number };
  value?: number;
}

function extractNutrients(food: Record<string, unknown>): UsdaFoodNutrients {
  const raw: FdcNutrientEntry[] = Array.isArray(food.foodNutrients)
    ? (food.foodNutrients as FdcNutrientEntry[])
    : [];

  const byId = new Map<number, number>();
  for (const n of raw) {
    const id = n.nutrientId ?? n.nutrient?.id;
    if (id !== undefined && n.value !== undefined) byId.set(id, n.value);
  }

  const g = (id: number) => byId.get(id);

  return {
    fdcId:        Number(food.fdcId),
    description:  String(food.description ?? ''),
    calories:     g(NID.calories),
    protein:      g(NID.protein),
    carbs:        g(NID.carbs),
    fat:          g(NID.fat),
    fiber:        g(NID.fiber),
    sugar:        g(NID.sugar),
    sodium:       g(NID.sodium),
    potassium:    g(NID.potassium),
    phosphorus:   g(NID.phosphorus),
    calcium:      g(NID.calcium),
    iron:         g(NID.iron),
    vitaminC:     g(NID.vitaminC),
    vitaminA:     g(NID.vitaminA),
    saturatedFat: g(NID.saturatedFat),
    cholesterol:  g(NID.cholesterol),
  };
}

/** Session-scoped in-memory cache to avoid redundant API calls (capped at 500 entries). */
const _cache = new Map<string, UsdaFoodNutrients | null>();
const CACHE_MAX = 500;

async function lookupOne(name: string, apiKey: string): Promise<UsdaFoodNutrients | null> {
  const key = name.toLowerCase().trim();
  if (_cache.has(key)) return _cache.get(key) ?? null;
  if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value!);

  try {
    const url =
      `${USDA_BASE}/foods/search` +
      `?query=${encodeURIComponent(name)}` +
      `&api_key=${apiKey}` +
      `&pageSize=1` +
      `&dataType=Foundation,SR%20Legacy`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[USDA] HTTP ${res.status} for "${name}"`);
      _cache.set(key, null);
      return null;
    }

    const json = await res.json() as { foods?: Record<string, unknown>[] };
    const food = json.foods?.[0];
    if (!food) {
      _cache.set(key, null);
      return null;
    }

    const result = extractNutrients(food);
    _cache.set(key, result);
    return result;
  } catch (err) {
    console.warn(`[USDA] Network error for "${name}":`, err);
    _cache.set(key, null);
    return null;
  }
}

/**
 * Enrich every SlotItem in the plan with real USDA FDC nutrient data.
 * Fails soft: missing lookups leave the item unchanged.
 */
export async function enrichPlanWithUsdaFdcData(
  plan: WeeklyTherapeuticPlan,
): Promise<WeeklyTherapeuticPlan> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ...plan,
      notes: [
        ...(plan.notes ?? []),
        'USDA FDC live enrichment skipped – VITE_USDA_FDC_API_KEY not configured.',
      ],
    };
  }

  // Collect unique food names (strip texture suffixes like " (soft)")
  const rawNames = new Set<string>();
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const slot of meal.slots ?? []) {
        const raw = slot.item?.name?.trim();
        if (raw && raw !== 'N/A' && !/^(purified water|water)$/i.test(raw)) {
          rawNames.add(raw.replace(/\s*\([^)]+\)\s*$/, '').trim());
        }
      }
    }
  }

  // Resolve all concurrently
  const pairs = await Promise.all(
    Array.from(rawNames).map(async (n) => [n, await lookupOne(n, apiKey)] as const),
  );
  const usdaMap = new Map<string, UsdaFoodNutrients | null>(pairs);
  const hitCount = [...usdaMap.values()].filter(Boolean).length;

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
      `USDA FDC live nutrient data applied to ${hitCount} of ${rawNames.size} food items (Foundation Foods / SR Legacy datasets).`,
    ],
  };
}
