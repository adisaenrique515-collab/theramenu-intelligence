import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WeeklyTherapeuticPlan } from '../types.ts';
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

interface GenerateLocalPlanRequest {
  diagnosis: string;
  patientDetails?: string;
  patientData: Record<string, any>;
}

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

export function generateLocalTherapeuticPlan(request: GenerateLocalPlanRequest): WeeklyTherapeuticPlan {
  const patientDetails = request.patientDetails || '';
  const patientData = request.patientData || {};
  const databaseStatus = getLocalNutritionDbStatus();
  const plannerProfile = buildPlannerProfile(request);
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
