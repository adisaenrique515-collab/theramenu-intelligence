import type { PatientData } from '../components/TherapeuticForm';
import type { LocalNutritionDbStatus } from '../localNutritionDb.types';
import type { WeeklyTherapeuticPlan } from '../types';

interface GeneratePlanRequest {
  diagnosis: string;
  patientDetails: string;
  patientData: PatientData;
}

export async function generatePlanViaInternalApi(payload: GeneratePlanRequest): Promise<WeeklyTherapeuticPlan> {
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
