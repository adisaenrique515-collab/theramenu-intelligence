import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrandedFoodSeed, ResourceFood, ResourceFoodInsight, ResourcePackSummary } from '../resourcePack.types.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')) as T;
}

const resourceFoods = readJson<ResourceFood[]>('resources/ausnut/foods-core.json');
const measuresByKey = readJson<Record<string, unknown[]>>('resources/ausnut/food-measures-by-key.json');
const recipesByKey = readJson<Record<string, unknown>>('resources/ausnut/food-recipes-by-key.json');
const nutrientsMeta = readJson<Array<{ nutrientName?: string; nutrientId?: number; unit?: string }>>('resources/ausnut/nutrients-meta.json');
const kdigoSeed = readJson<ResourcePackSummary['kdigoSeed']>('resources/clinical/kdigo-ckd-rule-seed.json');
const espenSeed = readJson<ResourcePackSummary['espenSeed']>('resources/clinical/espen-hospital-rule-seed.json');
const phosphorusSeed = readJson<ResourcePackSummary['phosphorusSeed']>('resources/clinical/phosphorus-guide-seed.json');
const brandedSeed = readJson<BrandedFoodSeed>('resources/usda-branded/bfpd-clinical-seed.json');

const takeTopFoodInsights = (
  predicate: (food: ResourceFood) => boolean,
  score: (food: ResourceFood) => number,
): ResourceFoodInsight[] =>
  resourceFoods
    .filter(predicate)
    .sort((left, right) => score(right) - score(left))
    .slice(0, 5)
    .map((food) => ({
      key: food.publicFoodKey,
      name: food.name,
      proteinG: food.proteinG ?? 0,
      fibreG: food.fibreG ?? 0,
      sodiumMg: food.sodiumMg ?? 0,
      potassiumMg: food.potassiumMg ?? 0,
      phosphorusMg: food.phosphorusMg ?? 0,
      group: food.foodGroupName ?? food.adgClass1 ?? 'Unclassified',
    }));

let cachedSummary: ResourcePackSummary | null = null;

export function getResourcePackSummary(): ResourcePackSummary {
  if (cachedSummary) {
    return cachedSummary;
  }

  const topFoodGroups = Object.entries(
    resourceFoods.reduce<Record<string, number>>((accumulator, food) => {
      const key = food.foodGroupName ?? food.adgClass1 ?? 'Unclassified';
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  cachedSummary = {
    foodsCount: resourceFoods.length,
    foodsWithMeasures: Object.keys(measuresByKey).length,
    foodsWithRecipes: Object.keys(recipesByKey).length,
    nutrientDefinitions: nutrientsMeta.length,
    topFoodGroups,
    nutrientDenseFoods: takeTopFoodInsights(
      (food) => (food.proteinG ?? 0) >= 8 || (food.fibreG ?? 0) >= 4,
      (food) =>
        (food.proteinG ?? 0) * 4 +
        (food.fibreG ?? 0) * 3 +
        (food.ironMg ?? 0) * 2 +
        (food.calciumMg ?? 0) / 25 -
        (food.sodiumMg ?? 0) / 120,
    ),
    renalAwareFoods: takeTopFoodInsights(
      (food) =>
        (food.sodiumMg ?? Number.POSITIVE_INFINITY) <= 140 &&
        (food.potassiumMg ?? Number.POSITIVE_INFINITY) <= 220 &&
        (food.phosphorusMg ?? Number.POSITIVE_INFINITY) <= 140,
      (food) => (food.proteinG ?? 0) * 4 + (food.fibreG ?? 0) * 2 - (food.potassiumMg ?? 0) / 50,
    ),
    lowSodiumFoods: takeTopFoodInsights(
      (food) => (food.sodiumMg ?? Number.POSITIVE_INFINITY) <= 120,
      (food) => (food.proteinG ?? 0) * 3 + (food.fibreG ?? 0) * 2 - (food.saturatedFatG ?? 0) * 3,
    ),
    nutrientsMeta,
    kdigoSeed,
    espenSeed,
    phosphorusSeed,
    brandedSeed,
  };

  return cachedSummary;
}
