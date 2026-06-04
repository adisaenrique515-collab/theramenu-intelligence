/**
 * server/nutrientUtils.ts — Phase 3 nutrient utility functions.
 *
 * Rules enforced here:
 * - EMPTY_NUTRIENTS is the only place where fields are initialised to 0.
 * - During accumulation, a missing (undefined) source field contributes
 *   nothing to the sum; it does NOT silently add 0 as if data were present.
 * - All functions return plain NutrientVector objects (no mutation).
 * - Missing fields are reported via MissingNutrientReport.
 */

import type { NutrientVector, MealPlan, DayPlan, WeeklyTherapeuticPlan } from '../types.ts';

// ── Constants ────────────────────────────────────────────────────────────

/**
 * The canonical ordered list of nutrient fields.
 * Used by loops to avoid touching individual field names in multiple places.
 */
export const NUTRIENT_KEYS: ReadonlyArray<keyof NutrientVector> = Object.freeze([
  'caloriesKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fiberG',
  'sodiumMg',
  'potassiumMg',
  'phosphorusMg',
  'cholesterolMg',
  'saturatedFatG',
  'sugarG',
  'fluidMl',
] as const);

/**
 * EMPTY_NUTRIENTS — the only authoritative zero-initialised NutrientVector.
 * Frozen to prevent accidental mutation.
 */
export const EMPTY_NUTRIENTS: Readonly<NutrientVector> = Object.freeze({
  caloriesKcal:  0,
  proteinG:      0,
  carbsG:        0,
  fatG:          0,
  fiberG:        0,
  sodiumMg:      0,
  potassiumMg:   0,
  phosphorusMg:  0,
  cholesterolMg: 0,
  saturatedFatG: 0,
  sugarG:        0,
  fluidMl:       0,
});

// ── Missing-field tracking ────────────────────────────────────────────────

/**
 * Returned alongside sums to indicate which nutrient fields had no data.
 * A field in missingFields means its contribution to the total is 0, but the
 * real value is unknown — treat that 0 with caution in clinical reports.
 */
export interface MissingNutrientReport {
  /** Fields that were absent in at least one source item. */
  readonly missingFields: ReadonlySet<keyof NutrientVector>;
  /** Number of source items that had at least one missing field. */
  readonly itemsWithMissingData: number;
}

// ── Core arithmetic ──────────────────────────────────────────────────────

/**
 * addNutrients — add b into a.
 * b may be Partial: undefined fields in b contribute 0 (no data) to the result.
 * This is the accumulation operator; 0 here means "no contribution from b"
 * not "this nutrient is known to be zero in b".
 */
export function addNutrients(
  a: NutrientVector,
  b: Partial<NutrientVector>,
): NutrientVector {
  return {
    caloriesKcal:  a.caloriesKcal  + (b.caloriesKcal  ?? 0),
    proteinG:      a.proteinG      + (b.proteinG      ?? 0),
    carbsG:        a.carbsG        + (b.carbsG        ?? 0),
    fatG:          a.fatG          + (b.fatG          ?? 0),
    fiberG:        a.fiberG        + (b.fiberG        ?? 0),
    sodiumMg:      a.sodiumMg      + (b.sodiumMg      ?? 0),
    potassiumMg:   a.potassiumMg   + (b.potassiumMg   ?? 0),
    phosphorusMg:  a.phosphorusMg  + (b.phosphorusMg  ?? 0),
    cholesterolMg: a.cholesterolMg + (b.cholesterolMg ?? 0),
    saturatedFatG: a.saturatedFatG + (b.saturatedFatG ?? 0),
    sugarG:        a.sugarG        + (b.sugarG        ?? 0),
    fluidMl:       a.fluidMl       + (b.fluidMl       ?? 0),
  };
}

/**
 * scaleNutrients — multiply every field by a scalar.
 * Used to convert per-100g values to a serving size.
 * multiplier must be finite and ≥ 0; throws on invalid input.
 */
export function scaleNutrients(
  nutrients: NutrientVector,
  multiplier: number,
): NutrientVector {
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError(`scaleNutrients: multiplier must be finite and ≥ 0, got ${multiplier}`);
  }
  return {
    caloriesKcal:  nutrients.caloriesKcal  * multiplier,
    proteinG:      nutrients.proteinG      * multiplier,
    carbsG:        nutrients.carbsG        * multiplier,
    fatG:          nutrients.fatG          * multiplier,
    fiberG:        nutrients.fiberG        * multiplier,
    sodiumMg:      nutrients.sodiumMg      * multiplier,
    potassiumMg:   nutrients.potassiumMg   * multiplier,
    phosphorusMg:  nutrients.phosphorusMg  * multiplier,
    cholesterolMg: nutrients.cholesterolMg * multiplier,
    saturatedFatG: nutrients.saturatedFatG * multiplier,
    sugarG:        nutrients.sugarG        * multiplier,
    fluidMl:       nutrients.fluidMl       * multiplier,
  };
}

/**
 * sumNutrients — sum an array of Partial<NutrientVector>.
 * Returns { total, missing } so callers know which fields had data gaps.
 * An empty array returns EMPTY_NUTRIENTS with no missing fields.
 */
export function sumNutrients(items: ReadonlyArray<Partial<NutrientVector>>): {
  total: NutrientVector;
  missing: MissingNutrientReport;
} {
  const missingFields = new Set<keyof NutrientVector>();
  let itemsWithMissingData = 0;

  let total: NutrientVector = { ...EMPTY_NUTRIENTS };

  for (const item of items) {
    let itemHadMissing = false;
    for (const key of NUTRIENT_KEYS) {
      if (item[key] === undefined || item[key] === null) {
        missingFields.add(key);
        itemHadMissing = true;
      }
    }
    if (itemHadMissing) itemsWithMissingData++;
    total = addNutrients(total, item);
  }

  return {
    total,
    missing: { missingFields, itemsWithMissingData },
  };
}

// ── Serving calculation ───────────────────────────────────────────────────

export interface ServingNutrients {
  /** Scaled NutrientVector for the given serving size. */
  readonly nutrients: NutrientVector;
  /** Nutrient fields that were absent in the per-100g source. */
  readonly missingFields: ReadonlySet<keyof NutrientVector>;
}

/**
 * calculateNutrientsForServing — scale per-100g nutrient data to a serving.
 *
 * @param per100g   Nutrient values per 100g. May be Partial (some unknown).
 * @param grams     Serving size in grams. Must be > 0.
 *
 * Fields that are undefined in per100g are recorded in missingFields.
 * Their contribution to nutrients is 0, NOT an estimate.
 */
export function calculateNutrientsForServing(
  per100g: Partial<NutrientVector>,
  grams: number,
): ServingNutrients {
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new RangeError(`calculateNutrientsForServing: grams must be > 0, got ${grams}`);
  }

  const factor = grams / 100;
  const missing = new Set<keyof NutrientVector>();

  function scale(key: keyof NutrientVector): number {
    const v = per100g[key];
    if (v === undefined || v === null) {
      missing.add(key);
      return 0;
    }
    return v * factor;
  }

  const nutrients: NutrientVector = {
    caloriesKcal:  scale('caloriesKcal'),
    proteinG:      scale('proteinG'),
    carbsG:        scale('carbsG'),
    fatG:          scale('fatG'),
    fiberG:        scale('fiberG'),
    sodiumMg:      scale('sodiumMg'),
    potassiumMg:   scale('potassiumMg'),
    phosphorusMg:  scale('phosphorusMg'),
    cholesterolMg: scale('cholesterolMg'),
    saturatedFatG: scale('saturatedFatG'),
    sugarG:        scale('sugarG'),
    fluidMl:       scale('fluidMl'),
  };

  return { nutrients, missingFields: missing };
}

// ── Portion parsing ───────────────────────────────────────────────────────

/**
 * parsePortionGrams — extract gram weight from a portion string.
 * Handles: "120g", "200ml", "1.5 cup" (1 cup = 240ml), "serving" (120g default).
 * Returns null if the string cannot be parsed (caller decides fallback).
 */
export function parsePortionGrams(portion: string | undefined): number | null {
  if (!portion) return null;
  const s = portion.trim().toLowerCase();

  const gMatch = s.match(/^(\d+(?:\.\d+)?)\s*g\b/);
  if (gMatch) return Number(gMatch[1]);

  const mlMatch = s.match(/^(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) return Number(mlMatch[1]);

  const cupMatch = s.match(/^(\d+(?:\.\d+)?)\s*cup/);
  if (cupMatch) return Number(cupMatch[1]) * 240;

  if (s.includes('serving')) return 120;

  return null;
}

// ── FoodNutrientProfile → Partial<NutrientVector> ────────────────────────

/**
 * Internal adapter: convert FoodNutrientProfile field names to NutrientVector keys.
 * fluidMl is excluded — it is not stored per-100g in a nutrient profile.
 */
function profileToPartialVector(profile: {
  caloriesKcalPer100: number;
  proteinGPer100: number;
  carbsGPer100: number;
  fatGPer100: number;
  fiberGPer100: number;
  sodiumMgPer100: number;
  potassiumMgPer100: number;
  phosphorusMgPer100: number;
  cholesterolMgPer100: number;
  saturatedFatGPer100: number;
  sugarGPer100: number;
}): Partial<NutrientVector> {
  return {
    caloriesKcal:  profile.caloriesKcalPer100,
    proteinG:      profile.proteinGPer100,
    carbsG:        profile.carbsGPer100,
    fatG:          profile.fatGPer100,
    fiberG:        profile.fiberGPer100,
    sodiumMg:      profile.sodiumMgPer100,
    potassiumMg:   profile.potassiumMgPer100,
    phosphorusMg:  profile.phosphorusMgPer100,
    cholesterolMg: profile.cholesterolMgPer100,
    saturatedFatG: profile.saturatedFatGPer100,
    sugarG:        profile.sugarGPer100,
    // fluidMl intentionally absent — tracked separately from nutrients
  };
}

// ── Meal / Day / Week accumulation ────────────────────────────────────────

const DEFAULT_PORTION_GRAMS = 100;

/**
 * sumMealNutrients — sum all filled slot items in a single MealPlan.
 *
 * Nutrient data is sourced from slot.item.nutrientProfile when present.
 * Slots with null items or no nutrient profile are skipped (not assumed zero).
 */
export function sumMealNutrients(meal: MealPlan): {
  total: NutrientVector;
  missing: MissingNutrientReport;
  skippedSlots: number;
} {
  const partials: Partial<NutrientVector>[] = [];
  let skippedSlots = 0;

  for (const slot of meal.slots ?? []) {
    const item = slot.item;
    if (!item) { skippedSlots++; continue; }

    const grams = parsePortionGrams(item.portion) ?? DEFAULT_PORTION_GRAMS;

    if (item.nutrientProfile) {
      const per100g = profileToPartialVector(item.nutrientProfile);
      const { nutrients } = calculateNutrientsForServing(per100g, grams);
      partials.push(nutrients);
    } else {
      // Slot has an item but no nutrient data — count it but don't assume zero.
      skippedSlots++;
    }
  }

  const { total, missing } = sumNutrients(partials);
  return { total, missing, skippedSlots };
}

/**
 * sumDailyNutrients — sum all meals in a DayPlan.
 */
export function sumDailyNutrients(day: DayPlan): {
  total: NutrientVector;
  missing: MissingNutrientReport;
  skippedSlots: number;
} {
  const mealTotals: NutrientVector[] = [];
  const combinedMissing = new Set<keyof NutrientVector>();
  let totalSkipped = 0;
  let itemsWithMissingData = 0;

  for (const meal of day.meals) {
    const { total, missing, skippedSlots } = sumMealNutrients(meal);
    mealTotals.push(total);
    totalSkipped += skippedSlots;
    for (const f of missing.missingFields) combinedMissing.add(f);
    if (missing.itemsWithMissingData > 0) itemsWithMissingData++;
  }

  const { total } = sumNutrients(mealTotals);
  return {
    total,
    missing: { missingFields: combinedMissing, itemsWithMissingData },
    skippedSlots: totalSkipped,
  };
}

/**
 * sumWeeklyNutrients — sum all days in a WeeklyTherapeuticPlan.
 * Returns the 7-day totals alongside a missing-field report.
 */
export function sumWeeklyNutrients(plan: WeeklyTherapeuticPlan): {
  total: NutrientVector;
  missing: MissingNutrientReport;
  skippedSlots: number;
} {
  const dayTotals: NutrientVector[] = [];
  const combinedMissing = new Set<keyof NutrientVector>();
  let totalSkipped = 0;
  let itemsWithMissingData = 0;

  for (const day of plan.days) {
    const { total, missing, skippedSlots } = sumDailyNutrients(day);
    dayTotals.push(total);
    totalSkipped += skippedSlots;
    for (const f of missing.missingFields) combinedMissing.add(f);
    if (missing.itemsWithMissingData > 0) itemsWithMissingData++;
  }

  const { total } = sumNutrients(dayTotals);
  return {
    total,
    missing: { missingFields: combinedMissing, itemsWithMissingData },
    skippedSlots: totalSkipped,
  };
}
