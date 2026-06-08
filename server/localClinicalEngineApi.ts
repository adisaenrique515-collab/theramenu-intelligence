import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MealPlan, NutritionPrescription, WeeklyTherapeuticPlan } from '../types.ts';
import { getLocalNutritionDbStatus } from './localNutritionDb.ts';
import { generateLocalWeeklyPlan, type LocalPlannerProfile } from './localMealPlanner.ts';
import {
  calculateProteinTarget,
  classifyCkd,
  ESPEN_SNACK_TIMING,
  generatePotassiumAlert,
  getSodiumTarget,
  recommendDietCodes,
} from './therapeuticEngineConcepts.ts';

type RiskBand = 'low' | 'moderate' | 'high';
type MealType = MealPlan['mealType'];

interface GenerateLocalPlanRequest {
  diagnosis: string;
  patientDetails?: string;
  patientData: Record<string, any>;
}

let lastNutritionPrescriptionDebug: NutritionPrescription | null = null;

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIABETIC_DIAGNOSIS = 'DIABETIC';
const diabetesConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'resources', 'clinical', 'diabetes-logic-config.json'), 'utf8'),
) as {
  sodiumAlertMg: number;
  fiberDensityPer1000Kcal: number;
  plateMethod: string[];
  nutritionalBehaviors: {
    encourage: string[];
    sodiumReplacementBase: string[];
  };
  medicationAdjustmentRules: Record<string, string>;
  riskScore: Record<string, number>;
};
const phosphorusGuideSeed = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'resources', 'clinical', 'phosphorus-guide-seed.json'), 'utf8'),
) as {
  rules: {
    dailyAllowanceMg: { min: number; max: number };
    lowPhosphorusPerServingMgMax: number;
    mediumPhosphorusPerServingMgMax: number;
    highPhosphorusPerServingMgMin: number;
    ingredientLabelWarnings: string[];
    highPhosphorusFoodGroups: string[];
    lowerPhosphorusFoodGroups: string[];
    careNotes: string[];
  };
};
const brandedSeed = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'resources', 'usda-branded', 'bfpd-clinical-seed.json'), 'utf8'),
) as {
  dataset: {
    products: number;
    productsWithPhosphateAdditives: number;
  };
  ingredientLabelWarnings: string[];
};

function parseNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function includesDistressKeyword(text: string): boolean {
  return ['shame', 'guilt', 'overwhelmed'].some((keyword) => text.toLowerCase().includes(keyword));
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

function resolveCarePath(riskLevel: RiskBand): NutritionPrescription['carePath'] {
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

function hasCkdRestrictions(profile: LocalPlannerProfile): boolean {
  const ckd = classifyCkd(profile.eGfr ?? 90, profile.acrMgG ?? 10);
  return ['G3a', 'G3b', 'G4', 'G5'].includes(ckd.gfrCategory) || ['A2', 'A3'].includes(ckd.acrCategory) || isRenalDiagnosis(profile.diagnosis);
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

function buildHardExclusions(profile: LocalPlannerProfile): string[] {
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

function termsFromPhosphorusGroups(groups: string[]): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group.toLowerCase().split(/[^a-z0-9]+/))
        .filter((term) => term.length >= 3 && !['with', 'without', 'fresh', 'light', 'colored', 'dairy'].includes(term)),
    ),
  );
}

function avoidTermsFromPhosphorusGroups(groups: string[]): string[] {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group.toLowerCase().split(/[^a-z0-9]+/))
        .filter((term) => term.length >= 4 && !['whole', 'products', 'drinks'].includes(term)),
    ),
  );
}

function mergeUniqueTerms(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group || []).map((term) => term.trim()).filter(Boolean)));
}

function calculateFastingRisk(patientData: Record<string, any>) {
  const riskScoreConfig = diabetesConfig.riskScore as Record<string, number>;
  let score = 0;
  const factors: string[] = [];

  const addFactor = (condition: boolean, points: number, label: string) => {
    if (condition) {
      score += points;
      factors.push(`${label} (+${points})`);
    }
  };

  addFactor(Boolean(patientData.pregnant), riskScoreConfig.pregnancyWithAnyDiabetes, 'Pregnancy with diabetes');
  addFactor(patientData.diabetesType === 'type1', riskScoreConfig.type1Diabetes, 'Type 1 diabetes');
  addFactor(parseNumber(patientData.yearsSinceDiagnosis) > 20, riskScoreConfig.durationOver20Years, 'Diabetes duration >20 years');
  addFactor(parseNumber(patientData.yearsSinceDiagnosis) >= 10 && parseNumber(patientData.yearsSinceDiagnosis) <= 20, riskScoreConfig.duration10To20Years, 'Diabetes duration 10-20 years');
  addFactor(Boolean(patientData.multipleDailyInsulin), riskScoreConfig.multipleDailyInsulin, 'Multiple daily insulin');
  addFactor(Boolean(patientData.basalInsulin), riskScoreConfig.basalInsulin, 'Basal insulin');
  addFactor(Boolean(patientData.modernSulfonylurea), riskScoreConfig.modernSulfonylurea, 'Modern sulfonylurea');
  addFactor(Boolean(patientData.hypoglycemiaAwarenessImpaired), riskScoreConfig.impairedHypoglycemiaAwareness, 'Impaired hypoglycemia awareness');
  addFactor(Boolean(patientData.severeHypoglycemiaLast4Weeks), riskScoreConfig.severeHypoglycemiaLast4Weeks, 'Severe hypoglycemia in last 4 weeks');
  addFactor(parseNumber(patientData.a1cPercent) > 9, riskScoreConfig.a1cAbove9, 'A1C > 9%');
  addFactor(parseNumber(patientData.a1cPercent) >= 7.5 && parseNumber(patientData.a1cPercent) <= 9, riskScoreConfig.a1cBetween7_5And9, 'A1C 7.5-9%');
  addFactor(!patientData.usesCgm && !patientData.selfMonitoring, riskScoreConfig.noMonitoring, 'No glucose monitoring');
  if (Boolean(patientData.usesCgm)) {
    score += riskScoreConfig.cgmCredit;
    factors.push(`CGM in use (${riskScoreConfig.cgmCredit})`);
  }
  addFactor(Boolean(patientData.recentDkaOrHhs), riskScoreConfig.recentDkaOrHhs, 'Recent DKA/HHS');
  addFactor(patientData.macrovascularStatus === 'unstable', riskScoreConfig.unstableMacrovascularDisease, 'Unstable macrovascular disease');
  addFactor(patientData.macrovascularStatus === 'stable', riskScoreConfig.stableMacrovascularDisease, 'Stable macrovascular disease');
  addFactor(patientData.egfrBand === 'lt30', riskScoreConfig.egfrBelow30, 'eGFR < 30');
  addFactor(patientData.egfrBand === '30to45', riskScoreConfig.egfr30To45, 'eGFR 30-45');
  addFactor(Boolean(patientData.neuropathy), riskScoreConfig.neuropathy, 'Neuropathy');
  addFactor(Boolean(patientData.footComplications), riskScoreConfig.footComplications, 'Foot complications');
  addFactor(Boolean(patientData.retinopathy), riskScoreConfig.retinopathy, 'Retinopathy');
  addFactor(Boolean(patientData.cognitiveImpairment), riskScoreConfig.cognitiveImpairment, 'Cognitive impairment');
  addFactor(parseNumber(patientData.age) > 70 && !patientData.hasHomeSupport, riskScoreConfig.ageOver70WithoutSupport, 'Age >70 without support');
  addFactor(patientData.physicalLabor === 'high', riskScoreConfig.highPhysicalLabor, 'High-intensity physical labor');
  addFactor(patientData.physicalLabor === 'moderate', riskScoreConfig.moderatePhysicalLabor, 'Moderate physical labor');
  addFactor(!patientData.fastingEducation, riskScoreConfig.noFastingEducation, 'No fasting-focused education');
  addFactor(parseNumber(patientData.fastingHours) >= 16, riskScoreConfig.fastingAtLeast16Hours, 'Fasting >=16 hours');

  const level: RiskBand = score > 6 ? 'high' : score >= 3.5 ? 'moderate' : 'low';
  return { score: Number(score.toFixed(1)), level, factors };
}

function buildDiabetesSafetyBundle(plan: WeeklyTherapeuticPlan, patientData: Record<string, any>, patientDetails: string) {
  const safetyAlerts: string[] = [];
  const supplementFlags: string[] = [];
  const referralFlags: string[] = [];
  const activityFlags: string[] = [];
  const treatmentAdjustments: string[] = [];

  const totalCalories = plan.days[0]?.dailyTargets?.caloriesKcal || 0;
  const totalFiber = plan.days[0]?.totals?.fiberG || 0;
  const fiberTarget = Math.round((totalCalories / 1000) * diabetesConfig.fiberDensityPer1000Kcal);

  if (plan.days.some((day) => day.totals.sodiumMg > diabetesConfig.sodiumAlertMg)) {
    safetyAlerts.push(`Daily sodium exceeds ${diabetesConfig.sodiumAlertMg} mg/day threshold.`);
  }

  if (totalFiber < fiberTarget) {
    safetyAlerts.push(`Daily fiber density is below ${diabetesConfig.fiberDensityPer1000Kcal} g per 1000 kcal target.`);
  }

  if (Boolean(patientData.sglt2Inhibitor) && patientData.eatingPattern === 'ketogenic') {
    safetyAlerts.push('Ketogenic eating pattern blocked because SGLT2 inhibitor use raises euglycemic DKA risk.');
  }

  if (Boolean(patientData.sglt2Inhibitor) && parseNumber(patientData.fastingHours) > 0) {
    safetyAlerts.push('Prompt beta-hydroxybutyrate monitoring during fasting because SGLT2 inhibitor is active.');
  }

  if (Boolean(patientData.alcoholUse) && (patientData.basalInsulin || patientData.prandialInsulin || patientData.olderSulfonylurea || patientData.modernSulfonylurea || patientData.insulinSecretagogue)) {
    safetyAlerts.push('Delayed hypoglycemia alert: alcohol logged while insulin or secretagogue therapy is active.');
  }

  if (Boolean(patientData.magnesiumSupplement)) supplementFlags.push('Magnesium flagged: not recommended for glycemic benefit.');
  if (Boolean(patientData.chromiumSupplement)) supplementFlags.push('Chromium flagged: not recommended for glycemic benefit.');
  if (Boolean(patientData.cinnamonSupplement)) supplementFlags.push('Cinnamon flagged: not recommended for glycemic benefit.');
  if (Boolean(patientData.aloeSupplement)) supplementFlags.push('Aloe vera flagged: not recommended for glycemic benefit.');
  if (Boolean(patientData.betaCaroteneSupplement)) supplementFlags.push('Beta-carotene flagged: lack of benefit and potential harm.');

  if (Boolean(patientData.olderSulfonylurea)) {
    treatmentAdjustments.push(diabetesConfig.medicationAdjustmentRules.olderSulfonylurea);
  }
  if (Boolean(patientData.basalInsulin)) {
    treatmentAdjustments.push(diabetesConfig.medicationAdjustmentRules.basalInsulin);
  }
  if (Boolean(patientData.prandialInsulin)) {
    treatmentAdjustments.push(diabetesConfig.medicationAdjustmentRules.prandialInsulin);
  }
  if (Boolean(patientData.sglt2Inhibitor) || Boolean(patientData.metformin)) {
    treatmentAdjustments.push(diabetesConfig.medicationAdjustmentRules.sglt2OrMetformin);
  }

  if (Boolean(patientData.intentionalUnderdosing)) referralFlags.push('Behavioral referral: intentional omission or underdosing of insulin/medication for weight loss.');
  if (Boolean(patientData.repeatedDkaHospitalizations)) referralFlags.push('Behavioral referral: repeated DKA hospitalizations logged.');
  if (Boolean(patientData.suicidalityPositive)) referralFlags.push('Behavioral referral: suicidality screen positive.');
  if (includesDistressKeyword(patientDetails)) referralFlags.push('Behavioral referral: distress language detected (shame/guilt/overwhelmed).');

  if (Boolean(patientData.neuropathy)) {
    activityFlags.push('Daily foot exam prompt active because peripheral neuropathy is present.');
  }
  if (Boolean(patientData.footInjuryLogged)) {
    activityFlags.push('Weight-bearing activity restricted; allow swimming or cycling only until foot injury resolves.');
  }
  if (Boolean(patientData.proliferativeRetinopathy)) {
    activityFlags.push('Vigorous aerobic and resistance exercise contraindicated because proliferative retinopathy is present.');
  }
  activityFlags.push('Sedentary interrupt alert active every 30 minutes.');
  activityFlags.push('Adult movement prescription: at least 150 minutes per week over at least 3 days.');

  return {
    risk: calculateFastingRisk(patientData),
    safetyAlerts,
    supplementFlags,
    referralFlags,
    activityFlags,
    treatmentAdjustments,
    fiberTarget,
  };
}

function buildPlannerProfile(request: GenerateLocalPlanRequest): LocalPlannerProfile {
  const patientData = request.patientData || {};
  return {
    diagnosis: request.diagnosis || 'CARDIAC',
    age: parseNumber(patientData.age, 45),
    sex: patientData.sex === 'female' ? 'female' : 'male',
    weightKg: parseNumber(patientData.weightKg, 75),
    heightCm: parseNumber(patientData.heightCm, 175),
    eGfr: parseNumber(patientData.eGfr, 90),
    acrMgG: parseNumber(patientData.acrMgG, 10),
    potassiumMmolL: parseNumber(patientData.potassiumMmolL, 4.5),
    hypertension: Boolean(patientData.hypertension),
    heartFailure: Boolean(patientData.heartFailure),
    onDialysis: Boolean(patientData.onDialysis),
    malnourished: Boolean(patientData.malnourished),
    goal: String(patientData.goal || 'maintenance'),
    mealCount: patientData.mealCount || 6,
    textureLevel: patientData.textureLevel || 'regular',
    riskLevel: patientData.riskLevel || 'low',
    egfrBand: patientData.egfrBand || 'gte45',
  };
}

function buildPrescriptionId(profile: LocalPlannerProfile): string {
  const seed = [
    profile.diagnosis,
    profile.age,
    profile.sex,
    profile.weightKg,
    profile.heightCm,
    profile.mealCount,
    profile.textureLevel,
    profile.riskLevel,
    profile.eGfr ?? '',
    profile.acrMgG ?? '',
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `NP-${hash.toString(16).toUpperCase().padStart(8, '0')}`;
}

export function buildNutritionPrescription(
  request: GenerateLocalPlanRequest,
  profile: LocalPlannerProfile,
): NutritionPrescription {
  const ckdAssessment = classifyCkd(profile.eGfr ?? 90, profile.acrMgG ?? 10);
  const carePath = resolveCarePath(profile.riskLevel);
  const baseEnergy = Math.max(1200, Math.round(profile.weightKg * carePath.energyKcalPerKg));
  const proteinMidpoint = (carePath.proteinMinGPerKg + carePath.proteinMaxGPerKg) / 2;
  const proteinPrescription = calculateProteinTarget(
    profile.weightKg,
    ckdAssessment.gfrCategory,
    Boolean(profile.onDialysis),
    Boolean(profile.malnourished),
  );
  const sodiumPrescription = getSodiumTarget(Boolean(profile.heartFailure), Boolean(profile.hypertension));
  const potassiumAlert = generatePotassiumAlert(profile.potassiumMmolL ?? 0);
  const recommendedDiets = recommendDietCodes({
    ckd: ckdAssessment,
    diabetes: request.diagnosis === DIABETIC_DIAGNOSIS,
    hypertension: Boolean(profile.hypertension),
    malnourished: Boolean(profile.malnourished),
    onDialysis: Boolean(profile.onDialysis),
  });

  let proteinTarget = Math.round(
    ['G3a', 'G3b', 'G4', 'G5'].includes(ckdAssessment.gfrCategory) || profile.onDialysis || profile.malnourished
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
    fiberMin = Math.max(25, Math.ceil((baseEnergy / 1000) * diabetesConfig.fiberDensityPer1000Kcal));
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

  const renal = hasCkdRestrictions(profile);
  const diabetes = isDiabetesDiagnosis(profile.diagnosis);
  const cardiac = isCardiacDiagnosis(profile.diagnosis);
  const dysphagia = isDysphagiaDiagnosis(profile.diagnosis);
  const hepatic = isHepaticDiagnosis(profile.diagnosis);
  const gastricSensitive = isGastricSensitiveDiagnosis(profile.diagnosis);
  const postOp = isPostOpDiagnosis(profile.diagnosis);
  const oncology = isOncologyDiagnosis(profile.diagnosis);
  const recoveryFocused = oncology || postOp || Boolean(profile.malnourished);
  const gentleGi = gastricSensitive || postOp;
  const preferredTerms = mergeUniqueTerms(
    renal ? termsFromPhosphorusGroups(phosphorusGuideSeed.rules.lowerPhosphorusFoodGroups) : undefined,
    cardiac ? ['fresh', 'unsalted', 'baked', 'steamed'] : undefined,
    hepatic ? ['plain', 'baked', 'poached', 'steamed'] : undefined,
    gentleGi ? ['plain', 'soft', 'cooked', 'mashed', 'stewed'] : undefined,
    recoveryFocused ? ['fortified', 'high protein', 'soft'] : undefined,
  );
  const avoidTerms = mergeUniqueTerms(
    renal ? avoidTermsFromPhosphorusGroups(phosphorusGuideSeed.rules.highPhosphorusFoodGroups) : undefined,
    cardiac ? ['fried', 'cured', 'smoked', 'sausage', 'bacon', 'gravy'] : undefined,
    hepatic ? ['fried', 'cured', 'sausage', 'bacon'] : undefined,
    gentleGi ? ['fried', 'spicy', 'pickled', 'pepper', 'acidic'] : undefined,
  );
  const textureMaxRefuse = dysphagia ? 5 : renal ? 12 : gentleGi ? 14 : 20;
  const carbsG = Math.round((baseEnergy * 0.5) / 4);
  const fatG = Math.round((baseEnergy * 0.3) / 9);

  return {
    prescriptionId: buildPrescriptionId(profile),
    generatedAt: new Date().toISOString(),
    phase: 'shadow',
    patient: {
      diagnosis: profile.diagnosis,
      age: profile.age,
      sex: profile.sex,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      goal: profile.goal,
      mealCount: profile.mealCount,
      textureLevel: profile.textureLevel,
      riskLevel: profile.riskLevel,
      eGfr: profile.eGfr,
      acrMgG: profile.acrMgG,
      potassiumMmolL: profile.potassiumMmolL,
      hypertension: profile.hypertension,
      heartFailure: profile.heartFailure,
      onDialysis: profile.onDialysis,
      malnourished: profile.malnourished,
      egfrBand: profile.egfrBand,
    },
    carePath,
    targets: {
      method: 'existing_local_formula',
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
    mealPattern: {
      mealCount: profile.mealCount,
      mealRatios: buildMealRatios(profile.mealCount),
      mealTimingSchedule: [...ESPEN_SNACK_TIMING],
    },
    constraints: {
      hardExclusions: buildHardExclusions(profile),
      preferredTerms,
      avoidTerms,
      maxRefusePct: textureMaxRefuse,
      minFiberGPer100: diabetes ? 2.5 : 0,
      maxSodiumMgPer100: renal || cardiac || hepatic ? 140 : 220,
      maxPotassiumMgPer100: renal ? 180 : undefined,
      maxPhosphorusMgPer100: renal ? phosphorusGuideSeed.rules.lowPhosphorusPerServingMgMax : undefined,
      maxProteinGPer100: renal ? 12 : undefined,
      minProteinGPer100: renal ? undefined : recoveryFocused ? 8 : 4,
    },
    clinicalFlags: {
      renal,
      diabetes,
      cardiac,
      dysphagia,
      hepatic,
      gastricSensitive,
      postOp,
      oncology,
      dialysis: Boolean(profile.onDialysis),
      malnourished: Boolean(profile.malnourished),
      heartFailure: Boolean(profile.heartFailure),
      hypertension: Boolean(profile.hypertension),
    },
    safety: {
      ckdAssessment,
      proteinPrescription,
      sodiumPrescription,
      potassiumAlert,
      recommendedDiets,
      phosphorusGuide: {
        dailyAllowanceMg: phosphorusGuideSeed.rules.dailyAllowanceMg,
        ingredientLabelWarnings: phosphorusGuideSeed.rules.ingredientLabelWarnings,
        highPhosphorusFoodGroups: phosphorusGuideSeed.rules.highPhosphorusFoodGroups,
        lowerPhosphorusFoodGroups: phosphorusGuideSeed.rules.lowerPhosphorusFoodGroups,
        careNotes: phosphorusGuideSeed.rules.careNotes,
      },
      fastingRisk: request.diagnosis === DIABETIC_DIAGNOSIS ? calculateFastingRisk(request.patientData || {}) : undefined,
    },
    rationale: [
      'Shadow artifact only; not consumed by meal generation, candidate selection, validation, UI, or Supabase persistence.',
      'Targets mirror the existing local clinical engine formulas for Phase 1 drift detection.',
    ],
  };
}

export function getLastNutritionPrescriptionDebug(): NutritionPrescription | null {
  return lastNutritionPrescriptionDebug;
}

export function generateLocalTherapeuticPlan(request: GenerateLocalPlanRequest): WeeklyTherapeuticPlan {
  const patientDetails = request.patientDetails || '';
  const patientData = request.patientData || {};
  const databaseStatus = getLocalNutritionDbStatus();
  const plannerProfile = buildPlannerProfile(request);
  lastNutritionPrescriptionDebug = buildNutritionPrescription(request, plannerProfile);
  const ckdAssessment = classifyCkd(plannerProfile.eGfr ?? 90, plannerProfile.acrMgG ?? 10);
  const proteinPrescription = calculateProteinTarget(
    plannerProfile.weightKg,
    ckdAssessment.gfrCategory,
    Boolean(plannerProfile.onDialysis),
    Boolean(plannerProfile.malnourished),
  );
  const sodiumPrescription = getSodiumTarget(Boolean(plannerProfile.heartFailure), Boolean(plannerProfile.hypertension));
  const potassiumAlert = generatePotassiumAlert(plannerProfile.potassiumMmolL ?? 0);
  const recommendedDiets = recommendDietCodes({
    ckd: ckdAssessment,
    diabetes: request.diagnosis === DIABETIC_DIAGNOSIS,
    hypertension: Boolean(plannerProfile.hypertension),
    malnourished: Boolean(plannerProfile.malnourished),
    onDialysis: Boolean(plannerProfile.onDialysis),
  });

  if (!databaseStatus.databaseReady) {
    throw new Error('Nutrition DB not ready. Place FOOD_DES.txt, NUT_DATA.txt, and WEIGHT.txt in the configured local flat-file directory before generating plans.');
  }

  let plan = generateLocalWeeklyPlan(plannerProfile);

  const sharedNotes = [
    'PHI processed locally only; no external clinical API calls are performed.',
    'Internal API boundary active for deterministic local plan generation.',
    'Meal construction sourced from SQLite-backed USDA flat-file ETL, not bundled fallback foods.',
    `Nutrition database mode: ${databaseStatus.databaseReady ? 'SQLite ready' : 'SQLite unavailable'}.`,
    `ESPEN snack fractionation active at ${ESPEN_SNACK_TIMING.join(', ')}.`,
    `Recommended diet codes: ${recommendedDiets.map((diet) => diet.code).join(', ')}.`,
    `Low-phosphorus renal guide active: ${phosphorusGuideSeed.rules.dailyAllowanceMg.min}-${phosphorusGuideSeed.rules.dailyAllowanceMg.max} mg/day reference band.`,
    `Ingredient-label watchlist active: ${phosphorusGuideSeed.rules.ingredientLabelWarnings.join(', ')}.`,
    `BFPD branded label screen active across ${brandedSeed.dataset.products.toLocaleString()} products; ${brandedSeed.dataset.productsWithPhosphateAdditives.toLocaleString()} contain phosphate terms (${brandedSeed.ingredientLabelWarnings.join(', ')}).`,
    ...(potassiumAlert ? [`Potassium surveillance: ${potassiumAlert.message}`] : []),
  ];

  if (request.diagnosis === DIABETIC_DIAGNOSIS) {
    const diabetesBundle = buildDiabetesSafetyBundle(plan, patientData, patientDetails);

    return {
      ...plan,
      diagnosis: 'THERAPEUTIC DIABETES',
      rationale: `${plan.rationale} Diabetes MNT logic applied with sodium, fibre density, fasting safety, medication, and behavioral safeguards.`,
      notes: [
        ...plan.notes,
        ...sharedNotes,
        `Fasting risk score: ${diabetesBundle.risk.score} (${diabetesBundle.risk.level}).`,
        ...diabetesBundle.safetyAlerts,
        ...diabetesBundle.supplementFlags,
        ...diabetesBundle.treatmentAdjustments,
        ...diabetesBundle.activityFlags,
      ],
      localEngine: {
        phiProcessing: 'LOCAL_ONLY',
        networkDependency: 'NONE',
        databaseStatus,
      },
      therapeuticEngine: {
        snackSchedule: [...ESPEN_SNACK_TIMING],
        recommendedDiets,
        ckdAssessment,
        proteinPrescription,
        sodiumPrescription,
        phosphorusGuide: {
          dailyAllowanceMg: phosphorusGuideSeed.rules.dailyAllowanceMg,
          ingredientLabelWarnings: phosphorusGuideSeed.rules.ingredientLabelWarnings,
          highPhosphorusFoodGroups: phosphorusGuideSeed.rules.highPhosphorusFoodGroups,
          lowerPhosphorusFoodGroups: phosphorusGuideSeed.rules.lowerPhosphorusFoodGroups,
          careNotes: phosphorusGuideSeed.rules.careNotes,
        },
        potassiumAlert,
        prescribingScope: [
          'physician',
          'dentist',
          'physician_assistant',
          'nurse_practitioner',
          'registered_dietitian',
        ],
      },
      diabetesMnt: {
        sodiumLimitMg: diabetesConfig.sodiumAlertMg,
        fiberTargetG: diabetesBundle.fiberTarget,
        fiberTargetPer1000Kcal: diabetesConfig.fiberDensityPer1000Kcal,
        fastingRiskScore: diabetesBundle.risk.score,
        fastingRiskLevel: diabetesBundle.risk.level,
        fastingRiskFactors: diabetesBundle.risk.factors,
        safetyAlerts: diabetesBundle.safetyAlerts,
        supplementFlags: diabetesBundle.supplementFlags,
        treatmentAdjustments: diabetesBundle.treatmentAdjustments,
        behavioralReferralFlags: diabetesBundle.referralFlags,
        activitySafetyFlags: diabetesBundle.activityFlags,
        plateMethod: diabetesConfig.plateMethod,
        encouragedFoods: diabetesConfig.nutritionalBehaviors.encourage,
        sodiumReplacementBase: diabetesConfig.nutritionalBehaviors.sodiumReplacementBase,
      },
    };
  }

  return {
    ...plan,
    notes: [...plan.notes, ...sharedNotes],
    localEngine: {
      phiProcessing: 'LOCAL_ONLY',
      networkDependency: 'NONE',
      databaseStatus,
    },
    therapeuticEngine: {
      snackSchedule: [...ESPEN_SNACK_TIMING],
      recommendedDiets,
      ckdAssessment,
      proteinPrescription,
      sodiumPrescription,
      phosphorusGuide: {
        dailyAllowanceMg: phosphorusGuideSeed.rules.dailyAllowanceMg,
        ingredientLabelWarnings: phosphorusGuideSeed.rules.ingredientLabelWarnings,
        highPhosphorusFoodGroups: phosphorusGuideSeed.rules.highPhosphorusFoodGroups,
        lowerPhosphorusFoodGroups: phosphorusGuideSeed.rules.lowerPhosphorusFoodGroups,
        careNotes: phosphorusGuideSeed.rules.careNotes,
      },
      potassiumAlert,
      prescribingScope: [
        'physician',
        'dentist',
        'physician_assistant',
        'nurse_practitioner',
        'registered_dietitian',
      ],
    },
  };
}
