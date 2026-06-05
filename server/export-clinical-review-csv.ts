/**
 * server/export-clinical-review-csv.ts — Phase 8: CSV export for clinical review.
 *
 * Produces a CSV file containing FoodItem records in a format suitable for
 * dietitian review in spreadsheet applications.
 *
 * Design rules:
 *   - All values are properly escaped (commas, double-quotes, newlines).
 *   - Multi-value fields (allergens, missingNutrients, etc.) are joined with ' | '.
 *   - Nutrient values are rounded to 2 decimal places.
 *   - A review checklist column is included to prompt the reviewer.
 *   - The header row includes the units for each nutrient field.
 *   - This module is server-side only — no API keys appear in output.
 */

import type { FoodItem } from '../types-clinical.ts';

// ── CSV escaping ──────────────────────────────────────────────────────────

/**
 * csvCell — escape a single value for RFC 4180 CSV.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 */
function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function r2(n: number): string {
  return n.toFixed(2);
}

// ── Column definitions ────────────────────────────────────────────────────

const HEADERS = [
  // Identity
  'id',
  'canonicalName',
  'fdcId',
  'category',
  'preparationState',
  // Governance
  'approvalStatus',
  'source',
  'confidence',
  'verifiedBy',
  'verifiedAt',
  'reviewDueAt',
  // Nutrients (per 100 g)
  'caloriesKcal_per100g',
  'proteinG_per100g',
  'carbsG_per100g',
  'fatG_per100g',
  'fiberG_per100g',
  'sodiumMg_per100g',
  'potassiumMg_per100g',
  'phosphorusMg_per100g',
  'cholesterolMg_per100g',
  'saturatedFatG_per100g',
  'sugarG_per100g',
  // Data quality
  'missingNutrients',
  'missingNutrientCount',
  // Clinical safety (requires dietitian input)
  'allergens',
  'contraindicatedFor',
  'textureLevels',
  'tags',
  // Review prompt
  'dietitianReviewChecklist',
] as const;

const REVIEW_CHECKLIST = [
  'Verify allergens',
  'Set contraindications',
  'Confirm texture levels',
  'Check portion limits',
  'Validate nutrient source',
].join(' | ');

// ── Row builder ───────────────────────────────────────────────────────────

function foodToRow(food: FoodItem): string {
  const n = food.nutrientsPer100g;

  const cells: Array<string | number | undefined | null> = [
    // Identity
    food.id,
    food.canonicalName,
    food.fdcId ?? '',
    food.category,
    food.preparationState,
    // Governance
    food.approvalStatus,
    food.source,
    food.confidence,
    food.verifiedBy ?? '',
    food.verifiedAt ?? '',
    food.reviewDueAt ?? '',
    // Nutrients
    r2(n.caloriesKcal),
    r2(n.proteinG),
    r2(n.carbsG),
    r2(n.fatG),
    r2(n.fiberG),
    r2(n.sodiumMg),
    r2(n.potassiumMg),
    r2(n.phosphorusMg),
    r2(n.cholesterolMg),
    r2(n.saturatedFatG),
    r2(n.sugarG),
    // Data quality
    food.missingNutrients.join(' | '),
    food.missingNutrients.length,
    // Clinical safety
    food.allergens.join(' | '),
    food.contraindicatedFor.join(' | '),
    food.textureLevels.join(' | '),
    (food.tags ?? []).join(' | '),
    // Review checklist
    REVIEW_CHECKLIST,
  ];

  return cells.map(csvCell).join(',');
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * exportToClinicalReviewCsv — serialise an array of FoodItems to CSV.
 *
 * Returns the complete CSV string including the header row.
 * An empty input array returns just the header row.
 * The output uses CRLF line endings (RFC 4180).
 */
export function exportToClinicalReviewCsv(
  foods: ReadonlyArray<FoodItem>,
): string {
  const header = HEADERS.join(',');
  const rows   = foods.map(foodToRow);
  return [header, ...rows].join('\r\n');
}

/**
 * parseClinicalReviewCsv — parse a CSV string (previously exported by this
 * module) back into an array of plain row objects keyed by header name.
 *
 * Used for round-trip tests and to re-ingest dietitian-annotated files.
 * Values are all strings — callers are responsible for type coercion.
 *
 * Limitations:
 *   - Only handles simple RFC 4180 quoting (no multi-line cells).
 *   - Intended for machine-generated CSVs from this module only.
 */
export function parseClinicalReviewCsv(
  csv: string,
): ReadonlyArray<Readonly<Record<string, string>>> {
  // Normalise line endings
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = splitCsvRow(lines[0]!);
  const result: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvRow(lines[i]!);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? '';
    }
    result.push(row);
  }

  return result;
}

/**
 * splitCsvRow — split a single CSV line respecting RFC 4180 quoting.
 * Does not handle multi-line quoted values (not produced by this module).
 */
function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}
