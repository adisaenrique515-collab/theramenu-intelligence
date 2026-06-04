export interface OfflineEngineModule {
  name: string;
  status: 'active' | 'pending';
  description: string;
}

export interface OfflineEngineDataSource {
  id: string;
  description: string;
  fields: string[];
  role: string;
}

export interface OfflineCarePath {
  code: 'STANDARD_DIET' | 'HOSPITAL_DIET';
  label: string;
  indication: string;
  energyKcalPerKg: number;
  proteinGPerKgMin: number;
  proteinGPerKgMax: number;
}

export interface OfflineNormalizationRow {
  meal: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface OfflineClinicalOverview {
  networkStatus: 'offline';
  engineMode: 'internal-api';
  modules: OfflineEngineModule[];
  dataSources: OfflineEngineDataSource[];
  diagnosisRoutes: string[];
  carePaths: OfflineCarePath[];
  normalizationExample: {
    rawInputs: string[];
    normalizedRows: OfflineNormalizationRow[];
  };
  queryGuardrails: Array<{
    label: string;
    expression: string;
  }>;
  phosphorusGuide?: {
    dailyAllowanceMg: {
      min: number;
      max: number;
    };
    ingredientLabelWarnings: string[];
    highPhosphorusFoodGroups: string[];
    lowerPhosphorusFoodGroups: string[];
    careNotes: string[];
  };
}
