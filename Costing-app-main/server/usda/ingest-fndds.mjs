// server/usda/ingest-fndds.mjs
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const OUT_DIR = path.resolve('./server/data/usda');
const FILES = {
  fnddsNutrients: 'C:/Users/erick/Downloads/USDA/xl/2021-2023 FNDDS At A Glance - Ingredient Nutrient Values.xlsx',
  fnddsPortions: 'C:/Users/erick/Downloads/USDA/xl/2021-2023 FNDDS At A Glance - Portions and Weights.xlsx',
};

const normalize = (s) => String(s||'').toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 %/().,\-]/g,'').trim();

function readNutrients(file){
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws,{defval:null, range:1}); // skip banner row
  const wanted = new Map();
  for(const r of rows){
    const name = r['Ingredient description'];
    const ndesc = r['Nutrient description'];
    const val = Number(r['Nutrient value']);
    if(!name || !ndesc || !Number.isFinite(val)) continue;
    const key = normalize(name);
    if(!wanted.has(key)) wanted.set(key,{ name, norm:key, per_100g:{} });
    const rec = wanted.get(key).per_100g;
    switch(ndesc){
      case 'Energy': rec.energy_kcal = val; break;
      case 'Protein': rec.protein_g = val; break;
      case 'Total Fat': rec.fat_g = val; break;
      case 'Carbohydrate': rec.carbs_g = val; break;
      case 'Fiber, total dietary': rec.fiber_g = val; break;
      case 'Sugars, total': rec.sugar_g = val; break;
      case 'Sodium': rec.sodium_mg = val; break;
      case 'Fatty acids, total saturated': rec.satfat_g = val; break;
      default: break;
    }
  }
  return Array.from(wanted.values());
}

function readPortions(file){
  const wb = xlsx.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws,{defval:null, range:1}); // skip banner row
  const map = new Map();
  for(const r of rows){
    const name = r['Main food description'];
    const desc = r['Portion description'];
    const grams = Number(r['Portion weight\r\n(g)'] ?? r['Portion weight (g)']);
    if(!name || !desc || !Number.isFinite(grams)) continue;
    const key = normalize(name);
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push({ desc, grams });
  }
  return map;
}

function merge(nutrients, portionsMap){
  return nutrients.map(n => ({
    name: n.name,
    norm: n.norm,
    per_100g: {
      energy_kcal: n.per_100g.energy_kcal ?? null,
      protein_g: n.per_100g.protein_g ?? null,
      fat_g: n.per_100g.fat_g ?? null,
      carbs_g: n.per_100g.carbs_g ?? null,
      fiber_g: n.per_100g.fiber_g ?? null,
      sugar_g: n.per_100g.sugar_g ?? null,
      sodium_mg: n.per_100g.sodium_mg ?? null,
      satfat_g: n.per_100g.satfat_g ?? null,
    },
    portions: portionsMap.get(n.norm) || []
  }));
}

async function run(){
  if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true});
  const nutrients = readNutrients(FILES.fnddsNutrients);
  const portionsMap = readPortions(FILES.fnddsPortions);
  const merged = merge(nutrients, portionsMap);
  fs.writeFileSync(path.join(OUT_DIR,'fndds_ingredients.json'), JSON.stringify(merged,null,2));
  const nameIndex = merged.map(x => ({name:x.name, norm:x.norm}));
  fs.writeFileSync(path.join(OUT_DIR,'fndds_name_index.json'), JSON.stringify(nameIndex,null,2));
  console.log(`[ingest] Wrote ${merged.length} items to server/data/usda/fndds_ingredients.json`);
}

run().catch(e=>{ console.error(e); process.exit(1); });
