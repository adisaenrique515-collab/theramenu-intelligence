import { HospitalMenusStandards, DiagnosisType, FacilityStandard } from './types';

export const DEFAULT_STANDARDS_LIST: FacilityStandard[] = [
  { key: 'hot_holding', operator: '>=', value: 65, unit: 'C', note: 'Continuous monitoring required' },
  { key: 'serving_hot', operator: '>=', value: 63, unit: 'C', note: 'At point of patient delivery' },
  { key: 'cold_holding', operator: '<=', value: 5, unit: 'C', note: 'Continuous monitoring required' },
  { key: 'serving_cold', operator: '<=', value: 8, unit: 'C', note: 'At point of patient delivery' },
  { key: 'vehicle_transport', operator: '<=', value: 5, unit: 'C', note: 'Active refrigeration required' },
];

export const DEFAULT_STANDARDS: HospitalMenusStandards = {
  hotHolding: '>= 65C',
  servingHotFood: '>= 63C',
  coldHolding: '<= 5C',
  servingColdFood: '<= 8C',
  boosting: 'As per Facility',
  vehicle: '<= 5C',
  standardsList: DEFAULT_STANDARDS_LIST,
};

export const HOSPITAL_BRAND = {
  name: 'Hospital Menus Corporation',
  department: 'Hospitality Catering Department',
  logoUrl: '',
};

export const CLINICAL_PROTOCOLS: Record<string, string> = {
  [DiagnosisType.H_PYLORI]:
    'Mucosal Protection: Low acid, high sulforaphane, non-irritant textures. Avoid caffeine and spicy foods.',
  [DiagnosisType.LACTATION]:
    'Lactation Support: +500 kcal/day, high hydration (8-10 glasses), galactagogue-inclusive. Avoid alcohol and limit caffeine.',
  [DiagnosisType.ONCOLOGY]:
    'Neutropenic-Aware: High-density protein, zero raw produce, cooked to core temperature. Focus on antioxidant-rich fruits/veg (Vitamin C, E, Carotenoids).',
  [DiagnosisType.POST_OP]:
    'Early Enteral Transition: Clear Liquid -> Full Liquid -> Soft -> Regular. Focus on protein for tissue repair.',
  [DiagnosisType.ULCER]:
    'Gastric Protection: Small frequent meals, zero caffeine, non-spicy, low-acid. Avoid alcohol which increases gastric acidity.',
  [DiagnosisType.DIABETIC]:
    'Glycemic Control: 60% unrefined carbs, 0.8g/kg protein, <30% fat, <300mg cholesterol, <3g sodium. High fibre (20-35g/day) to improve glucose tolerance.',
  [DiagnosisType.CARDIAC]:
    'Lipid Management: <30% total fat, <10% saturated fat, <300mg cholesterol. Increase soluble fibre (Psyllium, Oat bran) and monounsaturated fats (Olive oil).',
  [DiagnosisType.PRENATAL]:
    'Maternal Health: +300 kcal, 60g protein, 30mg iron, 1000mg calcium, 400mcg folic acid. Avoid unpasteurized dairy and raw animal products.',
  [DiagnosisType.DYSPHAGIA]:
    'Texture Modification: IDDSI compliant textures. Focus on nutrient density in pureed/minced forms to prevent involuntary weight loss.',
  [DiagnosisType.HEPATIC]:
    'Liver Support: Moderate protein, low sodium. Narrow therapeutic window for iron and fat-soluble vitamins if cirrhosis is present.',
  [DiagnosisType.RENAL]:
    'Kidney Protection: Controlled protein (0.8g/kg), low sodium, potassium, and phosphorus management based on stage.',
  [DiagnosisType.NEUTROPENIC]:
    'Infection Prevention: All food cooked to >74C. No raw fruits/veg, unpasteurized dairy, or cold-smoked fish.',
  [DiagnosisType.GERIATRIC]:
    'Senior Care: 1500mg calcium, high fibre, softer textures to accommodate reduced saliva and dental issues. Focus on nutrient density.',
};
