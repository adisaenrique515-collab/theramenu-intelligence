import foods from "../ausnut/foods-core.json";
import measuresByKey from "../ausnut/food-measures-by-key.json";
import recipesByKey from "../ausnut/food-recipes-by-key.json";
import nutrientsMeta from "../ausnut/nutrients-meta.json";
import kdigoCkdRuleSeed from "../clinical/kdigo-ckd-rule-seed.json";
import espenHospitalRuleSeed from "../clinical/espen-hospital-rule-seed.json";

export { foods, measuresByKey, recipesByKey, nutrientsMeta, kdigoCkdRuleSeed, espenHospitalRuleSeed };

export function getFoodByKey(publicFoodKey: string) {
  return (foods as any[]).find((food) => food.publicFoodKey === publicFoodKey) ?? null;
}

export function getMeasuresForFood(publicFoodKey: string) {
  return (measuresByKey as Record<string, any[]>)[publicFoodKey] ?? [];
}

export function getRecipeForFood(publicFoodKey: string) {
  return (recipesByKey as Record<string, any>)[publicFoodKey] ?? null;
}
