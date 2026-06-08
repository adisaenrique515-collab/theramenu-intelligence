import { createHash } from 'node:crypto';
import path from 'node:path';
import { buildNutritionPrescription } from '../server/localClinicalEngineApi.ts';
import { generateLocalWeeklyPlan, type LocalPlannerProfile } from '../server/localMealPlanner.ts';

const FIXED_ISO = '2026-06-08T00:00:00.000Z';
const RealDate = Date;
process.env.THERAMENU_USDA_FLATFILE_DIR = path.join(process.cwd(), 'data', 'smoke-flatfiles');

class FixedDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(FIXED_ISO);
    } else {
      super(args[0]);
    }
  }

  static now(): number {
    return new RealDate(FIXED_ISO).getTime();
  }
}

globalThis.Date = FixedDate as DateConstructor;

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const scenarios: Array<{
  name: string;
  diagnosis: string;
  profile: LocalPlannerProfile;
  patientData: Record<string, unknown>;
}> = [
  {
    name: 'renal-stage-4',
    diagnosis: 'RENAL STAGE 4',
    profile: {
      diagnosis: 'RENAL STAGE 4',
      age: 72,
      sex: 'female',
      weightKg: 62,
      heightCm: 164,
      eGfr: 24,
      acrMgG: 340,
      potassiumMmolL: 5.2,
      hypertension: true,
      heartFailure: false,
      onDialysis: false,
      malnourished: false,
      goal: 'maintenance',
      mealCount: 6,
      textureLevel: 'regular',
      riskLevel: 'moderate',
      egfrBand: 'lt30',
    },
    patientData: {
      age: 72,
      sex: 'female',
      weightKg: 62,
      heightCm: 164,
      eGfr: 24,
      acrMgG: 340,
      potassiumMmolL: 5.2,
      hypertension: true,
      heartFailure: false,
      onDialysis: false,
      malnourished: false,
      goal: 'maintenance',
      mealCount: 6,
      textureLevel: 'regular',
      riskLevel: 'moderate',
      egfrBand: 'lt30',
    },
  },
  {
    name: 'diabetic',
    diagnosis: 'DIABETIC',
    profile: {
      diagnosis: 'DIABETIC',
      age: 58,
      sex: 'male',
      weightKg: 86,
      heightCm: 178,
      eGfr: 72,
      acrMgG: 20,
      potassiumMmolL: 4.6,
      hypertension: true,
      heartFailure: false,
      onDialysis: false,
      malnourished: false,
      goal: 'maintenance',
      mealCount: 6,
      textureLevel: 'regular',
      riskLevel: 'low',
      egfrBand: 'gte45',
    },
    patientData: {
      age: 58,
      sex: 'male',
      weightKg: 86,
      heightCm: 178,
      eGfr: 72,
      acrMgG: 20,
      potassiumMmolL: 4.6,
      hypertension: true,
      heartFailure: false,
      onDialysis: false,
      malnourished: false,
      goal: 'maintenance',
      mealCount: 6,
      textureLevel: 'regular',
      riskLevel: 'low',
      egfrBand: 'gte45',
      diabetesType: 'type2',
      yearsSinceDiagnosis: 12,
      a1cPercent: 8.2,
      fastingHours: 0,
      usesCgm: true,
      selfMonitoring: true,
      fastingEducation: true,
      hasHomeSupport: true,
      macrovascularStatus: 'stable',
      physicalLabor: 'low',
    },
  },
];

let failed = false;

for (const scenario of scenarios) {
  const before = generateLocalWeeklyPlan(scenario.profile);
  const prescription = buildNutritionPrescription(
    {
      diagnosis: scenario.diagnosis,
      patientDetails: '',
      patientData: scenario.patientData,
    },
    scenario.profile,
  );
  const after = generateLocalWeeklyPlan(scenario.profile);
  const beforeHash = sha256(before);
  const afterHash = sha256(after);
  const passed = beforeHash === afterHash;

  console.log(`${passed ? 'PASS' : 'FAIL'} ${scenario.name}`);
  console.log(`  prescription: ${prescription.prescriptionId}`);
  console.log(`  before hash:  ${beforeHash}`);
  console.log(`  after hash:   ${afterHash}`);

  if (!passed) {
    failed = true;
  }
}

if (failed) {
  console.error('\nNutritionPrescription output drift detected.');
  process.exit(1);
}

console.log('\nNutritionPrescription no-output-drift check PASSED.');
