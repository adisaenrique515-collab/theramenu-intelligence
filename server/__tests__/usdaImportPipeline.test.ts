/**
 * server/__tests__/usdaImportPipeline.test.ts
 *
 * Tests for Phase 8: USDA FDC import pipeline.
 *
 * All tests use mock HTTP responses — no real USDA API calls are made.
 * The API key env var is injected / removed per test to verify security rules.
 *
 * Run with:
 *   node --experimental-strip-types --test server/__tests__/usdaImportPipeline.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  importUsdaFood,
  normaliseNutrients,
  inferCategory,
  inferPreparationState,
  resolveApiKey,
  FDC_NUTRIENT_IDS,
  type FetchFn,
  type FdcFoodResponse,
} from '../import-usda-food.ts';

import {
  validateFoodRecord,
  validateFoodRecords,
} from '../validate-food-records.ts';

import {
  exportToClinicalReviewCsv,
  parseClinicalReviewCsv,
} from '../export-clinical-review-csv.ts';

import { EMPTY_NUTRIENTS } from '../nutrientUtils.ts';
import type { FoodItem } from '../../types-clinical.ts';

// ── Test API-key plumbing ─────────────────────────────────────────────────

const TEST_KEY = 'TEST_KEY_PHASE8';

/** Temporarily set the API key env var. */
function setApiKey(key: string) {
  process.env['VITE_USDA_FDC_API_KEY'] = key;
}

/** Remove the API key env var. */
function clearApiKey() {
  delete process.env['VITE_USDA_FDC_API_KEY'];
  delete process.env['USDA_FDC_API_KEY'];
}

// ── Mock FDC payload builders ─────────────────────────────────────────────

/** Build a minimal valid FDC `/food/{id}` response. */
function makeFdcPayload(overrides: Partial<FdcFoodResponse> = {}): FdcFoodResponse {
  return {
    fdcId: 173945,
    description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    dataType: 'SR Legacy',
    foodCategory: { description: 'Poultry Products', code: '0500' },
    foodNutrients: [
      { nutrient: { id: FDC_NUTRIENT_IDS.caloriesKcal }, amount: 165 },
      { nutrient: { id: FDC_NUTRIENT_IDS.proteinG },      amount: 31.0 },
      { nutrient: { id: FDC_NUTRIENT_IDS.carbsG },        amount: 0.0 },
      { nutrient: { id: FDC_NUTRIENT_IDS.fatG },          amount: 3.6 },
      { nutrient: { id: FDC_NUTRIENT_IDS.fiberG },        amount: 0.0 },
      { nutrient: { id: FDC_NUTRIENT_IDS.sodiumMg },      amount: 74 },
      { nutrient: { id: FDC_NUTRIENT_IDS.potassiumMg },   amount: 256 },
      { nutrient: { id: FDC_NUTRIENT_IDS.phosphorusMg },  amount: 220 },
      { nutrient: { id: FDC_NUTRIENT_IDS.cholesterolMg }, amount: 85 },
      { nutrient: { id: FDC_NUTRIENT_IDS.saturatedFatG }, amount: 1.0 },
      { nutrient: { id: FDC_NUTRIENT_IDS.sugarG },        amount: 0.0 },
    ],
    ...overrides,
  };
}

/** Mock fetch that always returns a successful FDC response. */
function mockFetch(payload: FdcFoodResponse, status = 200): FetchFn {
  return async (_url: string) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as Response;
  };
}

/** Mock fetch that throws a network error. */
function networkErrorFetch(): FetchFn {
  return async (_url: string) => {
    throw new Error('ECONNREFUSED');
  };
}

/** Mock fetch that returns non-JSON. */
function badJsonFetch(status = 200): FetchFn {
  return async (_url: string) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new SyntaxError('Unexpected token'); },
  } as Response);
}

// ── Minimal FoodItem fixture ──────────────────────────────────────────────

function makeValidPendingFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id:               'usda_173945',
    canonicalName:    'Test Food',
    category:         'protein',
    mealTypes:        ['Breakfast', 'Lunch', 'Dinner'],
    preparationState: 'cooked',
    nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: 165, proteinG: 31, fatG: 3.6 },
    missingNutrients: ['fluidMl'],
    textureLevels:    ['regular'],
    allergens:        [],
    contraindicatedFor: [],
    allowedFor:       [],
    servingRules:     { minGrams: 60, maxGrams: 200, defaultGrams: 120, unit: 'g' },
    source:           'USDA_FDC',
    confidence:       'unverified',
    approvalStatus:   'pending_review',
    fdcId:            173945,
    tags:             [],
    ...overrides,
  };
}

// ── Suite 1: API key security ─────────────────────────────────────────────

describe('Suite 1 — API key security', () => {
  before(() => clearApiKey());
  after(() => clearApiKey());

  it('resolveApiKey throws when no env var is set', () => {
    assert.throws(
      () => resolveApiKey(),
      /API key is not configured/,
    );
  });

  it('importUsdaFood throws synchronously when API key is missing', async () => {
    clearApiKey();
    await assert.rejects(
      () => importUsdaFood(173945, mockFetch(makeFdcPayload())),
      /API key is not configured/,
    );
  });

  it('resolveApiKey returns the key when VITE_USDA_FDC_API_KEY is set', () => {
    setApiKey(TEST_KEY);
    assert.strictEqual(resolveApiKey(), TEST_KEY);
  });

  it('resolveApiKey reads USDA_FDC_API_KEY as fallback', () => {
    clearApiKey();
    process.env['USDA_FDC_API_KEY'] = 'FALLBACK_KEY';
    assert.strictEqual(resolveApiKey(), 'FALLBACK_KEY');
    delete process.env['USDA_FDC_API_KEY'];
  });

  it('API key does not appear in the returned FoodItem or rawProviderPayload', async () => {
    setApiKey(TEST_KEY);
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    // Stringify and check the key is absent
    const serialised = JSON.stringify(result.food);
    assert.ok(!serialised.includes(TEST_KEY), 'API key must not appear in FoodItem JSON');
  });
});

// ── Suite 2: Successful import ────────────────────────────────────────────

describe('Suite 2 — Successful import', () => {
  before(() => setApiKey(TEST_KEY));
  after(() => clearApiKey());

  it('returns ok: true for a valid FDC response', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.strictEqual(result.ok, true);
  });

  it('returned food has approvalStatus: pending_review (never approved)', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.strictEqual(result.food.approvalStatus, 'pending_review');
  });

  it('returned food has source: USDA_FDC', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.strictEqual(result.food.source, 'USDA_FDC');
  });

  it('returned food has confidence: unverified', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.strictEqual(result.food.confidence, 'unverified');
  });

  it('returned food id encodes the FDC ID', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.ok(result.food.id.includes('173945'), `expected id to contain fdcId; got "${result.food.id}"`);
  });

  it('returned food canonicalName matches FDC description', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.strictEqual(result.food.canonicalName, makeFdcPayload().description);
  });

  it('rawProviderPayload is preserved in the FoodItem', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.ok(result.food.rawProviderPayload !== undefined, 'rawProviderPayload must be present');
    assert.strictEqual((result.food.rawProviderPayload as { fdcId?: number }).fdcId, 173945);
  });

  it('fdcId field is set on the FoodItem', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.strictEqual(result.food.fdcId, 173945);
  });

  it('importedAt is an ISO 8601 timestamp', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    const ts = new Date(result.importedAt).getTime();
    assert.ok(!isNaN(ts), `importedAt must be a valid date; got "${result.importedAt}"`);
  });
});

// ── Suite 3: Nutrient normalisation ──────────────────────────────────────

describe('Suite 3 — Nutrient normalisation', () => {
  before(() => setApiKey(TEST_KEY));
  after(() => clearApiKey());

  it('all 11 FDC-mapped nutrients are extracted correctly', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    const n = result.food.nutrientsPer100g;
    assert.strictEqual(n.caloriesKcal,  165);
    assert.strictEqual(n.proteinG,       31.0);
    assert.strictEqual(n.carbsG,          0.0);
    assert.strictEqual(n.fatG,            3.6);
    assert.strictEqual(n.sodiumMg,       74);
    assert.strictEqual(n.potassiumMg,   256);
    assert.strictEqual(n.phosphorusMg,  220);
    assert.strictEqual(n.cholesterolMg,  85);
    assert.strictEqual(n.saturatedFatG,   1.0);
    assert.strictEqual(n.sugarG,          0.0);
  });

  it('fluidMl is always 0 and listed as missing', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    assert.strictEqual(result.food.nutrientsPer100g.fluidMl, 0);
    assert.ok(result.food.missingNutrients.includes('fluidMl'));
  });

  it('missing nutrients are flagged when absent from FDC response', () => {
    const { nutrients, missingNutrients } = normaliseNutrients([
      // Only calories and protein — all others absent
      { nutrient: { id: FDC_NUTRIENT_IDS.caloriesKcal }, amount: 100 },
      { nutrient: { id: FDC_NUTRIENT_IDS.proteinG },      amount: 10  },
    ]);
    assert.strictEqual(nutrients.caloriesKcal, 100);
    assert.strictEqual(nutrients.proteinG,      10);
    assert.ok(missingNutrients.includes('carbsG'),       'carbsG must be flagged missing');
    assert.ok(missingNutrients.includes('fatG'),         'fatG must be flagged missing');
    assert.ok(missingNutrients.includes('sodiumMg'),     'sodiumMg must be flagged missing');
    assert.ok(missingNutrients.includes('fluidMl'),      'fluidMl must always be flagged missing');
  });

  it('zero values from FDC are preserved (not treated as missing)', () => {
    const { nutrients, missingNutrients } = normaliseNutrients([
      { nutrient: { id: FDC_NUTRIENT_IDS.carbsG }, amount: 0 },
    ]);
    assert.strictEqual(nutrients.carbsG, 0);
    assert.ok(!missingNutrients.includes('carbsG'), 'zero value must NOT be flagged missing');
  });

  it('handles legacy search-endpoint format ({ nutrientId, value })', () => {
    const { nutrients } = normaliseNutrients([
      { nutrientId: FDC_NUTRIENT_IDS.caloriesKcal, value: 200 },
      { nutrientId: FDC_NUTRIENT_IDS.proteinG,     value: 20  },
    ]);
    assert.strictEqual(nutrients.caloriesKcal, 200);
    assert.strictEqual(nutrients.proteinG,      20);
  });

  it('empty foodNutrients array flags all 12 fields as missing', async () => {
    const payload = makeFdcPayload({ foodNutrients: [] });
    const result = await importUsdaFood(173945, mockFetch(payload));
    assert.ok(result.ok);
    assert.strictEqual(result.food.missingNutrients.length, 12, 'all 12 NutrientVector fields must be flagged');
  });
});

// ── Suite 4: Category and preparation inference ───────────────────────────

describe('Suite 4 — Category and preparation state inference', () => {
  it('Poultry Products → protein', () => {
    assert.strictEqual(
      inferCategory({ foodCategory: { description: 'Poultry Products' } }),
      'protein',
    );
  });

  it('Dairy and Egg Products (cheese) → dairy', () => {
    assert.strictEqual(
      inferCategory({ description: 'Cheese, cheddar', foodCategory: { description: 'Dairy and Egg Products' } }),
      'dairy',
    );
  });

  it('Vegetables and Vegetable Products → vegetable', () => {
    assert.strictEqual(
      inferCategory({ foodCategory: { description: 'Vegetables and Vegetable Products' } }),
      'vegetable',
    );
  });

  it('Cereal Grains and Pasta → grain', () => {
    assert.strictEqual(
      inferCategory({ foodCategory: { description: 'Cereal Grains and Pasta' } }),
      'grain',
    );
  });

  it('Beverages → beverage', () => {
    assert.strictEqual(
      inferCategory({ foodCategory: { description: 'Beverages' } }),
      'beverage',
    );
  });

  it('Legumes and Legume Products → legume', () => {
    assert.strictEqual(
      inferCategory({ foodCategory: { description: 'Legumes and Legume Products' } }),
      'legume',
    );
  });

  it('Soups, Sauces, and Gravies → broth', () => {
    assert.strictEqual(
      inferCategory({ foodCategory: { description: 'Soups, Sauces, and Gravies' } }),
      'broth',
    );
  });

  it('description "cooked, roasted" → cooked', () => {
    assert.strictEqual(inferPreparationState('Chicken breast, cooked, roasted'), 'cooked');
  });

  it('description with "raw" → raw', () => {
    assert.strictEqual(inferPreparationState('Beef, ground, raw'), 'raw');
  });

  it('description with "canned" → canned', () => {
    assert.strictEqual(inferPreparationState('Tuna, canned in water'), 'canned');
  });

  it('description with "frozen" → frozen', () => {
    assert.strictEqual(inferPreparationState('Broccoli, frozen'), 'frozen');
  });

  it('description with "dried" → dried', () => {
    assert.strictEqual(inferPreparationState('Apricots, dried, sulphured'), 'dried');
  });

  it('unknown description defaults to cooked (conservative)', () => {
    assert.strictEqual(inferPreparationState('Product XYZ'), 'cooked');
  });
});

// ── Suite 5: Import failure cases ─────────────────────────────────────────

describe('Suite 5 — Import failure cases', () => {
  before(() => setApiKey(TEST_KEY));
  after(() => clearApiKey());

  it('HTTP 404 returns ok: false with httpStatus 404', async () => {
    const result = await importUsdaFood(999999, mockFetch(makeFdcPayload(), 404));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.httpStatus, 404);
    assert.ok(result.error.includes('404'), `error must mention the status code; got: "${result.error}"`);
  });

  it('HTTP 403 (invalid API key) returns ok: false', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload(), 403));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.httpStatus, 403);
  });

  it('network error returns ok: false', async () => {
    const result = await importUsdaFood(173945, networkErrorFetch());
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('Network error'), `error must mention network; got: "${result.error}"`);
  });

  it('invalid JSON response returns ok: false', async () => {
    const result = await importUsdaFood(173945, badJsonFetch());
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.length > 0);
  });

  it('response missing fdcId returns ok: false', async () => {
    const payload = makeFdcPayload({ fdcId: undefined });
    const result = await importUsdaFood(173945, mockFetch(payload));
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('missing required fields'));
  });

  it('response missing description returns ok: false', async () => {
    const payload = makeFdcPayload({ description: undefined });
    const result = await importUsdaFood(173945, mockFetch(payload));
    assert.strictEqual(result.ok, false);
  });

  it('fdcId is echoed back in failure result', async () => {
    const result = await importUsdaFood(999999, mockFetch(makeFdcPayload(), 404));
    assert.strictEqual(result.fdcId, 999999);
  });
});

// ── Suite 6: Food record validation ──────────────────────────────────────

describe('Suite 6 — Food record validation', () => {
  it('valid pending_review food record passes validation', () => {
    const result = validateFoodRecord(makeValidPendingFood());
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('food with approvalStatus approved is an error', () => {
    const food = makeValidPendingFood({ approvalStatus: 'approved' });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('approved')));
  });

  it('food with empty id is an error', () => {
    const food = makeValidPendingFood({ id: '' });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('empty or missing id')));
  });

  it('food with empty canonicalName is an error', () => {
    const food = makeValidPendingFood({ canonicalName: '' });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('empty or missing canonicalName')));
  });

  it('food with negative calories is an error', () => {
    const food = makeValidPendingFood({
      nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: -10 },
    });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('negative')));
  });

  it('food with > 900 kcal/100g is an error', () => {
    const food = makeValidPendingFood({
      nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: 950 },
    });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('900')));
  });

  it('USDA_FDC food missing fdcId is an error', () => {
    const food = makeValidPendingFood({ fdcId: undefined });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('missing fdcId')));
  });

  it('food with empty textureLevels is an error', () => {
    const food = makeValidPendingFood({ textureLevels: [] });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('textureLevels is empty')));
  });

  it('USDA food with empty allergens generates a warning', () => {
    const result = validateFoodRecord(makeValidPendingFood({ allergens: [] }));
    assert.ok(result.warnings.some((w) => w.includes('allergen')));
  });

  it('food with empty contraindicatedFor generates a warning', () => {
    const result = validateFoodRecord(makeValidPendingFood());
    assert.ok(result.warnings.some((w) => w.includes('contraindicatedFor')));
  });

  it('food missing core macronutrients generates warnings', () => {
    const food = makeValidPendingFood({
      nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: 165 },
      missingNutrients: ['proteinG', 'carbsG', 'fatG', 'fluidMl'],
    });
    const result = validateFoodRecord(food);
    assert.ok(result.warnings.some((w) => w.includes('proteinG') || w.includes('carbsG') || w.includes('fatG')));
  });

  it('foodId and canonicalName are echoed in the result', () => {
    const food = makeValidPendingFood({ id: 'usda_173945', canonicalName: 'Test Chicken' });
    const result = validateFoodRecord(food);
    assert.strictEqual(result.foodId, 'usda_173945');
    assert.strictEqual(result.canonicalName, 'Test Chicken');
  });
});

// ── Suite 7: Batch validation ─────────────────────────────────────────────

describe('Suite 7 — Batch validation', () => {
  it('empty batch returns zero totals', () => {
    const summary = validateFoodRecords([]);
    assert.strictEqual(summary.totalRecords, 0);
    assert.strictEqual(summary.validCount, 0);
    assert.strictEqual(summary.invalidCount, 0);
  });

  it('batch counts valid and invalid records correctly', () => {
    const foods: FoodItem[] = [
      makeValidPendingFood({ id: 'a' }),
      makeValidPendingFood({ id: 'b', approvalStatus: 'approved' }),  // invalid
      makeValidPendingFood({ id: 'c' }),
    ];
    const summary = validateFoodRecords(foods);
    assert.strictEqual(summary.totalRecords, 3);
    assert.strictEqual(summary.validCount, 2);
    assert.strictEqual(summary.invalidCount, 1);
  });

  it('results array length matches input length', () => {
    const foods = [makeValidPendingFood({ id: '1' }), makeValidPendingFood({ id: '2' })];
    const summary = validateFoodRecords(foods);
    assert.strictEqual(summary.results.length, 2);
  });
});

// ── Suite 8: CSV export ───────────────────────────────────────────────────

describe('Suite 8 — CSV export', () => {
  const food = makeValidPendingFood({
    id:            'usda_173945',
    canonicalName: 'Chicken Breast, Cooked',
    fdcId:         173945,
    category:      'protein',
    approvalStatus: 'pending_review',
    source:        'USDA_FDC',
    missingNutrients: ['fluidMl'],
    allergens:        [],
    contraindicatedFor: [],
    textureLevels:  ['regular'],
  });

  it('exportToClinicalReviewCsv returns a non-empty string', () => {
    const csv = exportToClinicalReviewCsv([food]);
    assert.ok(typeof csv === 'string' && csv.length > 0);
  });

  it('CSV has a header row as the first line', () => {
    const csv = exportToClinicalReviewCsv([food]);
    const firstLine = csv.split('\r\n')[0]!;
    assert.ok(firstLine.includes('id'), `header must include "id"; got: "${firstLine.slice(0, 80)}"`);
    assert.ok(firstLine.includes('canonicalName'));
    assert.ok(firstLine.includes('approvalStatus'));
  });

  it('CSV with one food has exactly 2 lines (header + data)', () => {
    const csv = exportToClinicalReviewCsv([food]);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    assert.strictEqual(lines.length, 2);
  });

  it('empty food list returns only the header row', () => {
    const csv = exportToClinicalReviewCsv([]);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    assert.strictEqual(lines.length, 1);
  });

  it('CSV data row contains the fdcId', () => {
    const csv = exportToClinicalReviewCsv([food]);
    assert.ok(csv.includes('173945'), 'fdcId must appear in the CSV data');
  });

  it('CSV data row contains the canonicalName', () => {
    const csv = exportToClinicalReviewCsv([food]);
    assert.ok(csv.includes('Chicken Breast'), `CSV must include the food name; got: ${csv.slice(0, 200)}`);
  });

  it('approvalStatus in CSV is never "approved" for pending_review food', () => {
    const csv = exportToClinicalReviewCsv([food]);
    const dataRow = csv.split('\r\n')[1]!;
    assert.ok(dataRow.includes('pending_review'), 'status must be pending_review');
    assert.ok(!dataRow.includes(',approved,'), 'status must not be "approved"');
  });

  it('values containing commas are properly quoted', () => {
    const commaFood = makeValidPendingFood({ canonicalName: 'Rice, Brown, Cooked' });
    const csv = exportToClinicalReviewCsv([commaFood]);
    // The name should be quoted to preserve the commas
    assert.ok(csv.includes('"Rice, Brown, Cooked"'), 'comma-containing names must be quoted in CSV');
  });

  it('values containing double-quotes are escaped', () => {
    const quoteFood = makeValidPendingFood({ canonicalName: 'Chicken "Rotisserie" Breast' });
    const csv = exportToClinicalReviewCsv([quoteFood]);
    // Double-quotes inside a cell are escaped as ""
    assert.ok(csv.includes('""Rotisserie""') || csv.includes('"Chicken ""Rotisserie"" Breast"'),
      'double-quotes in cell values must be escaped');
  });

  it('round-trip: parseClinicalReviewCsv recovers the row values', () => {
    const csv = exportToClinicalReviewCsv([food]);
    const rows = parseClinicalReviewCsv(csv);
    assert.strictEqual(rows.length, 1);
    const row = rows[0]!;
    assert.strictEqual(row['id'],            'usda_173945');
    assert.strictEqual(row['approvalStatus'], 'pending_review');
    assert.strictEqual(row['source'],         'USDA_FDC');
    assert.strictEqual(row['fdcId'],          '173945');
  });

  it('batch export: CSV has header + N data rows', () => {
    const foods = [
      makeValidPendingFood({ id: 'usda_1' }),
      makeValidPendingFood({ id: 'usda_2' }),
      makeValidPendingFood({ id: 'usda_3' }),
    ];
    const csv = exportToClinicalReviewCsv(foods);
    const lines = csv.split('\r\n').filter((l) => l.length > 0);
    assert.strictEqual(lines.length, 4); // 1 header + 3 data rows
  });
});

// ── Suite 9: End-to-end pipeline (import → validate → export) ────────────

describe('Suite 9 — End-to-end pipeline', () => {
  before(() => setApiKey(TEST_KEY));
  after(() => clearApiKey());

  it('import → validate → csv pipeline produces a valid, exportable record', async () => {
    // Step 1: import
    const importResult = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(importResult.ok);
    const food = importResult.food;

    // Step 2: validate
    const validationResult = validateFoodRecord(food);
    assert.ok(validationResult.valid, `validation errors: ${validationResult.errors.join('; ')}`);

    // Step 3: export
    const csv = exportToClinicalReviewCsv([food]);
    const rows = parseClinicalReviewCsv(csv);
    assert.strictEqual(rows.length, 1);

    const row = rows[0]!;
    assert.strictEqual(row['approvalStatus'], 'pending_review');
    assert.strictEqual(row['source'],         'USDA_FDC');
    assert.ok(row['canonicalName']!.length > 0);
  });

  it('import → validate preserves all 11 FDC-mapped nutrients', async () => {
    const result = await importUsdaFood(173945, mockFetch(makeFdcPayload()));
    assert.ok(result.ok);
    const n = result.food.nutrientsPer100g;
    const coreFields: Array<keyof typeof n> = [
      'caloriesKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG',
      'sodiumMg', 'potassiumMg', 'phosphorusMg', 'cholesterolMg',
      'saturatedFatG', 'sugarG',
    ];
    for (const field of coreFields) {
      assert.ok(
        !result.food.missingNutrients.includes(field),
        `${field} must not be marked missing when present in FDC response`,
      );
    }
  });
});
