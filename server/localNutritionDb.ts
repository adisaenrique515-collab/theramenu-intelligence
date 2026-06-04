import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import type {
  LocalFoodQuery,
  LocalFoodRecord,
  LocalNutritionDbStatus,
} from '../localNutritionDb.types.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data', 'local-db');
const DB_PATH = path.join(DATA_DIR, 'theramenu-clinical.sqlite');
const REQUIRED_FILES = ['FOOD_DES.txt', 'NUT_DATA.txt', 'WEIGHT.txt'] as const;

const NUTRIENT_CODES = {
  caloriesKcalPer100: '208',
  proteinGPer100: '203',
  fatGPer100: '204',
  carbsGPer100: '205',
  fiberGPer100: '291',
  sugarGPer100: '269',
  sodiumMgPer100: '307',
  potassiumMgPer100: '306',
  phosphorusMgPer100: '305',
  cholesterolMgPer100: '601',
  saturatedFatGPer100: '606',
} as const;

interface LocalFoodRow {
  ndbNo: string;
  description: string;
  refusePct: number;
  caloriesKcalPer100: number | null;
  carbsGPer100: number | null;
  proteinGPer100: number | null;
  fatGPer100: number | null;
  fiberGPer100: number | null;
  sodiumMgPer100: number | null;
  potassiumMgPer100: number | null;
  phosphorusMgPer100: number | null;
  cholesterolMgPer100: number | null;
  saturatedFatGPer100: number | null;
  sugarGPer100: number | null;
}

function getCandidateDirs(): string[] {
  return [
    process.env.THERAMENU_USDA_FLATFILE_DIR,
    path.join(ROOT_DIR, 'data', 'usda-flatfiles'),
    path.join(ROOT_DIR, 'resources', 'usda-flatfiles'),
  ].filter(Boolean) as string[];
}

function ensureDirectoryStructure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDatabase(): DatabaseSync {
  ensureDirectoryStructure();
  const database = new DatabaseSync(DB_PATH, {
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });

  database.exec(`
    CREATE TABLE IF NOT EXISTS Food_Description (
      NDB_No TEXT PRIMARY KEY,
      Long_Desc TEXT NOT NULL,
      Refuse_Pct REAL DEFAULT 0
    ) STRICT;

    CREATE TABLE IF NOT EXISTS Nutrient_Data (
      NDB_No TEXT NOT NULL,
      Nutrient_No TEXT NOT NULL,
      Nutrient_Val REAL NOT NULL,
      PRIMARY KEY (NDB_No, Nutrient_No),
      FOREIGN KEY (NDB_No) REFERENCES Food_Description(NDB_No) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS Weights_and_Measures (
      NDB_No TEXT NOT NULL,
      Seq TEXT NOT NULL,
      Msre_Desc TEXT NOT NULL,
      Gram_Weight REAL NOT NULL,
      PRIMARY KEY (NDB_No, Seq, Msre_Desc),
      FOREIGN KEY (NDB_No) REFERENCES Food_Description(NDB_No) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS ETL_Metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_nutrient_data_ndb_no ON Nutrient_Data(NDB_No);
    CREATE INDEX IF NOT EXISTS idx_weight_ndb_no ON Weights_and_Measures(NDB_No);
  `);

  return database;
}

function parseFlatFileLine(line: string): string[] {
  return line.split('^').map((token) => token.replace(/^~/, '').replace(/~$/, '').trim());
}

function findFlatFileDirectory(): { directory: string | null; files: Record<string, string | null> } {
  for (const directory of getCandidateDirs()) {
    const files = Object.fromEntries(
      REQUIRED_FILES.map((name) => {
        const fullPath = path.join(directory, name);
        return [name, fs.existsSync(fullPath) ? fullPath : null];
      }),
    ) as Record<string, string | null>;

    if (REQUIRED_FILES.every((name) => Boolean(files[name]))) {
      return { directory, files };
    }
  }

  return {
    directory: null,
    files: Object.fromEntries(REQUIRED_FILES.map((name) => [name, null])) as Record<string, string | null>,
  };
}

function makeFingerprint(filePath: string): string {
  const stat = fs.statSync(filePath);
  return `${path.basename(filePath)}:${stat.size}:${stat.mtimeMs}`;
}

function currentFingerprint(files: Record<string, string | null>): string | null {
  if (!REQUIRED_FILES.every((name) => files[name])) {
    return null;
  }

  return REQUIRED_FILES.map((name) => makeFingerprint(files[name] as string)).join('|');
}

function importFoodDescriptions(database: DatabaseSync, filePath: string) {
  const insert = database.prepare(`
    INSERT INTO Food_Description (NDB_No, Long_Desc, Refuse_Pct)
    VALUES (?, ?, ?)
  `);

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const columns = parseFlatFileLine(line);
    if (!columns[0] || !columns[2]) continue;
    const refuse = Number(columns[8] || 0);
    insert.run(columns[0], columns[2], Number.isFinite(refuse) ? refuse : 0);
  }
}

function importNutrientData(database: DatabaseSync, filePath: string) {
  const insert = database.prepare(`
    INSERT INTO Nutrient_Data (NDB_No, Nutrient_No, Nutrient_Val)
    VALUES (?, ?, ?)
  `);

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const columns = parseFlatFileLine(line);
    if (!columns[0] || !columns[1]) continue;
    const value = Number(columns[2] || 0);
    insert.run(columns[0], columns[1], Number.isFinite(value) ? value : 0);
  }
}

function importWeights(database: DatabaseSync, filePath: string) {
  const insert = database.prepare(`
    INSERT INTO Weights_and_Measures (NDB_No, Seq, Msre_Desc, Gram_Weight)
    VALUES (?, ?, ?, ?)
  `);

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const columns = parseFlatFileLine(line);
    if (!columns[0] || !columns[1] || !columns[3]) continue;
    const gramWeight = Number(columns[4] || 0);
    insert.run(columns[0], columns[1], columns[3], Number.isFinite(gramWeight) ? gramWeight : 0);
  }
}

function importFlatFiles(database: DatabaseSync, files: Record<string, string | null>, fingerprint: string) {
  database.exec('BEGIN');

  try {
    database.exec('DELETE FROM Nutrient_Data; DELETE FROM Weights_and_Measures; DELETE FROM Food_Description;');
    importFoodDescriptions(database, files['FOOD_DES.txt'] as string);
    importNutrientData(database, files['NUT_DATA.txt'] as string);
    importWeights(database, files['WEIGHT.txt'] as string);

    const upsertMetadata = database.prepare(`
      INSERT INTO ETL_Metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    upsertMetadata.run('source_fingerprint', fingerprint);
    upsertMetadata.run('last_import_at', new Date().toISOString());
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function readRowCount(database: DatabaseSync, tableName: 'Food_Description' | 'Nutrient_Data' | 'Weights_and_Measures'): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count?: number } | undefined;
  return Number(row?.count || 0);
}

function hydrateDatabase(database: DatabaseSync) {
  const { files } = findFlatFileDirectory();
  const sourceFingerprint = currentFingerprint(files);

  if (!sourceFingerprint) {
    return;
  }

  const existingFingerprintRow = database
    .prepare(`SELECT value FROM ETL_Metadata WHERE key = 'source_fingerprint'`)
    .get() as { value?: string } | undefined;

  if (existingFingerprintRow?.value !== sourceFingerprint) {
    importFlatFiles(database, files, sourceFingerprint);
  }
}

function getBestMeasure(database: DatabaseSync, ndbNo: string, preferredGramWeight: number) {
  const measure = database.prepare(`
    SELECT Msre_Desc AS measureDescription, Gram_Weight AS gramWeight
    FROM Weights_and_Measures
    WHERE NDB_No = ?
    ORDER BY ABS(Gram_Weight - ?) ASC, CAST(Seq AS INTEGER) ASC
    LIMIT 1
  `).get(ndbNo, preferredGramWeight) as
    | { measureDescription?: string; gramWeight?: number }
    | undefined;

  return {
    measureDescription: measure?.measureDescription || '100 g portion',
    gramWeight: Number(measure?.gramWeight || preferredGramWeight || 100),
  };
}

function coerceNutrient(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function mapFoodRow(database: DatabaseSync, row: LocalFoodRow, preferredGramWeight: number): LocalFoodRecord {
  const measure = getBestMeasure(database, row.ndbNo, preferredGramWeight);
  const refusePct = coerceNutrient(row.refusePct);
  const edibleGramWeight = Math.max(1, Math.round(measure.gramWeight * (1 - refusePct / 100)));

  return {
    ndbNo: row.ndbNo,
    description: row.description,
    refusePct,
    measureDescription: measure.measureDescription,
    gramWeight: Math.round(measure.gramWeight),
    edibleGramWeight,
    caloriesKcalPer100: coerceNutrient(row.caloriesKcalPer100),
    carbsGPer100: coerceNutrient(row.carbsGPer100),
    proteinGPer100: coerceNutrient(row.proteinGPer100),
    fatGPer100: coerceNutrient(row.fatGPer100),
    fiberGPer100: coerceNutrient(row.fiberGPer100),
    sodiumMgPer100: coerceNutrient(row.sodiumMgPer100),
    potassiumMgPer100: coerceNutrient(row.potassiumMgPer100),
    phosphorusMgPer100: coerceNutrient(row.phosphorusMgPer100),
    cholesterolMgPer100: coerceNutrient(row.cholesterolMgPer100),
    saturatedFatGPer100: coerceNutrient(row.saturatedFatGPer100),
    sugarGPer100: coerceNutrient(row.sugarGPer100),
  };
}

function scoreFood(record: LocalFoodRecord, query: LocalFoodQuery): number {
  let score = 0;
  const lowerDescription = record.description.toLowerCase();

  query.keywords.forEach((keyword, index) => {
    if (lowerDescription.includes(keyword.toLowerCase())) {
      score += 20 - index;
    }
  });

  if (query.preferHigherFiber) {
    score += record.fiberGPer100 * 3;
  }
  if (query.preferLowerSodium) {
    score += Math.max(0, 20 - record.sodiumMgPer100 / 10);
  }
  if (query.preferLowerPhosphorus) {
    score += Math.max(0, 24 - record.phosphorusMgPer100 / 8);
  }
  if (typeof query.minProteinGPer100 === 'number') {
    score += record.proteinGPer100 * 2;
  }
  if (typeof query.maxProteinGPer100 === 'number') {
    score += Math.max(0, 15 - record.proteinGPer100);
  }
  (query.preferDescriptionTerms || []).forEach((term, index) => {
    if (lowerDescription.includes(term.toLowerCase())) {
      score += 16 - Math.min(index, 10);
    }
  });
  (query.avoidDescriptionTerms || []).forEach((term, index) => {
    if (lowerDescription.includes(term.toLowerCase())) {
      score -= 14 - Math.min(index, 8);
    }
  });

  score += Math.max(0, 12 - record.refusePct);
  return score;
}

export function getLocalNutritionDbStatus(): LocalNutritionDbStatus {
  const { directory, files } = findFlatFileDirectory();
  const database = openDatabase();
  const notes: string[] = [
    'Protected Health Information remains local to the device and internal process boundary.',
    'Annual USDA updates can be applied by swapping flat files; the ETL fingerprint is re-evaluated on each request.',
  ];

  try {
    hydrateDatabase(database);

    const lastImportAtRow = database
      .prepare(`SELECT value FROM ETL_Metadata WHERE key = 'last_import_at'`)
      .get() as { value?: string } | undefined;

    if (!currentFingerprint(files)) {
      notes.push('Waiting for FOOD_DES.txt, NUT_DATA.txt, and WEIGHT.txt in a configured local flat-file directory.');
    } else {
      notes.push('Flat-file ETL imported into local SQLite without rebuilding application code.');
    }

    return {
      databasePath: DB_PATH,
      databaseReady: readRowCount(database, 'Food_Description') > 0,
      dataSource: 'LOCAL_SQLITE',
      phiProcessing: 'LOCAL_ONLY',
      flatFileDirectory: directory,
      requiredFiles: REQUIRED_FILES.map((name) => ({
        name,
        found: Boolean(files[name]),
        path: files[name],
      })),
      lastImportAt: lastImportAtRow?.value || null,
      rowCounts: {
        foodDescription: readRowCount(database, 'Food_Description'),
        nutrientData: readRowCount(database, 'Nutrient_Data'),
        weightsAndMeasures: readRowCount(database, 'Weights_and_Measures'),
      },
      notes,
    };
  } finally {
    database.close();
  }
}

export function queryLocalFoods(query: LocalFoodQuery): LocalFoodRecord[] {
  const database = openDatabase();

  try {
    hydrateDatabase(database);

    if (readRowCount(database, 'Food_Description') <= 0) {
      throw new Error('Nutrition DB not ready. Load FOOD_DES.txt, NUT_DATA.txt, and WEIGHT.txt into the configured local flat-file directory.');
    }

    const limit = Math.max(1, Math.min(query.limit || 12, 48));
    const keywords = Array.from(new Set(query.keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)));
    const searchTerms = keywords.length > 0 ? keywords : [''];
    const whereClause = searchTerms.map(() => 'LOWER(fd.Long_Desc) LIKE ?').join(' OR ');

    const rows = database.prepare(`
      SELECT
        fd.NDB_No AS ndbNo,
        fd.Long_Desc AS description,
        fd.Refuse_Pct AS refusePct,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.caloriesKcalPer100}' THEN nd.Nutrient_Val END) AS caloriesKcalPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.carbsGPer100}' THEN nd.Nutrient_Val END) AS carbsGPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.proteinGPer100}' THEN nd.Nutrient_Val END) AS proteinGPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.fatGPer100}' THEN nd.Nutrient_Val END) AS fatGPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.fiberGPer100}' THEN nd.Nutrient_Val END) AS fiberGPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.sodiumMgPer100}' THEN nd.Nutrient_Val END) AS sodiumMgPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.potassiumMgPer100}' THEN nd.Nutrient_Val END) AS potassiumMgPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.phosphorusMgPer100}' THEN nd.Nutrient_Val END) AS phosphorusMgPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.cholesterolMgPer100}' THEN nd.Nutrient_Val END) AS cholesterolMgPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.saturatedFatGPer100}' THEN nd.Nutrient_Val END) AS saturatedFatGPer100,
        MAX(CASE WHEN nd.Nutrient_No = '${NUTRIENT_CODES.sugarGPer100}' THEN nd.Nutrient_Val END) AS sugarGPer100
      FROM Food_Description fd
      LEFT JOIN Nutrient_Data nd ON fd.NDB_No = nd.NDB_No
      WHERE ${whereClause}
      GROUP BY fd.NDB_No, fd.Long_Desc, fd.Refuse_Pct
      LIMIT ?
    `).all(...searchTerms.map((keyword) => `%${keyword}%`), Math.max(limit * 4, 24)) as unknown as LocalFoodRow[];

    const excludeTerms = (query.excludeTerms || []).map((term) => term.toLowerCase());
    const preferredGramWeight = query.preferredGramWeight || 120;

    return rows
      .map((row) => mapFoodRow(database, row, preferredGramWeight))
      .filter((record) => !excludeTerms.some((term) => record.description.toLowerCase().includes(term)))
      .filter((record) => typeof query.maxRefusePct !== 'number' || record.refusePct <= query.maxRefusePct)
      .filter((record) => typeof query.minFiberGPer100 !== 'number' || record.fiberGPer100 >= query.minFiberGPer100)
      .filter((record) => typeof query.maxSodiumMgPer100 !== 'number' || record.sodiumMgPer100 <= query.maxSodiumMgPer100)
      .filter((record) => typeof query.maxPotassiumMgPer100 !== 'number' || record.potassiumMgPer100 <= query.maxPotassiumMgPer100)
      .filter((record) => typeof query.maxPhosphorusMgPer100 !== 'number' || record.phosphorusMgPer100 <= query.maxPhosphorusMgPer100)
      .filter((record) => typeof query.maxProteinGPer100 !== 'number' || record.proteinGPer100 <= query.maxProteinGPer100)
      .filter((record) => typeof query.minProteinGPer100 !== 'number' || record.proteinGPer100 >= query.minProteinGPer100)
      .sort((left, right) => scoreFood(right, query) - scoreFood(left, query))
      .slice(0, limit);
  } finally {
    database.close();
  }
}
