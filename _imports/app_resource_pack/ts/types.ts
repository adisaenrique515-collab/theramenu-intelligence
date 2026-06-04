export type FoodCore = {
  surveyId: number;
  publicFoodKey: string;
  name: string;
  derivation: string | null;
  description: string | null;
  foodGroupCode: number | null;
  foodGroupName: string | null;
  adgCode1: number | null;
  adgClass1: string | null;
  adgCode2: number | null;
  adgClass2: string | null;
  discretionaryClassification: string | null;
  ediblePortion: number | null;
  adgConversionFactor: number | null;
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
  magnesiumMg: number | null;
  saturatedFatG: number | null;
  cholesterolMg: number | null;
};

export type FoodMeasure = {
  measureId: number;
  quantity: number | null;
  descriptor1: string | null;
  descriptor2: string | null;
  descriptor3: string | null;
  descriptor4: string | null;
  gramAmount: number | null;
  volumeMl: number | null;
};

export type FoodRecipeIngredient = {
  surveyId: number | null;
  publicFoodKey: string | null;
  name: string | null;
  weightG: number | null;
  retentionFactor: number | null;
};

export type KdigoCkdRuleSeed = {
  diagnosisCode: string;
  rules: {
    dietPattern: { summary: string };
    monitoredNutrients: { summary: string; trackedNutrients: string[] };
    proteinIntake: { targetGPerKgPerDay: number; population: string };
    avoidHighProtein: { avoidAboveGPerKgPerDay: number };
    sodiumIntake: { maxSodiumGPerDay: number; maxSodiumMmolPerDay: number; equivalentSaltGPerDay: number };
    notes: string[];
  };
};
