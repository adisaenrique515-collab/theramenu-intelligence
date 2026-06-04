/**
 * server/eligibilityEngine.ts — Phase 5: Eligibility filter pipeline.
 *
 * Applies six hard-gate filters in strict order before any scoring occurs.
 * A food that fails any gate is EXCLUDED from scoring — never given a soft penalty.
 * Unsafe foods never reach the slot-selection scoring step.
 *
 * Gate order (per specification):
 *   1. texture_compatibility  — food must support the requested IDDSI texture level
 *   2. contraindication       — food must not be in contraindicatedFor the diagnosis
 *   3. allergen               — food must not contain any of the patient's allergens
 *   4. meal_type              — food must be suitable for the requested meal type
 *   5. approval_status        — food must have approvalStatus === 'approved'
 *   6. portion_feasibility    — food serving rules must be valid and satisfiable
 */

import type {
  FoodItem,
  DiagnosisCode,
  TextureLevel,
  AllergenCode,
  MealTypeKey,
} from '../types-clinical.ts';

// ── Types ──────────────────────────────────────────────────────────────────

export type EligibilityGate =
  | 'texture_compatibility'
  | 'contraindication'
  | 'allergen'
  | 'meal_type'
  | 'approval_status'
  | 'portion_feasibility';

/**
 * Context provided to the eligibility engine for a single slot selection pass.
 * All fields are required except minimumPortionGrams, which tightens Gate 6.
 */
export interface EligibilityContext {
  readonly diagnosisCode: DiagnosisCode;
  readonly textureLevel: TextureLevel;
  readonly allergens: ReadonlyArray<AllergenCode>;
  readonly mealType: MealTypeKey;
  /**
   * Optional floor for Gate 6.
   * If set, foods whose maxGrams < minimumPortionGrams are excluded.
   */
  readonly minimumPortionGrams?: number;
}

/**
 * A single food that was excluded, with the gate that rejected it and the reason.
 * failedAt is the FIRST gate that rejected the food — later gates are not evaluated.
 */
export interface FoodExclusion {
  readonly food: FoodItem;
  readonly failedAt: EligibilityGate;
  readonly reason: string;
}

export interface EligibilityResult {
  readonly eligible: ReadonlyArray<FoodItem>;
  readonly excluded: ReadonlyArray<FoodExclusion>;
  /** Count of foods excluded at each gate. */
  readonly counts: Readonly<Record<EligibilityGate, number>>;
  /** Total foods evaluated. */
  readonly totalEvaluated: number;
}

// ── Gate implementations ───────────────────────────────────────────────────

/**
 * gate1_texture — food must include the requested IDDSI texture level.
 */
function gate1_texture(
  food: FoodItem,
  ctx: EligibilityContext,
): FoodExclusion | null {
  if (food.textureLevels.includes(ctx.textureLevel)) return null;
  return {
    food,
    failedAt: 'texture_compatibility',
    reason:
      `"${food.canonicalName}" does not support IDDSI texture "${ctx.textureLevel}". ` +
      `Supported: [${food.textureLevels.join(', ')}].`,
  };
}

/**
 * gate2_contraindication — food must not be contraindicated for the diagnosis.
 * This is a hard exclusion: a food listed in contraindicatedFor is NEVER served
 * to a patient with that diagnosis regardless of any other consideration.
 */
function gate2_contraindication(
  food: FoodItem,
  ctx: EligibilityContext,
): FoodExclusion | null {
  if (!food.contraindicatedFor.includes(ctx.diagnosisCode)) return null;
  return {
    food,
    failedAt: 'contraindication',
    reason:
      `"${food.canonicalName}" is contraindicated for "${ctx.diagnosisCode}". ` +
      `contraindicatedFor: [${food.contraindicatedFor.join(', ')}].`,
  };
}

/**
 * gate3_allergen — food must not contain any allergen present in the patient profile.
 */
function gate3_allergen(
  food: FoodItem,
  ctx: EligibilityContext,
): FoodExclusion | null {
  if (ctx.allergens.length === 0) return null;
  const patientAllergenSet = new Set(ctx.allergens);
  const hit = food.allergens.find((a) => patientAllergenSet.has(a));
  if (!hit) return null;
  return {
    food,
    failedAt: 'allergen',
    reason:
      `"${food.canonicalName}" contains allergen "${hit}" listed in the patient allergen profile.`,
  };
}

/**
 * gate4_mealType — food must be suitable for the requested meal type.
 */
function gate4_mealType(
  food: FoodItem,
  ctx: EligibilityContext,
): FoodExclusion | null {
  if (food.mealTypes.includes(ctx.mealType)) return null;
  return {
    food,
    failedAt: 'meal_type',
    reason:
      `"${food.canonicalName}" is not designated for meal type "${ctx.mealType}". ` +
      `Designated for: [${food.mealTypes.join(', ')}].`,
  };
}

/**
 * gate5_approvalStatus — only approved foods reach the scoring step.
 * draft, pending_review, and retired foods are all excluded.
 */
function gate5_approvalStatus(
  food: FoodItem,
): FoodExclusion | null {
  if (food.approvalStatus === 'approved') return null;
  return {
    food,
    failedAt: 'approval_status',
    reason:
      `"${food.canonicalName}" has approval status "${food.approvalStatus}". ` +
      `Only "approved" foods are permitted in production plan generation.`,
  };
}

/**
 * gate6_portionFeasibility — serving rules must be internally valid and
 * must satisfy any minimum portion requirement in the context.
 *
 * Reasons for failure:
 *   a) minGrams < 0 — negative floor is a data error
 *   b) maxGrams <= 0 — cannot serve any amount
 *   c) minGrams > maxGrams — impossible range
 *   d) ctx.minimumPortionGrams > maxGrams — requested min exceeds what food can provide
 */
function gate6_portionFeasibility(
  food: FoodItem,
  ctx: EligibilityContext,
): FoodExclusion | null {
  const { minGrams, maxGrams } = food.servingRules;

  if (minGrams < 0) {
    return {
      food,
      failedAt: 'portion_feasibility',
      reason:
        `"${food.canonicalName}" has invalid serving rule: minGrams (${minGrams}) is negative.`,
    };
  }
  if (maxGrams <= 0) {
    return {
      food,
      failedAt: 'portion_feasibility',
      reason:
        `"${food.canonicalName}" has invalid serving rule: maxGrams (${maxGrams}) must be > 0.`,
    };
  }
  if (minGrams > maxGrams) {
    return {
      food,
      failedAt: 'portion_feasibility',
      reason:
        `"${food.canonicalName}" has invalid serving range: ` +
        `minGrams (${minGrams}) > maxGrams (${maxGrams}).`,
    };
  }
  if (ctx.minimumPortionGrams !== undefined && ctx.minimumPortionGrams > maxGrams) {
    return {
      food,
      failedAt: 'portion_feasibility',
      reason:
        `"${food.canonicalName}" cannot satisfy the minimum portion of ${ctx.minimumPortionGrams}g. ` +
        `Maximum servable portion is ${maxGrams}g.`,
    };
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────

const GATE_PIPELINE: ReadonlyArray<
  (food: FoodItem, ctx: EligibilityContext) => FoodExclusion | null
> = [
  gate1_texture,
  gate2_contraindication,
  gate3_allergen,
  gate4_mealType,
  (food, ctx) => gate5_approvalStatus(food),   // adapts to consistent signature
  gate6_portionFeasibility,
];

/**
 * applyEligibilityFilters — run all 6 hard-gate filters over a food list.
 *
 * Each food is tested against gates 1–6 in order.
 * A food that fails gate N is immediately excluded; gates N+1 to 6 are not run.
 * Foods that pass all 6 gates are returned in `eligible`.
 *
 * @param foods  Candidate FoodItem array (may be empty).
 * @param ctx    Context for this slot-selection pass.
 * @returns      EligibilityResult with eligible, excluded, counts, and total.
 */
export function applyEligibilityFilters(
  foods: ReadonlyArray<FoodItem>,
  ctx: EligibilityContext,
): EligibilityResult {
  const eligible: FoodItem[] = [];
  const excluded: FoodExclusion[] = [];
  const counts: Record<EligibilityGate, number> = {
    texture_compatibility: 0,
    contraindication:      0,
    allergen:              0,
    meal_type:             0,
    approval_status:       0,
    portion_feasibility:   0,
  };

  for (const food of foods) {
    let exclusion: FoodExclusion | null = null;

    for (const gate of GATE_PIPELINE) {
      exclusion = gate(food, ctx);
      if (exclusion) break;
    }

    if (exclusion) {
      counts[exclusion.failedAt]++;
      excluded.push(exclusion);
    } else {
      eligible.push(food);
    }
  }

  return {
    eligible,
    excluded,
    counts,
    totalEvaluated: foods.length,
  };
}

/**
 * evaluateFood — evaluate a single food against the context.
 * Returns null if the food is eligible, or the first FoodExclusion if excluded.
 * Useful for testing individual foods without building a full food list.
 */
export function evaluateFood(
  food: FoodItem,
  ctx: EligibilityContext,
): FoodExclusion | null {
  for (const gate of GATE_PIPELINE) {
    const result = gate(food, ctx);
    if (result) return result;
  }
  return null;
}

/**
 * assertNoUnsafeFood — throws if any eligible food would be unsafe for the context.
 * Used as a post-filter invariant check before passing foods to the scorer.
 * Throws with a detailed message listing the first unsafe food found.
 */
export function assertNoUnsafeFood(
  eligibleFoods: ReadonlyArray<FoodItem>,
  ctx: EligibilityContext,
): void {
  for (const food of eligibleFoods) {
    const exclusion = evaluateFood(food, ctx);
    if (exclusion) {
      throw new Error(
        `SAFETY INVARIANT VIOLATION: An unsafe food reached the scorer. ` +
        `Gate "${exclusion.failedAt}" should have excluded "${food.canonicalName}". ` +
        `Reason: ${exclusion.reason}`,
      );
    }
  }
}
