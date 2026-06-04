/**
 * server/__tests__/nutrientUtils.test.ts
 *
 * Run with:
 *   node --experimental-strip-types --test server/__tests__/nutrientUtils.test.ts
 *
 * Uses Node.js built-in test runner (node:test) — no additional packages needed.
 *
 * Required test suites:
 *   1. 150g cooked brown rice
 *   2. 2 eggs (100g whole egg)
 *   3. Complete 12-nutrient daily accumulation
 *   4. Missing nutrient handling
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_NUTRIENTS,
  NUTRIENT_KEYS,
  addNutrients,
  scaleNutrients,
  sumNutrients,
  calculateNutrientsForServing,
  parsePortionGrams,
  sumMealNutrients,
  sumDailyNutrients,
  sumWeeklyNutrients,
  type ServingNutrients,
  type MissingNutrientReport,
} from '../nutrientUtils.ts';

import type { NutrientVector, MealPlan, DayPlan, WeeklyTherapeuticPlan } from '../../types.ts';

// ── Helpers ───────────────────────────────────────────────────────────────

function approx(actual: number, expected: number, tolerance = 0.01): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function assertApprox(
  actual: number,
  expected: number,
  label: string,
  tolerance = 0.01,
): void {
  assert.ok(
    approx(actual, expected, tolerance),
    `${label}: expected ≈${expected}, got ${actual} (tolerance ±${tolerance})`,
  );
}

// A complete NutrientVector for building test fixtures.
function fullNutrients(overrides: Partial<NutrientVector> = {}): NutrientVector {
  return { ...EMPTY_NUTRIENTS, ...overrides };
}

function makeMealPlan(slots: Array<{ name: string; portionG: number; per100g: Partial<NutrientVector> }>): MealPlan {
  return {
    mealType: 'Breakfast',
    dietaryLabel: 'TEST',
    slots: slots.map(({ name, portionG, per100g }) => {
      // Build a FoodNutrientProfile from the per100g partial
      const profile = {
        source: 'LOCAL_SQLITE' as const,
        fdcId: 0,
        description: name,
        fetchedAt: new Date().toISOString(),
        caloriesKcalPer100:  per100g.caloriesKcal  ?? 0,
        proteinGPer100:      per100g.proteinG      ?? 0,
        carbsGPer100:        per100g.carbsG        ?? 0,
        fatGPer100:          per100g.fatG          ?? 0,
        fiberGPer100:        per100g.fiberG        ?? 0,
        sodiumMgPer100:      per100g.sodiumMg      ?? 0,
        potassiumMgPer100:   per100g.potassiumMg   ?? 0,
        phosphorusMgPer100:  per100g.phosphorusMg  ?? 0,
        cholesterolMgPer100: per100g.cholesterolMg ?? 0,
        saturatedFatGPer100: per100g.saturatedFatG ?? 0,
        sugarGPer100:        per100g.sugarG        ?? 0,
      };
      return {
        slotName: name,
        status: 'FILLED' as const,
        item: {
          name,
          portion: `${portionG}g`,
          nutrientProfile: profile,
        },
      };
    }),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────

/**
 * USDA SR28 values for cooked long-grain brown rice (per 100g, cooked weight).
 * Source: USDA FDC FDC ID 169704 — Brown rice, long-grain, cooked
 */
const BROWN_RICE_PER_100G: Partial<NutrientVector> = {
  caloriesKcal: 123,
  proteinG:     2.74,
  carbsG:       25.58,
  fatG:         0.97,
  fiberG:       1.6,
  sodiumMg:     4,
  potassiumMg:  79,
  phosphorusMg: 83,
  // cholesterolMg, saturatedFatG, sugarG, fluidMl intentionally omitted
};

/**
 * USDA SR28 values for whole raw egg (per 100g).
 * Source: USDA FDC FDC ID 748967 — Egg, whole, raw, fresh
 */
const WHOLE_EGG_PER_100G: Partial<NutrientVector> = {
  caloriesKcal:  143,
  proteinG:      12.56,
  carbsG:        0.72,
  fatG:          9.51,
  fiberG:        0,
  sodiumMg:      142,
  potassiumMg:   138,
  phosphorusMg:  198,
  cholesterolMg: 372,
  saturatedFatG: 3.13,
  sugarG:        0.37,
  // fluidMl intentionally omitted
};

// ── Suite 1: 150g cooked brown rice ──────────────────────────────────────

describe('Suite 1 — 150g cooked brown rice', () => {
  it('scales calories correctly (150g)', () => {
    const { nutrients } = calculateNutrientsForServing(BROWN_RICE_PER_100G, 150);
    // 123 * 1.5 = 184.5
    assertApprox(nutrients.caloriesKcal, 184.5, 'caloriesKcal');
  });

  it('scales protein correctly (150g)', () => {
    const { nutrients } = calculateNutrientsForServing(BROWN_RICE_PER_100G, 150);
    assertApprox(nutrients.proteinG, 4.11, 'proteinG', 0.05);
  });

  it('scales carbs correctly (150g)', () => {
    const { nutrients } = calculateNutrientsForServing(BROWN_RICE_PER_100G, 150);
    assertApprox(nutrients.carbsG, 38.37, 'carbsG', 0.1);
  });

  it('scales potassium correctly (150g)', () => {
    const { nutrients } = calculateNutrientsForServing(BROWN_RICE_PER_100G, 150);
    assertApprox(nutrients.potassiumMg, 118.5, 'potassiumMg', 0.5);
  });

  it('reports cholesterolMg, saturatedFatG, sugarG, fluidMl as missing', () => {
    const { missingFields } = calculateNutrientsForServing(BROWN_RICE_PER_100G, 150);
    assert.ok(missingFields.has('cholesterolMg'), 'cholesterolMg must be flagged missing');
    assert.ok(missingFields.has('saturatedFatG'), 'saturatedFatG must be flagged missing');
    assert.ok(missingFields.has('sugarG'),        'sugarG must be flagged missing');
    assert.ok(missingFields.has('fluidMl'),       'fluidMl must be flagged missing');
  });

  it('does not flag known nutrients as missing', () => {
    const { missingFields } = calculateNutrientsForServing(BROWN_RICE_PER_100G, 150);
    assert.ok(!missingFields.has('caloriesKcal'), 'caloriesKcal must NOT be flagged');
    assert.ok(!missingFields.has('proteinG'),     'proteinG must NOT be flagged');
    assert.ok(!missingFields.has('carbsG'),       'carbsG must NOT be flagged');
  });
});

// ── Suite 2: 2 eggs (≈ 100g whole egg) ───────────────────────────────────

describe('Suite 2 — 2 eggs (100g whole egg, cooked weight)', () => {
  it('reports correct calories for 100g egg', () => {
    const { nutrients } = calculateNutrientsForServing(WHOLE_EGG_PER_100G, 100);
    assertApprox(nutrients.caloriesKcal, 143, 'caloriesKcal');
  });

  it('reports correct protein for 100g egg', () => {
    const { nutrients } = calculateNutrientsForServing(WHOLE_EGG_PER_100G, 100);
    assertApprox(nutrients.proteinG, 12.56, 'proteinG', 0.05);
  });

  it('reports correct cholesterol for 100g egg', () => {
    const { nutrients } = calculateNutrientsForServing(WHOLE_EGG_PER_100G, 100);
    assertApprox(nutrients.cholesterolMg, 372, 'cholesterolMg', 0.5);
  });

  it('reports correct saturated fat for 100g egg', () => {
    const { nutrients } = calculateNutrientsForServing(WHOLE_EGG_PER_100G, 100);
    assertApprox(nutrients.saturatedFatG, 3.13, 'saturatedFatG', 0.05);
  });

  it('does not flag any complete-data nutrients as missing', () => {
    const { missingFields } = calculateNutrientsForServing(WHOLE_EGG_PER_100G, 100);
    const shouldBePresent: Array<keyof NutrientVector> = [
      'caloriesKcal', 'proteinG', 'carbsG', 'fatG',
      'sodiumMg', 'potassiumMg', 'phosphorusMg',
      'cholesterolMg', 'saturatedFatG', 'sugarG',
    ];
    for (const key of shouldBePresent) {
      assert.ok(!missingFields.has(key), `${key} must NOT be flagged missing`);
    }
  });

  it('still flags fluidMl as missing (not a per-100g stored field)', () => {
    const { missingFields } = calculateNutrientsForServing(WHOLE_EGG_PER_100G, 100);
    assert.ok(missingFields.has('fluidMl'), 'fluidMl must be flagged missing');
  });
});

// ── Suite 3: complete 12-nutrient daily accumulation ─────────────────────

describe('Suite 3 — complete 12-nutrient daily accumulation', () => {
  /**
   * Synthetic breakfast with known values for all 12 fields.
   * Portion: 200g
   */
  const SYNTHETIC_FOOD_A: NutrientVector = {
    caloriesKcal:  150,
    proteinG:      10,
    carbsG:        20,
    fatG:          5,
    fiberG:        3,
    sodiumMg:      200,
    potassiumMg:   300,
    phosphorusMg:  100,
    cholesterolMg: 50,
    saturatedFatG: 2,
    sugarG:        8,
    fluidMl:       180,
  };

  /**
   * Synthetic lunch, portion 300g.
   */
  const SYNTHETIC_FOOD_B: NutrientVector = {
    caloriesKcal:  200,
    proteinG:      15,
    carbsG:        30,
    fatG:          8,
    fiberG:        5,
    sodiumMg:      400,
    potassiumMg:   500,
    phosphorusMg:  150,
    cholesterolMg: 80,
    saturatedFatG: 3,
    sugarG:        10,
    fluidMl:       250,
  };

  it('sums all 12 nutrients correctly across two meals', () => {
    const servingA = scaleNutrients(SYNTHETIC_FOOD_A, 200 / 100); // 200g
    const servingB = scaleNutrients(SYNTHETIC_FOOD_B, 300 / 100); // 300g

    const { total } = sumNutrients([servingA, servingB]);

    // caloriesKcal: 150*2 + 200*3 = 300 + 600 = 900
    assertApprox(total.caloriesKcal,  900, 'caloriesKcal');
    // proteinG: 10*2 + 15*3 = 20 + 45 = 65
    assertApprox(total.proteinG,       65, 'proteinG');
    // carbsG: 20*2 + 30*3 = 40 + 90 = 130
    assertApprox(total.carbsG,        130, 'carbsG');
    // fatG: 5*2 + 8*3 = 10 + 24 = 34
    assertApprox(total.fatG,           34, 'fatG');
    // fiberG: 3*2 + 5*3 = 6 + 15 = 21
    assertApprox(total.fiberG,         21, 'fiberG');
    // sodiumMg: 200*2 + 400*3 = 400 + 1200 = 1600
    assertApprox(total.sodiumMg,     1600, 'sodiumMg');
    // potassiumMg: 300*2 + 500*3 = 600 + 1500 = 2100
    assertApprox(total.potassiumMg,  2100, 'potassiumMg');
    // phosphorusMg: 100*2 + 150*3 = 200 + 450 = 650
    assertApprox(total.phosphorusMg,  650, 'phosphorusMg');
    // cholesterolMg: 50*2 + 80*3 = 100 + 240 = 340
    assertApprox(total.cholesterolMg, 340, 'cholesterolMg');
    // saturatedFatG: 2*2 + 3*3 = 4 + 9 = 13
    assertApprox(total.saturatedFatG,  13, 'saturatedFatG');
    // sugarG: 8*2 + 10*3 = 16 + 30 = 46
    assertApprox(total.sugarG,         46, 'sugarG');
    // fluidMl: 180*2 + 250*3 = 360 + 750 = 1110
    assertApprox(total.fluidMl,      1110, 'fluidMl');
  });

  it('EMPTY_NUTRIENTS has all 12 fields set to exactly 0', () => {
    assert.strictEqual(NUTRIENT_KEYS.length, 12, 'must have exactly 12 nutrient keys');
    for (const key of NUTRIENT_KEYS) {
      assert.strictEqual(
        EMPTY_NUTRIENTS[key],
        0,
        `EMPTY_NUTRIENTS.${key} must be 0`,
      );
    }
  });

  it('EMPTY_NUTRIENTS is frozen (immutable)', () => {
    assert.ok(Object.isFrozen(EMPTY_NUTRIENTS), 'EMPTY_NUTRIENTS must be frozen');
  });

  it('addNutrients(EMPTY, food) equals scaled food values', () => {
    const result = addNutrients({ ...EMPTY_NUTRIENTS }, SYNTHETIC_FOOD_A);
    for (const key of NUTRIENT_KEYS) {
      assertApprox(result[key], SYNTHETIC_FOOD_A[key], key);
    }
  });

  it('sumMealNutrients accumulates all slots via nutrientProfile', () => {
    const meal = makeMealPlan([
      { name: 'Food A', portionG: 200, per100g: SYNTHETIC_FOOD_A },
      { name: 'Food B', portionG: 300, per100g: SYNTHETIC_FOOD_B },
    ]);
    const { total } = sumMealNutrients(meal);
    assertApprox(total.caloriesKcal, 900, 'sumMealNutrients caloriesKcal');
    assertApprox(total.potassiumMg, 2100, 'sumMealNutrients potassiumMg');
  });

  it('sumDailyNutrients sums two meals in a DayPlan', () => {
    const mealA = makeMealPlan([{ name: 'A', portionG: 100, per100g: SYNTHETIC_FOOD_A }]);
    const mealB = makeMealPlan([{ name: 'B', portionG: 100, per100g: SYNTHETIC_FOOD_B }]);
    const fakeTargets: import('../../types.ts').ClinicalTargets = {
      ...EMPTY_NUTRIENTS, fiberGMin: 25, sodiumMgMax: 2000, fiberG: 25,
    };
    const day: DayPlan = {
      dayName: 'Monday',
      meals: [mealA, mealB],
      dailyTargets: fakeTargets,
      totals: { ...EMPTY_NUTRIENTS },
    };
    const { total } = sumDailyNutrients(day);
    // 150 + 200 = 350
    assertApprox(total.caloriesKcal, 350, 'sumDailyNutrients caloriesKcal');
  });
});

// ── Suite 4: missing nutrient handling ───────────────────────────────────

describe('Suite 4 — missing nutrient handling', () => {
  it('partial nutrient source does not assign zero as a known value', () => {
    const partialFood: Partial<NutrientVector> = {
      caloriesKcal: 100,
      proteinG: 5,
      // everything else missing
    };
    const { nutrients, missingFields } = calculateNutrientsForServing(partialFood, 100);

    // Present fields must be correct
    assertApprox(nutrients.caloriesKcal, 100, 'caloriesKcal');
    assertApprox(nutrients.proteinG, 5, 'proteinG');

    // Missing fields must be in missingFields
    const expectedMissing: Array<keyof NutrientVector> = [
      'carbsG', 'fatG', 'fiberG', 'sodiumMg', 'potassiumMg',
      'phosphorusMg', 'cholesterolMg', 'saturatedFatG', 'sugarG', 'fluidMl',
    ];
    for (const key of expectedMissing) {
      assert.ok(
        missingFields.has(key),
        `${key} must be in missingFields when source has no data`,
      );
    }

    // Missing fields resolve to 0 in the total (no data ≠ zero value)
    assertApprox(nutrients.potassiumMg, 0, 'potassiumMg numeric value is 0');
  });

  it('sumNutrients tracks missing fields across multiple items', () => {
    const itemA: Partial<NutrientVector> = { caloriesKcal: 100, proteinG: 5 };
    const itemB: Partial<NutrientVector> = { caloriesKcal: 200, potassiumMg: 300 };
    const { total, missing } = sumNutrients([itemA, itemB]);

    // Calories from both
    assertApprox(total.caloriesKcal, 300, 'combined calories');
    // proteinG missing in B
    assert.ok(missing.missingFields.has('proteinG'), 'proteinG missing in itemB');
    // potassiumMg missing in A
    assert.ok(missing.missingFields.has('potassiumMg'), 'potassiumMg missing in itemA');
    // Both items had at least one missing field
    assert.strictEqual(missing.itemsWithMissingData, 2, 'both items have missing data');
  });

  it('sumNutrients on empty array returns EMPTY_NUTRIENTS with no missing fields', () => {
    const { total, missing } = sumNutrients([]);
    for (const key of NUTRIENT_KEYS) {
      assert.strictEqual(total[key], 0, `${key} must be 0 for empty input`);
    }
    assert.strictEqual(missing.missingFields.size, 0, 'no missing fields for empty input');
    assert.strictEqual(missing.itemsWithMissingData, 0);
  });

  it('slot with no nutrientProfile is counted as skipped, not zero', () => {
    const meal: MealPlan = {
      mealType: 'Lunch',
      dietaryLabel: 'TEST',
      slots: [
        { slotName: 'protein', status: 'FILLED', item: { name: 'Chicken', portion: '120g' } },
      ],
    };
    const { total, skippedSlots } = sumMealNutrients(meal);
    // Slot has no nutrientProfile, so all nutrients should remain at EMPTY values
    assertApprox(total.caloriesKcal, 0, 'no profile → no calories accumulated');
    assert.strictEqual(skippedSlots, 1, 'one slot skipped (no nutrient profile)');
  });

  it('slot with null item is skipped without error', () => {
    const meal: MealPlan = {
      mealType: 'Dinner',
      dietaryLabel: 'TEST',
      slots: [
        { slotName: 'empty_slot', status: 'EMPTY', item: null },
      ],
    };
    const { total, skippedSlots } = sumMealNutrients(meal);
    assertApprox(total.caloriesKcal, 0, 'null item → no calories');
    assert.strictEqual(skippedSlots, 1, 'null item counted as skipped');
  });

  it('rejects non-positive serving size', () => {
    assert.throws(
      () => calculateNutrientsForServing({ caloriesKcal: 100 }, 0),
      /grams must be > 0/,
    );
    assert.throws(
      () => calculateNutrientsForServing({ caloriesKcal: 100 }, -50),
      /grams must be > 0/,
    );
  });

  it('rejects negative scaleNutrients multiplier', () => {
    assert.throws(
      () => scaleNutrients({ ...EMPTY_NUTRIENTS }, -1),
      /multiplier must be finite/,
    );
  });
});

// ── Suite 5: parsePortionGrams ────────────────────────────────────────────

describe('Suite 5 — parsePortionGrams', () => {
  const cases: Array<[string | undefined, number | null]> = [
    ['150g',    150],
    ['150 g',   150],
    ['200ml',   200],
    ['1.5 cup', 360],
    ['serving', 120],
    [undefined, null],
    ['',        null],
    ['N/A',     null],
  ];

  for (const [input, expected] of cases) {
    it(`parsePortionGrams(${JSON.stringify(input)}) → ${expected}`, () => {
      const result = parsePortionGrams(input);
      assert.strictEqual(result, expected);
    });
  }
});
