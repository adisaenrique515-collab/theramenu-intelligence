/**
 * server/clinicalProtocols.ts — Phase 4: Versioned clinical protocol records.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT CLINICAL DISCLAIMER
 * ─────────────────────────────────────────────────────────────────────────────
 * All targets in this file are CONFIGURABLE DEFAULTS derived from the cited
 * evidence references. They are NOT universal clinical truth and MUST be
 * adjusted to each patient's individual needs by a registered dietitian.
 *
 * Status: All protocols are 'draft' or 'pending_review'.
 * None may be used in production without explicit dietitian sign-off.
 * RENAL_STAGE_4 additionally requires clinician-supplied overrides for
 * dialysisStatus, urineOutput, serumPotassium, serumPhosphorus,
 * fluidRestriction, and protein targets before any plan is generated.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  VersionedClinicalProtocol,
  ClinicalTargetRule,
  EvidenceReference,
  MealSlotTemplate,
  MealTypeKey,
  FoodCategory,
  DiagnosisCode,
} from '../types-clinical.ts';

// ── Evidence references ───────────────────────────────────────────────────

/** ESPEN 2021 Practical Guideline: Clinical Nutrition in the Hospital */
const ESPEN_HOSP_2021: EvidenceReference = {
  code: 'ESPEN_HOSP_2021',
  title: 'ESPEN practical guideline: Clinical Nutrition in the Hospital',
  organization: 'ESPEN',
  year: 2021,
  url: 'https://doi.org/10.1016/j.clnu.2021.03.003',
  section: 'General recommendations – energy and protein targets',
  evidenceLevel: 'A',
};

/** ADA 2024 Standards of Medical Care in Diabetes */
const ADA_SOC_2024: EvidenceReference = {
  code: 'ADA_SOC_2024',
  title: 'Standards of Medical Care in Diabetes – 2024',
  organization: 'American Diabetes Association',
  year: 2024,
  url: 'https://doi.org/10.2337/dc24-S005',
  section: 'Section 5 – Facilitating Positive Health Behaviors: Eating Patterns',
  evidenceLevel: 'A',
};

/** ADA 2024 – macronutrient distribution for T2DM */
const ADA_MACRONUTRIENT_2024: EvidenceReference = {
  code: 'ADA_MACRONUTRIENT_2024',
  title: 'Standards of Medical Care in Diabetes – 2024: Macronutrient distribution',
  organization: 'American Diabetes Association',
  year: 2024,
  url: 'https://doi.org/10.2337/dc24-S005',
  section: 'Table 5.1 – Evidence-based eating patterns',
  evidenceLevel: 'B',
};

/** ACC/AHA 2019 Primary Prevention of Cardiovascular Disease Guideline */
const ACC_AHA_PP_2019: EvidenceReference = {
  code: 'ACC_AHA_PP_2019',
  title: '2019 ACC/AHA Guideline on the Primary Prevention of Cardiovascular Disease',
  organization: 'American College of Cardiology / American Heart Association',
  year: 2019,
  url: 'https://doi.org/10.1161/CIR.0000000000000678',
  section: 'Part 4 – Diet and Weight Management',
  evidenceLevel: 'A',
};

/** AHA 2021 Dietary Guidance for Cardiovascular Health */
const AHA_DIET_2021: EvidenceReference = {
  code: 'AHA_DIET_2021',
  title: 'Dietary Guidance to Improve Cardiovascular Health',
  organization: 'American Heart Association',
  year: 2021,
  url: 'https://doi.org/10.1161/CIR.0000000000001031',
  section: 'Core Elements 1–4 – Sodium, Saturated Fat, Dietary Patterns',
  evidenceLevel: 'A',
};

/** KDIGO 2024 CKD Evaluation and Management */
const KDIGO_CKD_2024: EvidenceReference = {
  code: 'KDIGO_CKD_2024',
  title: 'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease',
  organization: 'Kidney Disease: Improving Global Outcomes (KDIGO)',
  year: 2024,
  url: 'https://doi.org/10.1016/j.kint.2023.10.018',
  section: 'Chapter 3 – Management of Progression and Complications: Nutrition',
  evidenceLevel: 'A',
};

/** NKF KDOQI Nutrition in CKD 2020 Update */
const KDOQI_NUTRITION_2020: EvidenceReference = {
  code: 'KDOQI_NUTRITION_2020',
  title: 'KDOQI Clinical Practice Guidelines for Nutrition in CKD: 2020 Update',
  organization: 'National Kidney Foundation',
  year: 2020,
  url: 'https://doi.org/10.1053/j.ajkd.2020.05.006',
  section: 'Guideline 3 – Dietary Protein Intake; Guideline 5 – Dietary Electrolyte Intake',
  evidenceLevel: 'B',
};

/** KDIGO 2023 Diabetes Management in CKD */
const KDIGO_DM_CKD_2023: EvidenceReference = {
  code: 'KDIGO_DM_CKD_2023',
  title: 'KDIGO 2023 Clinical Practice Guideline for Diabetes Management in Chronic Kidney Disease',
  organization: 'KDIGO',
  year: 2023,
  url: 'https://doi.org/10.1016/j.kint.2023.07.010',
  section: 'Chapter 1 – Glycaemic Management; Chapter 3 – Lifestyle Interventions',
  evidenceLevel: 'A',
};

// ── Slot template builder ─────────────────────────────────────────────────

interface SlotDef {
  slotName: string;
  required: boolean;
  allowedCategories: FoodCategory[];
  forbiddenTags?: string[];
  preferredTags?: string[];
}

function buildSlots(
  mealTypes: MealTypeKey[],
  slotDefs: SlotDef[],
): MealSlotTemplate[] {
  const result: MealSlotTemplate[] = [];
  for (const mealType of mealTypes) {
    slotDefs.forEach((def, idx) => {
      result.push({
        slotName: def.slotName,
        mealType,
        required: def.required,
        minItems: def.required ? 1 : 0,
        maxItems: 1,
        slotOrder: idx + 1,
        allowedCategories: def.allowedCategories,
        forbiddenTags: def.forbiddenTags ?? [],
        preferredTags: def.preferredTags ?? [],
      });
    });
  }
  return result;
}

// ── Protocol 1: GENERAL_HOSPITAL ──────────────────────────────────────────

/**
 * General Hospital Baseline Protocol.
 *
 * Targets derived from ESPEN 2021 Hospital Nutrition guidelines.
 * status: 'pending_review' — suitable as a conservative baseline for
 * patients without a specific therapeutic diagnosis; still requires
 * dietitian assessment before individual assignment.
 */
export const PROTOCOL_GENERAL_HOSPITAL: VersionedClinicalProtocol = {
  diagnosisCode: 'GENERAL_HOSPITAL',
  version: '1.0.0',
  status: 'pending_review',

  applicability: {
    ageRange: { min: 18, max: 120 },
    excludeIf: [
      'active_ICU_level_1',
      'paediatric',
      'pregnancy',
      'severe_malnutrition_acute_phase',
    ],
  },

  targets: {
    // ESPEN 2021: 25–30 kcal/kg/day for non-critically ill inpatients
    energy: {
      type: 'per_kg',
      multiplier: 27.5,   // midpoint of 25–30; adjustable per activity/stress
      unit: 'kcal/day',
      min: 1400,
      max: 2500,
    } satisfies ClinicalTargetRule,

    // ESPEN 2021: 1.0–1.5 g protein/kg/day; adjust upward for stress/wounds
    protein: {
      type: 'per_kg',
      multiplier: 1.0,
      unit: 'g/day',
      min: 0.8,
      max: 1.5,
    } satisfies ClinicalTargetRule,

    // Standard macronutrient distribution for hospitalised adults
    carbsPercent: {
      type: 'range',
      min: 45,
      max: 55,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    fatPercent: {
      type: 'range',
      min: 25,
      max: 35,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    // WHO/ESPEN general hospital fiber recommendation
    fiber: {
      type: 'fixed',
      value: 25,
      unit: 'g/day (minimum)',
    } satisfies ClinicalTargetRule,

    // General hospital sodium: 2000 mg/day (less restrictive without CVD/renal)
    sodium: {
      type: 'fixed',
      value: 2000,
      unit: 'mg/day (maximum)',
    } satisfies ClinicalTargetRule,

    // ESPEN 2021: 30 ml/kg/day hydration target
    fluid: {
      type: 'per_kg',
      multiplier: 30,
      unit: 'ml/day',
      min: 1500,
      max: 3000,
    } satisfies ClinicalTargetRule,
  },

  forbiddenTags: [],
  requiredTags: [],

  slotTemplates: buildSlots(
    ['Breakfast', 'Lunch', 'Dinner'],
    [
      { slotName: 'starch_base',          required: true,  allowedCategories: ['grain', 'starch'],            preferredTags: ['whole_grain'] },
      { slotName: 'protein_primary',      required: true,  allowedCategories: ['protein', 'legume'],          preferredTags: ['lean_protein'] },
      { slotName: 'veg_or_fruit_optional',required: false, allowedCategories: ['vegetable', 'fruit'],         preferredTags: ['non_starchy_veg'] },
      { slotName: 'beverage',             required: true,  allowedCategories: ['beverage', 'broth'],          forbiddenTags: ['high_sugar'] },
    ],
  ),

  evidenceReferences: [ESPEN_HOSP_2021],
  reviewDueAt: '2027-01-01',
};

// ── Protocol 2: T2DM ──────────────────────────────────────────────────────

/**
 * Type 2 Diabetes Mellitus Glycaemic Control Protocol.
 *
 * Targets derived from ADA 2024 Standards of Medical Care in Diabetes.
 * status: 'draft' — requires individual glycaemic target review by dietitian,
 * especially carbohydrate distribution across meals.
 */
export const PROTOCOL_T2DM: VersionedClinicalProtocol = {
  diagnosisCode: 'T2DM',
  version: '1.0.0',
  status: 'draft',

  applicability: {
    ageRange: { min: 18, max: 120 },
    excludeIf: ['type_1_diabetes', 'gestational_diabetes', 'paediatric_diabetes'],
  },

  targets: {
    // ADA 2024: 25–30 kcal/kg/day; adjust for weight management goals
    energy: {
      type: 'per_kg',
      multiplier: 27.5,
      unit: 'kcal/day',
      min: 1200,
      max: 2400,
    } satisfies ClinicalTargetRule,

    // ADA 2024: 1.0–1.5 g/kg/day; higher end for older adults with sarcopenia risk
    protein: {
      type: 'per_kg',
      multiplier: 1.0,
      unit: 'g/day',
      min: 0.8,
      max: 1.5,
    } satisfies ClinicalTargetRule,

    // ADA 2024: reduced carbohydrate; 35–45% of energy; distributed across meals
    // Note: very-low-carb (<26%) patterns require individual dietitian assessment
    carbsPercent: {
      type: 'range',
      min: 35,
      max: 45,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    fatPercent: {
      type: 'range',
      min: 30,
      max: 35,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    // ADA 2024: ≥30 g/day; prefer viscous/soluble fibre (oats, legumes)
    fiber: {
      type: 'fixed',
      value: 30,
      unit: 'g/day (minimum)',
    } satisfies ClinicalTargetRule,

    // ADA 2024 / AHA 2021: ≤1800 mg/day for those with comorbid hypertension risk
    sodium: {
      type: 'fixed',
      value: 1800,
      unit: 'mg/day (maximum)',
    } satisfies ClinicalTargetRule,

    // ADA 2024: limit added sugars; <25 g/day
    sugar: {
      type: 'fixed',
      value: 25,
      unit: 'g/day (maximum added sugars)',
    } satisfies ClinicalTargetRule,

    // ADA 2024: prefer low-GI foods; GI target ≤55
    glycaemicIndex: {
      type: 'fixed',
      value: 55,
      unit: 'GI units (maximum preferred)',
    } satisfies ClinicalTargetRule,

    // ADA 2024: 30 ml/kg/day; no restriction unless renal complication present
    fluid: {
      type: 'per_kg',
      multiplier: 30,
      unit: 'ml/day',
      min: 1500,
      max: 3000,
    } satisfies ClinicalTargetRule,
  },

  forbiddenTags: ['refined_sugar', 'high_gi'],
  requiredTags: ['low_gi'],

  slotTemplates: buildSlots(
    ['Breakfast', 'Lunch', 'Dinner'],
    [
      { slotName: 'controlled_carb_base', required: true,  allowedCategories: ['grain', 'starch', 'legume'], preferredTags: ['low_gi', 'whole_grain', 'high_fiber'], forbiddenTags: ['refined_sugar', 'high_gi'] },
      { slotName: 'protein_primary',      required: true,  allowedCategories: ['protein', 'legume'],         preferredTags: ['lean_protein', 'plant_protein'] },
      { slotName: 'fiber_side_optional',  required: false, allowedCategories: ['vegetable', 'legume'],       preferredTags: ['high_fiber', 'non_starchy_veg'] },
      { slotName: 'beverage',             required: true,  allowedCategories: ['beverage', 'broth'],         forbiddenTags: ['high_sugar', 'refined_sugar'] },
    ],
  ),

  evidenceReferences: [ADA_SOC_2024, ADA_MACRONUTRIENT_2024],
  reviewDueAt: '2027-01-01',
};

// ── Protocol 3: CARDIAC ───────────────────────────────────────────────────

/**
 * Cardiac Protection Protocol.
 *
 * Targets derived from ACC/AHA 2019 Primary Prevention Guideline
 * and AHA 2021 Dietary Guidance for Cardiovascular Health.
 * status: 'draft' — sodium and saturated fat limits may require individual
 * adjustment based on lipid profile, blood pressure, and medication regimen.
 */
export const PROTOCOL_CARDIAC: VersionedClinicalProtocol = {
  diagnosisCode: 'CARDIAC',
  version: '1.0.0',
  status: 'draft',

  applicability: {
    ageRange: { min: 18, max: 120 },
    excludeIf: ['acute_myocardial_infarction_48h', 'decompensated_heart_failure', 'paediatric'],
  },

  targets: {
    // ACC/AHA 2019: 25–30 kcal/kg/day; caloric restriction if overweight
    energy: {
      type: 'per_kg',
      multiplier: 27.5,
      unit: 'kcal/day',
      min: 1400,
      max: 2400,
    } satisfies ClinicalTargetRule,

    // ACC/AHA 2019: 1.0–1.5 g/kg/day protein
    protein: {
      type: 'per_kg',
      multiplier: 1.0,
      unit: 'g/day',
      min: 0.8,
      max: 1.5,
    } satisfies ClinicalTargetRule,

    carbsPercent: {
      type: 'range',
      min: 40,
      max: 50,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    fatPercent: {
      type: 'range',
      min: 28,
      max: 33,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    // AHA 2021: <7% of total energy as saturated fat; at 2000 kcal ≈ 15.5 g
    saturatedFat: {
      type: 'fixed',
      value: 15,
      unit: 'g/day (maximum, configurable with total caloric intake)',
    } satisfies ClinicalTargetRule,

    // AHA 2021: <200 mg cholesterol/day for those with dyslipidaemia
    cholesterol: {
      type: 'fixed',
      value: 200,
      unit: 'mg/day (maximum)',
    } satisfies ClinicalTargetRule,

    // AHA 2021: ≤1500 mg/day sodium (strict cardiovascular goal)
    // Note: 2300 mg/day is the population-level target; 1500 mg is recommended
    // for individuals with hypertension, heart failure, or kidney disease.
    sodium: {
      type: 'fixed',
      value: 1500,
      unit: 'mg/day (maximum; adjust to 2300 mg if no comorbid hypertension)',
    } satisfies ClinicalTargetRule,

    // AHA 2021: ≥30 g/day dietary fibre
    fiber: {
      type: 'fixed',
      value: 30,
      unit: 'g/day (minimum)',
    } satisfies ClinicalTargetRule,

    fluid: {
      type: 'per_kg',
      multiplier: 30,
      unit: 'ml/day',
      min: 1500,
      max: 3000,
    } satisfies ClinicalTargetRule,
  },

  forbiddenTags: ['high_saturated_fat', 'processed_meat', 'fried', 'trans_fat'],
  requiredTags: ['omega_3'],

  slotTemplates: buildSlots(
    ['Breakfast', 'Lunch', 'Dinner'],
    [
      { slotName: 'wholegrain_base',       required: true,  allowedCategories: ['grain'],                     preferredTags: ['whole_grain', 'high_fiber', 'omega_3'], forbiddenTags: ['high_saturated_fat'] },
      { slotName: 'lean_protein_primary',  required: true,  allowedCategories: ['protein', 'legume'],         preferredTags: ['lean_protein', 'omega_3'],               forbiddenTags: ['high_saturated_fat', 'processed_meat'] },
      { slotName: 'vegetable_side',        required: true,  allowedCategories: ['vegetable'],                 preferredTags: ['non_starchy_veg', 'high_fiber'] },
      { slotName: 'beverage',              required: true,  allowedCategories: ['beverage', 'broth'],         forbiddenTags: ['high_sugar'] },
    ],
  ),

  evidenceReferences: [ACC_AHA_PP_2019, AHA_DIET_2021],
  reviewDueAt: '2027-01-01',
};

// ── Protocol 4: RENAL_STAGE_4 ─────────────────────────────────────────────

/**
 * Chronic Kidney Disease Stage 4 (eGFR 15–29 mL/min/1.73m²) Protocol.
 *
 * Targets derived from KDIGO 2024 CKD guidelines and KDOQI 2020 Nutrition update.
 * status: 'draft' — this protocol REQUIRES clinician-supplied overrides before
 * a plan may be generated. Targets for protein, potassium, phosphorus, and fluid
 * must all be individually set based on lab values and dialysis status.
 *
 * Mandatory clinician inputs before plan generation:
 *   - dialysisStatus (pre_dialysis | haemodialysis | peritoneal_dialysis)
 *   - urineOutputMlDay
 *   - serumPotassiumMEqL
 *   - serumPhosphorusMgDl
 *   - fluidRestrictionMl (if applicable)
 */
export const PROTOCOL_RENAL_STAGE_4: VersionedClinicalProtocol = {
  diagnosisCode: 'RENAL_STAGE_4',
  version: '1.0.0',
  status: 'draft',

  applicability: {
    ageRange: { min: 18, max: 120 },
    excludeIf: [
      'acute_kidney_injury',
      'post_transplant_acute_phase',
      'paediatric',
      'eGFR_above_30',   // incorrect staging
    ],
  },

  targets: {
    // KDOQI 2020 / KDIGO 2024: 25–35 kcal/kg/day for CKD G4-5 (metabolically stable)
    energy: {
      type: 'per_kg',
      multiplier: 30,     // conservative midpoint; adjust upward for malnutrition
      unit: 'kcal/day',
      min: 1400,
      max: 2500,
    } satisfies ClinicalTargetRule,

    // KDIGO 2024: 0.6–0.8 g/kg/day for NON-DIALYSIS CKD G4-5
    // CLINICIAN OVERRIDE REQUIRED if patient is on dialysis (→ 1.2–1.4 g/kg/day)
    protein: {
      type: 'per_kg',
      multiplier: 0.6,    // minimum for pre-dialysis; diet protein loss risk must be monitored
      unit: 'g/day',
      min: 0.6,
      max: 0.8,
    } satisfies ClinicalTargetRule,

    // Configurable: clinician must adjust based on dialysis status
    // Haemodialysis: protein increases to 1.2–1.4 g/kg/day (KDOQI 2020 Guideline 3.1.2)
    dialysisProteinAdjustment: {
      type: 'manual_override',
      description: 'If dialysisStatus = haemodialysis: set protein to 1.2–1.4 g/kg/day. ' +
                   'If dialysisStatus = peritoneal_dialysis: set to 1.2–1.5 g/kg/day. ' +
                   'Source: KDOQI 2020 Guideline 3.1.2.',
      requiresClinician: true,
    } satisfies ClinicalTargetRule,

    // Macronutrient distribution: remaining energy from carbs/fat
    carbsPercent: {
      type: 'range',
      min: 48,
      max: 56,
      unit: '% total energy (higher proportion to compensate for protein restriction)',
    } satisfies ClinicalTargetRule,

    fatPercent: {
      type: 'range',
      min: 28,
      max: 35,
      unit: '% total energy',
    } satisfies ClinicalTargetRule,

    // KDOQI 2020 Guideline 5.1: 1500 mg/day max sodium to manage hypertension and fluid
    sodium: {
      type: 'fixed',
      value: 1500,
      unit: 'mg/day (maximum)',
    } satisfies ClinicalTargetRule,

    // KDIGO 2024 / KDOQI 2020 Guideline 5.2: default 1500–1800 mg/day
    // CLINICIAN OVERRIDE REQUIRED — adjust based on serumPotassiumMEqL
    potassium: {
      type: 'range',
      min: 1500,
      max: 1800,
      unit: 'mg/day (configurable; see potassiumClinicalAdjustment)',
    } satisfies ClinicalTargetRule,

    // Adjust potassium based on serum lab value — MUST be set by clinician
    potassiumClinicalAdjustment: {
      type: 'manual_override',
      description: 'Adjust based on serumPotassiumMEqL: ' +
                   'If K+ < 3.5 (hypokalaemia): increase dietary potassium, flag for medical review. ' +
                   'If K+ 3.5–5.0 (normal): use default range 1500–1800 mg/day. ' +
                   'If K+ 5.1–5.5 (mild hyperkalaemia): restrict to ≤1500 mg/day. ' +
                   'If K+ > 5.5 (severe hyperkalaemia): restrict to ≤1000 mg/day, urgent medical review. ' +
                   'Source: KDIGO 2024, Chapter 3; KDOQI 2020 Guideline 5.2.',
      requiresClinician: true,
    } satisfies ClinicalTargetRule,

    // KDOQI 2020 Guideline 5.3: 600–800 mg/day; adjust based on serumPhosphorusMgDl
    phosphorus: {
      type: 'range',
      min: 600,
      max: 800,
      unit: 'mg/day (configurable; see phosphorusClinicalAdjustment)',
    } satisfies ClinicalTargetRule,

    // Clinician must adjust based on serum phosphorus lab value
    phosphorusClinicalAdjustment: {
      type: 'manual_override',
      description: 'Adjust based on serumPhosphorusMgDl: ' +
                   'If P < 2.5 (hypophosphataemia): liberalise diet, flag for medical review. ' +
                   'If P 2.5–4.5 (normal for CKD G4): use default range 600–800 mg/day. ' +
                   'If P > 4.5 (hyperphosphataemia): restrict to ≤600 mg/day; consider phosphate binders. ' +
                   'Source: KDOQI 2020 Guideline 5.3; KDIGO 2024.',
      requiresClinician: true,
    } satisfies ClinicalTargetRule,

    // KDOQI 2020 Guideline 5.4: Fiber ≥20 g/day (reduced vs. non-CKD due to potassium constraint)
    fiber: {
      type: 'fixed',
      value: 20,
      unit: 'g/day (minimum; select low-potassium, low-phosphorus fibre sources)',
    } satisfies ClinicalTargetRule,

    // CRITICAL: Fluid target depends on urineOutput and dialysisStatus
    // This field MUST be provided by the clinician before plan generation
    fluidRestriction: {
      type: 'manual_override',
      description: 'Fluid target must be individually prescribed. ' +
                   'For pre-dialysis: typically 30 ml/kg/day if urine output is preserved. ' +
                   'For haemodialysis: often limited to urineOutputMlDay + 500–800 ml/day (interdialytic). ' +
                   'For peritoneal dialysis: typically unrestricted if residual urine output is maintained. ' +
                   'Clinician must set fluidRestrictionMl based on urineOutputMlDay, dialysisStatus, ' +
                   'and peripheral oedema assessment. ' +
                   'Source: KDOQI 2020 Guideline 5.4; KDIGO 2024, Chapter 3.',
      requiresClinician: true,
    } satisfies ClinicalTargetRule,

    // Captures clinicianOverrideRequired flag per the Phase 5 spec
    clinicianOverrideRequired: {
      type: 'manual_override',
      description: 'All RENAL_STAGE_4 plans require explicit clinician review of: ' +
                   '(1) dialysisStatus, (2) urineOutputMlDay, (3) serumPotassiumMEqL, ' +
                   '(4) serumPhosphorusMgDl, (5) fluidRestrictionMl. ' +
                   'Plan export is blocked until a registered dietitian and nephrologist sign off.',
      requiresClinician: true,
    } satisfies ClinicalTargetRule,
  },

  // High-potassium, high-phosphorus, and high-sodium foods are absolutely forbidden.
  forbiddenTags: ['high_potassium', 'high_phosphorus', 'high_sodium', 'processed_meat'],
  requiredTags: [],

  slotTemplates: buildSlots(
    ['Breakfast', 'Lunch', 'Dinner'],
    [
      {
        slotName: 'renal_carb_base',
        required: true,
        allowedCategories: ['grain', 'starch'],
        forbiddenTags: ['high_potassium', 'high_phosphorus'],
        preferredTags: ['gut_safe', 'low_gi'],
      },
      {
        slotName: 'renal_protein_primary',
        required: true,
        allowedCategories: ['protein'],
        forbiddenTags: ['high_potassium', 'high_phosphorus', 'processed_meat'],
        preferredTags: ['lean_protein', 'fresh_lean_protein'],
      },
      {
        slotName: 'renal_veg_side',
        required: false,   // breakfast only has carb+protein+beverage
        allowedCategories: ['vegetable'],
        forbiddenTags: ['high_potassium', 'high_phosphorus'],
        preferredTags: ['non_starchy_veg'],
      },
      {
        slotName: 'beverage',
        required: true,
        allowedCategories: ['beverage'],
        forbiddenTags: ['high_potassium', 'high_sugar'],
        preferredTags: [],
      },
    ],
  ),

  evidenceReferences: [KDIGO_CKD_2024, KDOQI_NUTRITION_2020, KDIGO_DM_CKD_2023],
  // No approvedBy / approvedAt — status is 'draft'
  reviewDueAt: '2026-12-01',
};

// ── Protocol registry ─────────────────────────────────────────────────────

export const CLINICAL_PROTOCOL_REGISTRY: Readonly<Record<
  'GENERAL_HOSPITAL' | 'T2DM' | 'CARDIAC' | 'RENAL_STAGE_4',
  VersionedClinicalProtocol
>> = Object.freeze({
  GENERAL_HOSPITAL: PROTOCOL_GENERAL_HOSPITAL,
  T2DM:             PROTOCOL_T2DM,
  CARDIAC:          PROTOCOL_CARDIAC,
  RENAL_STAGE_4:    PROTOCOL_RENAL_STAGE_4,
});

/**
 * getProtocol — look up a versioned protocol by diagnosisCode.
 * Returns undefined for diagnoses not yet implemented in the registry.
 */
export function getProtocol(code: DiagnosisCode): VersionedClinicalProtocol | undefined {
  return CLINICAL_PROTOCOL_REGISTRY[code as keyof typeof CLINICAL_PROTOCOL_REGISTRY];
}

/**
 * requiresClinician — true if any target in the protocol is a manual_override.
 * RENAL_STAGE_4 will always return true.
 */
export function requiresClinician(protocol: VersionedClinicalProtocol): boolean {
  return Object.values(protocol.targets).some((t) => t.type === 'manual_override');
}
