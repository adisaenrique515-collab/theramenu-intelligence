import {
  WeeklyTherapeuticPlan,
  DayPlan,
  MealPlan,
  MealSlot,
  SlotItem,
  ClinicalTargets,
  DiagnosisType,
  ProtocolConfig,
  SchemaMealType,
  SchemaFoodCategory,
  SchemaTextureClass,
} from '../types';
import { DEFAULT_STANDARDS, CLINICAL_PROTOCOLS } from '../constants';
import { FOODS } from '../config/therapeuticSchema';
import { getSchemaEnrichedCondition } from './clinicalDatabase';
import { calculateAlignmentScore, calculateTotalsFromMeals, validateWeeklyPlan } from './planValidation';

export type DiagnosisCode =
  | 'CARDIAC'
  | 'RENAL_STAGE_3'
  | 'RENAL_STAGE_4'
  | 'T2DM'
  | 'GASTRIC'
  | 'LOW_FAT'
  | 'H_PYLORI'
  | 'LIVER_SUPPORT'
  | 'PEPTIC_ULCER'
  | 'POST_OP_SOFT'
  | 'GENERAL_HOSPITAL';

export interface PatientProfile {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  diagnosis: DiagnosisCode;
  somatotype?: 'endomorph' | 'mesomorph' | 'ectomorph' | 'unknown' | string;
  goal?: 'weight_loss' | 'maintenance' | 'weight_gain' | string;
  mealCount?: 3 | 4 | 5 | 6;
  textureLevel?: 'regular' | 'soft' | 'minced' | 'pureed' | 'liquid';
  riskLevel?: 'low' | 'moderate' | 'high';
}

interface CarePathProfile {
  code: 'STANDARD_DIET' | 'HOSPITAL_DIET';
  label: 'Standard Diet' | 'Hospital Diet';
  energyKcalPerKg: number;
  proteinMinGPerKg: number;
  proteinMaxGPerKg: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DIAGNOSIS_TYPE_BY_CODE: Partial<Record<DiagnosisCode, DiagnosisType>> = {
  CARDIAC: DiagnosisType.CARDIAC,
  RENAL_STAGE_3: DiagnosisType.RENAL,
  RENAL_STAGE_4: DiagnosisType.RENAL_STAGE_4,
  T2DM: DiagnosisType.DIABETIC,
  GASTRIC: DiagnosisType.GASTRIC,
  LOW_FAT: DiagnosisType.LOW_FAT,
  H_PYLORI: DiagnosisType.H_PYLORI,
  LIVER_SUPPORT: DiagnosisType.HEPATIC,
  PEPTIC_ULCER: DiagnosisType.ULCER,
  POST_OP_SOFT: DiagnosisType.POST_OP,
};

const SCHEMA_TO_UI_MEAL: Record<'breakfast' | 'lunch' | 'dinner', 'Breakfast' | 'Lunch' | 'Dinner'> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const FOOD_BY_ID = new Map(FOODS.map((food) => [food.food_id, food]));
const SNACK_MEAL_TYPES: Array<MealPlan['mealType']> = ['Snack AM', 'Snack PM', 'Snack Eve'];

function cloneTargets(targets: ClinicalTargets): ClinicalTargets {
  return { ...targets };
}

function resolveCarePath(profile: PatientProfile): CarePathProfile {
  if (profile.riskLevel === 'moderate' || profile.riskLevel === 'high') {
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

function kcalTarget(profile: PatientProfile, carePath: CarePathProfile): number {
  const base = profile.weightKg * carePath.energyKcalPerKg;
  const ageAdjustment = profile.age > 75 ? -100 : profile.age < 25 ? 100 : 0;
  const goalAdjustment = profile.goal === 'weight_loss' ? -200 : profile.goal === 'weight_gain' ? 250 : 0;
  return Math.max(1200, Math.round(base + ageAdjustment + goalAdjustment));
}

function defaultTargets(profile: PatientProfile): ClinicalTargets {
  const carePath = resolveCarePath(profile);
  const kcal = kcalTarget(profile, carePath);
  const proteinG = Math.round(profile.weightKg * ((carePath.proteinMinGPerKg + carePath.proteinMaxGPerKg) / 2));
  return {
    caloriesKcal: kcal,
    carbsG: Math.round((kcal * 0.5) / 4),
    proteinG,
    fatG: Math.round((kcal * 0.3) / 9),
    fiberG: 28,
    sodiumMg: 2000,
    potassiumMg: 3500,
    phosphorusMg: 700,
    cholesterolMg: 300,
    saturatedFatG: 20,
    sugarG: 36,
    fluidMl: 2000,
    fiberGMin: 25,
    sodiumMgMax: 2000,
    potassiumMgMax: 3500,
    phosphorusMgMax: 800,
    cholesterolMgMax: 300,
    saturatedFatGMax: 20,
    sugarGMax: 36,
    fluidMlTarget: 2000,
  };
}

function parseFluidTarget(fluidTarget: string, weightKg: number): number {
  const trimmed = fluidTarget.replace(/\s+/g, '');
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed === 'weightKg*30') {
    return Math.round(weightKg * 30);
  }
  return 2000;
}

function applySchemaTargets(profile: PatientProfile, targets: ClinicalTargets, config: ProtocolConfig): ClinicalTargets {
  const carePath = resolveCarePath(profile);
  const energy = kcalTarget(profile, carePath);
  const proteinMin = Math.round(
    Math.max(config.targets.protein_g_per_kg_min, carePath.proteinMinGPerKg) * profile.weightKg,
  );
  const carbMid = (config.targets.carb_pct_min + config.targets.carb_pct_max) / 2;
  const fatMid = (config.targets.fat_pct_min + config.targets.fat_pct_max) / 2;

  const carbs = Math.round((energy * carbMid) / 4);
  const fat = Math.round((energy * fatMid) / 9);
  const protein = Math.max(proteinMin, Math.round((energy * (1 - carbMid - fatMid)) / 4));

  return {
    ...targets,
    caloriesKcal: energy,
    carbsG: carbs,
    proteinG: protein,
    fatG: fat,
    fiberGMin: config.targets.fiber_min_g,
    sodiumMgMax: config.targets.sodium_max_mg,
    potassiumMgMax: config.targets.potassium_max_mg ?? undefined,
    phosphorusMgMax: config.targets.phosphorus_max_mg ?? undefined,
    sugarGMax: config.targets.sugar_max_g ?? undefined,
    fluidMlTarget: parseFluidTarget(config.targets.fluid_target_ml, profile.weightKg),
    giPreferredMax: config.targets.gi_max,
  };
}

function deriveSlotPortion(slotName: string): string {
  const name = slotName.toLowerCase();
  if (name.includes('beverage') || name.includes('fluid') || name.includes('hydration')) return '300ml';
  if (name.includes('protein')) return '120g';
  if (name.includes('starch') || name.includes('grain') || name.includes('carb')) return '180g';
  if (name.includes('veg')) return '130g';
  if (name.includes('fruit')) return '140g';
  return '120g';
}

function humanizeSlotName(slotName: string): string {
  return slotName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function matchesTexture(foodId: string, requestedTexture: SchemaTextureClass): boolean {
  const food = FOOD_BY_ID.get(foodId);
  if (!food) return false;
  if (requestedTexture === 'regular') return food.texture_tags.includes('regular');
  return food.texture_tags.includes(requestedTexture) || food.texture_tags.includes('soft');
}

function inferSlotCategories(slotName: string): SchemaFoodCategory[] {
  const name = slotName.toLowerCase();
  if (name.includes('beverage') || name.includes('fluid') || name.includes('hydration')) return ['beverage', 'broth'];
  if (name.includes('fruit')) return ['fruit'];
  if (name.includes('vegetable') || name.includes('veg')) return ['vegetable'];
  if (name.includes('protein')) return ['protein', 'legume', 'dairy'];
  if (name.includes('starch') || name.includes('grain') || name.includes('carb')) return ['grain', 'starch', 'legume'];
  if (name.includes('dairy')) return ['dairy'];
  return ['grain', 'starch', 'protein', 'legume', 'vegetable', 'fruit'];
}

function getRuleSets(config: ProtocolConfig): { preferTags: Set<string>; avoidTags: Set<string> } {
  const preferTags = new Set(
    config.foodRules.filter((rule) => rule.rule_type === 'prefer').map((rule) => rule.food_tag),
  );
  const avoidTags = new Set(
    config.foodRules.filter((rule) => rule.rule_type === 'avoid').map((rule) => rule.food_tag),
  );
  return { preferTags, avoidTags };
}

function protocolSpecificFilter(foodId: string, config: ProtocolConfig): boolean {
  const food = FOOD_BY_ID.get(foodId);
  if (!food) return false;

  const isRenal = config.protocol.protocol_code === 'RENAL_STAGE_3' || config.protocol.protocol_code === 'RENAL_STAGE_4';
  const sodiumCeiling = config.targets.sodium_max_mg <= 1500 ? 180 : 260;
  if (food.category !== 'beverage' && food.sodium_mg_per_100 > sodiumCeiling) return false;

  if (isRenal) {
    if ((food.potassium_mg_per_100 || 0) > 320) return false;
    if ((food.phosphorus_mg_per_100 || 0) > 220) return false;
  }

  return true;
}

function scoreFood(foodId: string, preferTags: Set<string>, avoidTags: Set<string>): number {
  const food = FOOD_BY_ID.get(foodId);
  if (!food) return -9999;

  const tagSet = new Set(food.clinical_tags);
  let score = 0;

  preferTags.forEach((tag) => {
    if (tagSet.has(tag)) score += 8;
  });
  avoidTags.forEach((tag) => {
    if (tagSet.has(tag)) score -= 30;
  });

  if (tagSet.has('high_fiber')) score += 4;
  if (tagSet.has('low_gi')) score += 3;
  if (food.sodium_mg_per_100 <= 120) score += 3;
  if (food.category === 'fruit' || food.category === 'vegetable') score += 2;

  return score;
}

function pickFoodIdFromCategories(
  config: ProtocolConfig,
  categories: SchemaFoodCategory[],
  requestedTexture: SchemaTextureClass,
  dayOffset: number,
): string | null {
  const { preferTags, avoidTags } = getRuleSets(config);
  const isCardioOrDiabetes =
    config.protocol.family === 'cardiovascular' || config.protocol.family === 'endocrine';
  const kcalCap = isCardioOrDiabetes ? 180 : 220;

  const strictFoodPool = FOODS
    .filter((food) => categories.includes(food.category))
    .filter((food) => matchesTexture(food.food_id, requestedTexture))
    .filter((food) => protocolSpecificFilter(food.food_id, config))
    .filter((food) => food.category === 'beverage' || food.kcal_per_100 <= kcalCap)
    .filter((food) => !food.clinical_tags.some((tag) => avoidTags.has(tag)))
    .sort((a, b) => {
      const scoreDiff = scoreFood(b.food_id, preferTags, avoidTags) - scoreFood(a.food_id, preferTags, avoidTags);
      return scoreDiff !== 0 ? scoreDiff : a.name.localeCompare(b.name);
    });

  const relaxedFoodPool =
    strictFoodPool.length > 0
      ? strictFoodPool
      : FOODS
          .filter((food) => categories.includes(food.category))
          .filter((food) => matchesTexture(food.food_id, requestedTexture))
          .filter((food) => protocolSpecificFilter(food.food_id, config))
          .filter((food) => !food.clinical_tags.some((tag) => avoidTags.has(tag)))
          .sort((a, b) => {
            const scoreDiff = scoreFood(b.food_id, preferTags, avoidTags) - scoreFood(a.food_id, preferTags, avoidTags);
            return scoreDiff !== 0 ? scoreDiff : a.name.localeCompare(b.name);
          });

  const foodPool = relaxedFoodPool;
  if (foodPool.length === 0) return null;
  return foodPool[dayOffset % foodPool.length]?.food_id || null;
}

function buildSlotItem(slotName: string, foodId: string | null, requestedTexture: SchemaTextureClass): SlotItem | null {
  if (!foodId) return null;
  const food = FOOD_BY_ID.get(foodId);
  if (!food) return null;

  const textureMismatch = requestedTexture !== 'regular' && !food.texture_tags.includes(requestedTexture);

  return {
    foodId: food.food_id,
    name: food.name,
    portion: deriveSlotPortion(slotName),
    therapeuticOverride: textureMismatch ? `Texture adaptation required: ${requestedTexture}` : undefined,
    operational: { serviceTemp: '>= 60C' },
  };
}

function pickCandidateFoodId(
  config: ProtocolConfig,
  slotName: string,
  candidates: { food_id: string; priority: number }[],
  requestedTexture: SchemaTextureClass,
  dayOffset: number,
): string | null {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const filteredCandidates = sorted
    .map((candidate) => candidate.food_id)
    .filter((foodId) => matchesTexture(foodId, requestedTexture))
    .filter((foodId) => protocolSpecificFilter(foodId, config));

  if (filteredCandidates.length > 0) {
    return filteredCandidates[dayOffset % filteredCandidates.length] || null;
  }

  return pickFoodIdFromCategories(config, inferSlotCategories(slotName), requestedTexture, dayOffset);
}

function buildMealFromSchema(
  config: ProtocolConfig,
  mealType: SchemaMealType,
  texture: SchemaTextureClass,
  dayOffset: number,
): MealPlan | null {
  if (!SCHEMA_TO_UI_MEAL[mealType as 'breakfast' | 'lunch' | 'dinner']) return null;

  const slots = config.slots
    .filter((slot) => slot.meal_type === mealType)
    .sort((a, b) => a.slot_order - b.slot_order)
    .map((slot) => {
      const candidates = config.candidates
        .filter((candidate) => candidate.meal_type === mealType && candidate.slot_name === slot.slot_name)
        .sort((a, b) => b.priority - a.priority);

      const foodId = pickCandidateFoodId(
        config,
        slot.slot_name,
        candidates,
        texture,
        dayOffset + slot.slot_order,
      );
      const item = buildSlotItem(slot.slot_name, foodId, texture);
      return {
        slotName: humanizeSlotName(slot.slot_name),
        item,
        status: item ? 'FILLED' : slot.required ? 'EMPTY' : 'SUBSTITUTED',
        substitutionNote: item
          ? undefined
          : slot.required
            ? 'No schema candidate matched this required slot'
            : 'Optional slot omitted for this day',
      } as MealSlot;
    });

  return {
    mealType: SCHEMA_TO_UI_MEAL[mealType as 'breakfast' | 'lunch' | 'dinner'],
    dietaryLabel: config.protocol.protocol_name,
    slots,
  };
}

function buildSnackMeals(
  config: ProtocolConfig,
  texture: SchemaTextureClass,
  dayOffset: number,
): MealPlan[] {
  const snackCategories: SchemaFoodCategory[][] = [
    ['fruit', 'grain'],
    ['legume', 'protein', 'dairy'],
    ['fruit', 'starch', 'grain'],
  ];

  return SNACK_MEAL_TYPES.map((snackType, snackIdx) => {
    const snackFoodId = pickFoodIdFromCategories(
      config,
      snackCategories[snackIdx] || ['fruit', 'grain'],
      texture,
      dayOffset + snackIdx + 1,
    );

    const snackFood = snackFoodId ? FOOD_BY_ID.get(snackFoodId) : null;
    const snackPortion =
      snackFood?.category === 'protein' || snackFood?.category === 'legume' ? '80g' : '100g';

    return {
      mealType: snackType,
      dietaryLabel: config.protocol.protocol_name,
      slots: [
        {
          slotName: 'Snack Item',
          item: snackFood
            ? {
                foodId: snackFood.food_id,
                name: snackFood.name,
                portion: snackPortion,
                operational: { serviceTemp: '<= 8C or >= 60C' },
              }
            : null,
          status: snackFood ? 'FILLED' : 'EMPTY',
          substitutionNote: snackFood ? undefined : 'No suitable snack candidate for this protocol day',
        },
        {
          slotName: 'Hydration',
          item: {
            foodId: 'water',
            name: 'Purified Water',
            portion: '220ml',
          },
          status: 'FILLED',
        },
      ],
    } as MealPlan;
  });
}

function buildFallbackMeals(diagnosisCode: DiagnosisCode, texture: string): MealPlan[] {
  const textureSuffix = texture !== 'regular' ? ` (${texture})` : '';

  return [
    {
      mealType: 'Breakfast',
      dietaryLabel: diagnosisCode.replace(/_/g, ' '),
      slots: [
        { slotName: 'Base Carbohydrate', item: { foodId: 'rolled_oats', name: `Steel-cut oats${textureSuffix}`, portion: '60g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Protein', item: { foodId: 'lentils_cooked', name: `Lentils${textureSuffix}`, portion: '120g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Fruit', item: { foodId: 'usda_2263889', name: 'Blueberries', portion: '120g' }, status: 'FILLED' },
        { slotName: 'Beverage', item: { foodId: 'water', name: 'Water', portion: '300ml' }, status: 'FILLED' },
      ],
    },
    {
      mealType: 'Lunch',
      dietaryLabel: diagnosisCode.replace(/_/g, ' '),
      slots: [
        { slotName: 'Base Carbohydrate', item: { foodId: 'brown_rice_cooked', name: `Brown rice${textureSuffix}`, portion: '180g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Protein', item: { foodId: 'chicken_breast', name: `Grilled chicken breast${textureSuffix}`, portion: '120g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Vegetable', item: { foodId: 'broccoli', name: `Steamed broccoli${textureSuffix}`, portion: '130g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Beverage', item: { foodId: 'water', name: 'Water', portion: '300ml' }, status: 'FILLED' },
      ],
    },
    {
      mealType: 'Dinner',
      dietaryLabel: diagnosisCode.replace(/_/g, ' '),
      slots: [
        { slotName: 'Base Carbohydrate', item: { foodId: 'quinoa_cooked', name: `Quinoa${textureSuffix}`, portion: '180g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Protein', item: { foodId: 'white_fish', name: `Baked fish${textureSuffix}`, portion: '120g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Vegetable', item: { foodId: 'cauliflower', name: `Roasted cauliflower${textureSuffix}`, portion: '130g', operational: { serviceTemp: '>= 60C' } }, status: 'FILLED' },
        { slotName: 'Beverage', item: { foodId: 'water', name: 'Water', portion: '300ml' }, status: 'FILLED' },
      ],
    },
  ];
}

function buildFallbackSnacks(diagnosisCode: DiagnosisCode, texture: string, dayOffset: number): MealPlan[] {
  const diagnosisLabel = diagnosisCode.replace(/_/g, ' ');
  const snackFoods = ['usda_2263889', 'lentils_cooked', 'usda_1105781'];

  return SNACK_MEAL_TYPES.map((mealType, idx) => {
    const foodId = snackFoods[(dayOffset + idx) % snackFoods.length];
    const food = FOOD_BY_ID.get(foodId);

    return {
      mealType,
      dietaryLabel: diagnosisLabel,
      slots: [
        {
          slotName: 'Snack Item',
          item: food
            ? {
                foodId: food.food_id,
                name: texture === 'regular' ? food.name : `${food.name} (${texture})`,
                portion: idx === 1 ? '110g' : '140g',
              }
            : null,
          status: food ? 'FILLED' : 'EMPTY',
          substitutionNote: food ? undefined : 'No fallback snack candidate found',
        },
        {
          slotName: 'Hydration',
          item: { foodId: 'water', name: 'Purified Water', portion: '300ml' },
          status: 'FILLED',
        },
      ],
    };
  });
}

function buildDayPlan(dayName: string, meals: MealPlan[], targets: ClinicalTargets): DayPlan {
  return {
    dayName,
    meals,
    dailyTargets: cloneTargets(targets),
    totals: calculateTotalsFromMeals(meals),
  };
}

export function generateWeeklyPlan(profile: PatientProfile): WeeklyTherapeuticPlan {
  const diagnosisType = DIAGNOSIS_TYPE_BY_CODE[profile.diagnosis];
  const enriched = diagnosisType ? getSchemaEnrichedCondition(diagnosisType) : null;
  const carePath = resolveCarePath(profile);

  const baseTargets = defaultTargets(profile);
  const resolvedTargets =
    enriched?.schemaConfig ? applySchemaTargets(profile, baseTargets, enriched.schemaConfig) : baseTargets;

  const resolvedTexture =
    profile.textureLevel ||
    enriched?.schemaConfig?.protocol.default_texture ||
    (profile.diagnosis === 'POST_OP_SOFT' ? 'soft' : 'regular');
  const targetMealCount = profile.mealCount || enriched?.schemaConfig?.protocol.default_meal_count || 3;

  const days: DayPlan[] = DAYS.map((dayName, dayIdx) => {
    const schemaMeals =
      enriched?.schemaConfig
        ? (['breakfast', 'lunch', 'dinner'] as const)
            .map((mealType) =>
              buildMealFromSchema(
                enriched.schemaConfig as ProtocolConfig,
                mealType,
                resolvedTexture as SchemaTextureClass,
                dayIdx,
              ),
            )
            .filter((meal): meal is MealPlan => Boolean(meal))
        : [];

    const baseMeals = schemaMeals.length > 0 ? schemaMeals : buildFallbackMeals(profile.diagnosis, resolvedTexture);
    const snackCount = Math.max(0, Math.min(3, targetMealCount - 3));
    const snackMeals =
      snackCount > 0
        ? enriched?.schemaConfig
          ? buildSnackMeals(enriched.schemaConfig, resolvedTexture as SchemaTextureClass, dayIdx)
          : buildFallbackSnacks(profile.diagnosis, resolvedTexture, dayIdx)
        : [];

    const meals = [...baseMeals, ...snackMeals.slice(0, snackCount)];
    return buildDayPlan(dayName, meals, resolvedTargets);
  });

  const legacyRule = enriched?.legacyRule;
  const fallbackDiagnosis = DIAGNOSIS_TYPE_BY_CODE[profile.diagnosis] || profile.diagnosis;
  const fallbackRationale = CLINICAL_PROTOCOLS[fallbackDiagnosis] || 'Standard clinical nutritional therapy protocol.';

  const preliminaryPlan: WeeklyTherapeuticPlan = {
    diagnosis: profile.diagnosis,
    clinicalAlignmentScore: enriched?.schemaConfig ? 96 : 90,
    constraints: {
      exclude: legacyRule?.forbidden_tags || [],
      prioritize: legacyRule?.cooking_methods || [],
      textureLevel: resolvedTexture,
      nutrientTargets: `${resolvedTargets.caloriesKcal} kcal/day target; protein floor ${Math.round(carePath.proteinMinGPerKg * profile.weightKg)} g/day; Na <= ${resolvedTargets.sodiumMgMax} mg`,
    },
    days,
    standards: DEFAULT_STANDARDS,
    notes: [
      `Care path: ${carePath.label} (${carePath.energyKcalPerKg} kcal/kg, protein ${carePath.proteinMinGPerKg}-${carePath.proteinMaxGPerKg} g/kg)`,
      enriched?.protocolCode
        ? `Schema protocol active: ${enriched.protocolCode}`
        : 'Schema protocol unavailable; fallback template applied',
      'Generated by deterministic offline-first clinical engine',
      'Internal API rule surface available for offline architecture and resource introspection',
      'Normalization pipeline active for meal and nutrient source harmonization',
      'Nutrient and variety checks are validated against internal safety gates',
      'Data source baseline: USDA FNDDS/FDC and local clinical diet manuals',
    ],
    rationale: `${carePath.label}: ${carePath.label === 'Hospital Diet' ? 'moderate/high nutritional risk pathway with higher protein support.' : 'low-risk baseline pathway.'} ${legacyRule?.therapeutic_goal || fallbackRationale}`,
    preparedBy: 'Clinical Engine (Offline-First Schema)',
    updatedDate: new Date().toISOString().slice(0, 10),
    carePathLabel: carePath.label,
    engineMode: 'OFFLINE_INTERNAL_API',
    compoundDietCodes: [resolvedTexture.toUpperCase(), profile.diagnosis, carePath.code],
  };

  const validationReport = validateWeeklyPlan(preliminaryPlan);
  const alignedScore = calculateAlignmentScore(validationReport);

  return {
    ...preliminaryPlan,
    clinicalAlignmentScore: alignedScore,
    validationReport,
  };
}
