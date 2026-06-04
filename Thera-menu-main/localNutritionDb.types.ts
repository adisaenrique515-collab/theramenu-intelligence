export interface FlatFilePresence {
  name: string;
  found: boolean;
  path: string | null;
}

export interface LocalNutritionDbStatus {
  databasePath: string;
  databaseReady: boolean;
  dataSource: 'LOCAL_SQLITE';
  phiProcessing: 'LOCAL_ONLY';
  flatFileDirectory: string | null;
  requiredFiles: FlatFilePresence[];
  lastImportAt: string | null;
  rowCounts: {
    foodDescription: number;
    nutrientData: number;
    weightsAndMeasures: number;
  };
  notes: string[];
}

export interface LocalFoodQuery {
  keywords: string[];
  excludeTerms?: string[];
  preferDescriptionTerms?: string[];
  avoidDescriptionTerms?: string[];
  preferredGramWeight?: number;
  limit?: number;
  maxRefusePct?: number;
  minFiberGPer100?: number;
  maxSodiumMgPer100?: number;
  maxPotassiumMgPer100?: number;
  maxPhosphorusMgPer100?: number;
  maxProteinGPer100?: number;
  minProteinGPer100?: number;
  preferLowerSodium?: boolean;
  preferLowerPhosphorus?: boolean;
  preferHigherFiber?: boolean;
}

export interface LocalFoodRecord {
  ndbNo: string;
  description: string;
  refusePct: number;
  measureDescription: string;
  gramWeight: number;
  edibleGramWeight: number;
  caloriesKcalPer100: number;
  carbsGPer100: number;
  proteinGPer100: number;
  fatGPer100: number;
  fiberGPer100: number;
  sodiumMgPer100: number;
  potassiumMgPer100: number;
  phosphorusMgPer100: number;
  cholesterolMgPer100: number;
  saturatedFatGPer100: number;
  sugarGPer100: number;
}
