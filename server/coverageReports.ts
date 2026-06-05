/**
 * server/coverageReports.ts — Phase 9: Clinical food database coverage reporting.
 *
 * Analyses a collection of FoodItem records against a set of clinical protocols
 * and produces a structured CoverageReport describing data-quality gaps,
 * coverage shortfalls, and rotation readiness.
 *
 * Design rules:
 *   - Read-only: never modifies food records or protocols.
 *   - No USDA API calls, no auto-approval.
 *   - Approved foods and pending_review foods are counted separately throughout.
 *   - Severity hierarchy: blocker > critical > warning > info.
 *   - Blockers: zero eligible approved foods for a required slot; total approved
 *     below the hard minimum; empty textureLevels on any food.
 *   - Criticals: renal-critical nutrients missing; categories well below threshold;
 *     approved food with ESTIMATED source; diagnosis with severely low eligibles.
 *   - Warnings: everything below threshold but not critical; pending counts; etc.
 *   - Infos: pending_review counts and other non-urgent FYI metrics.
 */

import type {
  FoodItem,
  FoodCategory,
  TextureLevel,
  MealTypeKey,
  DiagnosisCode,
  GovernanceState,
  VersionedClinicalProtocol,
} from '../types-clinical.ts';

// ── Coverage thresholds ───────────────────────────────────────────────────

/**
 * CoverageThresholds — minimum approved-food counts for each category group.
 * All fields are required so partial objects must be merged with DEFAULT_THRESHOLDS.
 */
export interface CoverageThresholds {
  /** grain + starch combined */
  readonly grainStarch:            number;
  /** protein (meat, fish, eggs, poultry) */
  readonly protein:                number;
  /** vegetables */
  readonly vegetable:              number;
  /** fruits */
  readonly fruit:                  number;
  /** dairy and dairy alternatives */
  readonly dairyAlternatives:      number;
  /** fats and oils */
  readonly fatsOils:               number;
  /** broths and fluids */
  readonly brothsFluids:           number;
  /** legumes */
  readonly legumes:                number;
  /** hard floor — total approved foods below this is a BLOCKER */
  readonly minTotalApproved:       number;
  /** soft ceiling — below this generates a WARNING */
  readonly recommendedTotalApproved: number;
  /** minimum approved foods per required slot before a CRITICAL is raised */
  readonly minFoodsPerSlot:        number;
  /** minimum rotation pool per (category × diagnosis) before a WARNING */
  readonly minRotationPoolPerCombination: number;
  /** minimum approved foods per texture level before a WARNING */
  readonly minFoodsPerTexture:     number;
  /** minimum approved foods per main meal type before a WARNING */
  readonly minFoodsPerMealType:    number;
}

export const DEFAULT_THRESHOLDS: CoverageThresholds = {
  grainStarch:                   12,
  protein:                       15,
  vegetable:                     20,
  fruit:                         10,
  dairyAlternatives:              6,
  fatsOils:                       4,
  brothsFluids:                   4,
  legumes:                        6,
  minTotalApproved:              77,
  recommendedTotalApproved:     150,
  minFoodsPerSlot:                3,
  minRotationPoolPerCombination:  3,
  minFoodsPerTexture:             5,
  minFoodsPerMealType:           10,
};

// ── Issue types ───────────────────────────────────────────────────────────

export type CoverageSeverity = 'blocker' | 'critical' | 'warning' | 'info';

export interface CoverageIssue {
  readonly severity:      CoverageSeverity;
  readonly code:          string;
  readonly message:       string;
  /** Count of affected food records. */
  readonly affectedCount?: number;
  /** IDs (truncated to 20) of affected records. */
  readonly affectedIds?:   ReadonlyArray<string>;
  readonly category?:      string;
  readonly diagnosisCode?: string;
  readonly slotName?:      string;
  readonly textureLevel?:  string;
  readonly mealType?:      string;
  /** Observed value (count, score, etc.) */
  readonly observed?:      number;
  /** Threshold that was not met */
  readonly threshold?:     number;
}

export interface CoverageSummary {
  readonly blockerCount:  number;
  readonly criticalCount: number;
  readonly warningCount:  number;
  readonly infoCount:     number;
}

export interface FoodStatusBreakdown {
  readonly total:         number;
  readonly approved:      number;
  readonly pendingReview: number;
  readonly draft:         number;
  readonly retired:       number;
}

export interface CoverageReport {
  readonly generatedAt:    string;
  readonly foodStatus:     FoodStatusBreakdown;
  readonly issues:         ReadonlyArray<CoverageIssue>;
  readonly summary:        CoverageSummary;
  /** True if any blocker issue is present. */
  readonly hasCriticalGaps: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────

const TEXTURE_LEVELS: ReadonlyArray<TextureLevel> = [
  'regular', 'soft', 'minced', 'pureed', 'liquid',
];

const ALL_MEAL_TYPES: ReadonlyArray<MealTypeKey> = [
  'Breakfast', 'Snack AM', 'Lunch', 'Snack PM', 'Dinner', 'Snack Eve',
];

const MAIN_MEAL_TYPES: ReadonlyArray<MealTypeKey> = [
  'Breakfast', 'Lunch', 'Dinner',
];

/** Renal-critical nutrients that must be present on every food record. */
const RENAL_CRITICAL_NUTRIENTS: ReadonlyArray<keyof Pick<
  FoodItem['nutrientsPer100g'],
  'potassiumMg' | 'phosphorusMg' | 'sodiumMg'
>> = ['potassiumMg', 'phosphorusMg', 'sodiumMg'];

function truncateIds(ids: string[], limit = 20): string[] {
  return ids.slice(0, limit);
}

function isApproved(food: FoodItem): boolean {
  return food.approvalStatus === 'approved';
}

// ── Section 1: Food status breakdown ─────────────────────────────────────

function buildStatusBreakdown(foods: ReadonlyArray<FoodItem>): FoodStatusBreakdown {
  let approved = 0, pendingReview = 0, draft = 0, retired = 0;
  for (const f of foods) {
    if      (f.approvalStatus === 'approved')       approved++;
    else if (f.approvalStatus === 'pending_review') pendingReview++;
    else if (f.approvalStatus === 'draft')           draft++;
    else if (f.approvalStatus === 'retired')         retired++;
  }
  return { total: foods.length, approved, pendingReview, draft, retired };
}

// ── Section 2: Data quality — missing nutrients ───────────────────────────

function reportMissingNutrients(foods: ReadonlyArray<FoodItem>): CoverageIssue[] {
  const issues: CoverageIssue[] = [];

  const RENAL_FIELDS: ReadonlyArray<{ key: keyof FoodItem['nutrientsPer100g'] & string; label: string }> = [
    { key: 'potassiumMg',  label: 'potassium' },
    { key: 'phosphorusMg', label: 'phosphorus' },
    { key: 'sodiumMg',     label: 'sodium' },
  ];

  for (const { key, label } of RENAL_FIELDS) {
    const affected = foods.filter((f) => f.missingNutrients.includes(key));
    if (affected.length === 0) continue;
    const approvedAffected = affected.filter(isApproved);

    issues.push({
      severity:     'critical',
      code:         `FOODS_MISSING_${key.toUpperCase()}`,
      message:
        `${affected.length} food(s) are missing ${label} data ` +
        `(${approvedAffected.length} approved). ` +
        `Missing ${label} prevents safe use in renal protocols.`,
      affectedCount: affected.length,
      affectedIds:   truncateIds(affected.map((f) => f.id)),
    });
  }

  // Other non-renal macros: warning level
  const macroFields: ReadonlyArray<{ key: keyof FoodItem['nutrientsPer100g'] & string; label: string }> = [
    { key: 'caloriesKcal', label: 'calories' },
    { key: 'proteinG',     label: 'protein (macro)' },
    { key: 'carbsG',       label: 'carbohydrates' },
    { key: 'fatG',         label: 'fat' },
  ];

  for (const { key, label } of macroFields) {
    const affected = foods.filter((f) => f.missingNutrients.includes(key) && isApproved(f));
    if (affected.length === 0) continue;
    issues.push({
      severity:     'warning',
      code:         `APPROVED_FOODS_MISSING_${key.toUpperCase()}`,
      message:
        `${affected.length} approved food(s) are missing ${label} data. ` +
        `Nutrient calculations using these foods will be inaccurate.`,
      affectedCount: affected.length,
      affectedIds:   truncateIds(affected.map((f) => f.id)),
    });
  }

  return issues;
}

// ── Section 3: Data quality — missing metadata ────────────────────────────

function reportMissingMetadata(foods: ReadonlyArray<FoodItem>): CoverageIssue[] {
  const issues: CoverageIssue[] = [];

  // Missing allergen declarations
  const noAllergenData = foods.filter((f) => f.allergens.length === 0 && isApproved(f));
  if (noAllergenData.length > 0) {
    issues.push({
      severity:     'warning',
      code:         'FOODS_MISSING_ALLERGENS',
      message:
        `${noAllergenData.length} approved food(s) have no allergen declarations. ` +
        `These foods cannot be safely excluded from allergen-restricted patients.`,
      affectedCount: noAllergenData.length,
      affectedIds:   truncateIds(noAllergenData.map((f) => f.id)),
    });
  }

  // Empty texture levels — BLOCKER: cannot be scheduled for any patient
  const noTexture = foods.filter((f) => f.textureLevels.length === 0);
  if (noTexture.length > 0) {
    issues.push({
      severity:     'blocker',
      code:         'FOODS_MISSING_TEXTURE_LEVELS',
      message:
        `${noTexture.length} food(s) have no IDDSI texture levels declared. ` +
        `These foods cannot be used in any meal plan generation.`,
      affectedCount: noTexture.length,
      affectedIds:   truncateIds(noTexture.map((f) => f.id)),
    });
  }

  // Approved foods with ESTIMATED source — critical (unreliable for clinical decisions)
  const estimatedApproved = foods.filter((f) => isApproved(f) && f.source === 'ESTIMATED');
  if (estimatedApproved.length > 0) {
    issues.push({
      severity:     'critical',
      code:         'FOODS_ESTIMATED_SOURCE',
      message:
        `${estimatedApproved.length} approved food(s) have source "ESTIMATED". ` +
        `Estimated nutrient values are not clinically reliable and must be replaced ` +
        `with verified source data before use in production.`,
      affectedCount: estimatedApproved.length,
      affectedIds:   truncateIds(estimatedApproved.map((f) => f.id)),
    });
  }

  // Missing source metadata — any non-ESTIMATED source is acceptable; flag foods
  // that have no traceable source at all (source === 'ESTIMATED' already covered above)
  const noSourceMeta = foods.filter(
    (f) => isApproved(f) && f.source === 'ESTIMATED' && !f.fdcId && !f.verifiedBy,
  );
  if (noSourceMeta.length > 0) {
    issues.push({
      severity:     'critical',
      code:         'FOODS_MISSING_SOURCE_METADATA',
      message:
        `${noSourceMeta.length} approved food(s) have no source traceability ` +
        `(ESTIMATED source, no FDC ID, no verifiedBy). ` +
        `Approved foods must have at least one form of source provenance.`,
      affectedCount: noSourceMeta.length,
      affectedIds:   truncateIds(noSourceMeta.map((f) => f.id)),
    });
  }

  // Pending-review foods count — informational (not a gap per se, but useful)
  const pendingCount = foods.filter((f) => f.approvalStatus === 'pending_review').length;
  if (pendingCount > 0) {
    issues.push({
      severity:     'info',
      code:         'FOODS_PENDING_REVIEW',
      message:
        `${pendingCount} food(s) are pending dietitian review and cannot be used ` +
        `in production meal plan generation.`,
      affectedCount: pendingCount,
      observed:      pendingCount,
    });
  }

  // Missing preparation state — conservative: flag unverified-confidence foods
  // with preparation state 'cooked' (the default fallback in import)
  const unknownPrep = foods.filter(
    (f) => f.confidence === 'unverified' && f.preparationState === 'cooked' && isApproved(f),
  );
  if (unknownPrep.length > 0) {
    issues.push({
      severity:     'warning',
      code:         'FOODS_MISSING_PREPARATION_STATE',
      message:
        `${unknownPrep.length} approved food(s) have preparation state "cooked" ` +
        `with confidence "unverified" — this is the import default and may not ` +
        `reflect the actual preparation state. Review recommended.`,
      affectedCount: unknownPrep.length,
      affectedIds:   truncateIds(unknownPrep.map((f) => f.id)),
    });
  }

  return issues;
}

// ── Section 4: Category coverage ─────────────────────────────────────────

type CategoryGroup =
  | 'grainStarch'
  | 'protein'
  | 'vegetable'
  | 'fruit'
  | 'dairyAlternatives'
  | 'fatsOils'
  | 'brothsFluids'
  | 'legumes';

const CATEGORY_GROUPS: ReadonlyArray<{
  group: CategoryGroup;
  label: string;
  categories: ReadonlyArray<FoodCategory>;
}> = [
  { group: 'grainStarch',       label: 'Grains/Starches',    categories: ['grain', 'starch'] },
  { group: 'protein',           label: 'Proteins',           categories: ['protein'] },
  { group: 'vegetable',         label: 'Vegetables',         categories: ['vegetable'] },
  { group: 'fruit',             label: 'Fruits',             categories: ['fruit'] },
  { group: 'dairyAlternatives', label: 'Dairy/Alternatives', categories: ['dairy'] },
  { group: 'fatsOils',          label: 'Fats/Oils',          categories: ['fat'] },
  { group: 'brothsFluids',      label: 'Broths/Fluids',      categories: ['broth', 'beverage'] },
  { group: 'legumes',           label: 'Legumes',            categories: ['legume'] },
];

function reportCategoryCoverage(
  foods: ReadonlyArray<FoodItem>,
  thresholds: CoverageThresholds,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const approvedFoods = foods.filter(isApproved);

  // Total approved check
  const totalApproved = approvedFoods.length;
  if (totalApproved < thresholds.minTotalApproved) {
    issues.push({
      severity:  'blocker',
      code:      'TOTAL_INSUFFICIENT_APPROVED_FOODS',
      message:
        `Total approved foods (${totalApproved}) is below the hard minimum of ` +
        `${thresholds.minTotalApproved}. Plan generation is not safe until this ` +
        `threshold is met.`,
      observed:  totalApproved,
      threshold: thresholds.minTotalApproved,
    });
  } else if (totalApproved < thresholds.recommendedTotalApproved) {
    issues.push({
      severity:  'warning',
      code:      'TOTAL_BELOW_RECOMMENDED_FOODS',
      message:
        `Total approved foods (${totalApproved}) is below the recommended minimum of ` +
        `${thresholds.recommendedTotalApproved}. Meal variety and rotation may be limited.`,
      observed:  totalApproved,
      threshold: thresholds.recommendedTotalApproved,
    });
  }

  // Per-category checks
  for (const { group, label, categories } of CATEGORY_GROUPS) {
    const count = approvedFoods.filter((f) => categories.includes(f.category)).length;
    const threshold = thresholds[group];

    if (count === 0) {
      issues.push({
        severity:  'blocker',
        code:      'CATEGORY_NO_APPROVED_FOODS',
        message:   `Category "${label}" has zero approved foods. Meal plans cannot be generated.`,
        category:  label,
        observed:  0,
        threshold,
      });
    } else if (count < Math.ceil(threshold / 2)) {
      issues.push({
        severity:  'critical',
        code:      'CATEGORY_CRITICALLY_LOW_COVERAGE',
        message:
          `Category "${label}" has only ${count} approved food(s) ` +
          `(less than half the minimum of ${threshold}). ` +
          `Meal variety is critically inadequate.`,
        category:  label,
        observed:  count,
        threshold,
      });
    } else if (count < threshold) {
      issues.push({
        severity:  'warning',
        code:      'CATEGORY_INSUFFICIENT_COVERAGE',
        message:
          `Category "${label}" has ${count} approved food(s), ` +
          `below the recommended minimum of ${threshold}.`,
        category:  label,
        observed:  count,
        threshold,
      });
    }
  }

  return issues;
}

// ── Section 5: Diagnosis eligibility coverage ─────────────────────────────

/**
 * For each protocol, count how many approved foods are eligible for the diagnosis
 * (not contraindicated). Uses 'regular' texture as a conservative baseline.
 * Warnings are generated when the pool is too small for safe rotation.
 */
function reportDiagnosisCoverage(
  foods: ReadonlyArray<FoodItem>,
  protocols: ReadonlyArray<VersionedClinicalProtocol>,
  thresholds: CoverageThresholds,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const approvedFoods = foods.filter(isApproved);

  for (const protocol of protocols) {
    const dx = protocol.diagnosisCode as string;

    const eligible = approvedFoods.filter(
      (f) => !f.contraindicatedFor.includes(protocol.diagnosisCode) &&
              f.textureLevels.includes('regular'),
    );

    const DIAGNOSIS_MINIMUM = 15;
    const DIAGNOSIS_CRITICAL = 8;

    if (eligible.length === 0) {
      issues.push({
        severity:      'blocker',
        code:          'DIAGNOSIS_NO_ELIGIBLE_FOODS',
        message:
          `Diagnosis "${dx}" has zero eligible approved foods (regular texture, non-contraindicated). ` +
          `Plan generation is impossible.`,
        diagnosisCode: dx,
        observed:      0,
        threshold:     DIAGNOSIS_MINIMUM,
      });
    } else if (eligible.length < DIAGNOSIS_CRITICAL) {
      issues.push({
        severity:      'critical',
        code:          'DIAGNOSIS_CRITICALLY_LOW_ELIGIBLE_FOODS',
        message:
          `Diagnosis "${dx}" has only ${eligible.length} eligible approved food(s). ` +
          `Critically insufficient for clinical meal plan generation.`,
        diagnosisCode: dx,
        observed:      eligible.length,
        threshold:     DIAGNOSIS_MINIMUM,
      });
    } else if (eligible.length < DIAGNOSIS_MINIMUM) {
      issues.push({
        severity:      'warning',
        code:          'DIAGNOSIS_INSUFFICIENT_ELIGIBLE_FOODS',
        message:
          `Diagnosis "${dx}" has ${eligible.length} eligible approved food(s), ` +
          `below the recommended minimum of ${DIAGNOSIS_MINIMUM}.`,
        diagnosisCode: dx,
        observed:      eligible.length,
        threshold:     DIAGNOSIS_MINIMUM,
      });
    }
  }

  return issues;
}

// ── Section 6: Required slot coverage ────────────────────────────────────

/**
 * For each required slot template across all protocols, count how many approved
 * foods fall in the slot's allowedCategories and are not contraindicated for the
 * protocol's diagnosis.
 *
 * Zero eligible approved foods for a required slot is a BLOCKER.
 * Fewer than minFoodsPerSlot is a CRITICAL.
 */
function reportSlotCoverage(
  foods: ReadonlyArray<FoodItem>,
  protocols: ReadonlyArray<VersionedClinicalProtocol>,
  thresholds: CoverageThresholds,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const approvedFoods = foods.filter(isApproved);

  for (const protocol of protocols) {
    const dx = protocol.diagnosisCode as string;
    // Deduplicate: slot templates repeat for each meal type — check per unique (mealType, slotName)
    const seen = new Set<string>();

    for (const template of protocol.slotTemplates) {
      if (!template.required) continue;
      const key = `${template.mealType}:${template.slotName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const eligible = approvedFoods.filter(
        (f) =>
          template.allowedCategories.includes(f.category) &&
          !f.contraindicatedFor.includes(protocol.diagnosisCode) &&
          f.textureLevels.includes('regular'),
      );

      if (eligible.length === 0) {
        issues.push({
          severity:      'blocker',
          code:          'SLOT_NO_ELIGIBLE_APPROVED_FOODS',
          message:
            `Required slot "${template.slotName}" in ${template.mealType} ` +
            `(diagnosis "${dx}") has zero eligible approved foods. ` +
            `Plan generation for this diagnosis is blocked.`,
          diagnosisCode: dx,
          slotName:      template.slotName,
          mealType:      template.mealType,
          observed:      0,
          threshold:     thresholds.minFoodsPerSlot,
        });
      } else if (eligible.length < thresholds.minFoodsPerSlot) {
        issues.push({
          severity:      'critical',
          code:          'SLOT_INSUFFICIENT_ELIGIBLE_FOODS',
          message:
            `Required slot "${template.slotName}" in ${template.mealType} ` +
            `(diagnosis "${dx}") has only ${eligible.length} eligible approved food(s) ` +
            `(minimum ${thresholds.minFoodsPerSlot} for rotation).`,
          diagnosisCode: dx,
          slotName:      template.slotName,
          mealType:      template.mealType,
          observed:      eligible.length,
          threshold:     thresholds.minFoodsPerSlot,
        });
      }
    }
  }

  return issues;
}

// ── Section 7: Texture level coverage ────────────────────────────────────

function reportTextureCoverage(
  foods: ReadonlyArray<FoodItem>,
  thresholds: CoverageThresholds,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const approvedFoods = foods.filter(isApproved);

  for (const texture of TEXTURE_LEVELS) {
    const count = approvedFoods.filter((f) => f.textureLevels.includes(texture)).length;

    if (count === 0) {
      issues.push({
        severity:     'blocker',
        code:         'TEXTURE_NO_APPROVED_FOODS',
        message:
          `IDDSI texture level "${texture}" has zero approved foods. ` +
          `Patients requiring this texture cannot receive a meal plan.`,
        textureLevel: texture,
        observed:     0,
        threshold:    thresholds.minFoodsPerTexture,
      });
    } else if (count < thresholds.minFoodsPerTexture) {
      issues.push({
        severity:     'warning',
        code:         'TEXTURE_INSUFFICIENT_COVERAGE',
        message:
          `IDDSI texture level "${texture}" has only ${count} approved food(s) ` +
          `(minimum ${thresholds.minFoodsPerTexture} recommended for adequate variety).`,
        textureLevel: texture,
        observed:     count,
        threshold:    thresholds.minFoodsPerTexture,
      });
    }
  }

  return issues;
}

// ── Section 8: Meal type coverage ─────────────────────────────────────────

function reportMealTypeCoverage(
  foods: ReadonlyArray<FoodItem>,
  thresholds: CoverageThresholds,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const approvedFoods = foods.filter(isApproved);

  for (const mealType of MAIN_MEAL_TYPES) {
    const count = approvedFoods.filter((f) => f.mealTypes.includes(mealType)).length;

    if (count < thresholds.minFoodsPerMealType) {
      issues.push({
        severity:  count === 0 ? 'blocker' : 'warning',
        code:      count === 0 ? 'MEAL_TYPE_NO_APPROVED_FOODS' : 'MEAL_TYPE_INSUFFICIENT_COVERAGE',
        message:
          `Meal type "${mealType}" has ${count} eligible approved food(s) ` +
          `(minimum ${thresholds.minFoodsPerMealType} recommended).`,
        mealType,
        observed:  count,
        threshold: thresholds.minFoodsPerMealType,
      });
    }
  }

  return issues;
}

// ── Section 9: Rotation readiness ─────────────────────────────────────────

/**
 * For each (category group × diagnosis) combination, count approved non-contraindicated
 * foods supporting 'regular' texture. Reports combinations below the rotation minimum.
 */
function reportRotationReadiness(
  foods: ReadonlyArray<FoodItem>,
  protocols: ReadonlyArray<VersionedClinicalProtocol>,
  thresholds: CoverageThresholds,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  const approvedFoods = foods.filter(isApproved);

  for (const protocol of protocols) {
    const dx = protocol.diagnosisCode as string;
    const eligible = approvedFoods.filter(
      (f) => !f.contraindicatedFor.includes(protocol.diagnosisCode) &&
              f.textureLevels.includes('regular'),
    );

    for (const { group, label, categories } of CATEGORY_GROUPS) {
      const count = eligible.filter((f) => categories.includes(f.category)).length;
      if (count < thresholds.minRotationPoolPerCombination) {
        const severity: CoverageSeverity =
          count === 0              ? 'critical' :
          count < Math.ceil(thresholds.minRotationPoolPerCombination / 2) ? 'critical' :
          'warning';

        issues.push({
          severity,
          code:          'ROTATION_INSUFFICIENT_POOL',
          message:
            `Rotation pool for "${label}" foods in diagnosis "${dx}" has ` +
            `${count} approved food(s) (minimum ${thresholds.minRotationPoolPerCombination}). ` +
            `Meal repetition risk is ${count === 0 ? 'critical' : 'elevated'}.`,
          category:      label,
          diagnosisCode: dx,
          observed:      count,
          threshold:     thresholds.minRotationPoolPerCombination,
        });
      }
    }
  }

  return issues;
}

// ── Main report function ──────────────────────────────────────────────────

/**
 * generateCoverageReport — produce a full CoverageReport for a food database.
 *
 * @param foods      All food records in the database (any status).
 * @param protocols  All active clinical protocols to check slot/diagnosis coverage.
 * @param thresholds Optional threshold overrides; merged with DEFAULT_THRESHOLDS.
 */
export function generateCoverageReport(
  foods: ReadonlyArray<FoodItem>,
  protocols: ReadonlyArray<VersionedClinicalProtocol>,
  thresholds: Partial<CoverageThresholds> = {},
): CoverageReport {
  const t: CoverageThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const allIssues: CoverageIssue[] = [
    ...reportMissingNutrients(foods),
    ...reportMissingMetadata(foods),
    ...reportCategoryCoverage(foods, t),
    ...reportDiagnosisCoverage(foods, protocols, t),
    ...reportSlotCoverage(foods, protocols, t),
    ...reportTextureCoverage(foods, t),
    ...reportMealTypeCoverage(foods, t),
    ...reportRotationReadiness(foods, protocols, t),
  ];

  const summary: CoverageSummary = {
    blockerCount:  allIssues.filter((i) => i.severity === 'blocker').length,
    criticalCount: allIssues.filter((i) => i.severity === 'critical').length,
    warningCount:  allIssues.filter((i) => i.severity === 'warning').length,
    infoCount:     allIssues.filter((i) => i.severity === 'info').length,
  };

  return {
    generatedAt:      new Date().toISOString(),
    foodStatus:       buildStatusBreakdown(foods),
    issues:           allIssues,
    summary,
    hasCriticalGaps:  summary.blockerCount > 0,
  };
}

// ── Convenience query helpers ─────────────────────────────────────────────

/** Filter a CoverageReport to issues at or above a given severity. */
export function filterIssuesBySeverity(
  report: CoverageReport,
  minSeverity: CoverageSeverity,
): ReadonlyArray<CoverageIssue> {
  const ORDER: Record<CoverageSeverity, number> = {
    blocker: 4, critical: 3, warning: 2, info: 1,
  };
  const min = ORDER[minSeverity];
  return report.issues.filter((i) => ORDER[i.severity] >= min);
}

/** Return only blocker issues — convenience for gate-check usage. */
export function getBlockers(report: CoverageReport): ReadonlyArray<CoverageIssue> {
  return report.issues.filter((i) => i.severity === 'blocker');
}

// ── Diagnosis readiness summaries ─────────────────────────────────────────

/**
 * Human-readable display names for the known diagnosis codes.
 * Falls back to the code itself for unrecognised values.
 */
const DIAGNOSIS_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  GENERAL_HOSPITAL: 'General Hospital Diet',
  T2DM:             'Type 2 Diabetes Mellitus',
  CARDIAC:          'Cardiac Disease',
  RENAL_STAGE_3:    'Chronic Kidney Disease Stage 3',
  RENAL_STAGE_4:    'Chronic Kidney Disease Stage 4',
  HTN:              'Hypertension',
  GASTRIC:          'Gastric Disease',
  PEPTIC_ULCER:     'Peptic Ulcer Disease',
  H_PYLORI:         'Helicobacter pylori',
  HEPATIC:          'Hepatic Disease',
};

function getDiagnosisName(code: string): string {
  return DIAGNOSIS_DISPLAY_NAMES[code] ?? code;
}

export type ValidationReadiness = 'ready' | 'ready_with_warnings' | 'blocked';

/**
 * CoverageSeverityOrOk — extends CoverageSeverity with an 'ok' sentinel
 * for when no coverage issues exist for a given diagnosis.
 */
export type CoverageSeverityOrOk = CoverageSeverity | 'ok';

/**
 * DiagnosisReadinessSummary — per-protocol readiness for the Diagnosis DB page.
 *
 * All food-derived counts use approved foods only, except pendingReviewFoodCount
 * and restrictedFoodCount which span all statuses.
 *
 * Eligibility baseline: approved + not contraindicated for this diagnosis.
 * Rotation baseline: above + textureLevels includes 'regular'.
 */
export interface DiagnosisReadinessSummary {
  /** Machine-readable protocol identifier. */
  readonly diagnosisCode: string;
  /** Human-readable display name; falls back to diagnosisCode for unknown codes. */
  readonly diagnosisName: string;
  readonly protocolVersion: string;
  readonly approvalStatus: GovernanceState;
  /** ISO 8601 date when the protocol requires re-evaluation; null if not set. */
  readonly reviewDueAt: string | null;
  /** Number of cited evidence references on the protocol. */
  readonly evidenceCount: number;
  /** Union of texture levels available across eligible approved foods. */
  readonly supportedTextureLevels: ReadonlyArray<TextureLevel>;
  /** Comma-separated list of configured nutrient target keys and their count. */
  readonly targetSummary: string;
  /** Total number of meal slot templates defined in the protocol. */
  readonly slotTemplateCount: number;
  /** Count of approved foods NOT contraindicated for this diagnosis. */
  readonly allowedApprovedFoodCount: number;
  /** Count of foods (any status) that ARE contraindicated for this diagnosis. */
  readonly restrictedFoodCount: number;
  /** Count of pending_review foods that are NOT contraindicated. */
  readonly pendingReviewFoodCount: number;
  /**
   * Count of eligible approved foods (not contraindicated + approved) that are
   * missing at least one of: potassiumMg, phosphorusMg, sodiumMg.
   */
  readonly missingCriticalNutrientsCount: number;
  /** Category labels where rotation pool for this diagnosis is below threshold. */
  readonly weakRotationCategories: ReadonlyArray<string>;
  /** Required slot identifiers (mealType:slotName) with zero eligible approved foods. */
  readonly slotsWithNoEligibleFoods: ReadonlyArray<string>;
  /**
   * Worst coverage severity for this diagnosis.
   * 'ok' means no coverage issues were detected.
   */
  readonly coverageSeverity: CoverageSeverityOrOk;
  /** Summary readiness assessment derived from coverageSeverity. */
  readonly validationReadiness: ValidationReadiness;
}

const SEVERITY_ORDER: Record<CoverageSeverityOrOk, number> = {
  blocker: 4, critical: 3, warning: 2, info: 1, ok: 0,
};

function bumpSeverity(
  current: CoverageSeverityOrOk,
  candidate: CoverageSeverityOrOk,
): CoverageSeverityOrOk {
  return SEVERITY_ORDER[candidate] > SEVERITY_ORDER[current] ? candidate : current;
}

const RENAL_CRITICAL_KEYS = ['potassiumMg', 'phosphorusMg', 'sodiumMg'] as const;

/**
 * generateDiagnosisReadinessSummaries — produce a per-protocol readiness summary
 * for every protocol in the supplied list.
 *
 * Pure function: reads foods and protocols; never writes or fetches.
 *
 * @param foods      All food records in the database (any status).
 * @param protocols  Clinical protocols to summarise.
 * @param thresholds Optional threshold overrides; merged with DEFAULT_THRESHOLDS.
 */
export function generateDiagnosisReadinessSummaries(
  foods: ReadonlyArray<FoodItem>,
  protocols: ReadonlyArray<VersionedClinicalProtocol>,
  thresholds: Partial<CoverageThresholds> = {},
): ReadonlyArray<DiagnosisReadinessSummary> {
  const t: CoverageThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const approvedFoods = foods.filter(isApproved);

  return protocols.map((protocol): DiagnosisReadinessSummary => {
    const dx = protocol.diagnosisCode as string;

    // Eligible: approved AND not contraindicated for this diagnosis
    const eligibleApproved = approvedFoods.filter(
      (f) => !f.contraindicatedFor.includes(protocol.diagnosisCode),
    );

    // Rotation baseline: eligible + supports 'regular' texture
    const rotationEligible = eligibleApproved.filter(
      (f) => f.textureLevels.includes('regular'),
    );

    const allowedApprovedFoodCount = eligibleApproved.length;

    const restrictedFoodCount = foods.filter(
      (f) => f.contraindicatedFor.includes(protocol.diagnosisCode),
    ).length;

    const pendingReviewFoodCount = foods.filter(
      (f) => f.approvalStatus === 'pending_review' &&
              !f.contraindicatedFor.includes(protocol.diagnosisCode),
    ).length;

    const missingCriticalNutrientsCount = eligibleApproved.filter(
      (f) => RENAL_CRITICAL_KEYS.some((k) => f.missingNutrients.includes(k)),
    ).length;

    // Supported texture levels: union from all eligible approved foods
    const textureSet = new Set<TextureLevel>();
    for (const f of eligibleApproved) {
      for (const tx of f.textureLevels) textureSet.add(tx);
    }
    const supportedTextureLevels = TEXTURE_LEVELS.filter((tx) => textureSet.has(tx));

    // Target summary: keys from protocol.targets
    const targetKeys = Object.keys(protocol.targets);
    const targetSummary = targetKeys.length > 0
      ? `${targetKeys.join(', ')} (${targetKeys.length})`
      : 'no targets defined';

    // Weak rotation categories: eligible rotation-pool count < threshold
    const weakRotationCategories: string[] = [];
    for (const { label, categories } of CATEGORY_GROUPS) {
      const count = rotationEligible.filter((f) => categories.includes(f.category)).length;
      if (count < t.minRotationPoolPerCombination) {
        weakRotationCategories.push(label);
      }
    }

    // Required slots with zero eligible approved foods
    const slotsWithNoEligibleFoods: string[] = [];
    const seenSlots = new Set<string>();
    for (const template of protocol.slotTemplates) {
      if (!template.required) continue;
      const key = `${template.mealType}:${template.slotName}`;
      if (seenSlots.has(key)) continue;
      seenSlots.add(key);
      const count = rotationEligible.filter(
        (f) => template.allowedCategories.includes(f.category),
      ).length;
      if (count === 0) {
        slotsWithNoEligibleFoods.push(`${template.mealType}:${template.slotName}`);
      }
    }

    // Derive overall coverage severity for this diagnosis
    let coverageSeverity: CoverageSeverityOrOk = 'ok';

    if (slotsWithNoEligibleFoods.length > 0 || allowedApprovedFoodCount === 0) {
      coverageSeverity = bumpSeverity(coverageSeverity, 'blocker');
    }
    if (missingCriticalNutrientsCount > 0) {
      coverageSeverity = bumpSeverity(coverageSeverity, 'critical');
    }
    if (allowedApprovedFoodCount > 0 && allowedApprovedFoodCount < 8) {
      coverageSeverity = bumpSeverity(coverageSeverity, 'critical');
    }
    if (allowedApprovedFoodCount >= 8 && allowedApprovedFoodCount < 15) {
      coverageSeverity = bumpSeverity(coverageSeverity, 'warning');
    }
    if (weakRotationCategories.length > 0) {
      coverageSeverity = bumpSeverity(coverageSeverity, 'warning');
    }
    if (pendingReviewFoodCount > 0 && coverageSeverity === 'ok') {
      coverageSeverity = bumpSeverity(coverageSeverity, 'info');
    }

    const validationReadiness: ValidationReadiness =
      coverageSeverity === 'blocker'                                      ? 'blocked' :
      coverageSeverity === 'critical' || coverageSeverity === 'warning'   ? 'ready_with_warnings' :
      'ready';

    return {
      diagnosisCode:              dx,
      diagnosisName:              getDiagnosisName(dx),
      protocolVersion:            protocol.version,
      approvalStatus:             protocol.status,
      reviewDueAt:                protocol.reviewDueAt ?? null,
      evidenceCount:              protocol.evidenceReferences.length,
      supportedTextureLevels,
      targetSummary,
      slotTemplateCount:          protocol.slotTemplates.length,
      allowedApprovedFoodCount,
      restrictedFoodCount,
      pendingReviewFoodCount,
      missingCriticalNutrientsCount,
      weakRotationCategories,
      slotsWithNoEligibleFoods,
      coverageSeverity,
      validationReadiness,
    };
  });
}
