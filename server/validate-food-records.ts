/**
 * server/validate-food-records.ts — Phase 8: Clinical food record validation.
 *
 * Validates FoodItem records imported from USDA FDC (or other sources) against
 * clinical data-quality requirements before they enter the dietitian review queue.
 *
 * Errors block the record from the review queue.
 * Warnings require human review but do not block import.
 *
 * Rules:
 *   - approvalStatus must never be 'approved' for a freshly imported record.
 *   - source must be a known NutrientSource.
 *   - Caloric plausibility: 0–900 kcal/100 g (physical upper bound for pure fat).
 *   - Macronutrient sum must not exceed caloric upper bound.
 *   - Missing nutrients (other than fluidMl which is always absent) generate warnings.
 *   - Empty id or canonicalName are errors (not warnings).
 */

import type { FoodItem, NutrientSource } from '../types-clinical.ts';

// ── Result types ──────────────────────────────────────────────────────────

export interface FoodRecordValidationResult {
  readonly foodId: string;
  readonly canonicalName: string;
  readonly valid: boolean;
  /** Hard failures — the record must not advance to the review queue. */
  readonly errors: ReadonlyArray<string>;
  /** Soft findings — require human review but do not block import. */
  readonly warnings: ReadonlyArray<string>;
}

export interface BatchValidationSummary {
  readonly totalRecords: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly results: ReadonlyArray<FoodRecordValidationResult>;
}

// ── Known source values ───────────────────────────────────────────────────

const KNOWN_SOURCES: ReadonlySet<NutrientSource> = new Set<NutrientSource>([
  'USDA_FDC', 'AUSNUT', 'LOCAL_TRUSTED', 'CURATED', 'ESTIMATED', 'RESEARCH',
]);

// ── Single-record validation ──────────────────────────────────────────────

/**
 * validateFoodRecord — validate one FoodItem against clinical data requirements.
 *
 * Does NOT modify the food record.
 */
export function validateFoodRecord(food: FoodItem): FoodRecordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const id = food.id ?? '';
  const name = food.canonicalName ?? '';

  // ── Structural errors ─────────────────────────────────────────────────

  if (!id.trim()) {
    errors.push('Food record has an empty or missing id.');
  }

  if (!name.trim()) {
    errors.push('Food record has an empty or missing canonicalName.');
  }

  // An approved status on a freshly imported record means automatic approval,
  // which is prohibited. This is a blocker — a dietitian must explicitly approve.
  if (food.approvalStatus === 'approved') {
    errors.push(
      `Food "${name}" (${id}) has approvalStatus "approved". ` +
      'Imported records must start as "pending_review". Automatic approval is prohibited.',
    );
  }

  if (!KNOWN_SOURCES.has(food.source)) {
    errors.push(
      `Food "${name}" (${id}) has unknown source "${food.source}". ` +
      `Valid sources: ${[...KNOWN_SOURCES].join(', ')}.`,
    );
  }

  if (!food.fdcId && food.source === 'USDA_FDC') {
    errors.push(
      `Food "${name}" (${id}) has source "USDA_FDC" but is missing fdcId.`,
    );
  }

  // ── Caloric plausibility ──────────────────────────────────────────────

  const kcal = food.nutrientsPer100g.caloriesKcal;
  if (kcal < 0) {
    errors.push(
      `Food "${name}": caloriesKcal (${kcal}) is negative — impossible value.`,
    );
  } else if (kcal > 900) {
    // 900 kcal/100g is the physical maximum for pure fat.
    errors.push(
      `Food "${name}": caloriesKcal (${kcal}) exceeds 900 kcal/100g — physical impossibility.`,
    );
  }

  // ── Macronutrient plausibility ────────────────────────────────────────

  const n = food.nutrientsPer100g;
  // Atwater factors: protein×4, carbs×4, fat×9 (alcohol excluded)
  const impliedKcal = n.proteinG * 4 + n.carbsG * 4 + n.fatG * 9;
  if (kcal > 0 && impliedKcal > 0) {
    const ratio = impliedKcal / kcal;
    if (ratio > 1.5) {
      warnings.push(
        `Food "${name}": macronutrient sum (${impliedKcal.toFixed(0)} kcal equiv.) ` +
        `is more than 150% of stated calories (${kcal} kcal/100g). ` +
        'Check source data for labelling errors.',
      );
    }
  }

  // ── Missing nutrient warnings ─────────────────────────────────────────

  const missingSet = new Set(food.missingNutrients);

  // fluidMl is expected to be missing from FDC imports — no warning needed.
  const EXPECTED_MISSING = new Set<keyof typeof n>(['fluidMl']);

  // Core macronutrients: missing any of these is a clinical risk.
  const CORE_MACRO: ReadonlyArray<keyof typeof n> = [
    'caloriesKcal', 'proteinG', 'carbsG', 'fatG',
  ];
  for (const field of CORE_MACRO) {
    if (missingSet.has(field) && !EXPECTED_MISSING.has(field)) {
      warnings.push(
        `Food "${name}": core macronutrient "${field}" is missing from the source data. ` +
        'Nutrient calculations using this food will be inaccurate.',
      );
    }
  }

  // Renal-critical nutrients: warn if missing (phosphorus, potassium, sodium).
  const RENAL_CRITICAL: ReadonlyArray<keyof typeof n> = [
    'sodiumMg', 'potassiumMg', 'phosphorusMg',
  ];
  for (const field of RENAL_CRITICAL) {
    if (missingSet.has(field) && !EXPECTED_MISSING.has(field)) {
      warnings.push(
        `Food "${name}": renal-critical nutrient "${field}" is missing. ` +
        'This food cannot be safely used in renal protocols without verified data.',
      );
    }
  }

  // Warn on total missing count beyond fluidMl
  const nonFluidMissing = food.missingNutrients.filter((f) => f !== 'fluidMl');
  if (nonFluidMissing.length >= 6) {
    warnings.push(
      `Food "${name}" has ${nonFluidMissing.length} missing nutrient fields: ` +
      `[${nonFluidMissing.join(', ')}]. ` +
      'This record has insufficient nutrient data for clinical use.',
    );
  }

  // ── Allergen / contraindication completeness ──────────────────────────

  if (food.source === 'USDA_FDC' && food.allergens.length === 0) {
    warnings.push(
      `Food "${name}": allergen list is empty. ` +
      'USDA FDC data does not include allergen information — a dietitian must review.',
    );
  }

  if (food.contraindicatedFor.length === 0) {
    warnings.push(
      `Food "${name}": contraindicatedFor list is empty. ` +
      'Clinical contraindications must be verified before the food is approved.',
    );
  }

  // ── Texture levels ────────────────────────────────────────────────────

  if (food.textureLevels.length === 0) {
    errors.push(
      `Food "${name}": textureLevels is empty. ` +
      'At least one IDDSI texture level must be declared.',
    );
  }

  return {
    foodId: id,
    canonicalName: name,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Batch validation ──────────────────────────────────────────────────────

/**
 * validateFoodRecords — validate a batch of FoodItem records.
 * Returns a BatchValidationSummary with per-record results and aggregate counts.
 */
export function validateFoodRecords(
  foods: ReadonlyArray<FoodItem>,
): BatchValidationSummary {
  const results = foods.map(validateFoodRecord);
  const validCount = results.filter((r) => r.valid).length;

  return {
    totalRecords: foods.length,
    validCount,
    invalidCount: results.length - validCount,
    results,
  };
}
