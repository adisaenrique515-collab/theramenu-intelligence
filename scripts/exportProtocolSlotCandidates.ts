import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProtocolCode, SchemaMealType } from '../types.ts';
import { PROTOCOL_SLOT_CANDIDATES } from '../config/therapeuticSchema.ts';

export type ProtocolSlotCandidateSourceStatus = 'draft' | 'pending_review' | 'approved' | 'retired';

export interface ProtocolSlotCandidateSource {
  readonly id: string;
  readonly protocolCode: ProtocolCode;
  readonly mealType: SchemaMealType;
  readonly slotName: string;
  readonly foodId: string;
  readonly priority: number;
  readonly status: ProtocolSlotCandidateSourceStatus;
  readonly source: 'therapeutic_schema_legacy';
  readonly legacyKey: string;
  readonly legacyOrder: number;
  readonly legacyGroupOrder: number;
}

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'protocol-slot-candidates.source.json');

function stableId(protocolCode: string, mealType: string, slotName: string, foodId: string): string {
  return `legacy:${protocolCode}:${mealType}:${slotName}:${foodId}`;
}

function exportCandidates(): ProtocolSlotCandidateSource[] {
  const groupCounts = new Map<string, number>();

  return PROTOCOL_SLOT_CANDIDATES.map((candidate, index) => {
    const legacyKey = `${candidate.protocol_code}|${candidate.meal_type}|${candidate.slot_name}`;
    const legacyGroupOrder = groupCounts.get(legacyKey) ?? 0;
    groupCounts.set(legacyKey, legacyGroupOrder + 1);

    return {
      id: stableId(candidate.protocol_code, candidate.meal_type, candidate.slot_name, candidate.food_id),
      protocolCode: candidate.protocol_code,
      mealType: candidate.meal_type,
      slotName: candidate.slot_name,
      foodId: candidate.food_id,
      priority: candidate.priority,
      status: 'approved',
      source: 'therapeutic_schema_legacy',
      legacyKey,
      legacyOrder: index,
      legacyGroupOrder,
    };
  });
}

function main(): void {
  const source = exportCandidates();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

  console.log(`Exported ${source.length} protocol slot candidates.`);
  console.log(`Wrote ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
}

main();
