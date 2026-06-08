import type { ResourcePackSummary } from '../resourcePack.types';
import { shouldUseLocalInternalApi } from '../utils/appMode';

const EMPTY_SEED = { sourceDocument: '', sourceFramework: '', resourceType: '', rules: {} };

let cachedSummaryPromise: Promise<ResourcePackSummary> | null = null;

export async function loadResourcePackSummary(): Promise<ResourcePackSummary> {
  if (!shouldUseLocalInternalApi) {
    return {
      foodsCount: 0,
      foodsWithMeasures: 0,
      foodsWithRecipes: 0,
      nutrientDefinitions: 0,
      topFoodGroups: [],
      nutrientDenseFoods: [],
      renalAwareFoods: [],
      lowSodiumFoods: [],
      nutrientsMeta: [],
      kdigoSeed: EMPTY_SEED,
      espenSeed: EMPTY_SEED,
      phosphorusSeed: EMPTY_SEED,
      brandedSeed: {
        sourceDocument: '', sourceFramework: '', resourceType: '', generatedAt: '',
        dataset: {
          products: 0, nutrientRows: 0, servingRows: 0,
          productsWithServingAndTrackedNutrients: 0, productsWithPhosphateAdditives: 0,
        },
        ingredientLabelWarnings: [],
        topManufacturers: [],
        renalSaferBrandedFoods: [],
        diabetesSaferBrandedFoods: [],
        phosphateAdditiveExamples: [],
      },
    };
  }

  if (!cachedSummaryPromise) {
    cachedSummaryPromise = fetch('/api/internal/resource-pack/summary').then(async (response) => {
      if (!response.ok) {
        throw new Error(`Internal API request failed with status ${response.status}.`);
      }

      return (await response.json()) as ResourcePackSummary;
    });
  }

  return cachedSummaryPromise;
}
