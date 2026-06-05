/**
 * server/__tests__/governanceEngine.test.ts
 *
 * Tests for Phase 7: evidence, governance, and audit metadata.
 *
 * Required test cases:
 *   1.  Approved protocol passes governance check in production mode
 *   2.  Pending-review protocol blocked in production mode
 *   3.  Draft protocol blocked in production mode
 *   4.  Draft protocol allowed in mock mode
 *   5.  Retired protocol blocked in all modes
 *   6.  Protocol without evidence references fails checkProtocolEvidence
 *   7.  Protocol with evidence references passes checkProtocolEvidence
 *   8.  Approved food passes governance in production mode
 *   9.  Draft food blocked in production mode
 *   10. Approved food with ESTIMATED source fails governance
 *   11. Approved food with traceable source passes governance
 *   12. Retired food blocked in all modes
 *   13. Deterministic hash is stable for same plan + versions + db version
 *   14. Deterministic hash changes when plan content changes
 *   15. Deterministic hash changes when protocol version changes
 *   16. Deterministic hash changes when food DB version changes
 *   17. Hash is stable regardless of protocolVersions array insertion order
 *   18. AuditMetadata includes planId, protocolVersions, foodDbVersion, engineVersion, generatedAt
 *   19. AuditMetadata includes deterministicHash
 *   20. AuditMetadata includes clinicalValidationReport when provided
 *   21. AuditMetadata generatedAt defaults to current time when omitted
 *   22. AuditMetadata hash matches computeDeterministicHash independently
 *
 * Run with:
 *   node --experimental-strip-types --test server/__tests__/governanceEngine.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkProtocolGovernance,
  checkProtocolEvidence,
  checkFoodGovernance,
  computeDeterministicHash,
  buildAuditMetadata,
  type ExecutionMode,
} from '../governanceEngine.ts';

import { EMPTY_NUTRIENTS } from '../nutrientUtils.ts';

import type {
  VersionedClinicalProtocol,
  FoodItem,
  EvidenceReference,
  ClinicalValidationReport,
  ClinicalValidationSummary,
} from '../../types-clinical.ts';

import type { WeeklyTherapeuticPlan, DayPlan } from '../../types.ts';

// ── Protocol fixtures ─────────────────────────────────────────────────────

const EVIDENCE_REF: EvidenceReference = {
  code: 'ESPEN_TEST_2024',
  title: 'Test Guideline',
  organization: 'TEST_ORG',
  year: 2024,
  evidenceLevel: 'A',
};

function makeProtocol(
  overrides: Partial<VersionedClinicalProtocol>,
): VersionedClinicalProtocol {
  return {
    diagnosisCode: 'GENERAL_HOSPITAL',
    version: '1.0.0',
    status: 'approved',
    applicability: {},
    targets: {},
    forbiddenTags: [],
    requiredTags: [],
    slotTemplates: [],
    evidenceReferences: [EVIDENCE_REF],
    approvedBy: 'Dr. Test Dietitian',
    approvedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const APPROVED_PROTOCOL  = makeProtocol({ status: 'approved' });
const PENDING_PROTOCOL   = makeProtocol({ status: 'pending_review' });
const DRAFT_PROTOCOL     = makeProtocol({ status: 'draft' });
const RETIRED_PROTOCOL   = makeProtocol({ status: 'retired' });
const NO_EVIDENCE_PROTOCOL = makeProtocol({ evidenceReferences: [] });

// ── Food item fixtures ────────────────────────────────────────────────────

function makeFood(overrides: Partial<FoodItem>): FoodItem {
  return {
    id:               'test_food',
    canonicalName:    'Test Food',
    category:         'grain',
    mealTypes:        ['Breakfast'],
    preparationState: 'cooked',
    nutrientsPer100g: { ...EMPTY_NUTRIENTS, caloriesKcal: 100 },
    missingNutrients: [],
    textureLevels:    ['regular'],
    allergens:        [],
    contraindicatedFor: [],
    allowedFor:       [],
    servingRules:     { minGrams: 50, maxGrams: 250, defaultGrams: 100, unit: 'g' },
    source:           'CURATED',
    confidence:       'curated',
    approvalStatus:   'approved',
    tags:             [],
    ...overrides,
  };
}

const APPROVED_FOOD_CURATED   = makeFood({ approvalStatus: 'approved',  source: 'CURATED' });
const APPROVED_FOOD_USDA      = makeFood({ approvalStatus: 'approved',  source: 'USDA_FDC' });
const APPROVED_FOOD_ESTIMATED = makeFood({ approvalStatus: 'approved',  source: 'ESTIMATED' });
const DRAFT_FOOD              = makeFood({ approvalStatus: 'draft' });
const PENDING_FOOD            = makeFood({ approvalStatus: 'pending_review' });
const RETIRED_FOOD            = makeFood({ approvalStatus: 'retired' });

// ── Plan fixtures ─────────────────────────────────────────────────────────

function makePlan(overrides: Partial<WeeklyTherapeuticPlan> = {}): WeeklyTherapeuticPlan {
  return {
    diagnosis:              'GENERAL_HOSPITAL',
    clinicalAlignmentScore: 95,
    constraints:            { exclude: [], prioritize: [], textureLevel: 'regular' },
    days: [
      {
        dayName: 'Monday',
        meals: [
          {
            mealType: 'Breakfast',
            dietaryLabel: 'Standard',
            slots: [
              {
                slotName: 'starch_base',
                status:   'FILLED',
                item: {
                  name:     'Brown Rice',
                  foodId:   'rice_001',
                  portion:  '150g',
                  operational: { serviceTemp: '>= 60°C' },
                },
              },
            ],
          },
        ],
        dailyTargets: { ...EMPTY_NUTRIENTS, caloriesKcal: 2000 },
        totals:       { ...EMPTY_NUTRIENTS, caloriesKcal: 1950 },
      } as DayPlan,
    ],
    standards:  { hotHolding: '≥60°C', servingHotFood: '≥60°C', coldHolding: '≤8°C', servingColdFood: '≤8°C', boosting: 'N/A', vehicle: 'N/A' },
    notes:      [],
    rationale:  'Test plan.',
    preparedBy: 'Test Engine',
    updatedDate: '2026-06-05',
    ...overrides,
  };
}

const VALID_REPORT_SUMMARY: ClinicalValidationSummary = {
  blockerCount: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
  nutrientChecksPassed: 5, nutrientChecksTotal: 5,
  weeklyUniqueFoods: 10, maxRepeatPerFood: 2, textureMismatchCount: 0,
};

const VALID_REPORT: ClinicalValidationReport = {
  passed: true,
  exportBlocked: false,
  issues: [],
  clinicalAlignmentScore: 100,
  summary: VALID_REPORT_SUMMARY,
};

// ── Suite 1: Protocol governance ─────────────────────────────────────────

describe('Suite 1 — Protocol governance in production mode', () => {
  it('approved protocol passes in production mode', () => {
    const result = checkProtocolGovernance(APPROVED_PROTOCOL, 'production');
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.violations.length, 0);
  });

  it('pending_review protocol is blocked in production mode', () => {
    const result = checkProtocolGovernance(PENDING_PROTOCOL, 'production');
    assert.strictEqual(result.passed, false);
    assert.ok(result.violations.some((v) => v.code === 'PROTOCOL_NOT_APPROVED_FOR_PRODUCTION'));
  });

  it('draft protocol is blocked in production mode', () => {
    const result = checkProtocolGovernance(DRAFT_PROTOCOL, 'production');
    assert.strictEqual(result.passed, false);
    const v = result.violations.find((v) => v.code === 'PROTOCOL_NOT_APPROVED_FOR_PRODUCTION');
    assert.ok(v, 'must have PROTOCOL_NOT_APPROVED_FOR_PRODUCTION violation');
    assert.strictEqual(v!.severity, 'blocker');
  });

  it('draft protocol passes in mock mode', () => {
    const result = checkProtocolGovernance(DRAFT_PROTOCOL, 'mock');
    assert.strictEqual(result.passed, true, `unexpected violations: ${JSON.stringify(result.violations)}`);
  });

  it('pending_review protocol passes in mock mode', () => {
    const result = checkProtocolGovernance(PENDING_PROTOCOL, 'mock');
    assert.strictEqual(result.passed, true);
  });

  it('approved protocol passes in mock mode', () => {
    const result = checkProtocolGovernance(APPROVED_PROTOCOL, 'mock');
    assert.strictEqual(result.passed, true);
  });
});

// ── Suite 2: Retired protocol blocked in all modes ────────────────────────

describe('Suite 2 — Retired protocol blocked in all modes', () => {
  for (const mode of ['production', 'mock'] as ExecutionMode[]) {
    it(`retired protocol blocked in ${mode} mode`, () => {
      const result = checkProtocolGovernance(RETIRED_PROTOCOL, mode);
      assert.strictEqual(result.passed, false);
      const v = result.violations.find((v) => v.code === 'PROTOCOL_RETIRED');
      assert.ok(v, 'must have PROTOCOL_RETIRED violation');
      assert.strictEqual(v!.severity, 'blocker');
    });
  }
});

// ── Suite 3: Protocol evidence ────────────────────────────────────────────

describe('Suite 3 — Protocol evidence references', () => {
  it('protocol with evidence references passes', () => {
    const result = checkProtocolEvidence(APPROVED_PROTOCOL);
    assert.strictEqual(result.passed, true);
  });

  it('protocol without evidence references fails', () => {
    const result = checkProtocolEvidence(NO_EVIDENCE_PROTOCOL);
    assert.strictEqual(result.passed, false);
    const v = result.violations.find((v) => v.code === 'PROTOCOL_NO_EVIDENCE_REFERENCES');
    assert.ok(v, 'must have PROTOCOL_NO_EVIDENCE_REFERENCES violation');
    assert.strictEqual(v!.severity, 'blocker');
  });

  it('violation message mentions the protocol id', () => {
    const result = checkProtocolEvidence(NO_EVIDENCE_PROTOCOL);
    const v = result.violations[0]!;
    assert.ok(
      v.message.includes(NO_EVIDENCE_PROTOCOL.diagnosisCode),
      `message must mention diagnosisCode; got: "${v.message}"`,
    );
  });

  it('retired protocol is exempt from evidence check', () => {
    const result = checkProtocolEvidence(RETIRED_PROTOCOL);
    assert.strictEqual(result.passed, true,
      'retired protocol should not be checked for evidence (already blocked by governance)');
  });
});

// ── Suite 4: Food governance ──────────────────────────────────────────────

describe('Suite 4 — Food governance in production mode', () => {
  it('approved food with CURATED source passes in production', () => {
    const result = checkFoodGovernance(APPROVED_FOOD_CURATED, 'production');
    assert.strictEqual(result.passed, true);
  });

  it('approved food with USDA_FDC source passes in production', () => {
    const result = checkFoodGovernance(APPROVED_FOOD_USDA, 'production');
    assert.strictEqual(result.passed, true);
  });

  it('draft food is blocked in production mode', () => {
    const result = checkFoodGovernance(DRAFT_FOOD, 'production');
    assert.strictEqual(result.passed, false);
    const v = result.violations.find((v) => v.code === 'FOOD_NOT_APPROVED_FOR_PRODUCTION');
    assert.ok(v, 'must have FOOD_NOT_APPROVED_FOR_PRODUCTION violation');
    assert.strictEqual(v!.severity, 'blocker');
  });

  it('pending_review food is blocked in production mode', () => {
    const result = checkFoodGovernance(PENDING_FOOD, 'production');
    assert.strictEqual(result.passed, false);
  });

  it('approved food with ESTIMATED source fails governance', () => {
    const result = checkFoodGovernance(APPROVED_FOOD_ESTIMATED, 'production');
    assert.strictEqual(result.passed, false);
    const v = result.violations.find((v) => v.code === 'APPROVED_FOOD_ESTIMATED_SOURCE');
    assert.ok(v, 'must have APPROVED_FOOD_ESTIMATED_SOURCE violation');
    assert.strictEqual(v!.severity, 'blocker');
  });

  it('approved food with ESTIMATED source also fails in mock mode', () => {
    const result = checkFoodGovernance(APPROVED_FOOD_ESTIMATED, 'mock');
    assert.strictEqual(result.passed, false);
    assert.ok(result.violations.some((v) => v.code === 'APPROVED_FOOD_ESTIMATED_SOURCE'),
      'ESTIMATED source on an approved food is invalid in any mode');
  });

  it('draft food passes in mock mode', () => {
    const result = checkFoodGovernance(DRAFT_FOOD, 'mock');
    assert.strictEqual(result.passed, true);
  });
});

// ── Suite 5: Retired food blocked in all modes ────────────────────────────

describe('Suite 5 — Retired food blocked in all modes', () => {
  for (const mode of ['production', 'mock'] as ExecutionMode[]) {
    it(`retired food blocked in ${mode} mode`, () => {
      const result = checkFoodGovernance(RETIRED_FOOD, mode);
      assert.strictEqual(result.passed, false);
      const v = result.violations.find((v) => v.code === 'FOOD_RETIRED');
      assert.ok(v, 'must have FOOD_RETIRED violation');
      assert.strictEqual(v!.severity, 'blocker');
    });
  }
});

// ── Suite 6: Deterministic hash ───────────────────────────────────────────

describe('Suite 6 — Deterministic hash', () => {
  const PROTOCOL_VERSIONS = [{ diagnosisCode: 'GENERAL_HOSPITAL', version: '1.0.0' }];
  const FOOD_DB_VERSION   = 'theramenu-clinical-v1.2.0';
  const plan              = makePlan();

  it('same inputs produce the same hash (stability)', () => {
    const h1 = computeDeterministicHash(plan, PROTOCOL_VERSIONS, FOOD_DB_VERSION);
    const h2 = computeDeterministicHash(plan, PROTOCOL_VERSIONS, FOOD_DB_VERSION);
    assert.strictEqual(h1, h2);
  });

  it('hash is a 64-character hex string (SHA-256)', () => {
    const h = computeDeterministicHash(plan, PROTOCOL_VERSIONS, FOOD_DB_VERSION);
    assert.match(h, /^[0-9a-f]{64}$/, `expected 64-char hex, got: "${h}"`);
  });

  it('hash changes when plan content changes', () => {
    const altPlan = makePlan({ diagnosis: 'T2DM' });
    const h1 = computeDeterministicHash(plan,    PROTOCOL_VERSIONS, FOOD_DB_VERSION);
    const h2 = computeDeterministicHash(altPlan, PROTOCOL_VERSIONS, FOOD_DB_VERSION);
    assert.notStrictEqual(h1, h2, 'hash must change when plan.diagnosis changes');
  });

  it('hash changes when protocol version changes', () => {
    const altVersions = [{ diagnosisCode: 'GENERAL_HOSPITAL', version: '2.0.0' }];
    const h1 = computeDeterministicHash(plan, PROTOCOL_VERSIONS, FOOD_DB_VERSION);
    const h2 = computeDeterministicHash(plan, altVersions,       FOOD_DB_VERSION);
    assert.notStrictEqual(h1, h2, 'hash must change when protocol version changes');
  });

  it('hash changes when food DB version changes', () => {
    const h1 = computeDeterministicHash(plan, PROTOCOL_VERSIONS, 'v1.0.0');
    const h2 = computeDeterministicHash(plan, PROTOCOL_VERSIONS, 'v1.1.0');
    assert.notStrictEqual(h1, h2, 'hash must change when foodDbVersion changes');
  });

  it('hash is stable regardless of protocolVersions insertion order', () => {
    const versions1 = [
      { diagnosisCode: 'RENAL_STAGE_4', version: '1.0.0' },
      { diagnosisCode: 'GENERAL_HOSPITAL', version: '1.0.0' },
    ];
    const versions2 = [
      { diagnosisCode: 'GENERAL_HOSPITAL', version: '1.0.0' },
      { diagnosisCode: 'RENAL_STAGE_4', version: '1.0.0' },
    ];
    const h1 = computeDeterministicHash(plan, versions1, FOOD_DB_VERSION);
    const h2 = computeDeterministicHash(plan, versions2, FOOD_DB_VERSION);
    assert.strictEqual(h1, h2, 'hash must be the same regardless of protocolVersions order');
  });
});

// ── Suite 7: AuditMetadata builder ───────────────────────────────────────

describe('Suite 7 — AuditMetadata builder', () => {
  const plan = makePlan();

  function buildTestAudit(overrides: {
    validationReport?: ClinicalValidationReport;
    generatedAt?: string;
  } = {}) {
    return buildAuditMetadata({
      planId:         'audit-test-001',
      plan,
      protocols:      [APPROVED_PROTOCOL],
      foodDbVersion:  'theramenu-clinical-v1.2.0',
      engineVersion:  '7.0.0',
      generatedBy:    'test-suite',
      ...overrides,
    });
  }

  it('audit record has correct planId', () => {
    assert.strictEqual(buildTestAudit().planId, 'audit-test-001');
  });

  it('audit record has protocolVersions array', () => {
    const audit = buildTestAudit();
    assert.ok(Array.isArray(audit.protocolVersions));
    assert.ok(audit.protocolVersions.length >= 1);
    assert.strictEqual(audit.protocolVersions[0]!.diagnosisCode, 'GENERAL_HOSPITAL');
    assert.strictEqual(audit.protocolVersions[0]!.version, '1.0.0');
  });

  it('audit record has foodDbVersion', () => {
    assert.strictEqual(buildTestAudit().foodDbVersion, 'theramenu-clinical-v1.2.0');
  });

  it('audit record has engineVersion', () => {
    assert.strictEqual(buildTestAudit().engineVersion, '7.0.0');
  });

  it('audit record has generatedAt in ISO 8601 format', () => {
    const audit = buildTestAudit({ generatedAt: '2026-06-05T12:00:00.000Z' });
    assert.strictEqual(audit.generatedAt, '2026-06-05T12:00:00.000Z');
  });

  it('audit record generatedAt defaults to current time when omitted', () => {
    const before = Date.now();
    const audit  = buildTestAudit();
    const after  = Date.now();
    const ts     = new Date(audit.generatedAt).getTime();
    assert.ok(ts >= before, 'generatedAt must be >= test start time');
    assert.ok(ts <= after,  'generatedAt must be <= test end time');
  });

  it('audit record has deterministicHash (64-char hex)', () => {
    const audit = buildTestAudit();
    assert.ok(typeof audit.deterministicHash === 'string');
    assert.match(audit.deterministicHash!, /^[0-9a-f]{64}$/);
  });

  it('audit record hash matches independently computed hash', () => {
    const audit = buildTestAudit();
    const expected = computeDeterministicHash(
      plan,
      [{ diagnosisCode: 'GENERAL_HOSPITAL', version: '1.0.0' }],
      'theramenu-clinical-v1.2.0',
    );
    assert.strictEqual(audit.deterministicHash, expected);
  });

  it('audit record includes clinicalValidationReport when provided', () => {
    const audit = buildTestAudit({ validationReport: VALID_REPORT });
    assert.ok(audit.clinicalValidationReport !== undefined);
    assert.strictEqual(audit.clinicalValidationReport!.passed, true);
    assert.strictEqual(audit.clinicalValidationReport!.clinicalAlignmentScore, 100);
  });

  it('audit record clinicalValidationReport is absent when not provided', () => {
    const audit = buildTestAudit();
    assert.strictEqual(audit.clinicalValidationReport, undefined);
  });

  it('two audits of the same plan have the same deterministicHash', () => {
    const h1 = buildTestAudit({ generatedAt: '2026-06-05T08:00:00.000Z' }).deterministicHash;
    const h2 = buildTestAudit({ generatedAt: '2026-06-05T09:00:00.000Z' }).deterministicHash;
    assert.strictEqual(h1, h2,
      'generatedAt must NOT affect the hash — hash covers plan content, not envelope');
  });
});
