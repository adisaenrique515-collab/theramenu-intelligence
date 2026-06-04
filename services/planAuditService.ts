import type { WeeklyTherapeuticPlan } from '../types';

export type PlanStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SENT_TO_KITCHEN' | 'REJECTED';
export type NrsRisk = 'LOW' | 'MODERATE' | 'HIGH';

export interface PlanRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  diagnosis: string;
  patientHash: string;
  stageReached: 1 | 2 | 3;
  status: PlanStatus;
  clinicalAlignmentScore: number;
  generatedBy: string;
  reviewedBy?: string;
  reviewerCredentials?: string;
  reviewNotes?: string;
  approvedAt?: string;
  nrsRiskLevel?: NrsRisk;
  nrsScore?: number;
}

export interface PlanRecordFull extends PlanRecord {
  plan: WeeklyTherapeuticPlan;
}

export interface ReviewRequest {
  status: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW' | 'SENT_TO_KITCHEN';
  reviewedBy: string;
  reviewerCredentials: string;
  reviewNotes: string;
}

export async function savePlan(
  plan: WeeklyTherapeuticPlan,
  patientData: Record<string, unknown>,
  stageReached: 1 | 2 | 3,
  nrsRiskLevel?: NrsRisk,
  nrsScore?: number,
): Promise<string> {
  try {
    const res = await fetch('/api/internal/plans/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, patientData, stageReached, nrsRiskLevel, nrsScore }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { id: string };
    return data.id;
  } catch {
    return '';
  }
}

export async function submitReview(planId: string, req: ReviewRequest): Promise<void> {
  const res = await fetch(`/api/internal/plans/${planId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Failed to submit review');
}

export async function getPlanHistory(): Promise<PlanRecord[]> {
  const res = await fetch('/api/internal/plans/history');
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json() as Promise<PlanRecord[]>;
}

export async function getPlanById(id: string): Promise<PlanRecordFull | null> {
  const res = await fetch(`/api/internal/plans/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<PlanRecordFull>;
}
