export interface CkdAssessment {
  gfrCategory: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  acrCategory: 'A1' | 'A2' | 'A3';
  isCkd: boolean;
  kidneyFailureHr: number;
}

export interface ProteinPrescription {
  min: number;
  target: number;
  max: number | null;
  source: string;
}

export interface PotassiumAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  action: string;
}

export interface SodiumPrescription {
  maxMg: number;
  minMg?: number;
  note: string;
  source: string;
}

export interface RecommendedDietCode {
  code: string;
  name: string;
  priority: number;
  source: 'NYS_DOCCS' | 'ESPEN';
}

const KIDNEY_FAILURE_MATRIX: Record<string, number> = {
  'G1-A1': 1.0, 'G1-A2': 1.8, 'G1-A3': 4.3,
  'G2-A1': 2.3, 'G2-A2': 4.9, 'G2-A3': 10,
  'G3a-A1': 13, 'G3a-A2': 27, 'G3a-A3': 85,
  'G3b-A1': 27, 'G3b-A2': 63, 'G3b-A3': 190,
  'G4-A1': 72, 'G4-A2': 130, 'G4-A3': 450,
  'G5-A1': 290, 'G5-A2': 570, 'G5-A3': 1100,
};

export const ESPEN_SNACK_TIMING = ['07:30', '10:00', '12:00', '15:00', '19:00', '22:00'] as const;

export const THERAPEUTIC_DIET_REGISTRY: ReadonlyArray<RecommendedDietCode> = [
  { code: 'STD', name: 'Standard Diet', priority: 3, source: 'ESPEN' },
  { code: 'HOSP', name: 'Hospital Diet', priority: 1, source: 'ESPEN' },
  { code: 'CONA', name: 'Controlled A', priority: 3, source: 'NYS_DOCCS' },
  { code: 'CONB', name: 'Controlled B', priority: 2, source: 'NYS_DOCCS' },
  { code: 'PR2A', name: 'Renal', priority: 1, source: 'NYS_DOCCS' },
  { code: 'PR2B', name: 'Renal Diabetic', priority: 1, source: 'NYS_DOCCS' },
  { code: 'PR3A', name: 'Dialysis Renal', priority: 1, source: 'NYS_DOCCS' },
  { code: 'PR3B', name: 'Dialysis Renal Diabetic', priority: 1, source: 'NYS_DOCCS' },
  { code: 'DASH15', name: 'DASH 1500mg Na', priority: 2, source: 'NYS_DOCCS' },
] as const;

export function classifyCkd(eGfr: number, acr: number): CkdAssessment {
  const gfrCategory =
    eGfr >= 90 ? 'G1' :
    eGfr >= 60 ? 'G2' :
    eGfr >= 45 ? 'G3a' :
    eGfr >= 30 ? 'G3b' :
    eGfr >= 15 ? 'G4' : 'G5';

  const acrCategory = acr < 30 ? 'A1' : acr < 300 ? 'A2' : 'A3';

  return {
    gfrCategory,
    acrCategory,
    isCkd: ['G3a', 'G3b', 'G4', 'G5'].includes(gfrCategory) || ['A2', 'A3'].includes(acrCategory),
    kidneyFailureHr: KIDNEY_FAILURE_MATRIX[`${gfrCategory}-${acrCategory}`] || 1,
  };
}

export function calculateProteinTarget(
  weightKg: number,
  ckdStage: CkdAssessment['gfrCategory'],
  onDialysis: boolean,
  malnourished: boolean,
): ProteinPrescription {
  if (onDialysis) {
    return { min: weightKg * 1.0, target: weightKg * 1.2, max: null, source: 'KDIGO_2024_DIALYSIS' };
  }
  if (malnourished) {
    return { min: weightKg * 1.2, target: weightKg * 1.5, max: weightKg * 2.0, source: 'ESPEN_HOSPITAL_DIET' };
  }
  if (['G3a', 'G3b', 'G4', 'G5'].includes(ckdStage)) {
    return { min: weightKg * 0.6, target: weightKg * 0.8, max: weightKg * 1.3, source: 'KDIGO_2024_3.3.1.1' };
  }
  return { min: weightKg * 0.8, target: weightKg * 1.0, max: weightKg * 1.2, source: 'ESPEN_STANDARD' };
}

export function generatePotassiumAlert(kMmol: number): PotassiumAlert | null {
  if (!Number.isFinite(kMmol) || kMmol <= 5.0) return null;
  if (kMmol <= 5.5) {
    return { severity: 'info', message: `Mild hyperkalemia (${kMmol.toFixed(1)} mmol/L)`, action: 'Review dietary potassium intake and repeat monitoring.' };
  }
  if (kMmol <= 6.0) {
    return { severity: 'warning', message: `Moderate hyperkalemia (${kMmol.toFixed(1)} mmol/L)`, action: 'Reduce potassium burden, review RASi exposure, and consider potassium binder escalation.' };
  }
  return { severity: 'critical', message: `Severe hyperkalemia (${kMmol.toFixed(1)} mmol/L)`, action: 'Urgent ECG review and emergency hyperkalemia protocol required.' };
}

export function getSodiumTarget(hasChronicHf: boolean, hypertension: boolean): SodiumPrescription {
  if (hasChronicHf) {
    return {
      maxMg: 2760,
      minMg: 2300,
      note: 'ESPEN sodium floor applies in chronic cardiac failure; do not restrict below 6 g NaCl/day.',
      source: 'ESPEN_REC_39',
    };
  }
  if (hypertension) {
    return {
      maxMg: 1500,
      note: 'DASH-tier sodium restriction for arterial hypertension.',
      source: 'NYS_DOCCS_DASH15',
    };
  }
  return {
    maxMg: 2000,
    note: 'KDIGO <2 g sodium/day baseline for CKD and controlled hospital diets.',
    source: 'KDIGO_2024_3.3.2.1',
  };
}

export function recommendDietCodes(input: {
  ckd: CkdAssessment;
  diabetes: boolean;
  hypertension: boolean;
  malnourished: boolean;
  onDialysis: boolean;
}): RecommendedDietCode[] {
  const diets: RecommendedDietCode[] = [];

  if (input.onDialysis) {
    diets.push(input.diabetes
      ? { code: 'PR3B', name: 'Dialysis Renal Diabetic', priority: 1, source: 'NYS_DOCCS' }
      : { code: 'PR3A', name: 'Dialysis Renal', priority: 1, source: 'NYS_DOCCS' });
  } else if (['G3a', 'G3b', 'G4', 'G5'].includes(input.ckd.gfrCategory)) {
    diets.push(input.diabetes
      ? { code: 'PR2B', name: 'Renal Diabetic', priority: 1, source: 'NYS_DOCCS' }
      : { code: 'PR2A', name: 'Renal', priority: 1, source: 'NYS_DOCCS' });
  }

  if (input.hypertension) {
    diets.push({ code: 'DASH15', name: 'DASH 1500mg Na', priority: 2, source: 'NYS_DOCCS' });
  }

  if (input.diabetes) {
    diets.push({ code: 'CONB', name: 'Controlled B', priority: 2, source: 'NYS_DOCCS' });
  }

  if (input.malnourished) {
    diets.push({ code: 'HOSP', name: 'Hospital Diet', priority: 1, source: 'ESPEN' });
  } else {
    diets.push({ code: 'STD', name: 'Standard Diet', priority: 3, source: 'ESPEN' });
  }

  return diets.sort((a, b) => a.priority - b.priority);
}
