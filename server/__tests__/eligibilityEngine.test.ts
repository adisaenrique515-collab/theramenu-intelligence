/**
 * server/__tests__/eligibilityEngine.test.ts
 *
 * Tests for Phase 5 eligibility filter pipeline.
 *
 * Required test cases (per spec):
 *   1. banana excluded for RENAL_STAGE_4 (contraindication gate)
 *   2. allergen exclusion (allergen gate)
 *   3. wrong IDDSI texture exclusion (texture gate)
 *   4. unapproved food exclusion (approval_status gate)
 *   5. food with invalid serving range exclusion (portion_feasibility gate)
 *   6. safe eligible food passes all filters
 *
 * Run with:
 *   node --experimental-strip-types --test server/__tests__/eligibilityEngine.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEligibilityFilters,
  evaluateFood,
  assertNoUnsafeFood,
  type EligibilityContext,
  type EligibilityGate,
} from '../eligibilityEngine.ts';

import { EMPTY_NUTRIENTS } from '../nutrientUtils.ts';
import type { FoodItem, NutrientVector } from '../../types-clinical.ts';

// ── Test food fixtures ────────────────────────────────────────────────────

function makeFood(overrides: Partial<FoodItem>): FoodItem {
  const defaults: FoodItem = {
    id:               'test_food',
    canonicalName:    'Test Food',
    category:         'grain',
    mealTypes:        ['Breakfast', 'Lunch', 'Dinner'],
    preparationState: 'cooked',
    nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: 100, proteinG: 5, carbsG: 20 },
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
  return { ...defaults, ...overrides };
}

/**
 * Banana — high potassium, explicitly contraindicated for renal protocols.
 * Source: USDA FDC FDC ID 1102702 — Bananas, raw; potassium ≈ 358 mg/100g.
 */
const BANANA = makeFood({
  id:            'banana_fresh',
  canonicalName: 'Banana, Fresh',
  category:      'fruit',
  mealTypes:     ['Breakfast', 'Snack AM', 'Snack PM'],
  preparationState: 'raw',
  nutrientsPer100g: {
    ...EMPTY_NUTRIENTS,
    caloriesKcal: 89,
    carbsG:       23,
    potassiumMg:  358,   // High potassium — clinically significant for CKD
    phosphorusMg: 22,
    sodiumMg:     1,
  },
  textureLevels:     ['regular', 'soft'],
  allergens:         [],
  contraindicatedFor: ['RENAL_STAGE_3', 'RENAL_STAGE_4'],
  approvalStatus:    'approved',
  tags:              ['high_potassium', 'fruit'],
});

/** Wholemeal bread — contains GLUTEN allergen */
const BREAD_GLUTEN = makeFood({
  id:            'bread_wholemeal',
  canonicalName: 'Wholemeal Bread',
  category:      'grain',
  mealTypes:     ['Breakfast', 'Lunch'],
  preparationState: 'processed',
  nutrientsPer100g: {
    ...EMPTY_NUTRIENTS,
    caloriesKcal: 247,
    proteinG:     9,
    carbsG:       41,
    fatG:         4,
    fiberG:       7,
    sodiumMg:     450,
  },
  textureLevels:     ['regular', 'soft'],
  allergens:         ['GLUTEN'],
  contraindicatedFor: [],
  approvalStatus:    'approved',
  tags:              ['whole_grain'],
});

/** Firm grilled chicken — only supports 'regular' texture, not pureed */
const FIRM_GRILLED_CHICKEN = makeFood({
  id:            'chicken_grilled_firm',
  canonicalName: 'Grilled Chicken Breast (Firm)',
  category:      'protein',
  mealTypes:     ['Breakfast', 'Lunch', 'Dinner'],
  preparationState: 'cooked',
  nutrientsPer100g: {
    ...EMPTY_NUTRIENTS,
    caloriesKcal: 165,
    proteinG:     31,
    fatG:         3.6,
    sodiumMg:     74,
  },
  textureLevels:     ['regular'],   // ONLY regular — not pureed, minced, etc.
  allergens:         [],
  contraindicatedFor: [],
  approvalStatus:    'approved',
  tags:              ['lean_protein'],
});

/** Food in draft/pending state — not approved for production use */
const DRAFT_FOOD = makeFood({
  id:            'experimental_blend',
  canonicalName: 'Experimental Protein Blend',
  category:      'protein',
  source:        'RESEARCH',
  confidence:    'unverified',
  approvalStatus: 'draft',         // NOT approved
});

/** Food with invalid serving range (min > max) — data error */
const FOOD_INVALID_SERVING = makeFood({
  id:            'data_error_food',
  canonicalName: 'Food With Invalid Serving Range',
  category:      'starch',
  servingRules: { minGrams: 300, maxGrams: 100, defaultGrams: 150, unit: 'g' }, // min > max!
  approvalStatus: 'approved',
});

/** Safe brown rice — passes all 6 filters for GENERAL_HOSPITAL, regular texture, no allergens */
const SAFE_BROWN_RICE = makeFood({
  id:            'brown_rice_cooked',
  canonicalName: 'Brown Rice Cooked',
  category:      'grain',
  mealTypes:     ['Breakfast', 'Lunch', 'Dinner'],
  preparationState: 'cooked',
  nutrientsPer100g: {
    ...EMPTY_NUTRIENTS,
    caloriesKcal: 123,
    proteinG:     2.74,
    carbsG:       25.58,
    fatG:         0.97,
    sodiumMg:     4,
    potassiumMg:  79,
    phosphorusMg: 83,
  },
  textureLevels:     ['regular', 'soft'],
  allergens:         [],
  contraindicatedFor: [],
  approvalStatus:    'approved',
  tags:              ['whole_grain', 'low_gi'],
});

// ── Contexts ──────────────────────────────────────────────────────────────

const CTX_RENAL_REGULAR: EligibilityContext = {
  diagnosisCode: 'RENAL_STAGE_4',
  textureLevel:  'regular',
  allergens:     [],
  mealType:      'Breakfast',
};

const CTX_GENERAL_REGULAR: EligibilityContext = {
  diagnosisCode: 'GENERAL_HOSPITAL',
  textureLevel:  'regular',
  allergens:     [],
  mealType:      'Breakfast',
};

const CTX_GENERAL_PUREED: EligibilityContext = {
  diagnosisCode: 'GENERAL_HOSPITAL',
  textureLevel:  'pureed',
  allergens:     [],
  mealType:      'Breakfast',
};

const CTX_GLUTEN_INTOLERANT: EligibilityContext = {
  diagnosisCode: 'GENERAL_HOSPITAL',
  textureLevel:  'regular',
  allergens:     ['GLUTEN'],
  mealType:      'Breakfast',
};

// ── Suite 1 (required): banana excluded for RENAL_STAGE_4 ────────────────

describe('Suite 1 — Banana excluded for RENAL_STAGE_4 (Gate 2: contraindication)', () => {
  it('banana fails at contraindication gate for RENAL_STAGE_4', () => {
    const exclusion = evaluateFood(BANANA, CTX_RENAL_REGULAR);
    assert.ok(exclusion, 'banana must be excluded');
    assert.strictEqual(exclusion!.failedAt, 'contraindication');
  });

  it('exclusion reason mentions the diagnosis code', () => {
    const exclusion = evaluateFood(BANANA, CTX_RENAL_REGULAR);
    assert.ok(
      exclusion!.reason.includes('RENAL_STAGE_4'),
      `reason must reference RENAL_STAGE_4; got: "${exclusion!.reason}"`,
    );
  });

  it('banana passes for GENERAL_HOSPITAL (not contraindicated)', () => {
    const exclusion = evaluateFood(BANANA, CTX_GENERAL_REGULAR);
    // Banana is not contraindicated for GENERAL_HOSPITAL
    // It will pass gates 1-2-3-4-5-6 for this context
    assert.strictEqual(exclusion, null, 'banana should not be excluded for GENERAL_HOSPITAL');
  });

  it('applyEligibilityFilters excludes banana in RENAL_STAGE_4 context', () => {
    const result = applyEligibilityFilters([BANANA, SAFE_BROWN_RICE], CTX_RENAL_REGULAR);
    const excludedIds = result.excluded.map((e) => e.food.id);
    assert.ok(excludedIds.includes('banana_fresh'), 'banana must be in excluded list');
    assert.ok(!result.eligible.map((f) => f.id).includes('banana_fresh'), 'banana must not be in eligible list');
  });

  it('applyEligibilityFilters counts one contraindication exclusion', () => {
    const result = applyEligibilityFilters([BANANA], CTX_RENAL_REGULAR);
    assert.strictEqual(result.counts.contraindication, 1);
  });
});

// ── Suite 2 (required): allergen exclusion ────────────────────────────────

describe('Suite 2 — Allergen exclusion (Gate 3)', () => {
  it('GLUTEN food fails allergen gate for gluten-intolerant patient', () => {
    const exclusion = evaluateFood(BREAD_GLUTEN, CTX_GLUTEN_INTOLERANT);
    assert.ok(exclusion, 'bread must be excluded for GLUTEN allergen');
    assert.strictEqual(exclusion!.failedAt, 'allergen');
  });

  it('exclusion reason names the specific allergen', () => {
    const exclusion = evaluateFood(BREAD_GLUTEN, CTX_GLUTEN_INTOLERANT);
    assert.ok(
      exclusion!.reason.includes('GLUTEN'),
      `reason must name the allergen; got: "${exclusion!.reason}"`,
    );
  });

  it('GLUTEN food passes for patient with no allergens', () => {
    const exclusion = evaluateFood(BREAD_GLUTEN, CTX_GENERAL_REGULAR);
    assert.strictEqual(exclusion, null, 'bread should pass when no patient allergens');
  });

  it('GLUTEN food excluded but non-allergen food passes in same batch', () => {
    const result = applyEligibilityFilters(
      [BREAD_GLUTEN, SAFE_BROWN_RICE],
      CTX_GLUTEN_INTOLERANT,
    );
    assert.ok(result.eligible.map((f) => f.id).includes('brown_rice_cooked'));
    assert.strictEqual(result.excluded[0]?.failedAt, 'allergen');
  });

  it('multiple allergen types — EGG also excluded', () => {
    const EGG_FOOD = makeFood({
      id: 'scrambled_egg',
      canonicalName: 'Scrambled Egg',
      allergens: ['EGG'],
      approvalStatus: 'approved',
    });
    const ctxEggAllergy: EligibilityContext = {
      ...CTX_GENERAL_REGULAR,
      allergens: ['EGG', 'MILK'],
    };
    const exclusion = evaluateFood(EGG_FOOD, ctxEggAllergy);
    assert.ok(exclusion, 'egg food must be excluded');
    assert.strictEqual(exclusion!.failedAt, 'allergen');
  });
});

// ── Suite 3 (required): wrong IDDSI texture exclusion ────────────────────

describe('Suite 3 — Wrong IDDSI texture exclusion (Gate 1)', () => {
  it('firm chicken (regular only) fails texture gate for pureed patient', () => {
    const exclusion = evaluateFood(FIRM_GRILLED_CHICKEN, CTX_GENERAL_PUREED);
    assert.ok(exclusion, 'firm chicken must fail for pureed patient');
    assert.strictEqual(exclusion!.failedAt, 'texture_compatibility');
  });

  it('exclusion reason names both the requested and available textures', () => {
    const exclusion = evaluateFood(FIRM_GRILLED_CHICKEN, CTX_GENERAL_PUREED);
    assert.ok(
      exclusion!.reason.includes('pureed'),
      `reason must mention "pureed"; got: "${exclusion!.reason}"`,
    );
    assert.ok(
      exclusion!.reason.includes('regular'),
      `reason must mention available textures; got: "${exclusion!.reason}"`,
    );
  });

  it('texture check fails first — before contraindication is checked', () => {
    // Create a food that fails both texture AND allergen — texture must win (gate order)
    const WRONG_TEXTURE_WITH_ALLERGEN = makeFood({
      id: 'dual_fail',
      textureLevels: ['regular'],           // will fail texture for 'pureed' patient
      allergens: ['GLUTEN'],                // would also fail allergen gate
      approvalStatus: 'approved',
    });
    const ctx: EligibilityContext = {
      diagnosisCode: 'GENERAL_HOSPITAL',
      textureLevel:  'pureed',
      allergens:     ['GLUTEN'],
      mealType:      'Breakfast',
    };
    const exclusion = evaluateFood(WRONG_TEXTURE_WITH_ALLERGEN, ctx);
    assert.ok(exclusion, 'food must be excluded');
    assert.strictEqual(
      exclusion!.failedAt,
      'texture_compatibility',
      'texture gate (1) must fire before allergen gate (3)',
    );
  });

  it('soft texture food passes for regular patient', () => {
    const SOFT_FOOD = makeFood({
      id: 'mashed_potato',
      textureLevels: ['regular', 'soft', 'minced', 'pureed'],
      approvalStatus: 'approved',
    });
    const exclusion = evaluateFood(SOFT_FOOD, CTX_GENERAL_REGULAR);
    assert.strictEqual(exclusion, null);
  });
});

// ── Suite 4 (required): unapproved food exclusion ────────────────────────

describe('Suite 4 — Unapproved food exclusion (Gate 5)', () => {
  it('draft food fails approval_status gate', () => {
    const exclusion = evaluateFood(DRAFT_FOOD, CTX_GENERAL_REGULAR);
    assert.ok(exclusion, 'draft food must be excluded');
    assert.strictEqual(exclusion!.failedAt, 'approval_status');
  });

  it('pending_review food also fails approval_status gate', () => {
    const PENDING = makeFood({ id: 'pending', canonicalName: 'Pending Food', approvalStatus: 'pending_review' });
    const exclusion = evaluateFood(PENDING, CTX_GENERAL_REGULAR);
    assert.ok(exclusion);
    assert.strictEqual(exclusion!.failedAt, 'approval_status');
  });

  it('retired food also fails approval_status gate', () => {
    const RETIRED = makeFood({ id: 'retired', canonicalName: 'Retired Food', approvalStatus: 'retired' });
    const exclusion = evaluateFood(RETIRED, CTX_GENERAL_REGULAR);
    assert.ok(exclusion);
    assert.strictEqual(exclusion!.failedAt, 'approval_status');
  });

  it('exclusion reason mentions the current status and required status', () => {
    const exclusion = evaluateFood(DRAFT_FOOD, CTX_GENERAL_REGULAR);
    assert.ok(
      exclusion!.reason.includes('draft'),
      `reason must mention "draft"; got: "${exclusion!.reason}"`,
    );
    assert.ok(
      exclusion!.reason.includes('approved'),
      `reason must mention "approved"; got: "${exclusion!.reason}"`,
    );
  });
});

// ── Suite 5 (required): invalid serving range exclusion ──────────────────

describe('Suite 5 — Portion feasibility exclusion (Gate 6)', () => {
  it('food with minGrams > maxGrams fails portion_feasibility gate', () => {
    const exclusion = evaluateFood(FOOD_INVALID_SERVING, CTX_GENERAL_REGULAR);
    assert.ok(exclusion, 'food with inverted range must be excluded');
    assert.strictEqual(exclusion!.failedAt, 'portion_feasibility');
  });

  it('exclusion reason mentions both minGrams and maxGrams', () => {
    const exclusion = evaluateFood(FOOD_INVALID_SERVING, CTX_GENERAL_REGULAR);
    assert.ok(
      exclusion!.reason.includes('300') && exclusion!.reason.includes('100'),
      `reason must mention the invalid values; got: "${exclusion!.reason}"`,
    );
  });

  it('food with maxGrams = 0 fails portion_feasibility gate', () => {
    const ZERO_MAX = makeFood({ servingRules: { minGrams: 0, maxGrams: 0, defaultGrams: 0, unit: 'g' }, approvalStatus: 'approved' });
    const exclusion = evaluateFood(ZERO_MAX, CTX_GENERAL_REGULAR);
    assert.ok(exclusion);
    assert.strictEqual(exclusion!.failedAt, 'portion_feasibility');
  });

  it('food with negative minGrams fails portion_feasibility gate', () => {
    const NEG_MIN = makeFood({ servingRules: { minGrams: -10, maxGrams: 200, defaultGrams: 100, unit: 'g' }, approvalStatus: 'approved' });
    const exclusion = evaluateFood(NEG_MIN, CTX_GENERAL_REGULAR);
    assert.ok(exclusion);
    assert.strictEqual(exclusion!.failedAt, 'portion_feasibility');
  });

  it('context minimumPortionGrams larger than food maxGrams fails gate 6', () => {
    const SMALL_MAX = makeFood({ id: 'small_max', servingRules: { minGrams: 10, maxGrams: 50, defaultGrams: 30, unit: 'g' }, approvalStatus: 'approved' });
    const ctx: EligibilityContext = {
      ...CTX_GENERAL_REGULAR,
      minimumPortionGrams: 100, // > maxGrams of 50
    };
    const exclusion = evaluateFood(SMALL_MAX, ctx);
    assert.ok(exclusion, 'must fail when minimum portion cannot be satisfied');
    assert.strictEqual(exclusion!.failedAt, 'portion_feasibility');
  });

  it('valid serving range (min ≤ max, max > 0) passes gate 6', () => {
    const VALID = makeFood({ servingRules: { minGrams: 0, maxGrams: 200, defaultGrams: 100, unit: 'g' }, approvalStatus: 'approved' });
    const exclusion = evaluateFood(VALID, CTX_GENERAL_REGULAR);
    assert.strictEqual(exclusion, null, 'valid range must pass gate 6');
  });
});

// ── Suite 6 (required): safe eligible food passes all filters ─────────────

describe('Suite 6 — Safe eligible food passes all 6 filters', () => {
  it('brown rice passes all filters for GENERAL_HOSPITAL regular texture', () => {
    const exclusion = evaluateFood(SAFE_BROWN_RICE, CTX_GENERAL_REGULAR);
    assert.strictEqual(exclusion, null, 'brown rice must pass all filters');
  });

  it('brown rice appears in eligible list from applyEligibilityFilters', () => {
    const result = applyEligibilityFilters([SAFE_BROWN_RICE], CTX_GENERAL_REGULAR);
    assert.strictEqual(result.eligible.length, 1);
    assert.strictEqual(result.eligible[0]?.id, 'brown_rice_cooked');
    assert.strictEqual(result.excluded.length, 0);
  });

  it('all 6 gate counts are 0 when only eligible foods are evaluated', () => {
    const result = applyEligibilityFilters([SAFE_BROWN_RICE], CTX_GENERAL_REGULAR);
    for (const gate of Object.keys(result.counts) as EligibilityGate[]) {
      assert.strictEqual(result.counts[gate], 0, `count for gate "${gate}" must be 0`);
    }
  });

  it('totalEvaluated equals foods.length', () => {
    const foods = [SAFE_BROWN_RICE, BANANA, BREAD_GLUTEN, DRAFT_FOOD, FIRM_GRILLED_CHICKEN];
    const result = applyEligibilityFilters(foods, CTX_GENERAL_REGULAR);
    assert.strictEqual(result.totalEvaluated, foods.length);
  });

  it('assertNoUnsafeFood does not throw for a clean eligible list', () => {
    assert.doesNotThrow(
      () => assertNoUnsafeFood([SAFE_BROWN_RICE], CTX_GENERAL_REGULAR),
      'assertNoUnsafeFood must not throw for a safe eligible list',
    );
  });
});

// ── Suite 7: Gate ordering invariant ─────────────────────────────────────

describe('Suite 7 — Gate ordering invariant', () => {
  it('texture gate (1) fires before contraindication gate (2)', () => {
    // Food that would fail BOTH texture and contraindication — texture must fail first
    const DUAL_FAIL = makeFood({
      id: 'dual_fail_tex_contra',
      textureLevels: ['regular'],          // fails texture for pureed patient
      contraindicatedFor: ['GENERAL_HOSPITAL'],  // would also fail contraindication
      approvalStatus: 'approved',
    });
    const ctx: EligibilityContext = { ...CTX_GENERAL_PUREED, diagnosisCode: 'GENERAL_HOSPITAL' };
    const exclusion = evaluateFood(DUAL_FAIL, ctx);
    assert.strictEqual(exclusion?.failedAt, 'texture_compatibility', 'gate 1 must fire first');
  });

  it('contraindication gate (2) fires before allergen gate (3)', () => {
    const DUAL_FAIL = makeFood({
      id: 'dual_fail_contra_allergen',
      contraindicatedFor: ['GENERAL_HOSPITAL'],
      allergens: ['GLUTEN'],
      approvalStatus: 'approved',
    });
    const ctx: EligibilityContext = { ...CTX_GENERAL_REGULAR, diagnosisCode: 'GENERAL_HOSPITAL', allergens: ['GLUTEN'] };
    const exclusion = evaluateFood(DUAL_FAIL, ctx);
    assert.strictEqual(exclusion?.failedAt, 'contraindication', 'gate 2 must fire before gate 3');
  });

  it('allergen gate (3) fires before meal_type gate (4)', () => {
    const DUAL_FAIL = makeFood({
      id: 'dual_fail_allergen_meal',
      allergens: ['GLUTEN'],
      mealTypes: ['Dinner'],               // would fail meal_type for Breakfast context
      approvalStatus: 'approved',
    });
    const ctx: EligibilityContext = { ...CTX_GLUTEN_INTOLERANT, mealType: 'Breakfast' };
    const exclusion = evaluateFood(DUAL_FAIL, ctx);
    assert.strictEqual(exclusion?.failedAt, 'allergen', 'gate 3 must fire before gate 4');
  });

  it('meal_type gate (4) fires before approval_status gate (5)', () => {
    const DUAL_FAIL = makeFood({
      id: 'dual_fail_meal_approval',
      mealTypes: ['Dinner'],               // fails meal_type for Breakfast
      approvalStatus: 'draft',             // also fails approval_status
    });
    const exclusion = evaluateFood(DUAL_FAIL, CTX_GENERAL_REGULAR);  // mealType: Breakfast
    assert.strictEqual(exclusion?.failedAt, 'meal_type', 'gate 4 must fire before gate 5');
  });

  it('approval_status gate (5) fires before portion_feasibility gate (6)', () => {
    const DUAL_FAIL = makeFood({
      id: 'dual_fail_approval_portion',
      approvalStatus: 'draft',
      servingRules: { minGrams: 300, maxGrams: 100, defaultGrams: 150, unit: 'g' }, // also invalid
    });
    const exclusion = evaluateFood(DUAL_FAIL, CTX_GENERAL_REGULAR);
    assert.strictEqual(exclusion?.failedAt, 'approval_status', 'gate 5 must fire before gate 6');
  });

  it('assertNoUnsafeFood throws if an unsafe food is present in the eligible list', () => {
    // Simulate a bug where banana slipped into the eligible list
    assert.throws(
      () => assertNoUnsafeFood([BANANA], CTX_RENAL_REGULAR),
      /SAFETY INVARIANT VIOLATION/,
      'must throw with safety violation message',
    );
  });
});

// ── Suite 8: Batch filtering with mixed foods ─────────────────────────────

describe('Suite 8 — Batch filtering with mixed food set', () => {
  const MIXED_FOODS = [
    SAFE_BROWN_RICE,     // passes all gates
    BANANA,              // fails contraindication (renal)
    BREAD_GLUTEN,        // passes (no patient allergens in this context)
    DRAFT_FOOD,          // fails approval_status
    FOOD_INVALID_SERVING, // fails portion_feasibility
    FIRM_GRILLED_CHICKEN, // passes (regular texture, GENERAL_HOSPITAL)
  ];

  it('batch: correct eligible count for GENERAL_HOSPITAL regular texture', () => {
    const result = applyEligibilityFilters(MIXED_FOODS, CTX_GENERAL_REGULAR);
    // Eligible: SAFE_BROWN_RICE, BREAD_GLUTEN, FIRM_GRILLED_CHICKEN = 3
    // Excluded: BANANA (passes contra for GENERAL), DRAFT_FOOD (approval), FOOD_INVALID_SERVING (portion)
    // Wait: BANANA is only contraindicated for RENAL — for GENERAL_HOSPITAL it passes
    // So eligible: SAFE_BROWN_RICE, BANANA, BREAD_GLUTEN, FIRM_GRILLED_CHICKEN = 4
    // Excluded: DRAFT_FOOD (approval), FOOD_INVALID_SERVING (portion)
    assert.strictEqual(result.eligible.length, 4, 'should have 4 eligible foods');
    assert.strictEqual(result.excluded.length, 2, 'should have 2 excluded foods');
  });

  it('batch: correct eligible count for RENAL_STAGE_4', () => {
    const result = applyEligibilityFilters(MIXED_FOODS, CTX_RENAL_REGULAR);
    // Excluded: BANANA (contraindication), DRAFT_FOOD (approval), FOOD_INVALID_SERVING (portion)
    // Eligible: SAFE_BROWN_RICE, BREAD_GLUTEN, FIRM_GRILLED_CHICKEN = 3
    assert.strictEqual(result.eligible.length, 3);
    assert.strictEqual(result.counts.contraindication, 1);
  });

  it('batch: exclusion gate counts are accurate', () => {
    const result = applyEligibilityFilters(MIXED_FOODS, CTX_RENAL_REGULAR);
    assert.strictEqual(result.counts.contraindication,    1, 'one contraindication');
    assert.strictEqual(result.counts.approval_status,     1, 'one approval failure');
    assert.strictEqual(result.counts.portion_feasibility, 1, 'one portion failure');
    assert.strictEqual(result.counts.texture_compatibility, 0);
    assert.strictEqual(result.counts.allergen,              0);
    assert.strictEqual(result.counts.meal_type,             0);
  });

  it('empty food list returns empty eligible and excluded with zero counts', () => {
    const result = applyEligibilityFilters([], CTX_GENERAL_REGULAR);
    assert.strictEqual(result.eligible.length,   0);
    assert.strictEqual(result.excluded.length,   0);
    assert.strictEqual(result.totalEvaluated,    0);
    for (const count of Object.values(result.counts)) {
      assert.strictEqual(count, 0);
    }
  });
});
