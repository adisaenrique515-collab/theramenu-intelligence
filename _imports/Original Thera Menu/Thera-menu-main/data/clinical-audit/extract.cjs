const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const XLSX = require('xlsx');

const files = [
  'C:/Users/erick/Downloads/2018CLINICALDIETMANUAL.pdf',
  'C:/Users/erick/Downloads/tdm.pdf',
  'C:/Users/erick/Downloads/ah102.pdf',
  'C:/Users/erick/Downloads/2021-2023 FNDDS At A Glance - Ingredient Nutrient Values.xlsx',
  'C:/Users/erick/Downloads/2021-2023 FNDDS At A Glance - Portions and Weights.xlsx',
  'C:/Users/erick/Downloads/supertrackerfooddatabase.xlsx',
  'C:/Users/erick/Downloads/fruit-and-vegetable-consumption-in-california-residents-2012-2013.pdf',
  'C:/Users/erick/Downloads/Download_Field_Descriptions_Oct2020.pdf',
];

const clinicalKeywords = [
  'sodium','potassium','phosphorus','protein','carbohydrate','fat','fiber','fluid',
  'renal','cardiac','diabetic','dysphagia','iddsi','h. pylori','ulcer','hepatic',
  'food safety','temperature','holding','allergen','texture','portion','serving'
];

function summarizeText(text){
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const hits = {};
  for (const k of clinicalKeywords) {
    const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const m = lower.match(re);
    hits[k] = m ? m.length : 0;
  }
  const top = Object.entries(hits).sort((a,b)=>b[1]-a[1]).slice(0,12);

  const lines = (text || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const headingCandidates = [];
  for (const line of lines) {
    if (line.length < 8 || line.length > 120) continue;
    const letters = line.replace(/[^A-Za-z]/g,'');
    const upperRatio = letters.length ? (line.replace(/[^A-Z]/g,'').length / letters.length) : 0;
    if (upperRatio > 0.6 || /^\d+(\.\d+)*\s+/.test(line) || /:\s*$/.test(line)) {
      headingCandidates.push(line);
      if (headingCandidates.length >= 25) break;
    }
  }

  return {
    charCount: normalized.length,
    topKeywordHits: top,
    headingCandidates,
    preview: normalized.slice(0, 2000)
  };
}

async function summarizePdf(file){
  const dataBuffer = fs.readFileSync(file);
  const parser = new PDFParse({ data: dataBuffer });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    const text = await parser.getText();
    return {
      type: 'pdf',
      pages: info.total || 0,
      info: info.info || {},
      ...summarizeText(text.text || '')
    };
  } finally {
    await parser.destroy();
  }
}

function summarizeXlsx(file){
  const wb = XLSX.readFile(file, { cellDates: false, raw: true });
  const sheets = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const headers = (rows[0] || []).map(v => String(v || '').trim()).filter(Boolean).slice(0, 60);
    const sampleRows = rows.slice(1, 6).map(r => (r || []).slice(0, Math.min(10, colCount)));

    const headerText = headers.join(' ').toLowerCase();
    const keywordSignals = clinicalKeywords.filter(k => headerText.includes(k)).slice(0, 20);

    sheets.push({ sheetName, rowCount, colCount, headers, keywordSignals, sampleRows });
  }

  return { type: 'xlsx', sheetCount: wb.SheetNames.length, sheets };
}

(async () => {
  const out = { generatedAt: new Date().toISOString(), files: [] };
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    try {
      let summary;
      if (ext === '.pdf') summary = await summarizePdf(file);
      else if (ext === '.xlsx') summary = summarizeXlsx(file);
      else summary = { type: 'unknown' };
      out.files.push({ file, ...summary });
      console.log(`processed: ${path.basename(file)}`);
    } catch (error) {
      out.files.push({ file, error: String(error && error.message ? error.message : error) });
      console.error(`failed: ${path.basename(file)} :: ${error.message || error}`);
    }
  }

  const outputPath = 'C:/Users/erick/Downloads/Thera-menu-main-patched/Thera-menu-main/data/clinical-audit/parsed-summary.json';
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`wrote: ${outputPath}`);
})();
