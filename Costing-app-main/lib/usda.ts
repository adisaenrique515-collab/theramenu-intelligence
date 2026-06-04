// lib/usda.ts
import type { RecipeData } from "../types";

export interface UsdaPortion { desc: string; grams: number }
export interface UsdaItem { name: string; norm: string; per_100g: Record<string, number|null>; portions?: UsdaPortion[] }

const norm = (s: any) => String(s ?? '').toLowerCase().replace(/\s+/g,' ').trim();

let _items: UsdaItem[] | null = null;
export async function loadUsda(): Promise<UsdaItem[]> {
  if (_items) return _items;
  const data = await fetch('/usda/fndds_ingredients.json').then(r => r.json());
  _items = data as UsdaItem[];
  return _items;
}

function scoreName(a: string, b: string): number {
  if (a === b) return 1000;
  let s = 0; if (a.startsWith(b)) s += 100; if (a.includes(b)) s += 50;
  const terms = b.split(' ').filter(Boolean);
  for (const t of terms) if (a.includes(t)) s += 5;
  return s;
}

function bestMatch(items: UsdaItem[], name: string): UsdaItem | null {
  const n = norm(name);
  let best: UsdaItem | null = null; let bestScore = -1;
  for (const it of items) {
    const s = scoreName(norm(it.name), n);
    if (s > bestScore) { bestScore = s; best = it; }
  }
  return best;
}

function gramsFrom(qty: number, unit: string, portions: UsdaPortion[] | undefined): number | null {
  const q = Number(qty); if (!Number.isFinite(q) || q <= 0) return null;
  const u = norm(unit);
  if (u === 'g' || u === 'gram' || u === 'grams') return q;
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return q * 1000;
  if (u === 'mg' || u === 'milligram' || u === 'milligrams') return q / 1000;
  if (u === 'lb' || u === 'pound' || u === 'pounds') return q * 453.59237;
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return q * 28.349523125;
  // Household: try direct match on portion description
  const P = portions || [];
  const hit = P.find(p => norm(p.desc).includes(u) || u.includes(norm(p.desc)));
  if (hit?.grams) return q * Number(hit.grams);
  const piece = P.find(p => /each|piece|serving|portion/.test(norm(p.desc)) && p.grams);
  if (piece?.grams) return q * Number(piece.grams);
  return null;
}

export interface NutritionPerPortion {
  energy_kcal_per_portion?: number;
  protein_g_per_portion?: number;
  fat_g_per_portion?: number;
  carbs_g_per_portion?: number;
  fiber_g_per_portion?: number;
  sugar_g_per_portion?: number;
  sodium_mg_per_portion?: number;
  satfat_g_per_portion?: number;
  potassium_mg_per_portion?: number;
  phosphorus_mg_per_portion?: number;
}

export async function computePerPortion(recipe: RecipeData, scale: number): Promise<NutritionPerPortion> {
  const items = await loadUsda();
  const acc: Record<string, number> = {};
  const lines = recipe.ingredients || [];
  for (const ing of lines) {
    const it = bestMatch(items, ing.name);
    if (!it) continue;
    const grams = gramsFrom(ing.qty * (scale || 1), ing.unit, it.portions);
    if (!grams) continue;
    const f = grams / 100;
    const p = it.per_100g || {};
    for (const k of Object.keys(p)) {
      const v = p[k];
      if (typeof v === 'number') acc[k] = (acc[k] || 0) + v * f;
    }
  }
  const portions = (recipe.portions || 1) * (scale || 1);
  const per: NutritionPerPortion = {};
  const map: Record<string,string> = {
    energy_kcal: 'energy_kcal_per_portion',
    protein_g: 'protein_g_per_portion',
    fat_g: 'fat_g_per_portion',
    carbs_g: 'carbs_g_per_portion',
    fiber_g: 'fiber_g_per_portion',
    sugar_g: 'sugar_g_per_portion',
    sodium_mg: 'sodium_mg_per_portion',
    satfat_g: 'satfat_g_per_portion',
    potassium_mg: 'potassium_mg_per_portion',
    phosphorus_mg: 'phosphorus_mg_per_portion'
  };
  for (const [src, dst] of Object.entries(map)) {
    if (typeof acc[src] === 'number') (per as any)[dst] = acc[src] / portions;
  }
  return per;
}
