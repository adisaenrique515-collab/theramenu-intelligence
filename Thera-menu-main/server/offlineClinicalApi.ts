import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OfflineClinicalOverview } from '../offlineClinical.types.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phosphorusSeed = JSON.parse(
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

const overview: OfflineClinicalOverview = {
  networkStatus: 'offline',
  engineMode: 'internal-api',
  modules: [
    {
      name: 'auth',
      status: 'active',
      description: 'Local session and app access layer remains available without cloud dependency.',
    },
    {
      name: 'resource_pack',
      status: 'active',
      description: 'AUSNUT food composition data and clinical rule seeds are served from the app itself.',
    },
    {
      name: 'normalization',
      status: 'active',
      description: 'Messy meal text is converted into structured nutrient rows before rule evaluation.',
    },
    {
      name: 'rule_router',
      status: 'active',
      description: 'Diagnosis-specific pathways dispatch renal, diabetic, dysphagia, and hospital diet logic.',
    },
    {
      name: 'db_sync',
      status: 'pending',
      description: 'Future sync hook for external systems; the engine remains functional while disconnected.',
    },
  ],
  dataSources: [
    {
      id: 'FOOD_DES',
      description: 'Food description catalog used for canonical item naming and lookup joins.',
      fields: ['food_id', 'long_desc', 'food_group'],
      role: 'Identity layer for food records',
    },
    {
      id: 'NUT_DATA',
      description: 'Per-100g nutrient matrix used to evaluate sodium, potassium, protein, and macro constraints.',
      fields: ['nutrient', 'value_per_100g', 'unit'],
      role: 'Clinical nutrient rule layer',
    },
    {
      id: 'WEIGHT',
      description: 'Household and gram-weight conversions used to normalize portions into comparable units.',
      fields: ['measure_desc', 'gram_weight', 'volume_ml'],
      role: 'Portion normalization layer',
    },
    {
      id: 'BFPD_PRODUCTS',
      description: 'Branded product ingredient and serving-size layer used to screen phosphate additives and processed-food risks.',
      fields: ['ingredients_english', 'manufacturer', 'serving_size_g', 'phosphate_label_terms'],
      role: 'Branded label screening layer',
    },
  ],
  diagnosisRoutes: ['RENAL', 'DIABETIC', 'DYSPHAGIA', 'CARDIAC', 'GASTRIC', 'HEPATIC'],
  carePaths: [
    {
      code: 'STANDARD_DIET',
      label: 'Standard Diet',
      indication: 'Low nutritional risk / general population.',
      energyKcalPerKg: 25,
      proteinGPerKgMin: 0.8,
      proteinGPerKgMax: 1.0,
    },
    {
      code: 'HOSPITAL_DIET',
      label: 'Hospital Diet',
      indication: 'Moderate/high nutritional risk or malnourished patients.',
      energyKcalPerKg: 30,
      proteinGPerKgMin: 1.2,
      proteinGPerKgMax: 2.0,
    },
  ],
  normalizationExample: {
    rawInputs: ['Chikn salad?', 'B fast-850cal', 'Lunch_pizza, cola!', 'Dinner: steak + wine...maybe', 'snack_apple??'],
    normalizedRows: [
      { meal: 'Chicken Salad', calories: 600, proteinG: 45, carbsG: 20, fatG: 25 },
      { meal: 'Breakfast Burrito', calories: 850, proteinG: 30, carbsG: 90, fatG: 40 },
      { meal: 'Pepperoni Pizza, Cola', calories: 1200, proteinG: 50, carbsG: 150, fatG: 50 },
      { meal: 'Steak Dinner, Red Wine', calories: 1100, proteinG: 70, carbsG: 40, fatG: 60 },
      { meal: 'Apple', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3 },
    ],
  },
  queryGuardrails: [
    {
      label: 'Stage 4 CKD shortlist',
      expression: 'WHERE sodium_mg <= 2000 AND potassium_mg <= 2000 AND protein_g_per_kg <= 0.8',
    },
    {
      label: 'High-fibre low-sodium shortlist',
      expression: 'WHERE sodium_mg <= 120 AND fibre_ratio >= 14',
    },
    {
      label: 'Low-phosphorus renal shortlist',
      expression: 'WHERE phosphorus_mg <= 800_daily AND ingredient_label NOT LIKE %PHOS% AND starch_class IN (white_rice, white_pasta, white_bread)',
    },
    {
      label: 'Branded phosphate additive screen',
      expression: `BFPD ingredient scan across ${brandedSeed.dataset.products} products; ${brandedSeed.dataset.productsWithPhosphateAdditives} contain label terms (${brandedSeed.ingredientLabelWarnings.join(', ')})`,
    },
  ],
  phosphorusGuide: {
    dailyAllowanceMg: phosphorusSeed.rules.dailyAllowanceMg,
    ingredientLabelWarnings: phosphorusSeed.rules.ingredientLabelWarnings,
    highPhosphorusFoodGroups: phosphorusSeed.rules.highPhosphorusFoodGroups,
    lowerPhosphorusFoodGroups: phosphorusSeed.rules.lowerPhosphorusFoodGroups,
    careNotes: phosphorusSeed.rules.careNotes,
  },
};

export function getOfflineClinicalOverview(): OfflineClinicalOverview {
  return overview;
}
