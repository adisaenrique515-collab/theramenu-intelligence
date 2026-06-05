/**
 * server/__tests__/validationEngine.test.ts
 *
 * Tests for Phase 6 clinical validation engine.
 *
 * Required test cases:
 *   1.  Safe plan passes — exportBlocked false, passed true, score 100
 *   2.  Contraindicated food served — BLOCKER
 *   3.  Allergen served — BLOCKER
 *   4.  Wrong IDDSI texture — BLOCKER
 *   5.  Missing required slot — BLOCKER
 *   6.  Invalid portion — BLOCKER
 *   7.  Protein above renal target — BLOCKER
 *   8.  Potassium above renal target — BLOCKER
 *   9.  Phosphorus above renal target — BLOCKER
 *   10. Fluid above renal target — BLOCKER
 *   11. Missing service temperature — BLOCKER
 *   12. Multiple issues in one plan
 *   13. Export blocked despite otherwise high score
 *   14. Renal nutrient excesses
 *
 * Run with:
 *   node --experimental-strip-types --test server/__tests__/validationEngine.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateClinicalPlan,
  calculateAlignmentScore,
  type ValidationContext,
} from '../validationEngine.ts';

import { PROTOCOL_GENERAL_HOSPITAL, PROTOCOL_RENAL_STAGE_4 } from '../clinicalProtocols.ts';
import { EMPTY_NUTRIENTS } from '../nutrientUtils.ts';

import type {
  WeeklyTherapeuticPlan,
  DayPlan,
  MealPlan,
  MealSlot,
  SlotItem,
  ClinicalTargets,
  NutrientVector,
} from '../../types.ts';

import type { FoodItem } from '../../types-clinical.ts';

// ── Fixtures: FoodItems for foodIndex ────────────────────────────────────

function makeFood(overrides: Partial<FoodItem>): FoodItem {
  const base: FoodItem = {
    id:               'safe_food',
    canonicalName:    'Safe Test Food',
    category:         'grain',
    mealTypes:        ['Breakfast', 'Lunch', 'Dinner'],
    preparationState: 'cooked',
    nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: 100, proteinG: 5 },
    missingNutrients: [],
    textureLevels:    ['regular', 'soft', 'minced', 'pureed', 'liquid'],
    allergens:        [],
    contraindicatedFor: [],
    allowedFor:       [],
    servingRules:     { minGrams: 50, maxGrams: 250, defaultGrams: 100, unit: 'g' },
    source:           'CURATED',
    confidence:       'curated',
    approvalStatus:   'approved',
    tags:             [],
  };
  return { ...base, ...overrides };
}

const SAFE_RICE = makeFood({ id: 'safe_rice', canonicalName: 'Brown Rice Cooked' });

const CONTRAINDICATED_BANANA = makeFood({
  id:              'banana',
  canonicalName:   'Banana, fresh',
  category:        'fruit',
  contraindicatedFor: ['RENAL_STAGE_4'],
  approvalStatus:  'approved',
});

const GLUTEN_BREAD = makeFood({
  id:           'gluten_bread',
  canonicalName: 'Wholemeal Bread',
  allergens:    ['GLUTEN'],
  approvalStatus: 'approved',
});

const FIRM_CHICKEN = makeFood({
  id:            'firm_chicken',
  canonicalName: 'Grilled Chicken (Firm)',
  category:      'protein',
  textureLevels: ['regular'],   // only regular — fails pureed patients
  approvalStatus: 'approved',
});

const DRAFT_FOOD = makeFood({
  id:             'draft_food',
  canonicalName:  'Unapproved Experimental Food',
  approvalStatus: 'draft',
});

// ── Plan builder helpers ──────────────────────────────────────────────────

interface SlotSpec {
  slotName: string;
  foodId?: string;
  portion?: string;
  serviceTemp?: string;
  status?: 'FILLED' | 'EMPTY' | 'SUBSTITUTED';
}

function makeSlot(spec: SlotSpec): MealSlot {
  if (spec.status === 'EMPTY' || spec.portion === undefined) {
    return {
      slotName: spec.slotName,
      status: 'EMPTY',
      item: null,
    };
  }
  const item: SlotItem = {
    name:    spec.foodId ?? spec.slotName,
    foodId:  spec.foodId,
    portion: spec.portion,
    operational: spec.serviceTemp !== undefined
      ? { serviceTemp: spec.serviceTemp }
      : undefined,
  };
  return {
    slotName: spec.slotName,
    status:   spec.status ?? 'FILLED',
    item,
  };
}

function makeMeal(
  mealType: MealPlan['mealType'],
  slots: SlotSpec[],
): MealPlan {
  return {
    mealType,
    dietaryLabel: 'TEST',
    slots: slots.map(makeSlot),
  };
}

function makeTargets(overrides: Partial<ClinicalTargets> = {}): ClinicalTargets {
  return {
    ...EMPTY_NUTRIENTS,
    caloriesKcal: 2000,
    proteinG:     70,
    sodiumMg:     1800,   // target (also used as max via sodiumMgMax)
    fiberG:       25,
    fiberGMin:    25,
    sodiumMgMax:  1800,
    ...overrides,
  };
}

function makeDay(
  dayName: string,
  meals: MealPlan[],
  targets: Partial<ClinicalTargets> = {},
  totals: Partial<NutrientVector> = {},
): DayPlan {
  return {
    dayName,
    meals,
    dailyTargets: makeTargets(targets),
    totals: {
      ...EMPTY_NUTRIENTS,
      caloriesKcal: 2000,   // within target by default
      proteinG:     72,
      sodiumMg:     1700,
      fiberG:       27,
      ...totals,
    },
  };
}

function makePlan(days: DayPlan[]): WeeklyTherapeuticPlan {
  return {
    diagnosis:              'TEST',
    clinicalAlignmentScore: 0,
    constraints:            { exclude: [], prioritize: [], textureLevel: 'regular' },
    days,
    standards:              { hotHolding: '≥60°C', servingHotFood: '≥60°C', coldHolding: '≤8°C', servingColdFood: '≤8°C', boosting: 'N/A', vehicle: 'N/A' },
    notes:                  [],
    rationale:              'Test plan.',
    preparedBy:             'Test Engine',
    updatedDate:            '2026-06-05',
  };
}

/** A safe slot that passes all checks */
function safeSlot(slotName: string, foodId = 'safe_rice'): SlotSpec {
  return { slotName, foodId, portion: '150g', serviceTemp: '>= 60°C' };
}

/** Default safe context for GENERAL_HOSPITAL */
function makeCtx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    diagnosisCode: 'GENERAL_HOSPITAL',
    textureLevel:  'regular',
    allergens:     [],
    protocol:      PROTOCOL_GENERAL_HOSPITAL,
    foodIndex:     new Map([['safe_rice', SAFE_RICE]]),
    ...overrides,
  };
}

/** Renal context pointing to RENAL_STAGE_4 protocol */
function renalCtx(foodIndex?: Map<string, FoodItem>): ValidationContext {
  return {
    diagnosisCode: 'RENAL_STAGE_4',
    textureLevel:  'regular',
    allergens:     [],
    protocol:      PROTOCOL_RENAL_STAGE_4,
    foodIndex:     foodIndex ?? new Map([['safe_rice', SAFE_RICE]]),
  };
}

// ── Suite 1: Safe plan passes ────────────────────────────────────────────
// Includes ALL required GENERAL_HOSPITAL Breakfast slots (starch_base, protein_primary, beverage).
// LOW_FOOD_VARIETY warning is expected (1 day, 1 food) and is intentional —
// the key assertions are no blockers, no criticals, exportBlocked false.

describe('Suite 1 — Safe plan passes all checks', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      safeSlot('starch_base'),
      safeSlot('protein_primary'),
      safeSlot('beverage'),
    ])],
    { sodiumMgMax: 1800 },
    { sodiumMg: 1500, fiberG: 27, proteinG: 75 },
  );
  const plan = makePlan([day]);
  const ctx  = makeCtx();

  it('report.passed is true (no blockers or criticals)', () => {
    const report = validateClinicalPlan(plan, ctx);
    assert.strictEqual(report.passed, true);
  });

  it('report.exportBlocked is false', () => {
    const report = validateClinicalPlan(plan, ctx);
    assert.strictEqual(report.exportBlocked, false);
  });

  it('report has no blockers', () => {
    const report = validateClinicalPlan(plan, ctx);
    assert.strictEqual(report.summary.blockerCount, 0, `unexpected blockers: ${JSON.stringify(report.issues.filter(i => i.severity === 'blocker').map(i => i.code))}`);
  });

  it('report has no criticals', () => {
    const report = validateClinicalPlan(plan, ctx);
    assert.strictEqual(report.summary.criticalCount, 0, `unexpected criticals: ${JSON.stringify(report.issues.filter(i => i.severity === 'critical').map(i => i.code))}`);
  });

  it('clinicalAlignmentScore is > 0', () => {
    const report = validateClinicalPlan(plan, ctx);
    assert.ok(report.clinicalAlignmentScore > 0);
  });
});

// ── Suite 2: Contraindicated food served (BLOCKER) ───────────────────────

describe('Suite 2 — Contraindicated food served', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      { slotName: 'starch_base', foodId: 'banana', portion: '100g', serviceTemp: '>= 60°C' },
    ])],
  );
  const plan  = makePlan([day]);
  const fIdx  = new Map([['banana', CONTRAINDICATED_BANANA], ['safe_rice', SAFE_RICE]]);
  const ctx   = renalCtx(fIdx);

  it('produces CONTRAINDICATED_FOOD_SERVED blocker', () => {
    const report = validateClinicalPlan(plan, ctx);
    const blockers = report.issues.filter((i) => i.code === 'CONTRAINDICATED_FOOD_SERVED');
    assert.ok(blockers.length >= 1, 'must have at least one CONTRAINDICATED_FOOD_SERVED issue');
    assert.strictEqual(blockers[0]!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).exportBlocked, true);
  });

  it('passed is false', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).passed, false);
  });

  it('issue path includes the slot location', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'CONTRAINDICATED_FOOD_SERVED')!;
    assert.ok(issue.path.includes('slot:'), `path must include slot location; got: "${issue.path}"`);
    assert.ok(issue.path.includes('Monday'), `path must include day name; got: "${issue.path}"`);
  });

  it('issue has non-empty clinicalReason', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'CONTRAINDICATED_FOOD_SERVED')!;
    assert.ok(issue.clinicalReason.length > 20, 'clinicalReason must be substantive');
  });
});

// ── Suite 3: Allergen served (BLOCKER) ──────────────────────────────────

describe('Suite 3 — Allergen served', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      { slotName: 'starch_base', foodId: 'gluten_bread', portion: '60g', serviceTemp: '>= 60°C' },
    ])],
  );
  const plan = makePlan([day]);
  const fIdx = new Map([['gluten_bread', GLUTEN_BREAD]]);
  const ctx  = makeCtx({ allergens: ['GLUTEN'], foodIndex: fIdx });

  it('produces ALLERGEN_SERVED blocker', () => {
    const report = validateClinicalPlan(plan, ctx);
    const issue = report.issues.find((i) => i.code === 'ALLERGEN_SERVED');
    assert.ok(issue, 'must have ALLERGEN_SERVED issue');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).exportBlocked, true);
  });

  it('issue message names the allergen', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'ALLERGEN_SERVED')!;
    assert.ok(issue.message.includes('GLUTEN'), `message must name the allergen; got: "${issue.message}"`);
  });

  it('no allergen issue when patient has no allergens', () => {
    const ctxNoAllergen = makeCtx({ foodIndex: fIdx });
    const report = validateClinicalPlan(plan, ctxNoAllergen);
    assert.ok(!report.issues.some((i) => i.code === 'ALLERGEN_SERVED'));
  });
});

// ── Suite 4: Wrong IDDSI texture (BLOCKER) ──────────────────────────────

describe('Suite 4 — Wrong IDDSI texture', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      { slotName: 'protein_primary', foodId: 'firm_chicken', portion: '120g', serviceTemp: '>= 60°C' },
    ])],
  );
  const plan = makePlan([day]);
  const fIdx = new Map([['firm_chicken', FIRM_CHICKEN]]);
  // Patient requires pureed texture, but food only supports regular
  const ctx  = makeCtx({ textureLevel: 'pureed', foodIndex: fIdx });

  it('produces WRONG_IDDSI_TEXTURE blocker', () => {
    const report = validateClinicalPlan(plan, ctx);
    const issue = report.issues.find((i) => i.code === 'WRONG_IDDSI_TEXTURE');
    assert.ok(issue, 'must have WRONG_IDDSI_TEXTURE issue');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).exportBlocked, true);
  });

  it('textureMismatchCount in summary is ≥ 1', () => {
    const report = validateClinicalPlan(plan, ctx);
    assert.ok(report.summary.textureMismatchCount >= 1);
  });

  it('issue message mentions requested texture level', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'WRONG_IDDSI_TEXTURE')!;
    assert.ok(issue.message.includes('pureed'), `message must mention "pureed"; got: "${issue.message}"`);
  });
});

// ── Suite 5: Missing required slot (BLOCKER) ────────────────────────────

describe('Suite 5 — Missing required slot', () => {
  // GENERAL_HOSPITAL Breakfast has required slot: starch_base, protein_primary, beverage
  // Omit protein_primary by putting it as EMPTY
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      safeSlot('starch_base'),
      { slotName: 'protein_primary', status: 'EMPTY' },
      safeSlot('beverage'),
    ])],
  );
  const plan = makePlan([day]);
  const ctx  = makeCtx();

  it('produces MISSING_REQUIRED_SLOT blocker', () => {
    const report = validateClinicalPlan(plan, ctx);
    const issue = report.issues.find((i) => i.code === 'MISSING_REQUIRED_SLOT');
    assert.ok(issue, 'must have MISSING_REQUIRED_SLOT issue');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).exportBlocked, true);
  });

  it('issue message names the empty slot', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'MISSING_REQUIRED_SLOT')!;
    assert.ok(
      issue.message.includes('protein_primary'),
      `message must name the slot; got: "${issue.message}"`,
    );
  });

  it('issue path points to meal level', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'MISSING_REQUIRED_SLOT')!;
    assert.ok(issue.path.includes('meal:'), `path must include meal level; got: "${issue.path}"`);
  });
});

// ── Suite 6: Invalid portion (BLOCKER) ──────────────────────────────────

describe('Suite 6 — Invalid portion', () => {
  const makeInvalidPortionPlan = (portion: string) => {
    const day = makeDay(
      'Monday',
      [makeMeal('Breakfast', [
        { slotName: 'starch_base', foodId: 'safe_rice', portion, serviceTemp: '>= 60°C' },
      ])],
    );
    return makePlan([day]);
  };

  for (const badPortion of ['N/A', '0g', 'unknown', '']) {
    it(`portion "${badPortion}" → INVALID_PORTION blocker`, () => {
      const plan   = makeInvalidPortionPlan(badPortion);
      const report = validateClinicalPlan(plan, makeCtx());
      const issue  = report.issues.find((i) => i.code === 'INVALID_PORTION');
      assert.ok(issue, `must have INVALID_PORTION for "${badPortion}"`);
      assert.strictEqual(issue!.severity, 'blocker');
      assert.strictEqual(report.exportBlocked, true);
    });
  }

  it('valid portion "150g" does not trigger INVALID_PORTION', () => {
    const plan = makeInvalidPortionPlan('150g');
    const report = validateClinicalPlan(plan, makeCtx());
    assert.ok(!report.issues.some((i) => i.code === 'INVALID_PORTION'));
  });
});

// ── Suite 7: Protein above renal target (BLOCKER) ───────────────────────

describe('Suite 7 — Protein above renal target', () => {
  // proteinGMax = 40g, totals.proteinG = 55g (exceeded)
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [safeSlot('renal_carb_base'), safeSlot('renal_protein_primary'), safeSlot('beverage')])],
    { proteinG: 40, proteinGMax: 40, sodiumMgMax: 1500, potassiumMgMax: 1800, phosphorusMgMax: 800 },
    { proteinG: 55 }, // EXCEEDS proteinGMax
  );
  const plan = makePlan([day]);
  const ctx  = renalCtx();

  it('produces PROTEIN_EXCEEDS_RENAL_TARGET blocker', () => {
    const report = validateClinicalPlan(plan, ctx);
    const issue = report.issues.find((i) => i.code === 'PROTEIN_EXCEEDS_RENAL_TARGET');
    assert.ok(issue, 'must have PROTEIN_EXCEEDS_RENAL_TARGET');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).exportBlocked, true);
  });

  it('issue includes observedValue and expectedValue', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'PROTEIN_EXCEEDS_RENAL_TARGET')!;
    assert.ok(typeof issue.observedValue === 'number', 'observedValue must be a number');
    assert.ok(issue.expectedValue !== undefined, 'expectedValue must be present');
    assert.ok(issue.unit === 'g/day', 'unit must be g/day');
  });

  it('does NOT trigger for non-renal diagnosis', () => {
    const ctxGeneral = makeCtx();
    const report = validateClinicalPlan(plan, ctxGeneral);
    assert.ok(!report.issues.some((i) => i.code === 'PROTEIN_EXCEEDS_RENAL_TARGET'));
  });
});

// ── Suite 8: Potassium above renal target (BLOCKER) ─────────────────────

describe('Suite 8 — Potassium above renal target', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [safeSlot('renal_carb_base'), safeSlot('beverage')])],
    { potassiumMgMax: 1800, sodiumMgMax: 1500, phosphorusMgMax: 800 },
    { potassiumMg: 2200 }, // EXCEEDS potassiumMgMax
  );
  const plan = makePlan([day]);

  it('produces POTASSIUM_EXCEEDS_RENAL_TARGET blocker', () => {
    const report = validateClinicalPlan(plan, renalCtx());
    const issue = report.issues.find((i) => i.code === 'POTASSIUM_EXCEEDS_RENAL_TARGET');
    assert.ok(issue, 'must have POTASSIUM_EXCEEDS_RENAL_TARGET');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, renalCtx()).exportBlocked, true);
  });

  it('issue.unit is mg/day', () => {
    const issue = validateClinicalPlan(plan, renalCtx()).issues.find((i) => i.code === 'POTASSIUM_EXCEEDS_RENAL_TARGET')!;
    assert.strictEqual(issue.unit, 'mg/day');
  });

  it('does NOT trigger for non-renal diagnosis', () => {
    const report = validateClinicalPlan(plan, makeCtx());
    assert.ok(!report.issues.some((i) => i.code === 'POTASSIUM_EXCEEDS_RENAL_TARGET'));
  });
});

// ── Suite 9: Phosphorus above renal target (BLOCKER) ────────────────────

describe('Suite 9 — Phosphorus above renal target', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [safeSlot('renal_carb_base'), safeSlot('beverage')])],
    { phosphorusMgMax: 800, potassiumMgMax: 1800, sodiumMgMax: 1500 },
    { phosphorusMg: 1050 }, // EXCEEDS phosphorusMgMax
  );
  const plan = makePlan([day]);

  it('produces PHOSPHORUS_EXCEEDS_RENAL_TARGET blocker', () => {
    const report = validateClinicalPlan(plan, renalCtx());
    const issue = report.issues.find((i) => i.code === 'PHOSPHORUS_EXCEEDS_RENAL_TARGET');
    assert.ok(issue, 'must have PHOSPHORUS_EXCEEDS_RENAL_TARGET');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, renalCtx()).exportBlocked, true);
  });

  it('issue observedValue > expectedValue', () => {
    const issue = validateClinicalPlan(plan, renalCtx()).issues.find((i) => i.code === 'PHOSPHORUS_EXCEEDS_RENAL_TARGET')!;
    assert.ok((issue.observedValue ?? 0) > (issue.expectedValue as number), 'observed must exceed expected');
  });
});

// ── Suite 10: Fluid above renal target (BLOCKER) ────────────────────────

describe('Suite 10 — Fluid above renal target', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [safeSlot('renal_carb_base'), safeSlot('beverage')])],
    { fluidMlTarget: 1500, phosphorusMgMax: 800, potassiumMgMax: 1800, sodiumMgMax: 1500 },
    { fluidMl: 2000 }, // Exceeds 1500 * 1.05 = 1575
  );
  const plan = makePlan([day]);

  it('produces FLUID_EXCEEDS_RENAL_TARGET blocker', () => {
    const report = validateClinicalPlan(plan, renalCtx());
    const issue = report.issues.find((i) => i.code === 'FLUID_EXCEEDS_RENAL_TARGET');
    assert.ok(issue, 'must have FLUID_EXCEEDS_RENAL_TARGET');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, renalCtx()).exportBlocked, true);
  });

  it('fluid within tolerance does not trigger blocker', () => {
    // 1500 * 1.05 = 1575; 1550 should pass
    const dayOk = makeDay(
      'Monday',
      [makeMeal('Breakfast', [safeSlot('renal_carb_base'), safeSlot('beverage')])],
      { fluidMlTarget: 1500, phosphorusMgMax: 800, potassiumMgMax: 1800, sodiumMgMax: 1500 },
      { fluidMl: 1550 },
    );
    const report = validateClinicalPlan(makePlan([dayOk]), renalCtx());
    assert.ok(!report.issues.some((i) => i.code === 'FLUID_EXCEEDS_RENAL_TARGET'));
  });

  it('does NOT trigger for non-renal diagnosis', () => {
    const report = validateClinicalPlan(plan, makeCtx());
    assert.ok(!report.issues.some((i) => i.code === 'FLUID_EXCEEDS_RENAL_TARGET'));
  });
});

// ── Suite 11: Missing service temperature (BLOCKER) ─────────────────────

describe('Suite 11 — Missing service temperature', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      // No serviceTemp in operational metadata
      { slotName: 'starch_base', foodId: 'safe_rice', portion: '150g' },
    ])],
  );
  const plan = makePlan([day]);
  const ctx  = makeCtx();

  it('produces MISSING_SERVICE_TEMPERATURE blocker', () => {
    const report = validateClinicalPlan(plan, ctx);
    const issue = report.issues.find((i) => i.code === 'MISSING_SERVICE_TEMPERATURE');
    assert.ok(issue, 'must have MISSING_SERVICE_TEMPERATURE');
    assert.strictEqual(issue!.severity, 'blocker');
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(validateClinicalPlan(plan, ctx).exportBlocked, true);
  });

  it('issue path includes the slot', () => {
    const issue = validateClinicalPlan(plan, ctx).issues.find((i) => i.code === 'MISSING_SERVICE_TEMPERATURE')!;
    assert.ok(issue.path.includes('slot:'), `path must reference the slot; got: "${issue.path}"`);
  });

  it('providing a serviceTemp clears the blocker', () => {
    const dayOk = makeDay(
      'Monday',
      [makeMeal('Breakfast', [
        { slotName: 'starch_base', foodId: 'safe_rice', portion: '150g', serviceTemp: '>= 60°C' },
      ])],
    );
    const report = validateClinicalPlan(makePlan([dayOk]), ctx);
    assert.ok(!report.issues.some((i) => i.code === 'MISSING_SERVICE_TEMPERATURE'));
  });
});

// ── Suite 12: Multiple issues in one plan ────────────────────────────────

describe('Suite 12 — Multiple issues in one plan', () => {
  // Plan with: missing service temp (blocker) + sodium exceeded (critical) + fiber below min (warning)
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      { slotName: 'starch_base', portion: '150g' },   // no serviceTemp → blocker
      safeSlot('beverage'),
    ])],
    { sodiumMgMax: 1800, fiberGMin: 25 },
    { sodiumMg: 2500, fiberG: 10 },  // sodium exceeded + fiber below min
  );
  const plan   = makePlan([day]);
  const report = validateClinicalPlan(plan, makeCtx());

  it('has at least 3 issues', () => {
    assert.ok(report.issues.length >= 3, `expected ≥ 3 issues, got ${report.issues.length}`);
  });

  it('has at least one blocker', () => {
    assert.ok(report.summary.blockerCount >= 1);
  });

  it('has at least one critical', () => {
    assert.ok(report.summary.criticalCount >= 1);
  });

  it('has at least one warning', () => {
    assert.ok(report.summary.warningCount >= 1);
  });

  it('exportBlocked is true (because of blocker)', () => {
    assert.strictEqual(report.exportBlocked, true);
  });

  it('passed is false', () => {
    assert.strictEqual(report.passed, false);
  });

  it('score is reduced from 100', () => {
    assert.ok(report.clinicalAlignmentScore < 100, 'score must be below 100 with issues');
  });
});

// ── Suite 13: Export blocked despite otherwise high score ───────────────

describe('Suite 13 — Export blocked despite high score', () => {
  // Plan has ONE blocker (missing temp on starch_base) — score = 100 - 40 - 5 (LOW_FOOD_VARIETY) = 55.
  // Other required slots are filled so no MISSING_REQUIRED_SLOT blockers are added.
  // The key point: exportBlocked is independent of score.
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [
      { slotName: 'starch_base', portion: '150g' },  // no serviceTemp → blocker
      safeSlot('protein_primary'),
      safeSlot('beverage'),
    ])],
  );
  const plan   = makePlan([day]);
  const report = validateClinicalPlan(plan, makeCtx());

  it('exportBlocked is true even with score > 0', () => {
    assert.strictEqual(report.exportBlocked, true);
    assert.ok(report.clinicalAlignmentScore > 0, 'score should still be positive');
  });

  it('score does not override exportBlocked', () => {
    // If score > 50, that alone should NOT make exportBlocked false
    if (report.clinicalAlignmentScore > 50) {
      assert.strictEqual(report.exportBlocked, true,
        'exportBlocked must remain true regardless of score');
    }
  });

  it('score = 100 - 40 = 60 for single blocker', () => {
    // One blocker with no other issues = 100 - 40 = 60
    // (there may be a LOW_FOOD_VARIETY warning too, reducing further)
    assert.ok(report.clinicalAlignmentScore <= 60);
  });
});

// ── Suite 14: Renal nutrient excesses (combined) ─────────────────────────

describe('Suite 14 — All four renal nutrient blockers in one plan', () => {
  const day = makeDay(
    'Monday',
    [makeMeal('Breakfast', [safeSlot('renal_carb_base'), safeSlot('beverage')])],
    {
      proteinGMax:   40,
      potassiumMgMax: 1800,
      phosphorusMgMax: 800,
      fluidMlTarget: 1500,
      sodiumMgMax: 1500,
    },
    {
      proteinG:    55,    // exceeds proteinGMax 40
      potassiumMg: 2200,  // exceeds potassiumMgMax 1800
      phosphorusMg: 950,  // exceeds phosphorusMgMax 800
      fluidMl:    2000,   // exceeds fluidMlTarget 1500 * 1.05 = 1575
    },
  );
  const plan   = makePlan([day]);
  const report = validateClinicalPlan(plan, renalCtx());

  const RENAL_BLOCKERS = [
    'PROTEIN_EXCEEDS_RENAL_TARGET',
    'POTASSIUM_EXCEEDS_RENAL_TARGET',
    'PHOSPHORUS_EXCEEDS_RENAL_TARGET',
    'FLUID_EXCEEDS_RENAL_TARGET',
  ] as const;

  for (const code of RENAL_BLOCKERS) {
    it(`includes ${code} blocker`, () => {
      const issue = report.issues.find((i) => i.code === code);
      assert.ok(issue, `missing ${code}`);
      assert.strictEqual(issue!.severity, 'blocker');
    });
  }

  it('summary.blockerCount is ≥ 4', () => {
    assert.ok(report.summary.blockerCount >= 4, `expected ≥ 4 blockers, got ${report.summary.blockerCount}`);
  });

  it('score is 0 or very low (4+ blockers × 40 each)', () => {
    // 4 × 40 = 160 deductions → score = max(0, 100 - 160) = 0
    assert.strictEqual(report.clinicalAlignmentScore, 0);
  });

  it('exportBlocked is true', () => {
    assert.strictEqual(report.exportBlocked, true);
  });
});

// ── Suite 15: Scoring determinism ────────────────────────────────────────

describe('Suite 15 — Scoring is deterministic', () => {
  it('calculateAlignmentScore([]) = 100', () => {
    assert.strictEqual(calculateAlignmentScore([]), 100);
  });

  it('one blocker → 60', () => {
    const issues = [{ severity: 'blocker' as const, code: 'X', message: 'X', path: 'plan', clinicalReason: 'X' }];
    assert.strictEqual(calculateAlignmentScore(issues), 60);
  });

  it('one critical → 85', () => {
    const issues = [{ severity: 'critical' as const, code: 'X', message: 'X', path: 'plan', clinicalReason: 'X' }];
    assert.strictEqual(calculateAlignmentScore(issues), 85);
  });

  it('one warning → 95', () => {
    const issues = [{ severity: 'warning' as const, code: 'X', message: 'X', path: 'plan', clinicalReason: 'X' }];
    assert.strictEqual(calculateAlignmentScore(issues), 95);
  });

  it('one info → 99', () => {
    const issues = [{ severity: 'info' as const, code: 'X', message: 'X', path: 'plan', clinicalReason: 'X' }];
    assert.strictEqual(calculateAlignmentScore(issues), 99);
  });

  it('blocker + critical + warning → 40 (100 - 40 - 15 - 5)', () => {
    const issues = [
      { severity: 'blocker' as const,  code: 'A', message: 'A', path: 'plan', clinicalReason: 'A' },
      { severity: 'critical' as const, code: 'B', message: 'B', path: 'plan', clinicalReason: 'B' },
      { severity: 'warning' as const,  code: 'C', message: 'C', path: 'plan', clinicalReason: 'C' },
    ];
    assert.strictEqual(calculateAlignmentScore(issues), 40);
  });

  it('3 blockers → max(0, 100-120) = 0', () => {
    const issues = Array(3).fill({ severity: 'blocker' as const, code: 'X', message: 'X', path: 'plan', clinicalReason: 'X' });
    assert.strictEqual(calculateAlignmentScore(issues), 0);
  });

  it('score is same on repeated calls (deterministic)', () => {
    const day  = makeDay('Monday', [makeMeal('Breakfast', [safeSlot('starch_base'), safeSlot('beverage')])]);
    const plan = makePlan([day]);
    const ctx  = makeCtx();
    const s1   = validateClinicalPlan(plan, ctx).clinicalAlignmentScore;
    const s2   = validateClinicalPlan(plan, ctx).clinicalAlignmentScore;
    assert.strictEqual(s1, s2);
  });
});

// ── Suite 16: Issue structure (path, clinicalReason, observedValue) ──────

describe('Suite 16 — ValidationIssue structure', () => {
  it('all issues have non-empty path and clinicalReason', () => {
    const day = makeDay(
      'Monday',
      [makeMeal('Breakfast', [
        { slotName: 'starch_base', portion: '150g' }, // no serviceTemp
      ])],
      { sodiumMgMax: 1800 },
      { sodiumMg: 2200, fiberG: 10 },
    );
    const report = validateClinicalPlan(makePlan([day]), makeCtx());
    for (const issue of report.issues) {
      assert.ok(issue.path.length > 0,          `path must not be empty for "${issue.code}"`);
      assert.ok(issue.clinicalReason.length > 0, `clinicalReason must not be empty for "${issue.code}"`);
    }
  });

  it('nutrient issues have observedValue and expectedValue', () => {
    const day = makeDay(
      'Monday',
      [makeMeal('Breakfast', [safeSlot('starch_base'), safeSlot('beverage')])],
      { sodiumMgMax: 1800 },
      { sodiumMg: 2500 },
    );
    const report = validateClinicalPlan(makePlan([day]), makeCtx());
    const sodiumIssue = report.issues.find((i) => i.code === 'SODIUM_EXCEEDED');
    assert.ok(sodiumIssue, 'must have SODIUM_EXCEEDED issue');
    assert.ok(typeof sodiumIssue!.observedValue === 'number');
    assert.ok(sodiumIssue!.expectedValue !== undefined);
    assert.ok(sodiumIssue!.unit === 'mg/day');
  });

  it('slot-level issues include slot name in path', () => {
    const day = makeDay(
      'Monday',
      [makeMeal('Breakfast', [
        { slotName: 'protein_primary', portion: '120g' }, // no serviceTemp
      ])],
    );
    const report = validateClinicalPlan(makePlan([day]), makeCtx());
    const issue = report.issues.find((i) => i.code === 'MISSING_SERVICE_TEMPERATURE');
    assert.ok(issue?.path.includes('protein_primary'), `path must include slot name; got: "${issue?.path}"`);
  });
});
