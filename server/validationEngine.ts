/**
 * server/validationEngine.ts — Phase 6: Clinical validation engine.
 *
 * Produces a ClinicalValidationReport against a WeeklyTherapeuticPlan.
 * Does NOT replace services/planValidation.ts (UI contract preserved).
 *
 * Design rules:
 * - Any BLOCKER sets exportBlocked = true and passed = false.
 * - Score is deterministic: 100 − (40·blockers + 15·criticals + 5·warnings + 1·infos).
 * - Score never overrides blocker status — exportBlocked is checked independently.
 * - Checks use protocol target data and day.dailyTargets, not hardcoded constants.
 * - food-level checks (contraindication, allergen, texture) require a foodIndex map.
 *   When foodIndex is absent those checks are skipped gracefully.
 *
 * Blocker conditions (10 per spec):
 *   CONTRAINDICATED_FOOD_SERVED
 *   ALLERGEN_SERVED
 *   WRONG_IDDSI_TEXTURE
 *   MISSING_REQUIRED_SLOT
 *   INVALID_PORTION
 *   PROTEIN_EXCEEDS_RENAL_TARGET
 *   POTASSIUM_EXCEEDS_RENAL_TARGET
 *   PHOSPHORUS_EXCEEDS_RENAL_TARGET
 *   FLUID_EXCEEDS_RENAL_TARGET
 *   MISSING_SERVICE_TEMPERATURE
 */

import type {
  WeeklyTherapeuticPlan,
  DayPlan,
  MealPlan,
  MealSlot,
  ClinicalTargets,
  NutrientVector,
} from '../types.ts';

import type {
  ValidationIssue,
  ClinicalValidationReport,
  ClinicalValidationSummary,
  ValidationSeverity,
  DiagnosisCode,
  TextureLevel,
  AllergenCode,
  FoodItem,
  VersionedClinicalProtocol,
  MealTypeKey,
} from '../types-clinical.ts';

import { parsePortionGrams } from './nutrientUtils.ts';

// ── Public context type ───────────────────────────────────────────────────

/**
 * ValidationContext — everything the engine needs that is not in the plan itself.
 * Pass `foodIndex` to enable food-level safety checks (recommended for production).
 */
export interface ValidationContext {
  readonly diagnosisCode: DiagnosisCode;
  readonly textureLevel: TextureLevel;
  readonly allergens: ReadonlyArray<AllergenCode>;
  /**
   * The versioned protocol for this diagnosis. Used for:
   *  - required slot identification (slotTemplates)
   *  - target references for issue messages
   */
  readonly protocol: VersionedClinicalProtocol;
  /**
   * Optional map of foodId → FoodItem. When provided, enables:
   *  - contraindication checking
   *  - allergen checking
   *  - IDDSI texture checking
   *  - approval status checking
   * When absent, those checks are skipped.
   */
  readonly foodIndex?: ReadonlyMap<string, FoodItem>;
}

// ── Diagnosis helpers ────────────────────────────────────────────────────

const RENAL_DIAGNOSES = new Set<DiagnosisCode>(['RENAL_STAGE_3', 'RENAL_STAGE_4']);

function isRenal(code: DiagnosisCode): boolean {
  return RENAL_DIAGNOSES.has(code);
}

// ── Issue factory ─────────────────────────────────────────────────────────

interface IssueExtras {
  path: string;
  clinicalReason: string;
  observedValue?: number;
  expectedValue?: number | string;
  unit?: string;
  dayName?: string;
  mealType?: MealTypeKey;
  slotName?: string;
}

function makeIssue(
  severity: ValidationSeverity,
  code: string,
  message: string,
  extras: IssueExtras,
): ValidationIssue {
  return {
    severity,
    code,
    message,
    path: extras.path,
    clinicalReason: extras.clinicalReason,
    observedValue: extras.observedValue,
    expectedValue: extras.expectedValue,
    unit: extras.unit,
    dayName: extras.dayName,
    mealType: extras.mealType,
    slotName: extras.slotName,
  };
}

function blocker(code: string, message: string, extras: IssueExtras): ValidationIssue {
  return makeIssue('blocker', code, message, extras);
}
function critical(code: string, message: string, extras: IssueExtras): ValidationIssue {
  return makeIssue('critical', code, message, extras);
}
function warning(code: string, message: string, extras: IssueExtras): ValidationIssue {
  return makeIssue('warning', code, message, extras);
}
function info(code: string, message: string, extras: IssueExtras): ValidationIssue {
  return makeIssue('info', code, message, extras);
}

// ── Path builders ────────────────────────────────────────────────────────

function planPath(): string { return 'plan'; }
function dayPath(dayName: string): string { return `day:${dayName}`; }
function mealPath(dayName: string, mealType: string): string { return `day:${dayName}/meal:${mealType}`; }
function slotPath(dayName: string, mealType: string, slotName: string): string {
  return `day:${dayName}/meal:${mealType}/slot:${slotName}`;
}

// ── Slot-level checks ─────────────────────────────────────────────────────

/**
 * checkPortionValidity — BLOCKER if portion string is unparseable or ≤ 0.
 */
function checkPortionValidity(
  slot: MealSlot,
  dayName: string,
  mealType: MealTypeKey,
): ValidationIssue | null {
  const item = slot.item;
  if (!item) return null; // empty slot handled separately

  const grams = parsePortionGrams(item.portion);
  if (grams === null || grams <= 0) {
    return blocker(
      'INVALID_PORTION',
      `Slot "${slot.slotName}" has an unparseable or zero portion: "${item.portion}".`,
      {
        path: slotPath(dayName, mealType, slot.slotName),
        clinicalReason:
          'An invalid portion means the nutrient calculation for this item is zero or meaningless, ' +
          'making the day total unreliable for clinical decision-making.',
        observedValue: grams ?? undefined,
        expectedValue: '> 0',
        unit: 'g',
        dayName,
        mealType,
        slotName: slot.slotName,
      },
    );
  }
  return null;
}

/**
 * checkServiceTemperature — BLOCKER if service temperature is absent.
 * Every served food item must have a declared service temperature for HACCP compliance.
 */
function checkServiceTemperature(
  slot: MealSlot,
  dayName: string,
  mealType: MealTypeKey,
): ValidationIssue | null {
  const item = slot.item;
  if (!item) return null;

  const temp = item.operational?.serviceTemp?.trim();
  if (!temp) {
    return blocker(
      'MISSING_SERVICE_TEMPERATURE',
      `Slot "${slot.slotName}" ("${item.name}") has no service temperature declared.`,
      {
        path: slotPath(dayName, mealType, slot.slotName),
        clinicalReason:
          'HACCP regulations require a declared service temperature for every food item. ' +
          'Missing temperature prevents verification of safe hot (≥ 60°C) or cold (≤ 8°C) holding.',
        dayName,
        mealType,
        slotName: slot.slotName,
      },
    );
  }
  return null;
}

/**
 * checkFoodSafety — food-level blockers that require the foodIndex.
 * Checks: contraindication, allergen, IDDSI texture, approval status.
 * Skipped when foodId is absent or foodIndex does not contain the id.
 */
function checkFoodSafety(
  slot: MealSlot,
  dayName: string,
  mealType: MealTypeKey,
  ctx: ValidationContext,
): ValidationIssue[] {
  const item = slot.item;
  if (!item?.foodId || !ctx.foodIndex) return [];

  const food = ctx.foodIndex.get(item.foodId);
  if (!food) return [];

  const issues: ValidationIssue[] = [];
  const path = slotPath(dayName, mealType, slot.slotName);
  const base = { path, dayName, mealType: mealType as MealTypeKey, slotName: slot.slotName };

  // Gate A — contraindication
  if (food.contraindicatedFor.includes(ctx.diagnosisCode)) {
    issues.push(blocker(
      'CONTRAINDICATED_FOOD_SERVED',
      `"${food.canonicalName}" is contraindicated for diagnosis "${ctx.diagnosisCode}".`,
      {
        ...base,
        clinicalReason:
          `This food is listed as contraindicated for ${ctx.diagnosisCode}. ` +
          `Serving it could cause direct clinical harm (e.g. hyperkalaemia in renal patients).`,
      },
    ));
  }

  // Gate B — allergen
  if (ctx.allergens.length > 0) {
    const patientSet = new Set(ctx.allergens);
    const hit = food.allergens.find((a) => patientSet.has(a));
    if (hit) {
      issues.push(blocker(
        'ALLERGEN_SERVED',
        `"${food.canonicalName}" contains allergen "${hit}" present in the patient allergen profile.`,
        {
          ...base,
          clinicalReason:
            `Serving a food containing a documented patient allergen risks anaphylaxis or ` +
            `serious adverse reaction. This is a hard clinical stop.`,
        },
      ));
    }
  }

  // Gate C — IDDSI texture
  if (!food.textureLevels.includes(ctx.textureLevel)) {
    issues.push(blocker(
      'WRONG_IDDSI_TEXTURE',
      `"${food.canonicalName}" does not support IDDSI texture "${ctx.textureLevel}". ` +
      `Available: [${food.textureLevels.join(', ')}].`,
      {
        ...base,
        clinicalReason:
          `Serving a food with an incompatible texture to a patient with a swallowing disorder ` +
          `risks aspiration, choking, or pneumonia (IDDSI Framework compliance required).`,
        observedValue: undefined,
        expectedValue: ctx.textureLevel,
      },
    ));
  }

  // Gate D — approval status (critical, not blocker per spec)
  if (food.approvalStatus !== 'approved') {
    issues.push(critical(
      'UNAPPROVED_FOOD_IN_PLAN',
      `"${food.canonicalName}" has approval status "${food.approvalStatus}". ` +
      `Only approved foods should appear in generated plans.`,
      {
        ...base,
        clinicalReason:
          `Unapproved foods have not completed the clinical review process. ` +
          `Nutrient data and contraindications may be incomplete or unverified.`,
      },
    ));
  }

  return issues;
}

// ── Meal-level checks ─────────────────────────────────────────────────────

/**
 * checkRequiredSlots — BLOCKER for each required slot that is EMPTY or absent.
 * Required slots are identified from protocol.slotTemplates for this mealType.
 */
function checkRequiredSlots(
  meal: MealPlan,
  dayName: string,
  ctx: ValidationContext,
): ValidationIssue[] {
  const mealType = meal.mealType as MealTypeKey;
  const issues: ValidationIssue[] = [];

  const requiredSlotNames = new Set(
    ctx.protocol.slotTemplates
      .filter((t) => t.mealType === mealType && t.required)
      .map((t) => t.slotName),
  );

  if (requiredSlotNames.size === 0) return [];

  const filledSlotNames = new Set(
    (meal.slots ?? [])
      .filter((s) => s.status !== 'EMPTY' && s.item !== null)
      .map((s) => s.slotName),
  );

  // Check slots that exist in the meal
  for (const slot of meal.slots ?? []) {
    if (requiredSlotNames.has(slot.slotName) && (slot.status === 'EMPTY' || slot.item === null)) {
      issues.push(blocker(
        'MISSING_REQUIRED_SLOT',
        `Required slot "${slot.slotName}" in ${mealType} (${dayName}) is empty.`,
        {
          path: mealPath(dayName, mealType),
          clinicalReason:
            `A required meal slot being empty means the patient does not receive the ` +
            `intended food group, risking nutritional inadequacy for that meal.`,
          dayName,
          mealType,
          slotName: slot.slotName,
        },
      ));
    }
  }

  // Check required slots that are completely absent from the meal
  for (const slotName of requiredSlotNames) {
    if (!filledSlotNames.has(slotName) && !(meal.slots ?? []).some((s) => s.slotName === slotName)) {
      issues.push(blocker(
        'MISSING_REQUIRED_SLOT',
        `Required slot "${slotName}" is absent from ${mealType} (${dayName}).`,
        {
          path: mealPath(dayName, mealType),
          clinicalReason:
            `A required slot absent from the meal means this food group was never included, ` +
            `resulting in an incomplete therapeutic meal.`,
          dayName,
          mealType,
          slotName,
        },
      ));
    }
  }

  return issues;
}

// ── Day-level checks ──────────────────────────────────────────────────────

interface DayCheckResult {
  issues: ValidationIssue[];
  nutrientChecksPassed: number;
  nutrientChecksTotal: number;
}

/**
 * checkDayNutrients — validate daily totals against dailyTargets.
 * Renal-specific blockers: protein, potassium, phosphorus, fluid excesses.
 * General checks: calorie balance, protein minimum, sodium cap, fiber minimum.
 */
function checkDayNutrients(day: DayPlan, ctx: ValidationContext): DayCheckResult {
  const issues: ValidationIssue[] = [];
  const t = day.totals;
  const targets = day.dailyTargets;
  let nutrientChecksPassed = 0;
  let nutrientChecksTotal = 0;
  const path = dayPath(day.dayName);
  const base = { path, dayName: day.dayName };

  // ── Calorie balance ──────────────────────────────────────────────────────
  if (targets.caloriesKcal > 0) {
    nutrientChecksTotal++;
    const pct = (t.caloriesKcal / targets.caloriesKcal) * 100;
    if (pct >= 80 && pct <= 130) {
      nutrientChecksPassed++;
    } else if (pct < 80) {
      issues.push(critical(
        'CALORIE_DEFICIT',
        `${day.dayName}: energy ${Math.round(t.caloriesKcal)} kcal is only ${Math.round(pct)}% of target ` +
        `${Math.round(targets.caloriesKcal)} kcal (minimum 80%).`,
        {
          ...base,
          clinicalReason: 'Persistent caloric deficit leads to muscle wasting and impaired recovery.',
          observedValue: Math.round(t.caloriesKcal),
          expectedValue: `≥ ${Math.round(targets.caloriesKcal * 0.8)}`,
          unit: 'kcal/day',
        },
      ));
    } else {
      issues.push(critical(
        'CALORIE_EXCESS',
        `${day.dayName}: energy ${Math.round(t.caloriesKcal)} kcal is ${Math.round(pct)}% of target ` +
        `(maximum 130%).`,
        {
          ...base,
          clinicalReason: 'Sustained caloric excess drives weight gain and metabolic complications.',
          observedValue: Math.round(t.caloriesKcal),
          expectedValue: `≤ ${Math.round(targets.caloriesKcal * 1.3)}`,
          unit: 'kcal/day',
        },
      ));
    }
  }

  // ── Protein minimum ──────────────────────────────────────────────────────
  if (targets.proteinG > 0) {
    nutrientChecksTotal++;
    if (t.proteinG >= targets.proteinG * 0.8) {
      nutrientChecksPassed++;
    } else {
      issues.push(critical(
        'PROTEIN_BELOW_MIN',
        `${day.dayName}: protein ${t.proteinG.toFixed(1)} g is below 80% of target ${targets.proteinG} g.`,
        {
          ...base,
          clinicalReason: 'Inadequate protein intake risks sarcopenia, poor wound healing, and immune suppression.',
          observedValue: parseFloat(t.proteinG.toFixed(1)),
          expectedValue: parseFloat((targets.proteinG * 0.8).toFixed(1)),
          unit: 'g/day',
        },
      ));
    }
  }

  // ── Protein maximum (renal — BLOCKER) ────────────────────────────────────
  if (isRenal(ctx.diagnosisCode) && typeof targets.proteinGMax === 'number' && targets.proteinGMax > 0) {
    nutrientChecksTotal++;
    if (t.proteinG <= targets.proteinGMax) {
      nutrientChecksPassed++;
    } else {
      issues.push(blocker(
        'PROTEIN_EXCEEDS_RENAL_TARGET',
        `${day.dayName}: protein ${t.proteinG.toFixed(1)} g exceeds renal maximum ${targets.proteinGMax} g.`,
        {
          ...base,
          clinicalReason:
            'Excess dietary protein in CKD accelerates nephron loss and increases uraemic toxin load. ' +
            'KDIGO 2024 recommends protein restriction to slow CKD progression.',
          observedValue: parseFloat(t.proteinG.toFixed(1)),
          expectedValue: targets.proteinGMax,
          unit: 'g/day',
        },
      ));
    }
  }

  // ── Sodium cap ───────────────────────────────────────────────────────────
  if (targets.sodiumMgMax > 0) {
    nutrientChecksTotal++;
    if (t.sodiumMg <= targets.sodiumMgMax) {
      nutrientChecksPassed++;
    } else {
      issues.push(critical(
        'SODIUM_EXCEEDED',
        `${day.dayName}: sodium ${Math.round(t.sodiumMg)} mg exceeds protocol limit ${targets.sodiumMgMax} mg.`,
        {
          ...base,
          clinicalReason:
            'Excess sodium intake raises blood pressure and increases cardiovascular and renal risk.',
          observedValue: Math.round(t.sodiumMg),
          expectedValue: targets.sodiumMgMax,
          unit: 'mg/day',
        },
      ));
    }
  }

  // ── Fiber minimum ────────────────────────────────────────────────────────
  if (targets.fiberGMin > 0) {
    nutrientChecksTotal++;
    if (t.fiberG >= targets.fiberGMin) {
      nutrientChecksPassed++;
    } else {
      issues.push(warning(
        'FIBER_BELOW_MIN',
        `${day.dayName}: fiber ${t.fiberG.toFixed(1)} g is below protocol minimum ${targets.fiberGMin} g.`,
        {
          ...base,
          clinicalReason:
            'Insufficient dietary fiber is associated with poor glycaemic control, dyslipidaemia, ' +
            'and increased colorectal cancer risk.',
          observedValue: parseFloat(t.fiberG.toFixed(1)),
          expectedValue: targets.fiberGMin,
          unit: 'g/day',
        },
      ));
    }
  }

  // ── Potassium maximum (renal — BLOCKER) ──────────────────────────────────
  if (isRenal(ctx.diagnosisCode) && typeof targets.potassiumMgMax === 'number' && targets.potassiumMgMax > 0) {
    nutrientChecksTotal++;
    if (t.potassiumMg <= targets.potassiumMgMax) {
      nutrientChecksPassed++;
    } else {
      issues.push(blocker(
        'POTASSIUM_EXCEEDS_RENAL_TARGET',
        `${day.dayName}: potassium ${Math.round(t.potassiumMg)} mg exceeds renal maximum ${targets.potassiumMgMax} mg.`,
        {
          ...base,
          clinicalReason:
            'Hyperkalaemia in CKD patients can cause life-threatening cardiac arrhythmias. ' +
            'KDOQI 2020 and KDIGO 2024 require strict potassium limits in CKD G4-5.',
          observedValue: Math.round(t.potassiumMg),
          expectedValue: targets.potassiumMgMax,
          unit: 'mg/day',
        },
      ));
    }
  }

  // ── Phosphorus maximum (renal — BLOCKER) ─────────────────────────────────
  if (isRenal(ctx.diagnosisCode) && typeof targets.phosphorusMgMax === 'number' && targets.phosphorusMgMax > 0) {
    nutrientChecksTotal++;
    if (t.phosphorusMg <= targets.phosphorusMgMax) {
      nutrientChecksPassed++;
    } else {
      issues.push(blocker(
        'PHOSPHORUS_EXCEEDS_RENAL_TARGET',
        `${day.dayName}: phosphorus ${Math.round(t.phosphorusMg)} mg exceeds renal maximum ${targets.phosphorusMgMax} mg.`,
        {
          ...base,
          clinicalReason:
            'Hyperphosphataemia in CKD drives secondary hyperparathyroidism, renal osteodystrophy, ' +
            'and cardiovascular calcification. KDOQI 2020 recommends dietary phosphorus restriction.',
          observedValue: Math.round(t.phosphorusMg),
          expectedValue: targets.phosphorusMgMax,
          unit: 'mg/day',
        },
      ));
    }
  }

  // ── Fluid maximum (renal — BLOCKER) ──────────────────────────────────────
  if (isRenal(ctx.diagnosisCode) && typeof targets.fluidMlTarget === 'number' && targets.fluidMlTarget > 0) {
    // Fluid target for renal patients is a ceiling, not a goal.
    // Use a 5% tolerance to account for estimation imprecision.
    const FLUID_TOLERANCE_FACTOR = 1.05;
    nutrientChecksTotal++;
    if (t.fluidMl <= targets.fluidMlTarget * FLUID_TOLERANCE_FACTOR) {
      nutrientChecksPassed++;
    } else {
      issues.push(blocker(
        'FLUID_EXCEEDS_RENAL_TARGET',
        `${day.dayName}: estimated fluid ${Math.round(t.fluidMl)} ml exceeds renal target ` +
        `${Math.round(targets.fluidMlTarget)} ml (+ 5% tolerance).`,
        {
          ...base,
          clinicalReason:
            'Fluid overload in CKD patients risks pulmonary oedema, hypertension, and cardiac failure. ' +
            'Clinician-prescribed fluid limit must be respected.',
          observedValue: Math.round(t.fluidMl),
          expectedValue: Math.round(targets.fluidMlTarget),
          unit: 'ml/day',
        },
      ));
    }
  }

  return { issues, nutrientChecksPassed, nutrientChecksTotal };
}

// ── Weekly-level checks ───────────────────────────────────────────────────

interface WeeklyCheckResult {
  issues: ValidationIssue[];
  weeklyUniqueFoods: number;
  maxRepeatPerFood: number;
  textureMismatchCount: number;
}

function checkWeeklyPatterns(plan: WeeklyTherapeuticPlan): WeeklyCheckResult {
  const foodCounts = new Map<string, number>();
  let textureMismatchCount = 0;

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const slot of meal.slots ?? []) {
        const item = slot.item;
        if (!item) continue;
        const key = item.foodId ?? item.name.toLowerCase();
        if (key && key !== 'purified water' && key !== 'water') {
          foodCounts.set(key, (foodCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const weeklyUniqueFoods = foodCounts.size;
  const maxRepeatPerFood = foodCounts.size > 0 ? Math.max(...foodCounts.values()) : 0;
  const issues: ValidationIssue[] = [];
  const path = planPath();

  const MIN_VARIETY = 12;
  if (weeklyUniqueFoods < MIN_VARIETY && plan.days.length > 0) {
    issues.push(warning(
      'LOW_FOOD_VARIETY',
      `Weekly plan has only ${weeklyUniqueFoods} unique foods (minimum ${MIN_VARIETY} recommended).`,
      {
        path,
        clinicalReason:
          'Low dietary variety reduces micronutrient diversity and increases the risk of ' +
          'single-food nutrient deficiencies.',
        observedValue: weeklyUniqueFoods,
        expectedValue: MIN_VARIETY,
        unit: 'unique foods/week',
      },
    ));
  }

  const MAX_REPEATS = 7;
  if (maxRepeatPerFood > MAX_REPEATS) {
    issues.push(warning(
      'EXCESSIVE_FOOD_REPETITION',
      `A single food item appears ${maxRepeatPerFood} times (maximum ${MAX_REPEATS} per week).`,
      {
        path,
        clinicalReason:
          'Over-reliance on a single food item increases the risk of nutrient imbalance ' +
          'and meal monotony, which reduces patient compliance.',
        observedValue: maxRepeatPerFood,
        expectedValue: MAX_REPEATS,
        unit: 'appearances/week',
      },
    ));
  }

  return { issues, weeklyUniqueFoods, maxRepeatPerFood, textureMismatchCount };
}

// ── Scoring ───────────────────────────────────────────────────────────────

/**
 * calculateAlignmentScore — deterministic scoring.
 *
 * Deductions per issue:
 *   blocker:  40 points
 *   critical: 15 points
 *   warning:   5 points
 *   info:      1 point
 *
 * Score = max(0, 100 - total_deductions).
 * Score is independent of exportBlocked — it is purely informational.
 */
export function calculateAlignmentScore(issues: ReadonlyArray<ValidationIssue>): number {
  const DEDUCTIONS: Record<ValidationSeverity, number> = {
    blocker:  40,
    critical: 15,
    warning:   5,
    info:      1,
  };

  const total = issues.reduce((sum, issue) => sum + DEDUCTIONS[issue.severity], 0);
  return Math.max(0, 100 - total);
}

// ── Main validation function ──────────────────────────────────────────────

/**
 * validateClinicalPlan — run all checks against a WeeklyTherapeuticPlan.
 *
 * Checks run at four levels:
 *   slot  → portion validity, service temperature, food safety (if foodIndex)
 *   meal  → required slots
 *   day   → nutrient targets and renal-specific blockers
 *   week  → food variety and repetition
 *
 * Returns a ClinicalValidationReport. exportBlocked is set independently of
 * clinicalAlignmentScore — a high score does not exempt a plan from being blocked.
 */
export function validateClinicalPlan(
  plan: WeeklyTherapeuticPlan,
  ctx: ValidationContext,
): ClinicalValidationReport {
  const allIssues: ValidationIssue[] = [];
  let nutrientChecksPassed = 0;
  let nutrientChecksTotal  = 0;
  let textureMismatchCount = 0;

  for (const day of plan.days) {
    for (const meal of day.meals) {
      const mealType = meal.mealType as MealTypeKey;

      // ── Slot-level ───────────────────────────────────────────────────────
      for (const slot of meal.slots ?? []) {
        if (slot.item === null) continue; // null items handled by MISSING_REQUIRED_SLOT

        const portion = checkPortionValidity(slot, day.dayName, mealType);
        if (portion) allIssues.push(portion);

        const temp = checkServiceTemperature(slot, day.dayName, mealType);
        if (temp) allIssues.push(temp);

        const foodIssues = checkFoodSafety(slot, day.dayName, mealType, ctx);
        allIssues.push(...foodIssues);
        textureMismatchCount += foodIssues.filter((i) => i.code === 'WRONG_IDDSI_TEXTURE').length;
      }

      // ── Meal-level ───────────────────────────────────────────────────────
      const mealIssues = checkRequiredSlots(meal, day.dayName, ctx);
      allIssues.push(...mealIssues);
    }

    // ── Day-level ────────────────────────────────────────────────────────
    const dayResult = checkDayNutrients(day, ctx);
    allIssues.push(...dayResult.issues);
    nutrientChecksPassed += dayResult.nutrientChecksPassed;
    nutrientChecksTotal  += dayResult.nutrientChecksTotal;
  }

  // ── Weekly-level ───────────────────────────────────────────────────────
  const weeklyResult = checkWeeklyPatterns(plan);
  allIssues.push(...weeklyResult.issues);

  // ── Derive report fields ───────────────────────────────────────────────
  const hasBlocker    = allIssues.some((i) => i.severity === 'blocker');
  const exportBlocked = hasBlocker;
  const passed        = !hasBlocker && !allIssues.some((i) => i.severity === 'critical');

  const summary: ClinicalValidationSummary = {
    blockerCount:         allIssues.filter((i) => i.severity === 'blocker').length,
    criticalCount:        allIssues.filter((i) => i.severity === 'critical').length,
    warningCount:         allIssues.filter((i) => i.severity === 'warning').length,
    infoCount:            allIssues.filter((i) => i.severity === 'info').length,
    nutrientChecksPassed,
    nutrientChecksTotal,
    weeklyUniqueFoods:    weeklyResult.weeklyUniqueFoods,
    maxRepeatPerFood:     weeklyResult.maxRepeatPerFood,
    textureMismatchCount,
  };

  return {
    passed,
    exportBlocked,
    issues:                allIssues,
    clinicalAlignmentScore: calculateAlignmentScore(allIssues),
    summary,
  };
}
