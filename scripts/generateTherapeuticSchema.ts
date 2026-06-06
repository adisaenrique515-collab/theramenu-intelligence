import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ClinicalProtocol,
  FoodRuleType,
  ProtocolCode,
  ProtocolComponentSlot,
  ProtocolFamily,
  ProtocolFoodRule,
  ProtocolRuleTargets,
  ProtocolServiceRule,
  ProtocolSlotCandidate,
  SchemaMealType,
  SchemaTextureClass,
} from '../types.ts';
import type { ClinicalTargetRule, VersionedClinicalProtocol } from '../types-clinical.ts';
import { CLINICAL_PROTOCOL_REGISTRY } from '../server/clinicalProtocols.ts';
import {
  CLINICAL_PROTOCOLS as CURRENT_PROTOCOLS,
  PROTOCOL_COMPONENT_SLOTS as CURRENT_SLOTS,
  PROTOCOL_FOOD_RULES as CURRENT_FOOD_RULES,
  PROTOCOL_RULE_TARGETS as CURRENT_TARGETS,
  PROTOCOL_SERVICE_RULES as CURRENT_SERVICE_RULES,
  PROTOCOL_SLOT_CANDIDATES as CURRENT_CANDIDATES,
} from '../config/therapeuticSchema.ts';

type GeneratedSchema = {
  protocols: ClinicalProtocol[];
  targets: ProtocolRuleTargets[];
  foodRules: ProtocolFoodRule[];
  slots: ProtocolComponentSlot[];
  candidates: ProtocolSlotCandidate[];
  serviceRules: ProtocolServiceRule[];
};

type Mismatch = {
  protocol: string;
  table: string;
  field: string;
  current: unknown;
  generated: unknown;
};

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'config', 'therapeuticSchema.generated.ts');

const PROTOCOL_NAME_BY_CODE: Partial<Record<ProtocolCode, string>> = {
  GENERAL_HOSPITAL: 'General Hospital Baseline',
  T2DM: 'Type 2 Diabetes Glycemic Control',
  HTN: 'Hypertension Sodium Control',
  CARDIAC: 'Cardiac Protection',
  RENAL_STAGE_3: 'Renal Stage 3 Protection',
  RENAL_STAGE_4: 'Renal Stage 4 Protection',
  H_PYLORI: 'H. Pylori Gastric Protection',
  GASTRIC: 'Gastric Sensitivity Protection',
  PEPTIC_ULCER: 'Peptic Ulcer Protection',
  HEPATIC: 'Hepatic Support Baseline',
};

const FAMILY_BY_CODE: Record<ProtocolCode, ProtocolFamily> = {
  GENERAL_HOSPITAL: 'general',
  T2DM: 'endocrine',
  HTN: 'cardiovascular',
  CARDIAC: 'cardiovascular',
  RENAL_STAGE_3: 'renal',
  RENAL_STAGE_4: 'renal',
  H_PYLORI: 'gastric',
  GASTRIC: 'gastric',
  PEPTIC_ULCER: 'gastric',
  HEPATIC: 'hepatic',
};

const DEFAULT_TEXTURE_BY_CODE: Partial<Record<ProtocolCode, SchemaTextureClass>> = {
  H_PYLORI: 'soft',
  GASTRIC: 'soft',
  PEPTIC_ULCER: 'soft',
};

const MEAL_TYPE_TO_SCHEMA: Record<string, SchemaMealType | null> = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
  'Snack AM': 'snack_am',
  'Snack PM': 'snack_pm',
  'Snack Eve': 'snack_eve',
};

function stableSortByCode<T extends { protocol_code: ProtocolCode }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.protocol_code.localeCompare(b.protocol_code));
}

function targetValue(rule: ClinicalTargetRule | undefined, fallback: number): number {
  if (!rule) return fallback;
  if (rule.type === 'fixed') return rule.value;
  if (rule.type === 'range') return rule.max;
  if (rule.type === 'per_kg') return rule.min ?? rule.multiplier;
  return fallback;
}

function targetRangeMin(rule: ClinicalTargetRule | undefined, fallback: number): number {
  if (!rule) return fallback;
  if (rule.type === 'range') return rule.min / 100;
  if (rule.type === 'fixed') return rule.value;
  if (rule.type === 'per_kg') return rule.min ?? rule.multiplier;
  return fallback;
}

function targetRangeMax(rule: ClinicalTargetRule | undefined, fallback: number): number {
  if (!rule) return fallback;
  if (rule.type === 'range') return rule.max / 100;
  if (rule.type === 'fixed') return rule.value;
  if (rule.type === 'per_kg') return rule.max ?? rule.multiplier;
  return fallback;
}

function fluidTarget(rule: ClinicalTargetRule | undefined): string {
  if (!rule) return 'weightKg*30';
  if (rule.type === 'fixed') return String(rule.value);
  if (rule.type === 'range') return String(rule.max);
  if (rule.type === 'per_kg') return `weightKg*${rule.multiplier}`;
  return 'manual_override';
}

function toClinicalProtocol(protocol: VersionedClinicalProtocol): ClinicalProtocol {
  const code = protocol.diagnosisCode as ProtocolCode;
  return {
    protocol_code: code,
    protocol_name: PROTOCOL_NAME_BY_CODE[code] ?? code.replace(/_/g, ' '),
    family: FAMILY_BY_CODE[code],
    default_texture: DEFAULT_TEXTURE_BY_CODE[code] ?? 'regular',
    default_meal_count: 6,
    active: protocol.status !== 'retired',
  };
}

function toTargets(protocol: VersionedClinicalProtocol): ProtocolRuleTargets {
  const code = protocol.diagnosisCode as ProtocolCode;
  return {
    protocol_code: code,
    energy_formula: 'BMR*activity*stress',
    protein_g_per_kg_min: targetRangeMin(protocol.targets.protein, 1),
    carb_pct_min: targetRangeMin(protocol.targets.carbsPercent, 0.45),
    carb_pct_max: targetRangeMax(protocol.targets.carbsPercent, 0.55),
    fat_pct_min: targetRangeMin(protocol.targets.fatPercent, 0.25),
    fat_pct_max: targetRangeMax(protocol.targets.fatPercent, 0.35),
    fiber_min_g: targetValue(protocol.targets.fiber, 25),
    sodium_max_mg: targetValue(protocol.targets.sodium, 2000),
    potassium_max_mg: protocol.targets.potassium ? targetValue(protocol.targets.potassium, 0) : null,
    phosphorus_max_mg: protocol.targets.phosphorus ? targetValue(protocol.targets.phosphorus, 0) : null,
    sugar_max_g: protocol.targets.sugar ? targetValue(protocol.targets.sugar, 0) : null,
    gi_max: protocol.targets.glycaemicIndex ? targetValue(protocol.targets.glycaemicIndex, 60) : 60,
    fluid_target_ml: fluidTarget(protocol.targets.fluid ?? protocol.targets.fluidRestriction),
  };
}

function toFoodRules(protocol: VersionedClinicalProtocol): ProtocolFoodRule[] {
  const code = protocol.diagnosisCode as ProtocolCode;
  const rows: ProtocolFoodRule[] = [];
  protocol.requiredTags.forEach((tag, idx) => {
    rows.push({
      protocol_code: code,
      rule_type: 'prefer' satisfies FoodRuleType,
      food_tag: tag,
      priority: 10 - Math.min(idx, 9),
      note: `Generated from requiredTags in clinicalProtocols.ts`,
    });
  });
  protocol.forbiddenTags.forEach((tag, idx) => {
    rows.push({
      protocol_code: code,
      rule_type: 'avoid' satisfies FoodRuleType,
      food_tag: tag,
      priority: 10 - Math.min(idx, 9),
      note: `Generated from forbiddenTags in clinicalProtocols.ts`,
    });
  });
  return rows.sort((a, b) =>
    a.protocol_code.localeCompare(b.protocol_code) ||
    a.rule_type.localeCompare(b.rule_type) ||
    b.priority - a.priority ||
    a.food_tag.localeCompare(b.food_tag),
  );
}

function toSlots(protocol: VersionedClinicalProtocol): ProtocolComponentSlot[] {
  const code = protocol.diagnosisCode as ProtocolCode;
  return protocol.slotTemplates
    .map((slot, idx): ProtocolComponentSlot | null => {
      const mealType = MEAL_TYPE_TO_SCHEMA[slot.mealType];
      if (!mealType) return null;
      return {
        protocol_code: code,
        meal_type: mealType,
        slot_name: slot.slotName,
        required: slot.required,
        min_items: slot.required ? 1 : 0,
        max_items: 1,
        slot_order: (idx % 4) + 1,
      };
    })
    .filter((slot): slot is ProtocolComponentSlot => slot !== null)
    .sort((a, b) =>
      a.protocol_code.localeCompare(b.protocol_code) ||
      a.meal_type.localeCompare(b.meal_type) ||
      a.slot_order - b.slot_order ||
      a.slot_name.localeCompare(b.slot_name),
    );
}

function generateFromClinicalProtocols(): GeneratedSchema {
  const protocols = Object.values(CLINICAL_PROTOCOL_REGISTRY)
    .map(toClinicalProtocol)
    .sort((a, b) => a.protocol_code.localeCompare(b.protocol_code));
  const sourceProtocols = Object.values(CLINICAL_PROTOCOL_REGISTRY).sort((a, b) =>
    a.diagnosisCode.localeCompare(b.diagnosisCode),
  );
  return {
    protocols,
    targets: stableSortByCode(sourceProtocols.map(toTargets)),
    foodRules: sourceProtocols.flatMap(toFoodRules),
    slots: sourceProtocols.flatMap(toSlots),
    candidates: [],
    serviceRules: [],
  };
}

function formatTsConst(name: string, typeName: string, rows: unknown[]): string {
  return `export const ${name}: readonly ${typeName}[] = ${JSON.stringify(rows, null, 2)} as const;\n`;
}

function writeGeneratedFile(schema: GeneratedSchema): void {
  const content = [
    '// Generated by scripts/generateTherapeuticSchema.ts.',
    '// Phase 1 check-only artifact. Do not import this file at runtime yet.',
    '',
    "import type { ClinicalProtocol, ProtocolComponentSlot, ProtocolFoodRule, ProtocolRuleTargets, ProtocolServiceRule, ProtocolSlotCandidate } from '../types.ts';",
    '',
    formatTsConst('CLINICAL_PROTOCOLS', 'ClinicalProtocol', schema.protocols),
    formatTsConst('PROTOCOL_RULE_TARGETS', 'ProtocolRuleTargets', schema.targets),
    formatTsConst('PROTOCOL_FOOD_RULES', 'ProtocolFoodRule', schema.foodRules),
    formatTsConst('PROTOCOL_SERVICE_RULES', 'ProtocolServiceRule', schema.serviceRules),
    formatTsConst('PROTOCOL_COMPONENT_SLOTS', 'ProtocolComponentSlot', schema.slots),
    formatTsConst('PROTOCOL_SLOT_CANDIDATES', 'ProtocolSlotCandidate', schema.candidates),
    '// FOODS are intentionally not generated in Phase 1; food catalog authority is separate from diagnosis protocols.',
    "export { FOODS } from './therapeuticSchema.ts';",
    '',
  ].join('\n');
  fs.writeFileSync(OUTPUT_PATH, content, 'utf8');
}

function indexByProtocol<T extends { protocol_code: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.protocol_code, row]));
}

function compareObjectFields(
  table: string,
  protocol: string,
  current: Record<string, unknown> | undefined,
  generated: Record<string, unknown> | undefined,
  mismatches: Mismatch[],
): void {
  if (!current || !generated) return;
  const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(generated)])).sort();
  keys.forEach((field) => {
    const currentValue = current[field];
    const generatedValue = generated[field];
    if (JSON.stringify(currentValue) !== JSON.stringify(generatedValue)) {
      mismatches.push({ protocol, table, field, current: currentValue, generated: generatedValue });
    }
  });
}

function collectMismatches(schema: GeneratedSchema): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const generatedProtocols = indexByProtocol(schema.protocols);
  const currentProtocols = indexByProtocol(CURRENT_PROTOCOLS);
  const generatedTargets = indexByProtocol(schema.targets);
  const currentTargets = indexByProtocol(CURRENT_TARGETS);

  Array.from(generatedProtocols.keys())
    .filter((code) => currentProtocols.has(code))
    .sort()
    .forEach((code) => {
      compareObjectFields(
        'CLINICAL_PROTOCOLS',
        code,
        currentProtocols.get(code) as unknown as Record<string, unknown>,
        generatedProtocols.get(code) as unknown as Record<string, unknown>,
        mismatches,
      );
      compareObjectFields(
        'PROTOCOL_RULE_TARGETS',
        code,
        currentTargets.get(code) as unknown as Record<string, unknown> | undefined,
        generatedTargets.get(code) as unknown as Record<string, unknown> | undefined,
        mismatches,
      );
    });

  return mismatches;
}

function main(): void {
  const generated = generateFromClinicalProtocols();
  writeGeneratedFile(generated);

  const currentCodes = CURRENT_PROTOCOLS.map((protocol) => protocol.protocol_code).sort();
  const generatedCodes = generated.protocols.map((protocol) => protocol.protocol_code).sort();
  const generatedCodeSet = new Set(generatedCodes);
  const currentCodeSet = new Set(currentCodes);

  const matchingProtocols = currentCodes.filter((code) => generatedCodeSet.has(code));
  const missingProtocols = currentCodes.filter((code) => !generatedCodeSet.has(code));
  const extraProtocols = generatedCodes.filter((code) => !currentCodeSet.has(code));
  const mismatches = collectMismatches(generated);

  console.log('therapeuticSchema generation check');
  console.log(`generated artifact: ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
  console.log('');
  console.log(`matching protocols (${matchingProtocols.length}): ${matchingProtocols.join(', ') || 'none'}`);
  console.log(`missing protocols (${missingProtocols.length}): ${missingProtocols.join(', ') || 'none'}`);
  console.log(`extra protocols (${extraProtocols.length}): ${extraProtocols.join(', ') || 'none'}`);
  console.log('');
  console.log('table row counts:');
  console.log(`  CLINICAL_PROTOCOLS current=${CURRENT_PROTOCOLS.length} generated=${generated.protocols.length}`);
  console.log(`  PROTOCOL_RULE_TARGETS current=${CURRENT_TARGETS.length} generated=${generated.targets.length}`);
  console.log(`  PROTOCOL_FOOD_RULES current=${CURRENT_FOOD_RULES.length} generated=${generated.foodRules.length}`);
  console.log(`  PROTOCOL_SERVICE_RULES current=${CURRENT_SERVICE_RULES.length} generated=${generated.serviceRules.length}`);
  console.log(`  PROTOCOL_COMPONENT_SLOTS current=${CURRENT_SLOTS.length} generated=${generated.slots.length}`);
  console.log(`  PROTOCOL_SLOT_CANDIDATES current=${CURRENT_CANDIDATES.length} generated=${generated.candidates.length}`);
  console.log('');
  console.log(`field mismatches (${mismatches.length}):`);
  if (mismatches.length === 0) {
    console.log('  none');
  } else {
    mismatches.forEach((mismatch) => {
      console.log(
        `  ${mismatch.protocol}.${mismatch.table}.${mismatch.field}: ` +
          `current=${JSON.stringify(mismatch.current)} generated=${JSON.stringify(mismatch.generated)}`,
      );
    });
  }
}

main();
