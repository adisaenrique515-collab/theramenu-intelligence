import type {
  FoodNutrientProfile,
  MealPlan,
  NutrientVector,
  PlanValidationReport,
  WeeklyTherapeuticPlan,
  SchemaFoodItem,
} from '../types';
import { FOODS } from '../config/therapeuticSchema';

const FOOD_BY_ID = new Map<string, SchemaFoodItem>(FOODS.map((food) => [food.food_id, food]));
const DEFAULT_PORTION_G = 100;

function emptyNutrients(): NutrientVector {
  return {
    caloriesKcal: 0,
    carbsG: 0,
    proteinG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    phosphorusMg: 0,
    cholesterolMg: 0,
    saturatedFatG: 0,
    sugarG: 0,
    fluidMl: 0,
  };
}

function parsePortionWeight(portion: string | undefined): number {
  if (!portion) return DEFAULT_PORTION_G;
  const normalized = portion.trim().toLowerCase();
  const gramsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gramsMatch) return Number(gramsMatch[1]);

  const mlMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) return Number(mlMatch[1]);

  const cupsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*cup/);
  if (cupsMatch) return Number(cupsMatch[1]) * 240;

  if (normalized.includes('serving')) return 120;
  return DEFAULT_PORTION_G;
}

function estimateFiberPer100(food: SchemaFoodItem): number {
  if (typeof food.fiber_g_per_100 === 'number' && food.fiber_g_per_100 > 0) return food.fiber_g_per_100;
  const baseByCategory: Record<SchemaFoodItem['category'], number> = {
    fruit: 2.4,
    vegetable: 3.2,
    legume: 7.0,
    grain: 4.2,
    starch: 2.1,
    protein: 0,
    dairy: 0,
    fat: 0,
    beverage: 0,
    broth: 0.5,
    condiment: 0.2,
  };
  let estimated = baseByCategory[food.category] || 0;
  if (food.clinical_tags.includes('high_fiber')) estimated += 2;
  return estimated;
}

function estimatePotassiumPer100(food: SchemaFoodItem): number {
  if (typeof food.potassium_mg_per_100 === 'number' && food.potassium_mg_per_100 > 0) return food.potassium_mg_per_100;
  const defaults: Record<SchemaFoodItem['category'], number> = {
    fruit: 190,
    vegetable: 230,
    legume: 290,
    grain: 130,
    starch: 170,
    protein: 240,
    dairy: 150,
    fat: 0,
    beverage: 20,
    broth: 40,
    condiment: 30,
  };
  return defaults[food.category] || 0;
}

function estimatePhosphorusPer100(food: SchemaFoodItem): number {
  if (typeof food.phosphorus_mg_per_100 === 'number' && food.phosphorus_mg_per_100 > 0) return food.phosphorus_mg_per_100;
  const defaults: Record<SchemaFoodItem['category'], number> = {
    fruit: 25,
    vegetable: 45,
    legume: 160,
    grain: 110,
    starch: 60,
    protein: 180,
    dairy: 120,
    fat: 0,
    beverage: 10,
    broth: 20,
    condiment: 20,
  };
  return defaults[food.category] || 0;
}

function estimateFluidFromSolid(food: SchemaFoodItem, grams: number): number {
  if (food.category === 'beverage') return grams;
  if (food.category === 'broth') return grams * 0.9;
  if (food.category === 'fruit' || food.category === 'vegetable') return grams * 0.75;
  if (food.category === 'grain' || food.category === 'starch' || food.category === 'legume') return grams * 0.45;
  if (food.category === 'dairy') return grams * 0.7;
  return grams * 0.55;
}

function addNutrients(target: NutrientVector, food: SchemaFoodItem, grams: number): void {
  const factor = grams / 100;
  target.caloriesKcal += food.kcal_per_100 * factor;
  target.carbsG += food.carbs_g_per_100 * factor;
  target.proteinG += food.protein_g_per_100 * factor;
  target.fatG += food.fat_g_per_100 * factor;
  target.fiberG += estimateFiberPer100(food) * factor;
  target.sodiumMg += food.sodium_mg_per_100 * factor;
  target.potassiumMg += estimatePotassiumPer100(food) * factor;
  target.phosphorusMg += estimatePhosphorusPer100(food) * factor;
  target.fluidMl += estimateFluidFromSolid(food, grams);
}

function addProfileNutrients(
  target: NutrientVector,
  profile: FoodNutrientProfile,
  grams: number,
  food: SchemaFoodItem | undefined,
): void {
  const factor = grams / 100;
  target.caloriesKcal += profile.caloriesKcalPer100 * factor;
  target.carbsG += profile.carbsGPer100 * factor;
  target.proteinG += profile.proteinGPer100 * factor;
  target.fatG += profile.fatGPer100 * factor;
  target.fiberG += profile.fiberGPer100 * factor;
  target.sodiumMg += profile.sodiumMgPer100 * factor;
  target.potassiumMg += profile.potassiumMgPer100 * factor;
  target.phosphorusMg += profile.phosphorusMgPer100 * factor;
  target.cholesterolMg += profile.cholesterolMgPer100 * factor;
  target.saturatedFatG += profile.saturatedFatGPer100 * factor;
  target.sugarG += profile.sugarGPer100 * factor;
  if (food) {
    target.fluidMl += estimateFluidFromSolid(food, grams);
  }
}

function roundVector(value: NutrientVector): NutrientVector {
  return {
    caloriesKcal: Math.round(value.caloriesKcal),
    carbsG: Math.round(value.carbsG),
    proteinG: Math.round(value.proteinG),
    fatG: Math.round(value.fatG),
    fiberG: Math.round(value.fiberG),
    sodiumMg: Math.round(value.sodiumMg),
    potassiumMg: Math.round(value.potassiumMg),
    phosphorusMg: Math.round(value.phosphorusMg),
    cholesterolMg: Math.round(value.cholesterolMg),
    saturatedFatG: Math.round(value.saturatedFatG),
    sugarG: Math.round(value.sugarG),
    fluidMl: Math.round(value.fluidMl),
  };
}

export function calculateTotalsFromMeals(meals: MealPlan[]): NutrientVector {
  const totals = emptyNutrients();
  meals.forEach((meal) => {
    meal.slots?.forEach((slot) => {
      const item = slot.item;
      if (!item) return;
      const grams = parsePortionWeight(item.portion);
      const fallbackFood =
        (item.foodId ? FOOD_BY_ID.get(item.foodId) : undefined) ||
        FOODS.find((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase());

      if (item.nutrientProfile) {
        addProfileNutrients(totals, item.nutrientProfile, grams, fallbackFood);
        return;
      }

      if (!fallbackFood) return;
      addNutrients(totals, fallbackFood, grams);
    });
  });
  return roundVector(totals);
}

function percent(value: number, reference: number): number {
  if (!reference) return 0;
  return (value / reference) * 100;
}

function maxLimit(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return fallback;
}

export function validateWeeklyPlan(plan: WeeklyTherapeuticPlan): PlanValidationReport {
  const issues: string[] = [];
  let nutrientChecksPassed = 0;
  let nutrientChecksTotal = 0;
  let textureMismatchCount = 0;
  let totalMeals = 0;

  const weeklyFoodCounts = new Map<string, number>();
  const repeatedMealFingerprints = new Map<string, number>();
  const requestedTexture = plan.constraints.textureLevel as
    | 'regular'
    | 'soft'
    | 'minced'
    | 'pureed'
    | 'liquid';

  plan.days.forEach((day) => {
    totalMeals += day.meals.length;
    const totals = calculateTotalsFromMeals(day.meals);
    day.totals = totals;

    const caloriesPct = percent(totals.caloriesKcal, day.dailyTargets.caloriesKcal);
    nutrientChecksTotal += 1;
    if (caloriesPct >= 80 && caloriesPct <= 130) {
      nutrientChecksPassed += 1;
    } else {
      issues.push(
        `${day.dayName}: calories out of range (${Math.round(caloriesPct)}% of target ${day.dailyTargets.caloriesKcal} kcal).`,
      );
    }

    nutrientChecksTotal += 1;
    if (totals.proteinG >= day.dailyTargets.proteinG * 0.8) {
      nutrientChecksPassed += 1;
    } else {
      issues.push(
        `${day.dayName}: protein too low (${totals.proteinG}g vs target ${day.dailyTargets.proteinG}g).`,
      );
    }

    nutrientChecksTotal += 1;
    const sodiumLimit = maxLimit(day.dailyTargets.sodiumMgMax, day.dailyTargets.sodiumMg);
    if (totals.sodiumMg <= sodiumLimit) {
      nutrientChecksPassed += 1;
    } else {
      issues.push(
        `${day.dayName}: sodium exceeded (${totals.sodiumMg}mg > ${sodiumLimit}mg).`,
      );
    }

    nutrientChecksTotal += 1;
    if (totals.fiberG >= day.dailyTargets.fiberGMin) {
      nutrientChecksPassed += 1;
    } else {
      issues.push(
        `${day.dayName}: fiber below minimum (${totals.fiberG}g < ${day.dailyTargets.fiberGMin}g).`,
      );
    }

    if (typeof day.dailyTargets.potassiumMgMax === 'number') {
      nutrientChecksTotal += 1;
      if (totals.potassiumMg <= day.dailyTargets.potassiumMgMax) {
        nutrientChecksPassed += 1;
      } else {
        issues.push(
          `${day.dayName}: potassium exceeded (${totals.potassiumMg}mg > ${day.dailyTargets.potassiumMgMax}mg).`,
        );
      }
    }

    if (typeof day.dailyTargets.phosphorusMgMax === 'number') {
      nutrientChecksTotal += 1;
      if (totals.phosphorusMg <= day.dailyTargets.phosphorusMgMax) {
        nutrientChecksPassed += 1;
      } else {
        issues.push(
          `${day.dayName}: phosphorus exceeded (${totals.phosphorusMg}mg > ${day.dailyTargets.phosphorusMgMax}mg).`,
        );
      }
    }

    if (typeof day.dailyTargets.fluidMlTarget === 'number' && day.dailyTargets.fluidMlTarget > 0) {
      nutrientChecksTotal += 1;
      const fluidRatio = percent(totals.fluidMl, day.dailyTargets.fluidMlTarget);
      if (fluidRatio >= 55 && fluidRatio <= 140) {
        nutrientChecksPassed += 1;
      } else {
        issues.push(
          `${day.dayName}: fluid mismatch (${totals.fluidMl}ml vs target ${day.dailyTargets.fluidMlTarget}ml).`,
        );
      }
    }

    day.meals.forEach((meal) => {
      const fingerprint = meal.slots
        ?.map((slot) => slot.item?.foodId || slot.item?.name || 'empty')
        .join('|');

      if (fingerprint) {
        repeatedMealFingerprints.set(fingerprint, (repeatedMealFingerprints.get(fingerprint) || 0) + 1);
      }

      meal.slots?.forEach((slot) => {
        const item = slot.item;
        if (!item || !item.foodId) return;

        const food = FOOD_BY_ID.get(item.foodId);
        if (!food) return;

        if (food.category !== 'beverage') {
          weeklyFoodCounts.set(food.food_id, (weeklyFoodCounts.get(food.food_id) || 0) + 1);
        }

        if (requestedTexture !== 'regular' && !food.texture_tags.includes(requestedTexture)) {
          textureMismatchCount += 1;
        }
      });
    });
  });

  const uniqueFoods = weeklyFoodCounts.size;
  const maxRepeatPerFood =
    weeklyFoodCounts.size > 0 ? Math.max(...Array.from(weeklyFoodCounts.values())) : 0;
  const avgMealsPerDay = totalMeals > 0 ? totalMeals / plan.days.length : 3;
  const minUniqueFoods = avgMealsPerDay >= 6 ? 18 : avgMealsPerDay >= 5 ? 15 : 12;
  const maxAllowedRepeat = avgMealsPerDay >= 6 ? 10 : 7;

  if (uniqueFoods < minUniqueFoods) {
    issues.push(
      `Weekly variety is low (${uniqueFoods} unique non-beverage foods; minimum ${minUniqueFoods} required).`,
    );
  }
  if (maxRepeatPerFood > maxAllowedRepeat) {
    issues.push(
      `Single-food repetition too high (max ${maxRepeatPerFood} repeats; limit is ${maxAllowedRepeat} per week).`,
    );
  }

  const repeatedMealsOverLimit = Array.from(repeatedMealFingerprints.values()).some((count) => count > 5);
  if (repeatedMealsOverLimit) {
    issues.push('Meal slot combinations repeat too often across the week.');
  }

  if (textureMismatchCount > 0) {
    issues.push(`Texture mismatch detected in ${textureMismatchCount} slots for requested texture ${requestedTexture}.`);
  }

  return {
    passed: issues.length === 0,
    issues,
    summary: {
      nutrientChecksPassed,
      nutrientChecksTotal,
      weeklyUniqueFoods: uniqueFoods,
      maxRepeatPerFood,
      textureMismatchCount,
    },
  };
}

export function calculateAlignmentScore(report: PlanValidationReport | undefined): number {
  if (!report) return 90;

  const summary = report.summary;
  if (!summary || summary.nutrientChecksTotal <= 0) {
    return report.passed ? 96 : 85;
  }

  const nutrientPct = (summary.nutrientChecksPassed / summary.nutrientChecksTotal) * 100;
  const nutrientFailures = summary.nutrientChecksTotal - summary.nutrientChecksPassed;
  const nonNutrientIssues = Math.max(0, report.issues.length - nutrientFailures);
  const texturePenalty = summary.textureMismatchCount > 0 ? 8 : 0;
  const repeatPenalty = summary.maxRepeatPerFood > 5 ? 5 : 0;
  const score = nutrientPct - nonNutrientIssues * 2 - texturePenalty - repeatPenalty;

  return Math.max(70, Math.min(99, Math.round(score)));
}
