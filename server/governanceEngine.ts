/**
 * server/governanceEngine.ts — Phase 7: Evidence, governance, and audit metadata.
 *
 * Responsibilities:
 *   - Protocol governance: production requires 'approved'; draft allowed only in mock.
 *   - Food governance: approved foods must have a non-ESTIMATED source.
 *   - Protocol evidence: every active protocol must cite at least one EvidenceReference.
 *   - Deterministic SHA-256 hash over canonical plan JSON + protocol versions + food DB version.
 *   - AuditMetadata builder.
 *
 * Governance rules (verbatim from Phase 7 spec):
 *   - Only approved protocols may be used in production generation.
 *   - Only approved foods may be used in production generation.
 *   - Draft protocols (and foods) may be used only in test/mock mode.
 *   - Every active (non-retired) protocol must have at least one evidence reference.
 *   - An approved food with source === 'ESTIMATED' fails — estimated values are not
 *     clinically reliable and must not underpin an approved plan.
 *   - Retired items are blocked in all modes.
 */

import { createHash } from 'node:crypto';

import type { WeeklyTherapeuticPlan } from '../types.ts';

import type {
  VersionedClinicalProtocol,
  FoodItem,
  AuditMetadata,
  DiagnosisCode,
  ClinicalValidationReport,
} from '../types-clinical.ts';

// ── Execution mode ────────────────────────────────────────────────────────

/**
 * ExecutionMode distinguishes production runs (only approved artefacts allowed)
 * from mock/test runs (draft and pending_review items are permitted).
 */
export type ExecutionMode = 'production' | 'mock';

// ── Governance result types ───────────────────────────────────────────────

export interface GovernanceViolation {
  readonly code: string;
  readonly message: string;
  readonly severity: 'blocker' | 'critical';
}

export interface GovernanceResult {
  readonly passed: boolean;
  readonly violations: ReadonlyArray<GovernanceViolation>;
}

function pass(): GovernanceResult {
  return { passed: true, violations: [] };
}

function fail(violations: GovernanceViolation[]): GovernanceResult {
  return { passed: false, violations };
}

function blocker(code: string, message: string): GovernanceViolation {
  return { code, message, severity: 'blocker' };
}

function critical(code: string, message: string): GovernanceViolation {
  return { code, message, severity: 'critical' };
}

// ── Protocol governance ───────────────────────────────────────────────────

/**
 * checkProtocolGovernance — validates a protocol's approval state for the given mode.
 *
 * Production: only 'approved' protocols are permitted.
 * Mock:       'approved', 'pending_review', 'draft' are permitted; 'retired' is blocked.
 */
export function checkProtocolGovernance(
  protocol: VersionedClinicalProtocol,
  mode: ExecutionMode,
): GovernanceResult {
  const { status, diagnosisCode, version } = protocol;
  const id = `${diagnosisCode}@${version}`;
  const violations: GovernanceViolation[] = [];

  if (status === 'retired') {
    violations.push(blocker(
      'PROTOCOL_RETIRED',
      `Protocol ${id} is retired and must not be used for plan generation in any mode.`,
    ));
    return fail(violations);
  }

  if (mode === 'production' && status !== 'approved') {
    violations.push(blocker(
      'PROTOCOL_NOT_APPROVED_FOR_PRODUCTION',
      `Protocol ${id} has status "${status}". ` +
      `Production generation requires status "approved". ` +
      `Use mock mode for testing with draft or pending_review protocols.`,
    ));
  }

  return violations.length === 0 ? pass() : fail(violations);
}

// ── Protocol evidence governance ──────────────────────────────────────────

/**
 * checkProtocolEvidence — validates that a non-retired protocol cites at least
 * one EvidenceReference.
 *
 * Retired protocols are excluded from this check — they are already blocked
 * by checkProtocolGovernance.
 */
export function checkProtocolEvidence(
  protocol: VersionedClinicalProtocol,
): GovernanceResult {
  if (protocol.status === 'retired') return pass();

  if (protocol.evidenceReferences.length === 0) {
    return fail([blocker(
      'PROTOCOL_NO_EVIDENCE_REFERENCES',
      `Protocol ${protocol.diagnosisCode}@${protocol.version} has no evidence references. ` +
      `Every active protocol must cite at least one clinical guideline or systematic review.`,
    )]);
  }

  return pass();
}

// ── Food governance ───────────────────────────────────────────────────────

/**
 * checkFoodGovernance — validates a food item's approval state for the given mode.
 *
 * Production: only 'approved' foods with a non-ESTIMATED source are permitted.
 * Mock:       'approved', 'pending_review', 'draft' permitted; 'retired' blocked.
 *
 * Rationale for ESTIMATED source block on approved foods:
 *   Nutrient values estimated from category averages are not clinically reliable.
 *   An approved food must have a traceable, trusted source before it can be used
 *   in production plan generation.
 */
export function checkFoodGovernance(
  food: FoodItem,
  mode: ExecutionMode,
): GovernanceResult {
  const id = `${food.id} ("${food.canonicalName}")`;
  const violations: GovernanceViolation[] = [];

  if (food.approvalStatus === 'retired') {
    violations.push(blocker(
      'FOOD_RETIRED',
      `Food ${id} is retired and must not be used for plan generation in any mode.`,
    ));
    return fail(violations);
  }

  if (mode === 'production' && food.approvalStatus !== 'approved') {
    violations.push(blocker(
      'FOOD_NOT_APPROVED_FOR_PRODUCTION',
      `Food ${id} has approvalStatus "${food.approvalStatus}". ` +
      `Production generation requires approvalStatus "approved".`,
    ));
  }

  if (food.approvalStatus === 'approved' && food.source === 'ESTIMATED') {
    violations.push(blocker(
      'APPROVED_FOOD_ESTIMATED_SOURCE',
      `Food ${id} is marked "approved" but its nutrient source is "ESTIMATED". ` +
      `Approved foods must have a traceable, non-estimated source ` +
      `(USDA_FDC, AUSNUT, LOCAL_TRUSTED, CURATED, or RESEARCH).`,
    ));
  }

  return violations.length === 0 ? pass() : fail(violations);
}

// ── Deterministic hash ────────────────────────────────────────────────────

/**
 * canonicalise — deep-sort all object keys alphabetically so that
 * JSON.stringify produces the same string regardless of insertion order.
 * Arrays preserve their order (order is semantically significant in plans).
 */
function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = canonicalise((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * computeDeterministicHash — SHA-256 over canonical plan JSON + protocol versions
 * + food database version.
 *
 * Guarantee: the same inputs always produce the same hex string.
 * protocolVersions are sorted by diagnosisCode before hashing so that
 * array insertion order does not affect the result.
 */
export function computeDeterministicHash(
  plan: WeeklyTherapeuticPlan,
  protocolVersions: ReadonlyArray<{ readonly diagnosisCode: string; readonly version: string }>,
  foodDbVersion: string,
): string {
  const sortedVersions = [...protocolVersions].sort((a, b) =>
    a.diagnosisCode.localeCompare(b.diagnosisCode),
  );

  const hashInput = canonicalise({
    foodDbVersion,
    plan,
    protocolVersions: sortedVersions,
  });

  return createHash('sha256')
    .update(JSON.stringify(hashInput))
    .digest('hex');
}

// ── Audit metadata builder ────────────────────────────────────────────────

export interface BuildAuditOptions {
  readonly planId: string;
  readonly plan: WeeklyTherapeuticPlan;
  /** All protocols used during generation — only diagnosisCode + version are stored. */
  readonly protocols: ReadonlyArray<VersionedClinicalProtocol>;
  readonly foodDbVersion: string;
  readonly engineVersion: string;
  readonly generatedBy: string;
  /** ISO 8601 timestamp. Defaults to current time if omitted. */
  readonly generatedAt?: string;
  readonly validationReport?: ClinicalValidationReport;
}

/**
 * buildAuditMetadata — construct an AuditMetadata record with a deterministic hash.
 *
 * The hash is computed from the plan, protocol versions, and foodDbVersion
 * before the AuditMetadata is assembled, so the hash reflects plan content
 * rather than the metadata envelope.
 */
export function buildAuditMetadata(opts: BuildAuditOptions): AuditMetadata {
  const protocolVersions = opts.protocols.map((p) => ({
    diagnosisCode: p.diagnosisCode as DiagnosisCode,
    version: p.version,
  }));

  const deterministicHash = computeDeterministicHash(
    opts.plan,
    protocolVersions,
    opts.foodDbVersion,
  );

  return {
    planId:                  opts.planId,
    protocolVersions,
    foodDbVersion:           opts.foodDbVersion,
    engineVersion:           opts.engineVersion,
    generatedAt:             opts.generatedAt ?? new Date().toISOString(),
    generatedBy:             opts.generatedBy,
    clinicalValidationReport: opts.validationReport,
    deterministicHash,
  };
}
