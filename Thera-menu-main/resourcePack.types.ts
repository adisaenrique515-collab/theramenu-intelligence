export interface ResourceFood {
  surveyId: number;
  publicFoodKey: string;
  name: string;
  foodGroupName: string | null;
  adgClass1: string | null;
  adgClass2: string | null;
  energyKj: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fibreG: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  phosphorusMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  saturatedFatG: number | null;
  cholesterolMg: number | null;
}

export interface ClinicalRuleSeed {
  sourceDocument: string;
  sourceFramework: string;
  resourceType: string;
  diagnosisCode?: string;
  rules: Record<string, any>;
  appUse?: {
    useFor?: string[];
    notDirectlyEncoded?: string[];
  };
}

export interface BrandedFoodSeed {
  sourceDocument: string;
  sourceFramework: string;
  resourceType: string;
  generatedAt: string;
  dataset: {
    products: number;
    nutrientRows: number;
    servingRows: number;
    productsWithServingAndTrackedNutrients: number;
    productsWithPhosphateAdditives: number;
  };
  ingredientLabelWarnings: string[];
  topManufacturers: Array<{ name: string; count: number }>;
  renalSaferBrandedFoods: Array<{
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
  }>;
  diabetesSaferBrandedFoods: Array<{
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
  }>;
  phosphateAdditiveExamples: Array<{
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
  }>;
  appUse?: {
    useFor?: string[];
    notDirectlyEncoded?: string[];
  };
}

export interface ResourceFoodInsight {
  key: string;
  name: string;
  proteinG: number;
  fibreG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  group: string;
}

export interface ResourcePackSummary {
  foodsCount: number;
  foodsWithMeasures: number;
  foodsWithRecipes: number;
  nutrientDefinitions: number;
  topFoodGroups: Array<{ name: string; count: number }>;
  nutrientDenseFoods: ResourceFoodInsight[];
  renalAwareFoods: ResourceFoodInsight[];
  lowSodiumFoods: ResourceFoodInsight[];
  nutrientsMeta: Array<{ nutrientName?: string; nutrientId?: number; unit?: string }>;
  kdigoSeed: ClinicalRuleSeed;
  espenSeed: ClinicalRuleSeed;
  phosphorusSeed: ClinicalRuleSeed;
  brandedSeed: BrandedFoodSeed;
}
