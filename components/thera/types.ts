export type PlanReviewStatus = "draft" | "pending_review" | "approved" | "rejected";

export type PlanValidationStatus = "pending" | "passed" | "warnings" | "blocked";

export interface ProtocolRef {
  id: string;
  version: string;
}

export interface CalcTargetsResponse {
  targets: Record<string, number | string>;
  protocol: ProtocolRef;
  approvalStatus?: PlanReviewStatus;
  warnings?: string[];
}

export interface AuditSummary {
  patientCode?: string;
  lastEventAt?: string;
  totals: {
    total: number;
    byEventType?: Record<string, number>;
  };
}

export interface PlanMetadata {
  protocolVersion: string;
  foodDatabaseVersion: string;
  engineVersion: string;
  generatedAt: string;
  planHash: string;
  validationStatus?: PlanValidationStatus;
  clinicalAlignmentScore?: number;
  exportBlocked?: boolean;
  exportBlockedReasons?: string[];
  signOffStatus?: PlanReviewStatus;
  signOffReviewer?: string;
  signOffAt?: string;
}

export type ValidationSeverity = "blocker" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  day?: string;
  mealTime?: string;
  slot?: string;
  clinicalReason?: string;
  observedValue?: number | string;
  expectedValue?: number | string;
  unit?: string;
}

export interface ValidatePlanResponse {
  protocol: ProtocolRef;
  issues: ValidationIssue[];
}

export interface GeneratedPlan {
  reviewStatus?: PlanReviewStatus;
}
