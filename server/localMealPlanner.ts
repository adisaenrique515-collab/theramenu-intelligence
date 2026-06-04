import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateAlignmentScore, calculateTotalsFromMeals, validateWeeklyPlan } from '../services/planValidation.ts';
import { calculateProteinTarget, classifyCkd, getSodiumTarget } from './therapeuticEngineConcepts.ts';
import type {
  ClinicalTargets,
  DayPlan,
  HospitalMenusStandards,
  MealPlan,
  MealSlot,
  SlotItem,
  WeeklyTherapeuticPlan,
} from '../types.ts';
import type { LocalFoodRecord } from '../localNutritionDb.types.ts';
import { queryLocalFoods } from './localNutritionDb.ts';

type RiskLevel = 'low' | 'moderate' | 'high';
type MealType = MealPlan['mealType'];
type EgfrBand = 'gte45' | '30to45' | 'lt30';

export interface LocalPlannerProfile {
  diagnosis: string;
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  eGfr?: number;
  acrMgG?: number;
  potassiumMmolL?: number;
  hypertension?: boolean;
  heartFailure?: boolean;
  onDialysis?: boolean;
  malnourished?: boolean;
  goal: string;
  mealCount: 3 | 4 | 5 | 6;
  textureLevel: 'regular' | 'soft' | 'minced' | 'pureed' | 'liquid';
  riskLevel: RiskLevel;
  egfrBand?: EgfrBand;
}

interface CarePath {
  code: 'STANDARD_DIET' | 'HOSPITAL_DIET';
  label: 'Standard Diet' | 'Hospital Diet';
  energyKcalPerKg: number;
  proteinMinGPerKg: number;
  proteinMaxGPerKg: number;
}

interface SlotBlueprint {
  slotName: string;
  keywordBuckets: string[][];
  preferDescriptionTerms?: string[];
  avoidDescriptionTerms?: string[];
  preferredGramWeight: number;
  mealShare: number;
  maxRefusePct?: number;
  minFiberGPer100?: number;
  maxSodiumMgPer100?: number;
  maxPotassiumMgPer100?: number;
  maxPhosphorusMgPer100?: number;
  maxProteinGPer100?: number;
  minProteinGPer100?: number;
  preferHigherFiber?: boolean;
  preferLowerSodium?: boolean;
  excludeTerms?: string[];
}

interface RankedCandidate {
  record: LocalFoodRecord;
  foodKey: string;
  score: number;
  source: 'primary' | 'fallback';
}

interface SelectionContext {
  usageByFoodKey: Map<string, number>;
  recentBySlotKey: Map<string, string[]>;
  currentDayFoodKeys: Set<string>;
  previousDayFoodKeys: Set<string>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phosphorusGuideSeed = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'resources', 'clinical', 'phosphorus-guide-seed.json'), 'utf8'),
) as {
  rules: {
    dailyAllowanceMg: { min: number; max: number };
    lowPhosphorusPerServingMgMax: number;
    mediumPhosphorusPerServingMgMax: number;
    highPhosphorusPerServingMgMin: number;
    highPhosphorusFoodGroups: string[];
    lowerPhosphorusFoodGroups: string[];
    ingredientLabelWarnings: string[];
    careNotes: string[];
  };
};

const RENAL_LOW_PHOSPHORUS_TERMS = Array.from(
  new Set(
    phosphorusGuideSeed.rules.lowerPhosphorusFoodGroups
      .flatMap((group) => group.toLowerCase().split(/[^a-z0-9]+/))
      .filter((term) => term.length >= 3 && !['with', 'without', 'fresh', 'light', 'colored', 'dairy'].includes(term)),
  ),
);

const RENAL_HIGH_PHOSPHORUS_SOFT_AVOIDS = Array.from(
  new Set(
    phosphorusGuideSeed.rules.highPhosphorusFoodGroups
      .flatMap((group) => group.toLowerCase().split(/[^a-z0-9]+/))
      .filter((term) => term.length >= 4 && !['whole', 'products', 'drinks'].includes(term)),
  ),
);

const RENAL_HIGH_PHOSPHORUS_HARD_EXCLUDES = [
  'bran',
  'whole grain',
  'wholemeal',
  'nuts',
  'seed',
  'seeds',
  'dark soda',
  'cola',
  'cocoa',
  'chocolate',
  'bottled iced tea',
  'pudding',
  'ice cream',
  'cheese',
  'yogurt',
] as const;

const DEFAULT_STANDARDS: HospitalMenusStandards = {
  hotHolding: '>= 65C',
  servingHotFood: '>= 63C',
  coldHolding: '<= 5C',
  servingColdFood: '<= 8C',
  boosting: 'As per Facility',
  vehicle: '<= 5C',
  standardsList: [
    { key: 'hot_holding', operator: '>=', value: 65, unit: 'C', note: 'Continuous monitoring required' },
    { key: 'serving_hot', operator: '>=', value: 63, unit: 'C', note: 'At point of patient delivery' },
    { key: 'cold_holding', operator: '<=', value: 5, unit: 'C', note: 'Continuous monitoring required' },
    { key: 'serving_cold', operator: '<=', value: 8, unit: 'C', note: 'At point of patient delivery' },
    { key: 'vehicle_transport', operator: '<=', value: 5, unit: 'C', note: 'Active refrigeration required' },
  ],
};

const LOCAL_PROTOCOL_RATIONALE: Record<string, string> = {
  CARDIAC: 'Cardiac protection with low sodium, lower saturated fat, and higher-fibre food selection.',
  RENAL: 'Kidney protection with controlled sodium, potassium, phosphorus, and protein exposure.',
  DIABETIC: 'Glycemic control with fibre density, low-sodium meal patterns, and structured timing.',
  DYSPHAGIA: 'Texture-aware feeding pattern prioritizing lower-refuse foods and safer hydration.',
  HEPATIC: 'Liver support with moderate protein and sodium control.',
  GASTRIC: 'Gastric protection with softer, lower-irritation foods.',
  ONCOLOGY: 'Recovery-oriented meal delivery with gentler textures, strong protein coverage, and flexible substitutions.',
  'POST-OPERATIVE': 'Post-operative support with softer meal delivery, recovery-safe substitutions, and structured intake timing.',
  'PEPTIC ULCER': 'Peptic ulcer protection with lower-acid, lower-irritation foods.',
  'H. PYLORI': 'Gastric irritation reduction with plain, lower-fat foods and gentle meal progression.',
};

const SIX_NODE_TIMES: Record<MealType, string> = {
  Breakfast: '08:00',
  'Snack AM': '10:00',
  Lunch: '12:30',
  'Snack PM': '15:00',
  Dinner: '18:00',
  'Snack Eve': '20:30',
};

function resolveCarePath(riskLevel: RiskLevel): CarePath {
  if (riskLevel === 'moderate' || riskLevel === 'high') {
    return {
      code: 'HOSPITAL_DIET',
      label: 'Hospital Diet',
      energyKcalPerKg: 30,
      proteinMinGPerKg: 1.2,
      proteinMaxGPerKg: 2.0,
    };
  }

  return {
    code: 'STANDARD_DIET',
    label: 'Standard Diet',
    energyKcalPerKg: 25,
    proteinMinGPerKg: 0.8,
    proteinMaxGPerKg: 1.0,
  };
}

function normalizeDiagnosis(diagnosis: string): string {
  return diagnosis.toUpperCase();
}

function isRenalDiagnosis(diagnosis: string): boolean {
  return normalizeDiagnosis(diagnosis).includes('RENAL');
}

function isDiabetesDiagnosis(diagnosis: string): boolean {
  const normalized = normalizeDiagnosis(diagnosis);
  return normalized.includes('DIABETIC') || normalized.includes('T2DM');
}

function isCardiacDiagnosis(diagnosis: string): boolean {
  return normalizeDiagnosis(diagnosis).includes('CARDIAC');
}

function isDysphagiaDiagnosis(diagnosis: string): boolean {
  return normalizeDiagnosis(diagnosis).includes('DYSPHAGIA');
}

function isHepaticDiagnosis(diagnosis: string): boolean {
  return normalizeDiagnosis(diagnosis).includes('HEPATIC');
}

function isPostOpDiagnosis(diagnosis: string): boolean {
  return normalizeDiagnosis(diagnosis).includes('POST');
}

function isOncologyDiagnosis(diagnosis: string): boolean {
  return normalizeDiagnosis(diagnosis).includes('ONCOLOGY');
}

function isGastricSensitiveDiagnosis(diagnosis: string): boolean {
  const normalized = normalizeDiagnosis(diagnosis);
  return normalized.includes('GASTRIC') || normalized.includes('ULCER') || normalized.includes('H. PYLORI');
}

function mergeUniqueTerms(...groups: Array<string[] | undefined>): string[] | undefined {
  const merged = Array.from(
    new Set(groups.flatMap((group) => group || []).map((term) => term.trim()).filter(Boolean)),
  );
  return merged.length > 0 ? merged : undefined;
}

function hasCkdRestrictions(profile: LocalPlannerProfile): boolean {
  const ckd = classifyCkd(profile.eGfr ?? 90, profile.acrMgG ?? 10);
  return ['G3a', 'G3b', 'G4', 'G5'].includes(ckd.gfrCategory) || ['A2', 'A3'].includes(ckd.acrCategory) || isRenalDiagnosis(profile.diagnosis);
}

function deriveTargets(profile: LocalPlannerProfile): { targets: ClinicalTargets; carePath: CarePath } {
  const carePath = resolveCarePath(profile.riskLevel);
  const baseEnergy = Math.max(1200, Math.round(profile.weightKg * carePath.energyKcalPerKg));
  const proteinMidpoint = (carePath.proteinMinGPerKg + carePath.proteinMaxGPerKg) / 2;
  const ckd = classifyCkd(profile.eGfr ?? 90, profile.acrMgG ?? 10);
  const proteinPrescription = calculateProteinTarget(
    profile.weightKg,
    ckd.gfrCategory,
    Boolean(profile.onDialysis),
    Boolean(profile.malnourished),
  );
  const sodiumPrescription = getSodiumTarget(Boolean(profile.heartFailure), Boolean(profile.hypertension));
  let proteinTarget = Math.round(
    ['G3a', 'G3b', 'G4', 'G5'].includes(ckd.gfrCategory) || profile.onDialysis || profile.malnourished
      ? proteinPrescription.target
      : profile.weightKg * proteinMidpoint,
  );
  let proteinMax: number | undefined;
  let sodiumMax = sodiumPrescription.maxMg;
  let potassiumMax = 3500;
  let phosphorusMax = phosphorusGuideSeed.rules.dailyAllowanceMg.max;
  let fiberMin = 28;

  if (isDiabetesDiagnosis(profile.diagnosis)) {
    sodiumMax = Math.min(sodiumMax, 2300);
    fiberMin = Math.max(25, Math.ceil((baseEnergy / 1000) * 14));
  }

  if (isCardiacDiagnosis(profile.diagnosis)) {
    sodiumMax = 1500;
    fiberMin = Math.max(fiberMin, 30);
  }

  if (hasCkdRestrictions(profile)) {
    sodiumMax = Math.min(sodiumMax, 2000);
    potassiumMax = 2000;
    phosphorusMax = phosphorusGuideSeed.rules.dailyAllowanceMg.min;
    proteinMax = proteinPrescription.max ? Math.round(proteinPrescription.max) : Math.round(profile.weightKg * (profile.egfrBand === 'lt30' ? 0.65 : 0.8));
    proteinTarget = Math.max(30, Math.round(proteinPrescription.target));
    fiberMin = Math.max(22, fiberMin);
  }

  if (profile.onDialysis && !hasCkdRestrictions(profile)) {
    proteinTarget = Math.max(proteinTarget, Math.round(proteinPrescription.target));
  }

  const carbsG = Math.round((baseEnergy * 0.5) / 4);
  const fatG = Math.round((baseEnergy * 0.3) / 9);

  return {
    carePath,
    targets: {
      caloriesKcal: baseEnergy,
      carbsG,
      proteinG: proteinTarget,
      proteinGMax: proteinMax,
      fatG,
      fiberG: fiberMin,
      sodiumMg: sodiumMax,
      potassiumMg: potassiumMax,
      phosphorusMg: phosphorusMax,
      cholesterolMg: 300,
      saturatedFatG: 20,
      sugarG: 36,
      fluidMl: Math.round(profile.weightKg * 30),
      fiberGMin: fiberMin,
      sodiumMgMax: sodiumMax,
      potassiumMgMax: potassiumMax,
      phosphorusMgMax: phosphorusMax,
      cholesterolMgMax: 300,
      saturatedFatGMax: 20,
      sugarGMax: 36,
      fluidMlTarget: Math.round(profile.weightKg * 30),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToNearestFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

function buildDiagnosisExclusions(profile: LocalPlannerProfile): string[] {
  const exclusions = ['raw shell', 'alcoholic', 'beer', 'wine'];

  if (hasCkdRestrictions(profile)) {
    exclusions.push('salted', 'pickled', 'cured', 'instant', 'bouillon', 'bone', ...RENAL_HIGH_PHOSPHORUS_HARD_EXCLUDES);
  }

  if (isCardiacDiagnosis(profile.diagnosis)) {
    exclusions.push('fried', 'sausage', 'bacon', 'ham', 'gravy', 'smoked');
  }

  if (isDysphagiaDiagnosis(profile.diagnosis)) {
    exclusions.push('seed', 'bone', 'shell', 'crust', 'chip', 'nut');
  }

  if (isGastricSensitiveDiagnosis(profile.diagnosis) || isPostOpDiagnosis(profile.diagnosis)) {
    exclusions.push('fried', 'spicy', 'chili', 'pepper', 'pickled', 'carbonated', 'coffee');
  }

  if (isHepaticDiagnosis(profile.diagnosis)) {
    exclusions.push('fried', 'bacon', 'sausage', 'cured');
  }

  return Array.from(new Set(exclusions));
}

function buildMealBlueprints(profile: LocalPlannerProfile): Array<{ mealType: MealType; slots: SlotBlueprint[] }> {
  const renal = hasCkdRestrictions(profile);
  const diabetes = isDiabetesDiagnosis(profile.diagnosis);
  const cardiac = isCardiacDiagnosis(profile.diagnosis);
  const dysphagia = isDysphagiaDiagnosis(profile.diagnosis);
  const hepatic = isHepaticDiagnosis(profile.diagnosis);
  const recoveryFocused = isOncologyDiagnosis(profile.diagnosis) || isPostOpDiagnosis(profile.diagnosis) || Boolean(profile.malnourished);
  const gentleGi = isGastricSensitiveDiagnosis(profile.diagnosis) || isPostOpDiagnosis(profile.diagnosis);
  const sharedExclusions = buildDiagnosisExclusions(profile);
  const sharedPreferredTerms = mergeUniqueTerms(
    renal ? RENAL_LOW_PHOSPHORUS_TERMS : undefined,
    cardiac ? ['fresh', 'unsalted', 'baked', 'steamed'] : undefined,
    hepatic ? ['plain', 'baked', 'poached', 'steamed'] : undefined,
    gentleGi ? ['plain', 'soft', 'cooked', 'mashed', 'stewed'] : undefined,
    recoveryFocused ? ['fortified', 'high protein', 'soft'] : undefined,
  );
  const sharedAvoidTerms = mergeUniqueTerms(
    renal ? RENAL_HIGH_PHOSPHORUS_SOFT_AVOIDS : undefined,
    cardiac ? ['fried', 'cured', 'smoked', 'sausage', 'bacon', 'gravy'] : undefined,
    hepatic ? ['fried', 'cured', 'sausage', 'bacon'] : undefined,
    gentleGi ? ['fried', 'spicy', 'pickled', 'pepper', 'acidic'] : undefined,
  );
  const textureMaxRefuse = dysphagia ? 5 : renal ? 12 : gentleGi ? 14 : 20;
  const fiberFloor = diabetes ? 2.5 : 0;

  const grainKeywords = dysphagia
    ? [['oatmeal', 'oats', 'porridge'], ['rice cereal', 'cream'], ['mashed potato', 'potato']]
    : renal
      ? [['white rice', 'rice cereal', 'corn cereal'], ['white pasta', 'white bread', 'toast'], ['popcorn', 'cracker'], ['oatmeal', 'oats']]
      : gentleGi
        ? [['oatmeal', 'porridge', 'cream of rice'], ['white rice', 'mashed potato'], ['toast', 'bread'], ['pasta', 'noodle']]
        : cardiac
          ? [['oatmeal', 'oats', 'barley'], ['brown rice', 'rice'], ['whole wheat bread', 'bread'], ['beans', 'lentils']]
          : [['oatmeal', 'oats', 'porridge'], ['bread', 'toast'], ['rice', 'pasta'], ['potato', 'sweet potato']];
  const proteinKeywords = renal
    ? [['egg', 'egg white'], ['tofu'], ['fish', 'chicken'], ['milk']]
    : gentleGi
      ? [['egg', 'yogurt'], ['chicken', 'fish'], ['tofu'], ['milk']]
      : recoveryFocused
        ? [['egg', 'yogurt'], ['chicken', 'fish'], ['tofu', 'beans'], ['milk']]
        : [['egg', 'yogurt'], ['fish', 'chicken'], ['tofu', 'beans'], ['milk', 'cheese']];
  const fruitKeywords = renal
    ? [['apple', 'pear'], ['berries', 'grape'], ['peach', 'pineapple']]
    : gentleGi
      ? [['apple', 'pear'], ['peach', 'banana'], ['berries', 'melon']]
      : [['apple', 'pear'], ['berries', 'orange'], ['banana', 'peach']];
  const vegetableKeywords = renal
    ? [['carrot', 'green bean'], ['cabbage', 'cauliflower'], ['broccoli', 'pumpkin']]
    : gentleGi
      ? [['carrot', 'pumpkin'], ['green bean', 'zucchini'], ['cauliflower', 'cabbage']]
      : cardiac || hepatic
        ? [['broccoli', 'spinach'], ['carrot', 'green bean'], ['pumpkin', 'tomato']]
        : [['broccoli', 'spinach'], ['carrot', 'bean'], ['pumpkin', 'tomato']];

  const blueprints: Array<{ mealType: MealType; slots: SlotBlueprint[] }> = [
    {
      mealType: 'Breakfast',
      slots: [
        {
          slotName: 'Base Carbohydrate',
          keywordBuckets: grainKeywords,
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: 160,
          mealShare: renal ? 0.55 : 0.45,
          minFiberGPer100: fiberFloor,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 140 : 220,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          preferHigherFiber: diabetes,
          preferLowerSodium: true,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
        {
          slotName: 'Protein',
          keywordBuckets: proteinKeywords,
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: recoveryFocused ? 125 : 110,
          mealShare: renal ? 0.2 : recoveryFocused ? 0.4 : 0.35,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 150 : 260,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.mediumPhosphorusPerServingMgMax : undefined,
          maxProteinGPer100: renal ? 12 : undefined,
          minProteinGPer100: renal ? undefined : recoveryFocused ? 6 : 4,
          preferLowerSodium: true,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
        {
          slotName: 'Fruit',
          keywordBuckets: fruitKeywords,
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: 120,
          mealShare: renal ? 0.1 : 0.2,
          minFiberGPer100: diabetes ? 1.5 : undefined,
          maxPotassiumMgPer100: renal ? 220 : undefined,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
      ],
    },
    {
      mealType: 'Snack AM',
      slots: [
        {
          slotName: 'Snack Item',
          keywordBuckets: renal ? [['white pasta', 'white rice'], ['apple', 'pear'], ['popcorn', 'cracker'], ['corn cereal', 'rice cereal']] : fruitKeywords,
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: renal ? 130 : 100,
          mealShare: renal ? 0.9 : 0.75,
          minFiberGPer100: diabetes ? 1.5 : undefined,
          maxSodiumMgPer100: cardiac || hepatic ? 110 : 120,
          maxPotassiumMgPer100: renal ? 150 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
      ],
    },
    {
      mealType: 'Lunch',
      slots: [
        {
          slotName: 'Protein',
          keywordBuckets: renal ? [['egg', 'egg white'], ['tofu'], ['fish', 'chicken']] : [['chicken', 'fish'], ['tofu', 'beans'], ['egg', 'yogurt']],
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: recoveryFocused ? 130 : 120,
          mealShare: renal ? 0.2 : recoveryFocused ? 0.38 : 0.35,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 160 : 260,
          maxPotassiumMgPer100: renal ? 200 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.mediumPhosphorusPerServingMgMax : undefined,
          maxProteinGPer100: renal ? 12 : undefined,
          minProteinGPer100: recoveryFocused ? 8 : 6,
          preferLowerSodium: true,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
        {
          slotName: 'Starch',
          keywordBuckets: renal ? [['white rice', 'white pasta'], ['white bread', 'toast'], ['popcorn', 'cracker'], ['potato']] : [['rice', 'pasta'], ['potato', 'bread'], ['oat', 'barley']],
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: 180,
          mealShare: renal ? 0.5 : 0.35,
          minFiberGPer100: fiberFloor,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 140 : 220,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          preferHigherFiber: diabetes,
          preferLowerSodium: true,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
        {
          slotName: 'Vegetable',
          keywordBuckets: vegetableKeywords,
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: 130,
          mealShare: renal ? 0.15 : 0.3,
          minFiberGPer100: diabetes ? 2 : undefined,
          maxSodiumMgPer100: cardiac || hepatic ? 110 : 120,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
      ],
    },
    {
      mealType: 'Snack PM',
      slots: [
        {
          slotName: 'Snack Item',
          keywordBuckets: renal ? [['apple', 'pear'], ['popcorn', 'cracker'], ['white bread', 'corn cereal'], ['milk']] : [['yogurt', 'milk'], ['apple', 'pear'], ['tofu', 'beans']],
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: renal ? 130 : 110,
          mealShare: renal ? 0.9 : 0.75,
          minFiberGPer100: diabetes ? 1 : undefined,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 150 : 220,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
      ],
    },
    {
      mealType: 'Dinner',
      slots: [
        {
          slotName: 'Protein',
          keywordBuckets: renal ? [['egg', 'egg white'], ['tofu'], ['fish', 'chicken']] : [['fish', 'chicken'], ['tofu', 'egg'], ['beans', 'yogurt']],
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: recoveryFocused ? 130 : 120,
          mealShare: renal ? 0.2 : recoveryFocused ? 0.38 : 0.35,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 160 : 260,
          maxPotassiumMgPer100: renal ? 200 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.mediumPhosphorusPerServingMgMax : undefined,
          maxProteinGPer100: renal ? 12 : undefined,
          minProteinGPer100: recoveryFocused ? 8 : 6,
          preferLowerSodium: true,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
        {
          slotName: 'Starch',
          keywordBuckets: renal ? [['white rice', 'white pasta'], ['white bread', 'toast'], ['popcorn', 'cracker'], ['potato']] : [['rice', 'pasta'], ['potato', 'bread'], ['oat', 'barley']],
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: 180,
          mealShare: renal ? 0.5 : 0.35,
          minFiberGPer100: fiberFloor,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 140 : 220,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          preferHigherFiber: diabetes,
          preferLowerSodium: true,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
        {
          slotName: 'Vegetable',
          keywordBuckets: vegetableKeywords,
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: 130,
          mealShare: renal ? 0.15 : 0.3,
          minFiberGPer100: diabetes ? 2 : undefined,
          maxSodiumMgPer100: cardiac || hepatic ? 110 : 120,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
      ],
    },
    {
      mealType: 'Snack Eve',
      slots: [
        {
          slotName: 'Snack Item',
          keywordBuckets: renal ? [['white pasta', 'white rice'], ['apple', 'pear'], ['popcorn', 'cracker'], ['white bread', 'corn cereal']] : [['apple', 'pear'], ['oatmeal', 'oats'], ['milk', 'yogurt']],
          preferDescriptionTerms: sharedPreferredTerms,
          avoidDescriptionTerms: sharedAvoidTerms,
          preferredGramWeight: renal ? 130 : 100,
          mealShare: renal ? 0.9 : 0.75,
          minFiberGPer100: diabetes ? 1.5 : undefined,
          maxSodiumMgPer100: renal || cardiac || hepatic ? 120 : 180,
          maxPotassiumMgPer100: renal ? 180 : undefined,
          maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
          excludeTerms: sharedExclusions,
          maxRefusePct: textureMaxRefuse,
        },
      ],
    },
  ];

  return blueprints.slice(0, profile.mealCount);
}

function parseDiagnosisLabel(diagnosis: string): string {
  return diagnosis.replace(/_/g, ' ');
}

function buildNutrientProfile(record: LocalFoodRecord) {
  return {
    source: 'LOCAL_SQLITE' as const,
    fdcId: Number(record.ndbNo) || 0,
    description: record.description,
    fetchedAt: new Date().toISOString(),
    caloriesKcalPer100: record.caloriesKcalPer100,
    carbsGPer100: record.carbsGPer100,
    proteinGPer100: record.proteinGPer100,
    fatGPer100: record.fatGPer100,
    fiberGPer100: record.fiberGPer100,
    sodiumMgPer100: record.sodiumMgPer100,
    potassiumMgPer100: record.potassiumMgPer100,
    phosphorusMgPer100: record.phosphorusMgPer100,
    cholesterolMgPer100: record.cholesterolMgPer100,
    saturatedFatGPer100: record.saturatedFatGPer100,
    sugarGPer100: record.sugarGPer100,
  };
}

function buildFoodKey(record: LocalFoodRecord): string {
  return record.ndbNo || record.description.toLowerCase();
}

function buildSlotKey(mealType: MealType, slotName: string): string {
  return `${mealType}:${slotName}`.toLowerCase();
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return hash;
}

function querySlotRecords(slot: SlotBlueprint, keywords: string[], limit: number, includeProteinFloor: boolean): LocalFoodRecord[] {
  return queryLocalFoods({
    keywords,
    preferredGramWeight: slot.preferredGramWeight,
    limit,
    maxRefusePct: slot.maxRefusePct,
    minFiberGPer100: slot.minFiberGPer100,
    maxSodiumMgPer100: slot.maxSodiumMgPer100,
    maxPotassiumMgPer100: slot.maxPotassiumMgPer100,
    maxPhosphorusMgPer100: slot.maxPhosphorusMgPer100,
    maxProteinGPer100: slot.maxProteinGPer100,
    minProteinGPer100: includeProteinFloor ? slot.minProteinGPer100 : undefined,
    preferHigherFiber: slot.preferHigherFiber,
    preferLowerSodium: slot.preferLowerSodium,
    preferLowerPhosphorus: typeof slot.maxPhosphorusMgPer100 === 'number',
    preferDescriptionTerms: slot.preferDescriptionTerms,
    avoidDescriptionTerms: slot.avoidDescriptionTerms,
    excludeTerms: slot.excludeTerms,
  });
}

function scoreCandidate(
  candidate: LocalFoodRecord,
  slot: SlotBlueprint,
  mealType: MealType,
  dayIndex: number,
  candidateIndex: number,
  source: RankedCandidate['source'],
  context: SelectionContext,
): number {
  const foodKey = buildFoodKey(candidate);
  const slotKey = buildSlotKey(mealType, slot.slotName);
  const description = candidate.description.toLowerCase();
  const recentSlotFoods = context.recentBySlotKey.get(slotKey) || [];
  const weeklyUseCount = context.usageByFoodKey.get(foodKey) || 0;
  const recentSlotIndex = recentSlotFoods.indexOf(foodKey);

  let score = source === 'primary' ? 64 : 38;
  score -= candidateIndex * 4;
  score -= weeklyUseCount * 18;

  if (context.currentDayFoodKeys.has(foodKey)) {
    score -= 36;
  }
  if (context.previousDayFoodKeys.has(foodKey)) {
    score -= 14;
  }
  if (recentSlotIndex >= 0) {
    score -= 28 - recentSlotIndex * 6;
  }

  if (slot.preferHigherFiber) {
    score += candidate.fiberGPer100 * 1.8;
  }
  if (slot.preferLowerSodium) {
    score += Math.max(0, 14 - candidate.sodiumMgPer100 / 18);
  }
  if (typeof slot.maxPotassiumMgPer100 === 'number') {
    score += Math.max(0, 12 - candidate.potassiumMgPer100 / 20);
  }
  if (typeof slot.maxPhosphorusMgPer100 === 'number') {
    score += Math.max(0, 12 - candidate.phosphorusMgPer100 / 12);
  }
  if (typeof slot.minProteinGPer100 === 'number') {
    score += candidate.proteinGPer100 * 1.2;
  }
  if (typeof slot.maxProteinGPer100 === 'number') {
    score += Math.max(0, slot.maxProteinGPer100 - candidate.proteinGPer100);
  }
  if (typeof slot.maxRefusePct === 'number') {
    score += Math.max(0, slot.maxRefusePct - candidate.refusePct);
  }

  (slot.preferDescriptionTerms || []).forEach((term, index) => {
    if (description.includes(term.toLowerCase())) {
      score += 8 - Math.min(index, 6);
    }
  });
  (slot.avoidDescriptionTerms || []).forEach((term, index) => {
    if (description.includes(term.toLowerCase())) {
      score -= 8 - Math.min(index, 5);
    }
  });

  if (mealType.includes('Snack') && candidate.caloriesKcalPer100 > 220) {
    score -= 8;
  }

  score += (hashString(`${foodKey}:${slotKey}:${dayIndex}`) % 13) / 10;
  return score;
}

function rankCandidates(
  slot: SlotBlueprint,
  mealType: MealType,
  dayIndex: number,
  slotIndex: number,
  context: SelectionContext,
): RankedCandidate[] {
  const bucket = slot.keywordBuckets[(dayIndex + slotIndex) % slot.keywordBuckets.length] || slot.keywordBuckets[0];
  const primary = querySlotRecords(slot, bucket, 8, true);
  const fallback = querySlotRecords(slot, slot.keywordBuckets.flat(), 12, false);
  const seen = new Set<string>();
  const ranked: RankedCandidate[] = [];

  primary.forEach((record, index) => {
    const foodKey = buildFoodKey(record);
    if (seen.has(foodKey)) return;
    seen.add(foodKey);
    ranked.push({
      record,
      foodKey,
      score: scoreCandidate(record, slot, mealType, dayIndex, index, 'primary', context),
      source: 'primary',
    });
  });

  fallback.forEach((record, index) => {
    const foodKey = buildFoodKey(record);
    if (seen.has(foodKey)) return;
    seen.add(foodKey);
    ranked.push({
      record,
      foodKey,
      score: scoreCandidate(record, slot, mealType, dayIndex, index, 'fallback', context),
      source: 'fallback',
    });
  });

  const sorted = ranked.sort((left, right) => right.score - left.score);

  // Clinically-filtered primary candidates must always win over fallback candidates.
  // Repetition penalties should rank primaries against each other, not allow an
  // unfiltered fallback to displace the only medically valid primary food.
  const bestPrimary = sorted.find((c) => c.source === 'primary');
  if (bestPrimary && sorted[0]?.source === 'fallback') {
    return [bestPrimary, ...sorted.filter((c) => c !== bestPrimary)];
  }

  return sorted;
}

function registerSelectedRecord(context: SelectionContext, mealType: MealType, slotName: string, foodKey: string) {
  context.usageByFoodKey.set(foodKey, (context.usageByFoodKey.get(foodKey) || 0) + 1);
  context.currentDayFoodKeys.add(foodKey);

  const slotKey = buildSlotKey(mealType, slotName);
  const prior = context.recentBySlotKey.get(slotKey) || [];
  const next = [foodKey, ...prior.filter((value) => value !== foodKey)].slice(0, 3);
  context.recentBySlotKey.set(slotKey, next);
}

function buildPortionString(
  record: LocalFoodRecord,
  targetCalories: number,
  slot: SlotBlueprint,
  targets: ClinicalTargets,
  mealCount: number,
): string {
  const lowerSlot = slot.slotName.toLowerCase();
  const isProteinSlot = lowerSlot.includes('protein');
  const isCarbSlot = lowerSlot.includes('starch') || lowerSlot.includes('carbohydrate') || lowerSlot.includes('snack');
  const isProduceSlot = lowerSlot.includes('fruit') || lowerSlot.includes('vegetable');
  const caloriesPer100 = Math.max(1, record.caloriesKcalPer100 || 1);
  let grams = (targetCalories / caloriesPer100) * 100;

  if (typeof targets.proteinGMax === 'number' && record.proteinGPer100 > 0 && isProteinSlot) {
    const mealProteinCeiling = targets.proteinGMax / Math.max(1, mealCount);
    grams = Math.min(grams, (mealProteinCeiling / record.proteinGPer100) * 100);
  }

  const minGrams = isProteinSlot
    ? 35
    : isCarbSlot
      ? 80
      : isProduceSlot
        ? 70
        : 60;
  const maxGrams = isProteinSlot
    ? Math.max(120, record.edibleGramWeight * 1.2)
    : isCarbSlot
      ? Math.max(320, record.edibleGramWeight * 2.2)
      : isProduceSlot
        ? Math.max(180, record.edibleGramWeight * 1.5)
        : Math.max(220, record.edibleGramWeight * 1.6);

  const snackPotassiumCap = lowerSlot.includes('snack') && record.potassiumMgPer100 > 80 ? 180 : maxGrams;
  grams = clamp(grams, minGrams, snackPotassiumCap);
  return `${roundToNearestFive(grams)}g`;
}

function buildSlotItemFromRecord(
  record: LocalFoodRecord,
  slot: SlotBlueprint,
  mealCalories: number,
  targets: ClinicalTargets,
  diagnosis: string,
  mealCount: number,
): SlotItem {
  return {
    name: record.description,
    foodId: record.ndbNo,
    portion: buildPortionString(record, mealCalories * slot.mealShare, slot, targets, mealCount),
    therapeuticOverride: isDysphagiaDiagnosis(diagnosis) ? `Texture adaptation required: ${diagnosis.toLowerCase()}` : undefined,
    operational: {
      serviceTemp: slot.slotName.toLowerCase().includes('snack') ? '<= 8C or >= 60C' : '>= 60C',
      handlingNotes: `Normalized from ${record.measureDescription}; refuse ${record.refusePct}% removed before nutrient scaling.`,
    },
    nutrientProfile: buildNutrientProfile(record),
  };
}

function parseGrams(portion: string | undefined): number {
  if (!portion) return 0;
  const match = portion.match(/(\d+(?:\.\d+)?)\s*g/i);
  return match ? Number(match[1]) : 0;
}

function setPortion(item: SlotItem | null, grams: number): SlotItem | null {
  if (!item) return item;
  return {
    ...item,
    portion: `${roundToNearestFive(Math.max(20, grams))}g`,
  };
}

function scaleMealSlots(
  meals: MealPlan[],
  predicate: (meal: MealPlan, slot: MealSlot) => boolean,
  scale: number,
  minGrams: number,
  maxGrams: number,
): MealPlan[] {
  return meals.map((meal) => ({
    ...meal,
    slots: meal.slots?.map((slot) => {
      if (!slot.item || !predicate(meal, slot)) {
        return slot;
      }
      const currentGrams = parseGrams(slot.item.portion);
      const nextGrams = clamp(currentGrams * scale, minGrams, maxGrams);
      return {
        ...slot,
        item: setPortion(slot.item, nextGrams),
        alternatives: slot.alternatives?.map((alternative) => {
          const alternativeGrams = parseGrams(alternative.portion);
          return setPortion(alternative, clamp(alternativeGrams * scale, minGrams, maxGrams));
        }).filter((alternative): alternative is SlotItem => Boolean(alternative)),
      };
    }),
  }));
}

function rebalanceMeals(meals: MealPlan[], targets: ClinicalTargets): MealPlan[] {
  let adjustedMeals = meals;
  let totals = calculateTotalsFromMeals(adjustedMeals);
  const proteinCeiling = targets.proteinGMax ?? Math.max(targets.proteinG * 1.15, targets.proteinG + 10);

  if (totals.proteinG > proteinCeiling) {
    const proteinScale = clamp(proteinCeiling / Math.max(totals.proteinG, 1), 0.45, 0.95);
    adjustedMeals = scaleMealSlots(
      adjustedMeals,
      (_meal, slot) => slot.slotName.toLowerCase().includes('protein'),
      proteinScale,
      25,
      140,
    );
    totals = calculateTotalsFromMeals(adjustedMeals);
  }

  if (typeof targets.potassiumMgMax === 'number' && totals.potassiumMg > targets.potassiumMgMax) {
    const potassiumScale = clamp(targets.potassiumMgMax / Math.max(totals.potassiumMg, 1), 0.55, 0.9);
    adjustedMeals = scaleMealSlots(
      adjustedMeals,
      (_meal, slot) =>
        Boolean(slot.item?.nutrientProfile) &&
        ((slot.item?.nutrientProfile?.potassiumMgPer100 ?? 0) > 140 ||
          slot.slotName.toLowerCase().includes('protein') ||
          slot.slotName.toLowerCase().includes('vegetable')),
      potassiumScale,
      25,
      180,
    );
    totals = calculateTotalsFromMeals(adjustedMeals);
  }

  if (typeof targets.phosphorusMgMax === 'number' && totals.phosphorusMg > targets.phosphorusMgMax) {
    const phosphorusScale = clamp(targets.phosphorusMgMax / Math.max(totals.phosphorusMg, 1), 0.5, 0.88);
    adjustedMeals = scaleMealSlots(
      adjustedMeals,
      (_meal, slot) =>
        Boolean(slot.item?.nutrientProfile) &&
        ((slot.item?.nutrientProfile?.phosphorusMgPer100 ?? 0) > 90 ||
          slot.slotName.toLowerCase().includes('protein')),
      phosphorusScale,
      20,
      150,
    );
    totals = calculateTotalsFromMeals(adjustedMeals);
  }

  if (totals.caloriesKcal < targets.caloriesKcal * 0.92) {
    const calorieScale = clamp(targets.caloriesKcal / Math.max(totals.caloriesKcal, 1), 1.05, 1.45);
    adjustedMeals = scaleMealSlots(
      adjustedMeals,
      (_meal, slot) => {
        const label = slot.slotName.toLowerCase();
        return label.includes('starch') || label.includes('carbohydrate') || label.includes('fruit') || label.includes('snack');
      },
      calorieScale,
      60,
      340,
    );
    totals = calculateTotalsFromMeals(adjustedMeals);
  }

  if (totals.caloriesKcal > targets.caloriesKcal * 1.08) {
    const calorieDownScale = clamp(targets.caloriesKcal / Math.max(totals.caloriesKcal, 1), 0.75, 0.98);
    adjustedMeals = scaleMealSlots(
      adjustedMeals,
      (_meal, slot) => !slot.slotName.toLowerCase().includes('protein'),
      calorieDownScale,
      40,
      300,
    );
    totals = calculateTotalsFromMeals(adjustedMeals);
  }

  if (totals.proteinG < targets.proteinG * 0.85) {
    const proteinUpScale = clamp(targets.proteinG / Math.max(totals.proteinG, 1), 1.05, 1.25);
    adjustedMeals = scaleMealSlots(
      adjustedMeals,
      (_meal, slot) => slot.slotName.toLowerCase().includes('protein'),
      proteinUpScale,
      30,
      160,
    );
  }

  return adjustedMeals;
}

function resolveSlotSelection(
  slot: SlotBlueprint,
  mealType: MealType,
  dayIndex: number,
  slotIndex: number,
  mealCalories: number,
  targets: ClinicalTargets,
  diagnosis: string,
  context: SelectionContext,
  mealCount: number,
): { item: SlotItem | null; alternatives: SlotItem[]; status: MealSlot['status']; substitutionNote?: string } {
  const ranked = rankCandidates(slot, mealType, dayIndex, slotIndex, context);
  const selected = ranked[0];

  if (!selected) {
    return {
      item: null,
      alternatives: [],
      status: 'EMPTY',
      substitutionNote: 'No matching SQL candidate met the active therapeutic filters.',
    };
  }

  const preferredAlternatives = ranked
    .slice(1)
    .filter((candidate) => candidate.foodKey !== selected.foodKey && !context.currentDayFoodKeys.has(candidate.foodKey))
    .slice(0, 2);
  const alternatives = (preferredAlternatives.length > 0 ? preferredAlternatives : ranked.slice(1))
    .filter((candidate, index, all) => all.findIndex((entry) => entry.foodKey === candidate.foodKey) === index)
    .slice(0, 2)
    .map((candidate) => buildSlotItemFromRecord(candidate.record, slot, mealCalories, targets, diagnosis, mealCount));

  registerSelectedRecord(context, mealType, slot.slotName, selected.foodKey);

  return {
    item: buildSlotItemFromRecord(selected.record, slot, mealCalories, targets, diagnosis, mealCount),
    alternatives,
    status: selected.source === 'primary' ? 'FILLED' : 'SUBSTITUTED',
    substitutionNote:
      selected.source === 'fallback'
        ? 'Expanded clinical keyword search used to preserve therapeutic coverage.'
        : alternatives.length > 0
          ? 'Condition-aligned alternatives are available for stock rotation or patient preference.'
          : undefined,
  };
}

function buildMeal(
  mealType: MealType,
  slots: SlotBlueprint[],
  dayIndex: number,
  targets: ClinicalTargets,
  diagnosis: string,
  mealRatios: Record<MealType, number>,
  context: SelectionContext,
  mealCount: number,
): MealPlan {
  const mealCalories = targets.caloriesKcal * (mealRatios[mealType] || 0.15);
  const mealSlots: MealSlot[] = slots.map((slot, slotIndex) => {
    const selection = resolveSlotSelection(slot, mealType, dayIndex, slotIndex, mealCalories, targets, diagnosis, context, mealCount);

    return {
      slotName: slot.slotName,
      item: selection.item,
      status: selection.status,
      alternatives: selection.alternatives,
      substitutionNote: selection.substitutionNote,
    };
  });

  return {
    mealType,
    dietaryLabel: parseDiagnosisLabel(diagnosis),
    scheduledTime: SIX_NODE_TIMES[mealType],
    slots: mealSlots,
  };
}

function buildMealRatios(mealCount: number): Record<MealType, number> {
  const defaults: Record<MealType, number> = {
    Breakfast: 0.2,
    'Snack AM': 0.1,
    Lunch: 0.25,
    'Snack PM': 0.1,
    Dinner: 0.25,
    'Snack Eve': 0.1,
  };

  if (mealCount <= 3) {
    return { Breakfast: 0.3, Lunch: 0.35, Dinner: 0.35, 'Snack AM': 0, 'Snack PM': 0, 'Snack Eve': 0 };
  }

  if (mealCount === 4) {
    return { Breakfast: 0.25, Lunch: 0.3, Dinner: 0.3, 'Snack AM': 0.15, 'Snack PM': 0, 'Snack Eve': 0 };
  }

  if (mealCount === 5) {
    return { Breakfast: 0.22, Lunch: 0.27, Dinner: 0.27, 'Snack AM': 0.12, 'Snack PM': 0.12, 'Snack Eve': 0 };
  }

  return defaults;
}

function buildDayPlan(dayName: string, meals: MealPlan[], targets: ClinicalTargets): DayPlan {
  const balancedMeals = rebalanceMeals(meals, targets);
  return {
    dayName,
    meals: balancedMeals,
    dailyTargets: { ...targets },
    totals: calculateTotalsFromMeals(balancedMeals),
  };
}

export function generateLocalWeeklyPlan(profile: LocalPlannerProfile): WeeklyTherapeuticPlan {
  const { targets, carePath } = deriveTargets(profile);
  const mealBlueprints = buildMealBlueprints(profile);
  const mealRatios = buildMealRatios(profile.mealCount);
  const selectionContext: SelectionContext = {
    usageByFoodKey: new Map(),
    recentBySlotKey: new Map(),
    currentDayFoodKeys: new Set(),
    previousDayFoodKeys: new Set(),
  };

  const days = DAYS.map((dayName, dayIndex) => {
    selectionContext.currentDayFoodKeys = new Set();
    const meals = mealBlueprints.map((blueprint) =>
      buildMeal(blueprint.mealType, blueprint.slots, dayIndex, targets, profile.diagnosis, mealRatios, selectionContext, profile.mealCount),
    );
    selectionContext.previousDayFoodKeys = new Set(selectionContext.currentDayFoodKeys);
    return buildDayPlan(dayName, meals, targets);
  });

  const preliminaryPlan: WeeklyTherapeuticPlan = {
    diagnosis: parseDiagnosisLabel(profile.diagnosis),
    clinicalAlignmentScore: 0,
    constraints: {
      exclude: buildDiagnosisExclusions(profile),
      prioritize: ['Deterministic SQL candidate filters', 'Local normalization formula', 'Six-node timing schedule'],
      textureLevel: profile.textureLevel,
      nutrientTargets: `${targets.caloriesKcal} kcal/day; protein target ${targets.proteinG} g/day; sodium <= ${targets.sodiumMgMax} mg/day`,
    },
    days,
    standards: DEFAULT_STANDARDS,
    notes: [
      `Care path: ${carePath.label} (${carePath.energyKcalPerKg} kcal/kg; protein ${carePath.proteinMinGPerKg}-${carePath.proteinMaxGPerKg} g/kg).`,
      'Meal construction is driven by local SQLite joins over FOOD_DES, NUT_DATA, and WEIGHT.',
      'Normalization formula active: (nutrient_per_100g * edible_gram_weight) / 100.',
      'Weekly rotation memory penalizes repeated slot selections and exposes condition-aligned alternatives.',
      'Flat-file ETL dependency enforced; plan generation fails closed if local USDA files are absent.',
    ],
    rationale: `${carePath.label}: ${LOCAL_PROTOCOL_RATIONALE[profile.diagnosis] || 'Deterministic local therapeutic plan generated from SQL-backed nutrient rows.'}`,
    preparedBy: 'Standalone Local Clinical Engine',
    updatedDate: new Date().toISOString().slice(0, 10),
    carePathLabel: carePath.label,
    engineMode: 'OFFLINE_INTERNAL_API',
    compoundDietCodes: [profile.diagnosis, carePath.code, profile.textureLevel.toUpperCase()],
    mealTimingSchedule: mealBlueprints.map((blueprint) => SIX_NODE_TIMES[blueprint.mealType]),
  };

  const validationReport = validateWeeklyPlan(preliminaryPlan);
  return {
    ...preliminaryPlan,
    clinicalAlignmentScore: calculateAlignmentScore(validationReport),
    validationReport,
  };
}
