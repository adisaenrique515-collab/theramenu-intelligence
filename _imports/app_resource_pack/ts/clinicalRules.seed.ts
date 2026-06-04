import kdigoCkdRuleSeed from "../clinical/kdigo-ckd-rule-seed.json";
import espenHospitalRuleSeed from "../clinical/espen-hospital-rule-seed.json";

export const CLINICAL_RULES = {
  CKD_G3_G5_ADULT: kdigoCkdRuleSeed,
  HOSPITAL_NUTRITION_BASELINE: espenHospitalRuleSeed,
} as const;
