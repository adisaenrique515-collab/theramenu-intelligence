// scripts/protocols/ingest-from-pdf.mjs
import fs from 'fs';
import path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDFS = [
  'C:/Users/erick/Downloads/PDFs/2018CLINICALDIETMANUAL.pdf',
  'C:/Users/erick/Downloads/PDFs/tdm.pdf'
];

const PROTOCOLS_PATH = path.resolve('./public/protocols/clinical_protocols.json');

function norm(s){ return String(s||'').toLowerCase(); }

function findNumberNear(text, key, unitRegex=/mg|g|ml/){
  const idx = text.indexOf(key);
  if (idx === -1) return null;
  const window = text.slice(Math.max(0, idx-120), Math.min(text.length, idx+240));
  const m = window.match(/([0-9]{2,5})\s*(mg|g|ml)/i);
  if (!m) return null;
  const val = Number(m[1]); const unit = m[2].toLowerCase();
  return { val, unit };
}

function toMg(val, unit){
  if (unit === 'mg') return val;
  if (unit === 'g') return val*1000;
  return null;
}

async function extractFacts(file){
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }); const doc = await loadingTask.promise; let txt = ''; for(let p=1;p<=doc.numPages;p++){ const page = await doc.getPage(p); const content = await page.getTextContent(); const s = content.items.map(it => it.str).join(' '); txt += ' ' + s; } txt = norm(txt).replace(/\s+/g,' ');
    const facts = { source: path.basename(file) };

    // Low sodium budgets
    let sod = findNumberNear(txt, 'low sodium');
    if (!sod) sod = findNumberNear(txt, 'sodium restricted');
    if (!sod) sod = findNumberNear(txt, 'sodium');
    if (sod){ const v = toMg(sod.val, sod.unit); if (v && v >= 1000 && v <= 4000) facts.sodium_mg_per_day = v; }

    // Consistent carbohydrate
    const carbWin = txt.match(/(consistent|controlled) carbohydrate.{0,80}?([0-9]{1,3})\s*-?\s*([0-9]{1,3})?\s*g/);
    if (carbWin){
      facts.carb_g_per_meal_min = Number(carbWin[2]);
      if (carbWin[3]) facts.carb_g_per_meal_max = Number(carbWin[3]);
    } else {
      const carbSingle = txt.match(/carbohydrate.{0,40}?([0-9]{1,3})\s*g\s*(per meal|per serving)/);
      if (carbSingle) facts.carb_g_per_meal = Number(carbSingle[1]);
    }

    // Renal – potassium & phosphorus
    const k = findNumberNear(txt, 'potassium');
    if (k){ const v = toMg(k.val, k.unit); if (v && v >= 1000 && v <= 6000) facts.potassium_mg_per_day = v; }
    const phos = findNumberNear(txt, 'phosphorus');
    if (phos){ const v = toMg(phos.val, phos.unit); if (v && v >= 300 && v <= 3000) facts.phosphorus_mg_per_day = v; }

    // Fluid restriction
    const fluid = txt.match(/fluid (restriction|limit).{0,40}?([0-9]{3,4})\s*(ml|mL)/);
    if (fluid){ const v = Number(fluid[2]); if (v >= 500 && v <= 3000) facts.fluid_ml_per_day = v; }

    // Texture keywords
    facts.texture = [];
    if (txt.includes('pureed')) facts.texture.push('pureed');
    if (txt.includes('mechanical soft')) facts.texture.push('mechanical soft');
    if (txt.includes('minced & moist') || txt.includes('minced and moist')) facts.texture.push('minced_moist');

    return facts;
  } catch (e) {
    console.error('[extractFacts] failed for', file, e.message);
    return { source: path.basename(file), error: e.message };
  }
}

function upsertProtocol(list, proto){
  const i = list.findIndex(p => p.id === proto.id);
  if (i === -1) { list.push(proto); return; }
  // merge rules (simple append, avoid duplicate ids)
  const existing = list[i];
  const ids = new Set(existing.rules.map(r => r.id));
  for (const r of proto.rules){ if (!ids.has(r.id)) existing.rules.push(r); }
}

async function run(){
  if (!fs.existsSync(PROTOCOLS_PATH)) throw new Error('protocols json not found: '+PROTOCOLS_PATH);
  const base = JSON.parse(fs.readFileSync(PROTOCOLS_PATH,'utf8'));
  base.updated = new Date().toISOString().slice(0,10);

  const factsArr = [];
  for (const f of PDFS) factsArr.push(await extractFacts(f));

  // Build protocol overlays from extracted facts
  const overlays = [];
  for (const f of factsArr){
    if (f.sodium_mg_per_day){
      const perMeal = Math.round(f.sodium_mg_per_day / 3);
      overlays.push({
        id: `manual_${f.source.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_sodium`,
        name: `Manual-derived Sodium Budget (${f.source})`,
        category: 'Disease',
        triggers: ['low_sodium','htn','chf'],
        rules: [
          { id: 'sodium_threshold_manual', type: 'numeric_threshold', subject: 'meal_totals', path: 'totals.sodium_mg_per_portion', operator: '<=', value: perMeal, severity: 'warning', message: `Sodium exceeds ~${perMeal} mg/portion (derived from manual).`, suggestion: 'Reduce high-sodium ingredients and use herbs/acid for flavor.'}
        ]
      });
    }
    if (f.carb_g_per_meal || (f.carb_g_per_meal_min && f.carb_g_per_meal_max)){
      const min = f.carb_g_per_meal ?? f.carb_g_per_meal_min ?? 45;
      const max = f.carb_g_per_meal ?? f.carb_g_per_meal_max ?? 60;
      overlays.push({
        id: `manual_${f.source.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_carb`,
        name: `Manual-derived Carbohydrate Budget (${f.source})`,
        category: 'Metabolic',
        triggers: ['t2d','t1d','consistent_carb'],
        rules: [
          { id: 'carb_over_manual', type: 'numeric_threshold', subject: 'meal_totals', path: 'totals.carbs_g_per_portion', operator: '<=', value: max, severity: 'warning', message: `Carbohydrates per portion exceed ${max} g target.`, suggestion: 'Increase non-starchy vegetables; choose whole grains and adjust portion sizes.'}
        ]
      });
    }
    if (f.potassium_mg_per_day){
      const perMealK = Math.round(f.potassium_mg_per_day / 3);
      overlays.push({
        id: `manual_${f.source.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_renal_k`,
        name: `Manual-derived Potassium Guidance (${f.source})`,
        category: 'Electrolyte',
        triggers: ['ckd','renal'],
        rules: [
          { id: 'k_flag_manual', type: 'numeric_threshold', subject: 'meal_totals', path: 'totals.potassium_mg_per_portion', operator: '<=', value: perMealK, severity: 'warning', message: `Potassium per portion exceeds ~${perMealK} mg target.`, suggestion: 'Prefer lower-K produce or adjust portions.'}
        ]
      });
    }
    if (f.phosphorus_mg_per_day){
      const perMealP = Math.round(f.phosphorus_mg_per_day / 3);
      overlays.push({
        id: `manual_${f.source.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_renal_p`,
        name: `Manual-derived Phosphorus Guidance (${f.source})`,
        category: 'Electrolyte',
        triggers: ['ckd','renal'],
        rules: [
          { id: 'p_flag_manual', type: 'numeric_threshold', subject: 'meal_totals', path: 'totals.phosphorus_mg_per_portion', operator: '<=', value: perMealP, severity: 'info', message: `Phosphorus per portion exceeds ~${perMealP} mg target.`, suggestion: 'Reduce processed cheeses/colas; prefer whole foods.'}
        ]
      });
    }
    if (f.fluid_ml_per_day){
      const perMealMl = Math.round(f.fluid_ml_per_day / 3);
      overlays.push({
        id: `manual_${f.source.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_fluid`,
        name: `Manual-derived Fluid Restriction (${f.source})`,
        category: 'Other',
        triggers: ['chf','ckd','fluid_restriction'],
        rules: [
          { id: 'fluid_flag_manual', type: 'numeric_threshold', subject: 'meal_totals', path: 'totals.fluid_ml_per_portion', operator: '<=', value: perMealMl, severity: 'warning', message: `Estimated fluid per portion exceeds ~${perMealMl} mL target.`, suggestion: 'Reduce broths/soups, ice, gelatin; adjust beverages.'}
        ]
      });
    }
    if (Array.isArray(f.texture) && f.texture.includes('pureed')){
      overlays.push({
        id: `manual_${f.source.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_texture`,
        name: `Manual-derived Texture (Pureed)`,
        category: 'Texture',
        triggers: ['iddsi_lvl4'],
        rules: [
          { id: 'texture_pureed_manual', type: 'texture_allow_list', subject: 'meal_meta', path: 'texture.level', operator: '=', value: 'pureed', severity: 'critical', message: 'Item must be pureed texture.', suggestion: 'Blend to smooth; avoid mixed textures.'}
        ]
      });
    }
  }

  // Upsert overlays into base.protocols
  for (const ov of overlays){ upsertProtocol(base.protocols, ov); }

  fs.writeFileSync(PROTOCOLS_PATH+'.bak', fs.readFileSync(PROTOCOLS_PATH));
  fs.writeFileSync(PROTOCOLS_PATH, JSON.stringify(base,null,2));
  console.log(`[protocols] updated ${PROTOCOLS_PATH} with ${overlays.length} overlay protocol(s).`);
  console.log(`[protocols] sources parsed:`, factsArr);
}

run().catch(e=>{ console.error(e); process.exit(1); });










