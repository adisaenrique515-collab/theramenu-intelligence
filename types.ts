
/**
 * Per-100g nutrient data sourced from the USDA FoodData Central API.
 * All numeric values are per 100 g of food as described by the FDC entry.
 */
export interface UsdaFoodNutrients {
  /** USDA FoodData Central food ID */
  fdcId: number;
  /** FDC canonical food description */
  description: string;
  /** Energy – kcal per 100 g */
  calories?: number;
  /** Protein – g per 100 g */
  protein?: number;
  /** Carbohydrate, by difference – g per 100 g */
  carbs?: number;
  /** Total lipid (fat) – g per 100 g */
  fat?: number;
  /** Dietary fibre – g per 100 g */
  fiber?: number;
  /** Total sugars – g per 100 g */
  sugar?: number;
  /** Sodium – mg per 100 g */
  sodium?: number;
  /** Potassium – mg per 100 g */
  potassium?: number;
  /** Phosphorus – mg per 100 g */
  phosphorus?: number;
  /** Calcium – mg per 100 g */
  calcium?: number;
  /** Iron – mg per 100 g */
  iron?: number;
  /** Vitamin C (ascorbic acid) – mg per 100 g */
  vitaminC?: number;
  /** Vitamin A (RAE) – mcg per 100 g */
  vitaminA?: number;
  /** Saturated fatty acids – g per 100 g */
  saturatedFat?: number;
  /** Cholesterol – mg per 100 g */
  cholesterol?: number;
}

export interface OperationalMetadata {
  hotHoldingTemp?: string;
  coldHoldingTemp?: string;
  transportTemp?: string;
  serviceTemp?: string;
  handlingNotes?: string;
}

export interface ClinicalIntelligence {
  structuralStability: {
    fsdi: number;
    acidBalance: number;
    fragilityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  yieldConversion: {
    rawToTrimPercent: number;
    trimToCookPercent: number;
    portionScalingFactor: number;
  };
  costIntelligence: {
    costPerPortion: number;
    contributionMargin: number;
    foodCostPercent: number;
  };
  menuClassification: 'STAR' | 'PUZZLE' | 'PLOWHORSE' | 'DOG';
  procurementForecast: string;
}

export interface FoodNutrientProfile {
  source: 'USDA_FDC' | 'LOCAL_SQLITE';
  fdcId: number;
  description: string;
  fetchedAt: string;
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

export interface SlotItem {
  name: string;
  foodId?: string;
  portion: string; // Standard portion (e.g., "120g")
  minPortion?: string;
  maxPortion?: string;
  therapeuticOverride?: string; // e.g., "Pureed for Dysphagia"
  operational?: OperationalMetadata;
  intelligence?: ClinicalIntelligence;
  nutrientProfile?: FoodNutrientProfile;
  /** Real per-100 g nutrient data fetched live from the USDA FoodData Central API. */
  usdaNutrients?: UsdaFoodNutrients;
}

export interface MealSlot {
  slotName: string; // e.g., "Base Carbohydrate", "Protein"
  item: SlotItem | null; // The item filling the slot
  status: 'FILLED' | 'EMPTY' | 'SUBSTITUTED';
  substitutionNote?: string;
  alternatives?: SlotItem[];
}

export interface MenuItem {
  description: string;
  servingSize: string;
}

export interface TherapeuticConstraints {
  exclude: string[];
  prioritize: string[];
  textureLevel: string; // IDDSI Standards
  nutrientTargets?: string;
}

export type OperatorType = ">=" | "<=" | "==" | ">" | "<";

export interface FacilityStandard {
  key: string;
  operator: OperatorType;
  value: number;
  unit: string;
  note?: string;
}

export interface HospitalMenusStandards {
  hotHolding: string;
  servingHotFood: string;
  coldHolding: string;
  servingColdFood: string;
  boosting: string;
  vehicle: string;
  standardsList?: FacilityStandard[];
}

export interface MealPlan {
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack AM" | "Snack PM" | "Snack Eve";
  items?: MenuItem[]; // Deprecated in favor of slots
  slots?: MealSlot[]; // New structured format
  dietaryLabel: string; // e.g., "ONCOLOGY - HIGH PROTEIN"
  scheduledTime?: string;
}

export interface NutrientVector {
  caloriesKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  cholesterolMg: number;
  saturatedFatG: number;
  sugarG: number;
  fluidMl: number;
}

export interface ClinicalTargets extends NutrientVector {
  fiberGMin: number;
  proteinGMax?: number;
  sodiumMgMax: number;
  potassiumMgMax?: number;
  phosphorusMgMax?: number;
  cholesterolMgMax?: number;
  saturatedFatGMax?: number;
  sugarGMax?: number;
  fluidMlTarget?: number;
  giPreferredMax?: number;
}

export type NutritionPrescriptionMethod = 'existing_local_formula';
export type NutritionPrescriptionCarePathCode = 'STANDARD_DIET' | 'HOSPITAL_DIET';
export type NutritionPrescriptionRiskLevel = 'low' | 'moderate' | 'high';

export interface NutritionPrescriptionPatientSnapshot {
  diagnosis: string;
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  goal: string;
  mealCount: 3 | 4 | 5 | 6;
  textureLevel: 'regular' | 'soft' | 'minced' | 'pureed' | 'liquid';
  riskLevel: NutritionPrescriptionRiskLevel;
  eGfr?: number;
  acrMgG?: number;
  potassiumMmolL?: number;
  hypertension?: boolean;
  heartFailure?: boolean;
  onDialysis?: boolean;
  malnourished?: boolean;
  egfrBand?: 'gte45' | '30to45' | 'lt30';
}

export interface NutritionPrescriptionCarePath {
  code: NutritionPrescriptionCarePathCode;
  label: 'Standard Diet' | 'Hospital Diet';
  energyKcalPerKg: number;
  proteinMinGPerKg: number;
  proteinMaxGPerKg: number;
}

export interface NutritionPrescriptionTargets extends ClinicalTargets {
  method: NutritionPrescriptionMethod;
}

export interface NutritionPrescriptionMealPattern {
  mealCount: 3 | 4 | 5 | 6;
  mealRatios: Record<MealPlan['mealType'], number>;
  mealTimingSchedule: string[];
}

export interface NutritionPrescriptionConstraints {
  hardExclusions: string[];
  preferredTerms: string[];
  avoidTerms: string[];
  maxRefusePct: number;
  minFiberGPer100?: number;
  maxSodiumMgPer100?: number;
  maxPotassiumMgPer100?: number;
  maxPhosphorusMgPer100?: number;
  maxProteinGPer100?: number;
  minProteinGPer100?: number;
}

export interface NutritionPrescriptionClinicalFlags {
  renal: boolean;
  diabetes: boolean;
  cardiac: boolean;
  dysphagia: boolean;
  hepatic: boolean;
  gastricSensitive: boolean;
  postOp: boolean;
  oncology: boolean;
  dialysis: boolean;
  malnourished: boolean;
  heartFailure: boolean;
  hypertension: boolean;
}

export interface NutritionPrescriptionSafety {
  ckdAssessment?: {
    gfrCategory: string;
    acrCategory: string;
    isCkd: boolean;
    kidneyFailureHr: number;
  };
  proteinPrescription?: {
    min: number;
    target: number;
    max: number | null;
    source: string;
  };
  sodiumPrescription?: {
    maxMg: number;
    minMg?: number;
    note: string;
    source: string;
  };
  potassiumAlert?: {
    severity: 'info' | 'warning' | 'critical';
    message: string;
    action: string;
  } | null;
  recommendedDiets: Array<{
    code: string;
    name: string;
    priority: number;
    source: 'NYS_DOCCS' | 'ESPEN';
  }>;
  phosphorusGuide: {
    dailyAllowanceMg: {
      min: number;
      max: number;
    };
    ingredientLabelWarnings: string[];
    highPhosphorusFoodGroups: string[];
    lowerPhosphorusFoodGroups: string[];
    careNotes: string[];
  };
  fastingRisk?: {
    score: number;
    level: NutritionPrescriptionRiskLevel;
    factors: string[];
  };
}

export interface NutritionPrescription {
  prescriptionId: string;
  generatedAt: string;
  phase: 'shadow';
  patient: NutritionPrescriptionPatientSnapshot;
  carePath: NutritionPrescriptionCarePath;
  targets: NutritionPrescriptionTargets;
  mealPattern: NutritionPrescriptionMealPattern;
  constraints: NutritionPrescriptionConstraints;
  clinicalFlags: NutritionPrescriptionClinicalFlags;
  safety: NutritionPrescriptionSafety;
  rationale: string[];
}

export interface DayPlan {
  dayName: string;
  meals: MealPlan[];
  dailyTargets: ClinicalTargets;
  totals: NutrientVector;
}

export interface WeeklyTherapeuticPlan {
  diagnosis: string;
  clinicalAlignmentScore: number;
  constraints: TherapeuticConstraints;
  days: DayPlan[];
  standards: HospitalMenusStandards;
  notes: string[];
  rationale: string;
  preparedBy: string;
  updatedDate: string;
  carePathLabel?: string;
  engineMode?: string;
  approvalSignatureHash?: string;
  compoundDietCodes?: string[];
  mealTimingSchedule?: string[];
  localEngine?: {
    phiProcessing: 'LOCAL_ONLY';
    networkDependency: 'NONE';
    databaseStatus: {
      databasePath: string;
      databaseReady: boolean;
      dataSource: 'LOCAL_SQLITE';
      phiProcessing: 'LOCAL_ONLY';
      flatFileDirectory: string | null;
      requiredFiles: Array<{
        name: string;
        found: boolean;
        path: string | null;
      }>;
      lastImportAt: string | null;
      rowCounts: {
        foodDescription: number;
        nutrientData: number;
        weightsAndMeasures: number;
      };
      notes: string[];
    };
  };
  diabetesMnt?: {
    sodiumLimitMg: number;
    fiberTargetG: number;
    fiberTargetPer1000Kcal: number;
    fastingRiskScore: number;
    fastingRiskLevel: 'low' | 'moderate' | 'high';
    fastingRiskFactors: string[];
    safetyAlerts: string[];
    supplementFlags: string[];
    treatmentAdjustments: string[];
    behavioralReferralFlags: string[];
    activitySafetyFlags: string[];
    plateMethod: string[];
    encouragedFoods: string[];
    sodiumReplacementBase: string[];
  };
  therapeuticEngine?: {
    snackSchedule: string[];
    recommendedDiets: Array<{
      code: string;
      name: string;
      priority: number;
      source: 'NYS_DOCCS' | 'ESPEN';
    }>;
    ckdAssessment?: {
      gfrCategory: string;
      acrCategory: string;
      isCkd: boolean;
      kidneyFailureHr: number;
    };
    proteinPrescription?: {
      min: number;
      target: number;
      max: number | null;
      source: string;
    };
    sodiumPrescription?: {
      maxMg: number;
      minMg?: number;
      note: string;
      source: string;
    };
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
    potassiumAlert?: {
      severity: 'info' | 'warning' | 'critical';
      message: string;
      action: string;
    } | null;
    prescribingScope: string[];
  };
  validationReport?: PlanValidationReport;
}

export enum DiagnosisType {
  CARDIAC = "CARDIAC",
  RENAL = "RENAL",
  MSD = "MSD",
  DIABETIC = "DIABETIC",
  GASTRIC = "GASTRIC",
  LOW_FAT = "LOW FAT",
  SALT_FREE = "SALT FREE",
  LOW_FIBRE = "LOW FIBRE",
  ONCOLOGY = "ONCOLOGY",
  ULCER = "PEPTIC ULCER",
  PRENATAL = "PRE-NATAL",
  POSTNATAL = "POST-NATAL",
  LACTATION = "BREASTFEEDING",
  H_PYLORI = "H. PYLORI",
  HEPATIC = "HEPATIC",
  DYSPHAGIA = "DYSPHAGIA",
  NEUTROPENIC = "NEUTROPENIC",
  POST_OP = "POST-OPERATIVE",
  RENAL_STAGE_4 = "RENAL STAGE 4",
  GERIATRIC = "GERIATRIC",
  CUSTOM = "CUSTOM"
}

// Schema adapter types (additive; preserves existing app contracts)
export type ProtocolCode =
  | "GENERAL_HOSPITAL"
  | "T2DM"
  | "HTN"
  | "CARDIAC"
  | "RENAL_STAGE_3"
  | "RENAL_STAGE_4"
  | "H_PYLORI"
  | "GASTRIC"
  | "PEPTIC_ULCER"
  | "HEPATIC";

export const DIAGNOSIS_TO_PROTOCOL_CODE: Readonly<Partial<Record<DiagnosisType, ProtocolCode>>> = {
  [DiagnosisType.CARDIAC]: "CARDIAC",
  [DiagnosisType.RENAL]: "RENAL_STAGE_3",
  [DiagnosisType.RENAL_STAGE_4]: "RENAL_STAGE_4",
  [DiagnosisType.DIABETIC]: "T2DM",
  [DiagnosisType.GASTRIC]: "GASTRIC",
  [DiagnosisType.ULCER]: "PEPTIC_ULCER",
  [DiagnosisType.H_PYLORI]: "H_PYLORI",
  [DiagnosisType.HEPATIC]: "HEPATIC",
  [DiagnosisType.SALT_FREE]: "HTN",
} as const;

export type ProtocolFamily =
  | "general"
  | "endocrine"
  | "cardiovascular"
  | "renal"
  | "gastric"
  | "hepatic";

export type SchemaTextureClass = "regular" | "soft" | "minced" | "pureed" | "liquid";
export type SchemaMealType = "breakfast" | "lunch" | "dinner" | "snack_am" | "snack_pm" | "snack_eve";
export type SchemaFoodCategory =
  | "grain"
  | "starch"
  | "protein"
  | "legume"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "fat"
  | "beverage"
  | "broth"
  | "condiment";
export type FoodRuleType = "prefer" | "avoid";

export interface ClinicalProtocol {
  readonly protocol_code: ProtocolCode;
  readonly protocol_name: string;
  readonly family: ProtocolFamily;
  readonly default_texture: SchemaTextureClass;
  readonly default_meal_count: number;
  readonly active: boolean;
}

export interface ProtocolRuleTargets {
  readonly protocol_code: ProtocolCode;
  readonly energy_formula: string;
  readonly protein_g_per_kg_min: number;
  readonly carb_pct_min: number;
  readonly carb_pct_max: number;
  readonly fat_pct_min: number;
  readonly fat_pct_max: number;
  readonly fiber_min_g: number;
  readonly sodium_max_mg: number;
  readonly potassium_max_mg: number | null;
  readonly phosphorus_max_mg: number | null;
  readonly sugar_max_g: number | null;
  readonly gi_max: number;
  readonly fluid_target_ml: string;
}

export interface ProtocolFoodRule {
  readonly protocol_code: ProtocolCode;
  readonly rule_type: FoodRuleType;
  readonly food_tag: string;
  readonly priority: number;
  readonly note: string;
}

export interface ProtocolComponentSlot {
  readonly protocol_code: ProtocolCode;
  readonly meal_type: SchemaMealType;
  readonly slot_name: string;
  readonly required: boolean;
  readonly min_items: number;
  readonly max_items: number;
  readonly slot_order: number;
}

export interface ProtocolSlotCandidate {
  readonly protocol_code: ProtocolCode;
  readonly meal_type: SchemaMealType;
  readonly slot_name: string;
  readonly food_id: string;
  readonly priority: number;
}

export interface ProtocolServiceRule {
  readonly protocol_code: ProtocolCode;
  readonly rule_name: string;
  readonly rule_value: string;
  readonly note: string;
}

export interface SchemaFoodItem {
  readonly food_id: string;
  readonly name: string;
  readonly category: SchemaFoodCategory;
  readonly cuisine: string;
  readonly texture_tags: SchemaTextureClass[];
  readonly clinical_tags: string[];
  readonly kcal_per_100: number;
  readonly protein_g_per_100: number;
  readonly carbs_g_per_100: number;
  readonly fat_g_per_100: number;
  readonly sodium_mg_per_100: number;
  readonly potassium_mg_per_100?: number;
  readonly phosphorus_mg_per_100?: number;
  readonly fiber_g_per_100?: number;
  readonly gi?: number;
}

export interface ProtocolConfig {
  readonly protocol: ClinicalProtocol;
  readonly targets: ProtocolRuleTargets;
  readonly foodRules: ProtocolFoodRule[];
  readonly slots: ProtocolComponentSlot[];
  readonly candidates: ProtocolSlotCandidate[];
  readonly serviceRules: ProtocolServiceRule[];
}

export interface ResolvedNutrientTargets {
  readonly patientId: string;
  readonly protocolCode: ProtocolCode;
  readonly total_energy_kcal: number;
  readonly protein_g: number;
  readonly protein_g_per_kg: number;
  readonly carb_g_min: number;
  readonly carb_g_max: number;
  readonly fat_g_min: number;
  readonly fat_g_max: number;
  readonly fiber_min_g: number;
  readonly sodium_max_mg: number;
  readonly potassium_max_mg: number | null;
  readonly phosphorus_max_mg: number | null;
  readonly sugar_max_g: number | null;
  readonly gi_max: number;
  readonly fluid_target_ml: number;
  readonly macro_check_passed: boolean;
}

export interface SchemaValidationError {
  readonly field: string;
  readonly value: unknown;
  readonly constraint: string;
  readonly message: string;
}

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: SchemaValidationError[];
}

export interface SafetyViolation {
  readonly nutrient: string;
  readonly plan_value: number;
  readonly limit: number;
  readonly severity: "warning" | "critical";
  readonly message: string;
}

export interface SafetyCheckResult {
  readonly passed: boolean;
  readonly violations: SafetyViolation[];
}

export interface ValidationSummary {
  readonly nutrientChecksPassed: number;
  readonly nutrientChecksTotal: number;
  readonly weeklyUniqueFoods: number;
  readonly maxRepeatPerFood: number;
  readonly textureMismatchCount: number;
}

export interface PlanValidationReport {
  readonly passed: boolean;
  readonly issues: string[];
  readonly summary?: ValidationSummary;
}
