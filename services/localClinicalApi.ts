import type { PatientData } from '../components/TherapeuticForm';
import type { LocalNutritionDbStatus } from '../localNutritionDb.types';
import type { WeeklyTherapeuticPlan } from '../types';
import { isCloudflareMode } from '../utils/appMode';
import { generateWeeklyPlan, type DiagnosisCode, type PatientProfile } from './clinicalEngine';

interface GeneratePlanRequest {
  diagnosis: string;
  patientDetails: string;
  patientData: PatientData;
}

// Maps DiagnosisType string values (sent by TherapeuticForm) to client-side DiagnosisCode.
const DIAGNOSIS_MAP: Record<string, DiagnosisCode> = {
  'CARDIAC':        'CARDIAC',
  'RENAL':          'RENAL_STAGE_3',
  'DIABETIC':       'T2DM',
  'GASTRIC':        'GASTRIC',
  'LOW FAT':        'LOW_FAT',
  'H. PYLORI':      'H_PYLORI',
  'HEPATIC':        'LIVER_SUPPORT',
  'PEPTIC ULCER':   'PEPTIC_ULCER',
  'POST-OPERATIVE': 'POST_OP_SOFT',
};

function toClientProfile(req: GeneratePlanRequest): PatientProfile {
  const d = req.patientData;
  return {
    diagnosis: DIAGNOSIS_MAP[req.diagnosis] ?? 'GENERAL_HOSPITAL',
    age: d.age ?? 45,
    sex: d.sex ?? 'male',
    weightKg: d.weightKg ?? 75,
    heightCm: d.heightCm ?? 175,
    somatotype: d.somatotype,
    goal: d.goal,
    mealCount: d.mealCount ?? 3,
    textureLevel: d.textureLevel ?? 'regular',
    riskLevel: d.riskLevel ?? 'low',
  };
}

export async function generatePlanViaInternalApi(payload: GeneratePlanRequest): Promise<WeeklyTherapeuticPlan> {
  // On Cloudflare Pages there is no Node.js server. Run the browser-side clinical
  // engine directly instead of calling the unreachable /api/* endpoint.
  if (isCloudflareMode) {
    return generateWeeklyPlan(toClientProfile(payload));
  }

  const response = await fetch('/api/internal/clinical-engine/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Clinical engine request failed (${response.status}).`);
  }

  return (await response.json()) as WeeklyTherapeuticPlan;
}

let cachedDbStatusPromise: Promise<LocalNutritionDbStatus> | null = null;

export async function loadLocalNutritionDbStatus(): Promise<LocalNutritionDbStatus> {
  if (isCloudflareMode) {
    return {
      databasePath: 'cloudflare-mode',
      databaseReady: false,
      dataSource: 'LOCAL_SQLITE',
      phiProcessing: 'LOCAL_ONLY',
      flatFileDirectory: null,
      requiredFiles: [],
      lastImportAt: null,
      rowCounts: { foodDescription: 0, nutrientData: 0, weightsAndMeasures: 0 },
      notes: ['Running on Cloudflare Pages — local SQLite database not available.'],
    };
  }

  if (!cachedDbStatusPromise) {
    cachedDbStatusPromise = fetch('/api/internal/nutrition-db/status')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Nutrition DB status request failed (${response.status}).`);
        }
        return (await response.json()) as LocalNutritionDbStatus;
      })
      .catch((err) => {
        cachedDbStatusPromise = null;
        throw err;
      });
  }

  return cachedDbStatusPromise;
}
