import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

type NutrientAccumulator = {
  caloriesKcalPer100?: number;
  proteinGPer100?: number;
  fiberGPer100?: number;
  sodiumMgPer100?: number;
  potassiumMgPer100?: number;
  phosphorusMgPer100?: number;
};

type ServingRecord = {
  grams: number;
  uom: string;
  householdAmount: string;
  householdUom: string;
};

type RankedProduct = {
  ndbNo: string;
  name: string;
  manufacturer: string;
  serving: string;
  caloriesKcal: number;
  proteinG: number;
  fiberG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  phosphateAdditives: string[];
};

const ROOT_DIR = path.resolve(path.dirname(sanitizePathname(new URL(import.meta.url).pathname)), '..');
const INPUT_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT_DIR, 'data', 'bfpd-import');
const OUTPUT_DIR = path.join(ROOT_DIR, 'resources', 'usda-branded');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'bfpd-clinical-seed.json');

const PRODUCTS_PATH = path.join(INPUT_DIR, 'Products.csv');
const NUTRIENTS_PATH = path.join(INPUT_DIR, 'Nutrients.csv');
const SERVING_PATH = path.join(INPUT_DIR, 'Serving_size.csv');

const NUTRIENT_CODES: Record<string, keyof NutrientAccumulator> = {
  '208': 'caloriesKcalPer100',
  '203': 'proteinGPer100',
  '291': 'fiberGPer100',
  '307': 'sodiumMgPer100',
  '306': 'potassiumMgPer100',
  '305': 'phosphorusMgPer100',
};

const PHOSPHATE_TERMS = ['phosphate', 'phosphoric', 'pyrophosphate', 'polyphosphate', 'phosphorus'];
const RENAL_AVOID_TERMS = [
  'supplement',
  'dietary supplement',
  'lentil',
  'bean',
  'beans',
  'seed',
  'seeds',
  'chia',
  'flax',
  'tea',
  'ice cream',
  'yogurt',
  'cheese',
  'cocoa',
  'chocolate',
] as const;
const CLINICAL_NOISE_TERMS = ['supplement', 'dietary supplement', 'powder', 'capsule'] as const;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function sanitizePathname(pathname: string): string {
  if (/^\/[A-Za-z]:\//.test(pathname)) {
    return pathname.slice(1);
  }
  return pathname;
}

function pushTopRanked(
  list: Array<RankedProduct & { score: number }>,
  candidate: RankedProduct & { score: number },
  limit: number,
) {
  list.push(candidate);
  list.sort((left, right) => right.score - left.score);
  if (list.length > limit) {
    list.length = limit;
  }
}

async function processCsv(
  filePath: string,
  onRow: (row: string[], rowIndex: number) => void | Promise<void>,
): Promise<number> {
  const stream = fs.createReadStream(filePath, 'utf8');
  const interfaceHandle = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let rowIndex = -1;
  for await (const line of interfaceHandle) {
    if (!line.trim()) {
      continue;
    }
    rowIndex += 1;
    if (rowIndex === 0) {
      continue;
    }
    await onRow(parseCsvLine(line), rowIndex);
  }
  return Math.max(0, rowIndex);
}

async function main() {
  const nutrients = new Map<string, NutrientAccumulator>();
  const servings = new Map<string, ServingRecord>();
  let nutrientRowCount = 0;
  let servingRowCount = 0;

  nutrientRowCount = await processCsv(NUTRIENTS_PATH, (row) => {
    const ndbNo = row[0];
    const nutrientCode = row[1];
    const value = toNumber(row[4]);
    const targetField = NUTRIENT_CODES[nutrientCode];
    if (!ndbNo || !targetField || typeof value !== 'number') {
      return;
    }
    const accumulator = nutrients.get(ndbNo) || {};
    accumulator[targetField] = value;
    nutrients.set(ndbNo, accumulator);
  });

  servingRowCount = await processCsv(SERVING_PATH, (row) => {
    const ndbNo = row[0];
    const grams = toNumber(row[1]);
    const uom = row[2] || '';
    if (!ndbNo || typeof grams !== 'number' || grams <= 0 || uom.toLowerCase() !== 'g') {
      return;
    }
    servings.set(ndbNo, {
      grams,
      uom,
      householdAmount: row[3] || '',
      householdUom: row[4] || '',
    });
  });

  const manufacturerCounts = new Map<string, number>();
  const renalCandidates: Array<RankedProduct & { score: number }> = [];
  const diabetesCandidates: Array<RankedProduct & { score: number }> = [];
  const phosphateExamples: Array<RankedProduct & { score: number }> = [];
  let productRowCount = 0;
  let productsWithMatchedServing = 0;
  let productsWithTrackedNutrients = 0;
  let productsWithPhosphateAdditives = 0;

  productRowCount = await processCsv(PRODUCTS_PATH, (row) => {
    const ndbNo = row[0];
    const name = row[1] || '';
    const manufacturer = row[4] || 'Unknown manufacturer';
    const ingredients = (row[7] || '').toLowerCase();
    const productText = `${name} ${ingredients}`.toLowerCase();
    const serving = ndbNo ? servings.get(ndbNo) : undefined;
    const nutrient = ndbNo ? nutrients.get(ndbNo) : undefined;

    if (!ndbNo || !serving || !nutrient) {
      return;
    }

    productsWithMatchedServing += 1;
    productsWithTrackedNutrients += 1;
    manufacturerCounts.set(manufacturer, (manufacturerCounts.get(manufacturer) || 0) + 1);

    const servingFactor = serving.grams / 100;
    const phosphateAdditives = PHOSPHATE_TERMS.filter((term) => ingredients.includes(term));
    const phosphorusTracked = typeof nutrient.phosphorusMgPer100 === 'number';
    const sodiumTracked = typeof nutrient.sodiumMgPer100 === 'number';
    const fiberTracked = typeof nutrient.fiberGPer100 === 'number';
    const hasRenalAvoidTerm = RENAL_AVOID_TERMS.some((term) => productText.includes(term));
    const hasClinicalNoiseTerm = CLINICAL_NOISE_TERMS.some((term) => productText.includes(term));
    if (phosphateAdditives.length > 0) {
      productsWithPhosphateAdditives += 1;
    }

    const record: RankedProduct = {
      ndbNo,
      name,
      manufacturer,
      serving: serving.householdAmount && serving.householdUom
        ? `${round(serving.grams)}g (${serving.householdAmount} ${serving.householdUom})`
        : `${round(serving.grams)}g`,
      caloriesKcal: round((nutrient.caloriesKcalPer100 || 0) * servingFactor),
      proteinG: round((nutrient.proteinGPer100 || 0) * servingFactor),
      fiberG: round((nutrient.fiberGPer100 || 0) * servingFactor),
      sodiumMg: round((nutrient.sodiumMgPer100 || 0) * servingFactor),
      potassiumMg: round((nutrient.potassiumMgPer100 || 0) * servingFactor),
      phosphorusMg: round((nutrient.phosphorusMgPer100 || 0) * servingFactor),
      phosphateAdditives,
    };

    const renalScore =
      Math.max(0, 140 - record.sodiumMg) +
      Math.max(0, 100 - record.phosphorusMg) * 1.5 +
      Math.max(0, 200 - record.potassiumMg) * 0.35 +
      record.fiberG * 8 +
      record.proteinG * 2 -
      phosphateAdditives.length * 90;

    if (
      phosphorusTracked &&
      sodiumTracked &&
      phosphateAdditives.length === 0 &&
      !hasRenalAvoidTerm &&
      !hasClinicalNoiseTerm &&
      record.caloriesKcal >= 20 &&
      record.caloriesKcal <= 320 &&
      record.fiberG <= 12 &&
      record.proteinG <= 18 &&
      record.phosphorusMg >= 5 &&
      record.phosphorusMg <= 100 &&
      record.sodiumMg <= 140 &&
      record.potassiumMg <= 220
    ) {
      pushTopRanked(renalCandidates, { ...record, score: renalScore }, 12);
    }

    const diabetesScore =
      Math.max(0, 230 - record.sodiumMg) +
      record.fiberG * 24 +
      Math.max(0, 260 - record.caloriesKcal) * 0.2 +
      record.proteinG * 4 -
      phosphateAdditives.length * 40;

    if (
      fiberTracked &&
      sodiumTracked &&
      !hasClinicalNoiseTerm &&
      record.caloriesKcal >= 40 &&
      record.fiberG >= 3 &&
      record.fiberG <= 12 &&
      record.sodiumMg <= 230 &&
      record.caloriesKcal <= 260
    ) {
      pushTopRanked(diabetesCandidates, { ...record, score: diabetesScore }, 12);
    }

    if (phosphateAdditives.length > 0 || (phosphorusTracked && record.phosphorusMg >= 200)) {
      const cautionScore = record.phosphorusMg + record.sodiumMg * 0.1 + phosphateAdditives.length * 60;
      pushTopRanked(phosphateExamples, { ...record, score: cautionScore }, 12);
    }
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const output = {
    sourceDocument: 'BFPD_csv_07132018.zip',
    sourceFramework: 'USDA Branded Food Products Database (July 13, 2018 CSV release)',
    resourceType: 'branded_foods_seed',
    generatedAt: new Date().toISOString(),
    dataset: {
      products: productRowCount,
      nutrientRows: nutrientRowCount,
      servingRows: servingRowCount,
      productsWithServingAndTrackedNutrients: productsWithTrackedNutrients,
      productsWithPhosphateAdditives,
    },
    ingredientLabelWarnings: PHOSPHATE_TERMS,
    topManufacturers: [...manufacturerCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    renalSaferBrandedFoods: renalCandidates.map(({ score: _score, ...record }) => record),
    diabetesSaferBrandedFoods: diabetesCandidates.map(({ score: _score, ...record }) => record),
    phosphateAdditiveExamples: phosphateExamples.map(({ score: _score, ...record }) => record),
    appUse: {
      useFor: [
        'branded ingredient label screening',
        'phosphate additive flagging',
        'renal low-phosphorus branded shortlist examples',
        'diabetes low-sodium higher-fiber branded shortlist examples',
      ],
      notDirectlyEncoded: [
        'meal-planner primary nutrient source replacement',
        'cloud product lookup',
      ],
    },
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`BFPD seed written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
