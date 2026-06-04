import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type FoodSeed = {
  id: string;
  description: string;
  refusePct: number;
  gramWeight: number;
  nutrients: Record<string, number>;
};

const foods: FoodSeed[] = [
  { id: '1001', description: 'Oatmeal cooked', refusePct: 0, gramWeight: 180, nutrients: { '208': 68, '203': 2.4, '204': 1.4, '205': 12, '291': 1.7, '269': 0.4, '307': 49, '306': 61, '305': 77, '601': 0, '606': 0.2 } },
  { id: '1002', description: 'Egg whole cooked', refusePct: 0, gramWeight: 50, nutrients: { '208': 155, '203': 13, '204': 11, '205': 1.1, '291': 0, '269': 1.1, '307': 124, '306': 126, '305': 198, '601': 373, '606': 3.3 } },
  { id: '1003', description: 'Apple raw', refusePct: 0, gramWeight: 140, nutrients: { '208': 52, '203': 0.3, '204': 0.2, '205': 14, '291': 2.4, '269': 10.4, '307': 1, '306': 107, '305': 11, '601': 0, '606': 0 } },
  { id: '1004', description: 'Yogurt plain low fat', refusePct: 0, gramWeight: 150, nutrients: { '208': 63, '203': 5.3, '204': 1.6, '205': 7, '291': 0, '269': 7, '307': 70, '306': 234, '305': 135, '601': 6, '606': 1.1 } },
  { id: '1005', description: 'Chicken breast roasted', refusePct: 0, gramWeight: 120, nutrients: { '208': 165, '203': 31, '204': 3.6, '205': 0, '291': 0, '269': 0, '307': 74, '306': 256, '305': 220, '601': 85, '606': 1 } },
  { id: '1006', description: 'Rice cooked', refusePct: 0, gramWeight: 160, nutrients: { '208': 130, '203': 2.7, '204': 0.3, '205': 28, '291': 0.4, '269': 0.1, '307': 1, '306': 35, '305': 43, '601': 0, '606': 0.1 } },
  { id: '1007', description: 'Carrot cooked', refusePct: 0, gramWeight: 90, nutrients: { '208': 35, '203': 0.8, '204': 0.2, '205': 8.2, '291': 3, '269': 3.5, '307': 58, '306': 235, '305': 30, '601': 0, '606': 0 } },
  { id: '1008', description: 'Broccoli cooked', refusePct: 0, gramWeight: 90, nutrients: { '208': 35, '203': 2.4, '204': 0.4, '205': 7.2, '291': 3.3, '269': 1.7, '307': 41, '306': 293, '305': 66, '601': 0, '606': 0.1 } },
  { id: '1009', description: 'Tofu firm', refusePct: 0, gramWeight: 100, nutrients: { '208': 76, '203': 8, '204': 4.8, '205': 1.9, '291': 0.3, '269': 0.6, '307': 7, '306': 121, '305': 97, '601': 0, '606': 0.7 } },
  { id: '1010', description: 'Pear raw', refusePct: 0, gramWeight: 140, nutrients: { '208': 57, '203': 0.4, '204': 0.1, '205': 15, '291': 3.1, '269': 9.8, '307': 1, '306': 116, '305': 12, '601': 0, '606': 0 } },
  { id: '1011', description: 'Milk low fat', refusePct: 0, gramWeight: 244, nutrients: { '208': 42, '203': 3.4, '204': 1, '205': 5, '291': 0, '269': 5, '307': 44, '306': 150, '305': 95, '601': 5, '606': 0.6 } },
  { id: '1012', description: 'Pasta cooked', refusePct: 0, gramWeight: 140, nutrients: { '208': 131, '203': 5, '204': 1.1, '205': 25, '291': 1.5, '269': 0.6, '307': 1, '306': 44, '305': 58, '601': 0, '606': 0.2 } },
  { id: '1013', description: 'Green beans cooked', refusePct: 0, gramWeight: 90, nutrients: { '208': 35, '203': 1.9, '204': 0.2, '205': 7.9, '291': 3.2, '269': 3.3, '307': 1, '306': 146, '305': 38, '601': 0, '606': 0 } },
  { id: '1014', description: 'Fish baked', refusePct: 0, gramWeight: 120, nutrients: { '208': 128, '203': 26, '204': 2.7, '205': 0, '291': 0, '269': 0, '307': 60, '306': 230, '305': 210, '601': 58, '606': 0.7 } },
  { id: '1015', description: 'Bread whole wheat', refusePct: 0, gramWeight: 30, nutrients: { '208': 247, '203': 13, '204': 4.2, '205': 41, '291': 7, '269': 5.7, '307': 430, '306': 230, '305': 180, '601': 0, '606': 0.8 } },
];

function wrap(value: string | number) {
  return `~${value}~`;
}

function makeFoodLine(food: FoodSeed) {
  return [wrap(food.id), wrap(''), wrap(food.description), wrap(''), wrap(''), wrap(''), wrap(''), wrap(''), wrap(food.refusePct)].join('^');
}

function makeWeightLine(food: FoodSeed) {
  return [wrap(food.id), wrap('1'), wrap(''), wrap('1 serving'), wrap(food.gramWeight)].join('^');
}

function makeNutrientLines(food: FoodSeed) {
  return Object.entries(food.nutrients).map(([nutrientNo, value]) => [wrap(food.id), wrap(nutrientNo), wrap(value)].join('^'));
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'theramenu-offline-smoke-'));
process.env.THERAMENU_USDA_FLATFILE_DIR = tempDir;

fs.writeFileSync(path.join(tempDir, 'FOOD_DES.txt'), `${foods.map(makeFoodLine).join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(tempDir, 'WEIGHT.txt'), `${foods.map(makeWeightLine).join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(tempDir, 'NUT_DATA.txt'), `${foods.flatMap(makeNutrientLines).join('\n')}\n`, 'utf8');

const { getLocalNutritionDbStatus } = await import('../server/localNutritionDb.ts');
const { generateLocalTherapeuticPlan } = await import('../server/localClinicalEngineApi.ts');

const status = getLocalNutritionDbStatus();
assert.equal(status.databaseReady, true);
assert.ok(status.rowCounts.foodDescription >= foods.length);

const plan = generateLocalTherapeuticPlan({
  diagnosis: 'DIABETIC',
  patientDetails: 'Overwhelmed by late shift meals.',
  patientData: {
    age: 57,
    sex: 'female',
    weightKg: 70,
    heightCm: 165,
    riskLevel: 'high',
    mealCount: 6,
    textureLevel: 'regular',
    diabetesType: 'type2',
    fastingHours: 16,
    usesCgm: true,
    selfMonitoring: true,
    sglt2Inhibitor: true,
    metformin: true,
    alcoholUse: false,
    egfrBand: 'gte45',
  },
});

assert.equal(plan.localEngine?.networkDependency, 'NONE');
assert.equal(plan.localEngine?.phiProcessing, 'LOCAL_ONLY');
assert.equal(plan.days.length, 7);
assert.ok(plan.days[0]?.meals[0]?.scheduledTime);
assert.ok(plan.days[0]?.totals.caloriesKcal > 0);
assert.ok(plan.notes.some((note) => note.includes('SQLite-backed')));
assert.ok(
  plan.days.some((day) =>
    day.meals.some((meal) => meal.slots?.some((slot) => (slot.alternatives?.length || 0) > 0)),
  ),
);

console.log('offline smoke test passed');
