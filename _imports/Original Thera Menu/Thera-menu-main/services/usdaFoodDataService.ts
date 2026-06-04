import type { FoodNutrientProfile, SlotItem, WeeklyTherapeuticPlan } from '../types';
import { calculateAlignmentScore, validateWeeklyPlan } from './planValidation';

type ImportMetaEnvLike = ImportMeta & { env?: Record<string, string | undefined> };
type ProcessLike = { env?: Record<string, string | undefined> };

type FdcSearchResult = {
  fdcId?: number;
  description?: string;
};

type FdcNutrient = {
  amount?: number;
  value?: number;
  nutrient?: {
    name?: string;
    number?: string;
  };
  nutrientName?: string;
  nutrientNumber?: string;
};

type FdcFoodDetails = {
  fdcId?: number;
  description?: string;
  foodNutrients?: FdcNutrient[];
};

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';
const env: Record<string, string | undefined> = (import.meta as ImportMetaEnvLike).env ?? {};
const processEnv =
  typeof process !== 'undefined' ? ((process as unknown as ProcessLike).env ?? {}) : {};
const USDA_API_KEY = String(env.VITE_USDA_FDC_API_KEY || processEnv.VITE_USDA_FDC_API_KEY || '').trim();
const profileCache = new Map<string, Promise<FoodNutrientProfile | null>>();
let authRejected = false;
let authRejectedLogged = false;
let transientFailure = false;

const NAME_CLEANUP_PATTERN = /\b(plain|cooked|steamed|baked|boiled|roasted|mashed|skinless|grilled|poached|soft|fresh|raw)\b/gi;

export const hasUsdaApiKey = USDA_API_KEY.length > 0;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function makeLookupKey(item: SlotItem): string {
  return `${item.foodId || 'name'}::${normalizeText(item.name)}`;
}

function buildSearchQueries(item: SlotItem): string[] {
  const canonical = normalizeText(item.name);
  const simplified = canonical.replace(NAME_CLEANUP_PATTERN, '').replace(/\s+/g, ' ').trim();
  return Array.from(new Set([canonical, simplified].filter(Boolean)));
}

function getFdcIdFromFoodId(foodId: string | undefined): number | null {
  if (!foodId || !foodId.startsWith('usda_')) return null;
  const numeric = Number(foodId.replace('usda_', ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function readNutrientValue(food: FdcFoodDetails, matcher: (name: string, number: string) => boolean): number {
  const nutrient = (food.foodNutrients || []).find((entry) => {
    const name = entry.nutrient?.name || entry.nutrientName || '';
    const number = entry.nutrient?.number || entry.nutrientNumber || '';
    return matcher(name.toLowerCase(), number);
  });

  return Number(nutrient?.amount ?? nutrient?.value ?? 0);
}

function mapFoodToProfile(food: FdcFoodDetails): FoodNutrientProfile {
  return {
    source: 'USDA_FDC',
    fdcId: Number(food.fdcId || 0),
    description: food.description || 'USDA FoodData Central food',
    fetchedAt: new Date().toISOString(),
    caloriesKcalPer100: readNutrientValue(food, (name, number) => number === '1008' || name === 'energy'),
    carbsGPer100: readNutrientValue(food, (name, number) => number === '1005' || name.includes('carbohydrate')),
    proteinGPer100: readNutrientValue(food, (name, number) => number === '1003' || name === 'protein'),
    fatGPer100: readNutrientValue(food, (name, number) => number === '1004' || name.includes('total lipid')),
    fiberGPer100: readNutrientValue(food, (name, number) => number === '1079' || name.includes('fiber')),
    sodiumMgPer100: readNutrientValue(food, (name, number) => number === '1093' || name.includes('sodium')),
    potassiumMgPer100: readNutrientValue(food, (name, number) => number === '1092' || name.includes('potassium')),
    phosphorusMgPer100: readNutrientValue(food, (name, number) => number === '1091' || name.includes('phosphorus')),
    cholesterolMgPer100: readNutrientValue(food, (name, number) => number === '1253' || name.includes('cholesterol')),
    saturatedFatGPer100: readNutrientValue(food, (name, number) => number === '1258' || name.includes('saturated')),
    sugarGPer100: readNutrientValue(food, (name, number) => number === '2000' || name.includes('sugars')),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  if (authRejected) {
    throw new Error('USDA request skipped after prior authorization failure');
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      authRejected = true;
      throw new Error('USDA request failed (403: API key rejected)');
    }

    transientFailure = true;
    throw new Error(`USDA request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

async function fetchFoodDetailsById(fdcId: number): Promise<FoodNutrientProfile | null> {
  const details = await fetchJson<FdcFoodDetails>(`${USDA_API_BASE}/food/${fdcId}?api_key=${encodeURIComponent(USDA_API_KEY)}`);
  if (!details.fdcId) return null;
  return mapFoodToProfile(details);
}

async function searchFood(item: SlotItem): Promise<FoodNutrientProfile | null> {
  for (const query of buildSearchQueries(item)) {
    const search = await fetchJson<{ foods?: FdcSearchResult[] }>(
      `${USDA_API_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=5&api_key=${encodeURIComponent(USDA_API_KEY)}`,
    );

    const normalizedQuery = normalizeText(query);
    const candidates = (search.foods || []).filter((food) => food.fdcId && food.description);
    const bestMatch =
      candidates.find((food) => normalizeText(food.description || '') === normalizedQuery) ||
      candidates.find((food) => normalizeText(food.description || '').includes(normalizedQuery)) ||
      candidates[0];

    if (bestMatch?.fdcId) {
      return fetchFoodDetailsById(bestMatch.fdcId);
    }
  }

  return null;
}

async function resolveNutrientProfile(item: SlotItem): Promise<FoodNutrientProfile | null> {
  const key = makeLookupKey(item);
  const existing = profileCache.get(key);
  if (existing) return existing;

  const task = (async () => {
    const directFdcId = getFdcIdFromFoodId(item.foodId);
    if (directFdcId) {
      return fetchFoodDetailsById(directFdcId);
    }

    return searchFood(item);
  })().catch((error) => {
    if (String(error instanceof Error ? error.message : error).includes('403')) {
      if (!authRejectedLogged) {
        console.warn('USDA nutrient enrichment disabled: API key rejected by FoodData Central.');
        authRejectedLogged = true;
      }
      return null;
    }

    console.warn('USDA nutrient lookup failed for', item.name, error);
    return null;
  });

  profileCache.set(key, task);
  return task;
}

export async function enrichPlanWithUsdaData(plan: WeeklyTherapeuticPlan): Promise<WeeklyTherapeuticPlan> {
  transientFailure = false;

  if (!hasUsdaApiKey) {
    return {
      ...plan,
      notes: [...plan.notes, 'USDA FoodData Central enrichment skipped: no API key configured'],
    };
  }

  let enrichedCount = 0;

  await Promise.all(
    plan.days.flatMap((day) =>
      day.meals.flatMap((meal) =>
        (meal.slots || []).map(async (slot) => {
          if (!slot.item || slot.item.nutrientProfile) return;

          const profile = await resolveNutrientProfile(slot.item);
          if (profile) {
            slot.item = {
              ...slot.item,
              nutrientProfile: profile,
            };
            enrichedCount += 1;
          }
        }),
      ),
    ),
  );

  const validationReport = validateWeeklyPlan(plan);
  const enrichmentNote = authRejected
    ? 'USDA FoodData Central enrichment failed: API key rejected (403)'
    : enrichedCount > 0
      ? `USDA FoodData Central enrichment applied to ${enrichedCount} meal slots`
      : transientFailure
        ? 'USDA FoodData Central enrichment failed: upstream request error'
        : 'USDA FoodData Central enrichment attempted but no matching foods were returned';

  return {
    ...plan,
    clinicalAlignmentScore: calculateAlignmentScore(validationReport),
    validationReport,
    notes: [...plan.notes, enrichmentNote],
  };
}
