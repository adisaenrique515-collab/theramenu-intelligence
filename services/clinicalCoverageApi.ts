// ── Types mirroring server/coverageReports.ts + server/foodItemStore.ts ──

export type GovernanceState = 'draft' | 'pending_review' | 'approved' | 'retired';
export type CoverageSeverity = 'blocker' | 'critical' | 'warning' | 'info';
export type CoverageSeverityOrOk = CoverageSeverity | 'ok';
export type ValidationReadiness = 'ready' | 'ready_with_warnings' | 'blocked';

export interface DiagnosisReadinessSummary {
  readonly diagnosisCode: string;
  readonly diagnosisName: string;
  readonly protocolVersion: string;
  readonly approvalStatus: GovernanceState;
  readonly reviewDueAt: string | null;
  readonly evidenceCount: number;
  readonly supportedTextureLevels: ReadonlyArray<string>;
  readonly targetSummary: string;
  readonly slotTemplateCount: number;
  readonly allowedApprovedFoodCount: number;
  readonly restrictedFoodCount: number;
  readonly pendingReviewFoodCount: number;
  readonly missingCriticalNutrientsCount: number;
  readonly weakRotationCategories: ReadonlyArray<string>;
  readonly slotsWithNoEligibleFoods: ReadonlyArray<string>;
  readonly coverageSeverity: CoverageSeverityOrOk;
  readonly validationReadiness: ValidationReadiness;
}

export interface CoverageThresholds {
  readonly grainStarch: number;
  readonly protein: number;
  readonly vegetable: number;
  readonly fruit: number;
  readonly dairyAlternatives: number;
  readonly fatsOils: number;
  readonly brothsFluids: number;
  readonly legumes: number;
  readonly minTotalApproved: number;
  readonly recommendedTotalApproved: number;
  readonly minFoodsPerSlot: number;
  readonly minRotationPoolPerCombination: number;
  readonly minFoodsPerTexture: number;
  readonly minFoodsPerMealType: number;
}

export interface FoodStoreTotals {
  readonly total: number;
  readonly draft: number;
  readonly pendingReview: number;
  readonly approved: number;
  readonly retired: number;
}

export interface ClinicalCoverageReadinessResponse {
  readonly summaries: ReadonlyArray<DiagnosisReadinessSummary>;
  readonly thresholds: CoverageThresholds;
  readonly storeTotals: FoodStoreTotals;
}

// ── Cache ─────────────────────────────────────────────────────────────────

import { shouldUseLocalInternalApi } from '../utils/appMode';

const EMPTY_THRESHOLDS: CoverageThresholds = {
  grainStarch: 0, protein: 0, vegetable: 0, fruit: 0,
  dairyAlternatives: 0, fatsOils: 0, brothsFluids: 0, legumes: 0,
  minTotalApproved: 0, recommendedTotalApproved: 0, minFoodsPerSlot: 0,
  minRotationPoolPerCombination: 0, minFoodsPerTexture: 0, minFoodsPerMealType: 0,
};

let cachedReadinessPromise: Promise<ClinicalCoverageReadinessResponse> | null = null;

export async function loadClinicalCoverageReadiness(): Promise<ClinicalCoverageReadinessResponse> {
  if (!shouldUseLocalInternalApi) {
    return {
      summaries: [],
      thresholds: EMPTY_THRESHOLDS,
      storeTotals: { total: 0, draft: 0, pendingReview: 0, approved: 0, retired: 0 },
    };
  }

  if (!cachedReadinessPromise) {
    cachedReadinessPromise = fetch('/api/internal/clinical-coverage/readiness')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Coverage readiness request failed (${res.status}).`);
        }
        return (await res.json()) as ClinicalCoverageReadinessResponse;
      })
      .catch((err) => {
        cachedReadinessPromise = null;
        throw err;
      });
  }
  return cachedReadinessPromise;
}

export function clearClinicalCoverageCache(): void {
  cachedReadinessPromise = null;
}
