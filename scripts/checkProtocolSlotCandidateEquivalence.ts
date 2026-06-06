import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProtocolSlotCandidate } from '../types.ts';
import { PROTOCOL_SLOT_CANDIDATES } from '../config/therapeuticSchema.ts';
import { PROTOCOL_SLOT_CANDIDATES as GENERATED_ARTIFACT_CANDIDATES } from '../config/protocolSlotCandidates.generated.ts';
import type { ProtocolSlotCandidateSource } from './exportProtocolSlotCandidates.ts';

type CandidateDiff = {
  path: string;
  left: unknown;
  right: unknown;
};

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.join(ROOT_DIR, 'data', 'protocol-slot-candidates.source.json');

function readSource(): ProtocolSlotCandidateSource[] {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(
      `Missing ${path.relative(ROOT_DIR, SOURCE_PATH)}. Run scripts/exportProtocolSlotCandidates.ts first.`,
    );
  }

  return JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8')) as ProtocolSlotCandidateSource[];
}

function projectRuntimeCandidates(source: ProtocolSlotCandidateSource[]): ProtocolSlotCandidate[] {
  return [...source]
    .sort((a, b) => a.legacyOrder - b.legacyOrder)
    .map((candidate) => ({
      protocol_code: candidate.protocolCode,
      meal_type: candidate.mealType,
      slot_name: candidate.slotName,
      food_id: candidate.foodId,
      priority: candidate.priority,
    }));
}

function candidateKey(candidate: ProtocolSlotCandidate): string {
  return [
    candidate.protocol_code,
    candidate.meal_type,
    candidate.slot_name,
    candidate.food_id,
    String(candidate.priority),
  ].join('|');
}

function runtimeGroupKey(candidate: ProtocolSlotCandidate): string {
  return `${candidate.protocol_code}|${candidate.meal_type}|${candidate.slot_name}`;
}

function compareExactRows(
  current: readonly ProtocolSlotCandidate[],
  generated: readonly ProtocolSlotCandidate[],
): CandidateDiff[] {
  const diffs: CandidateDiff[] = [];

  if (current.length !== generated.length) {
    diffs.push({ path: 'length', left: current.length, right: generated.length });
  }

  const max = Math.max(current.length, generated.length);
  for (let i = 0; i < max; i += 1) {
    const currentRow = current[i];
    const generatedRow = generated[i];
    if (JSON.stringify(currentRow) !== JSON.stringify(generatedRow)) {
      diffs.push({ path: `rows[${i}]`, left: currentRow, right: generatedRow });
    }
  }

  return diffs;
}

function compareIdentitySet(
  current: readonly ProtocolSlotCandidate[],
  generated: readonly ProtocolSlotCandidate[],
): CandidateDiff[] {
  const currentSet = new Set(current.map(candidateKey));
  const generatedSet = new Set(generated.map(candidateKey));
  const diffs: CandidateDiff[] = [];

  [...currentSet].sort().forEach((key) => {
    if (!generatedSet.has(key)) {
      diffs.push({ path: `missing:${key}`, left: key, right: null });
    }
  });

  [...generatedSet].sort().forEach((key) => {
    if (!currentSet.has(key)) {
      diffs.push({ path: `extra:${key}`, left: null, right: key });
    }
  });

  return diffs;
}

function groupCandidates(candidates: readonly ProtocolSlotCandidate[]): Map<string, ProtocolSlotCandidate[]> {
  const groups = new Map<string, ProtocolSlotCandidate[]>();
  candidates.forEach((candidate) => {
    const key = runtimeGroupKey(candidate);
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  });
  return groups;
}

function runtimeSort(candidates: readonly ProtocolSlotCandidate[]): ProtocolSlotCandidate[] {
  return [...candidates].sort((a, b) => b.priority - a.priority);
}

function compareRuntimeGroupOrder(
  current: readonly ProtocolSlotCandidate[],
  generated: readonly ProtocolSlotCandidate[],
): CandidateDiff[] {
  const currentGroups = groupCandidates(current);
  const generatedGroups = groupCandidates(generated);
  const allKeys = Array.from(new Set([...currentGroups.keys(), ...generatedGroups.keys()])).sort();
  const diffs: CandidateDiff[] = [];

  allKeys.forEach((key) => {
    const currentGroup = runtimeSort(currentGroups.get(key) ?? []);
    const generatedGroup = runtimeSort(generatedGroups.get(key) ?? []);
    const currentOrder = currentGroup.map(candidateKey);
    const generatedOrder = generatedGroup.map(candidateKey);

    if (JSON.stringify(currentOrder) !== JSON.stringify(generatedOrder)) {
      diffs.push({ path: `runtime-order:${key}`, left: currentOrder, right: generatedOrder });
    }
  });

  return diffs;
}

function printDiffs(title: string, diffs: CandidateDiff[]): void {
  console.log(`${title} (${diffs.length}):`);
  if (diffs.length === 0) {
    console.log('  none');
    return;
  }

  diffs.slice(0, 50).forEach((diff) => {
    console.log(`  ${diff.path}: left=${JSON.stringify(diff.left)} right=${JSON.stringify(diff.right)}`);
  });
  if (diffs.length > 50) {
    console.log(`  ... ${diffs.length - 50} more`);
  }
}

function main(): void {
  const source = readSource();
  const sourceProjection = projectRuntimeCandidates(source);
  const runtime = [...PROTOCOL_SLOT_CANDIDATES];
  const generatedArtifact = [...GENERATED_ARTIFACT_CANDIDATES];

  const runtimeVsSourceExactDiffs = compareExactRows(runtime, sourceProjection);
  const runtimeVsSourceIdentityDiffs = compareIdentitySet(runtime, sourceProjection);
  const runtimeVsSourceOrderDiffs = compareRuntimeGroupOrder(runtime, sourceProjection);
  const runtimeVsArtifactExactDiffs = compareExactRows(runtime, generatedArtifact);
  const runtimeVsArtifactIdentityDiffs = compareIdentitySet(runtime, generatedArtifact);
  const runtimeVsArtifactOrderDiffs = compareRuntimeGroupOrder(runtime, generatedArtifact);
  const sourceVsArtifactExactDiffs = compareExactRows(sourceProjection, generatedArtifact);
  const groups = groupCandidates(runtime);

  console.log('protocol slot candidate equivalence check');
  console.log(`source: ${path.relative(ROOT_DIR, SOURCE_PATH)}`);
  console.log(`source rows: ${source.length}`);
  console.log(`source projection rows: ${sourceProjection.length}`);
  console.log(`runtime rows: ${runtime.length}`);
  console.log(`generated artifact rows: ${generatedArtifact.length}`);
  console.log(`groups: ${groups.size}`);
  console.log('');
  printDiffs('runtime vs source exact row diffs', runtimeVsSourceExactDiffs);
  printDiffs('runtime vs source identity set diffs', runtimeVsSourceIdentityDiffs);
  printDiffs('runtime vs source group-order diffs', runtimeVsSourceOrderDiffs);
  printDiffs('runtime vs generated artifact exact row diffs', runtimeVsArtifactExactDiffs);
  printDiffs('runtime vs generated artifact identity set diffs', runtimeVsArtifactIdentityDiffs);
  printDiffs('runtime vs generated artifact group-order diffs', runtimeVsArtifactOrderDiffs);
  printDiffs('source projection vs generated artifact exact row diffs', sourceVsArtifactExactDiffs);

  if (
    runtimeVsSourceExactDiffs.length > 0 ||
    runtimeVsSourceIdentityDiffs.length > 0 ||
    runtimeVsSourceOrderDiffs.length > 0 ||
    runtimeVsArtifactExactDiffs.length > 0 ||
    runtimeVsArtifactIdentityDiffs.length > 0 ||
    runtimeVsArtifactOrderDiffs.length > 0 ||
    sourceVsArtifactExactDiffs.length > 0
  ) {
    process.exitCode = 1;
  }
}

main();
