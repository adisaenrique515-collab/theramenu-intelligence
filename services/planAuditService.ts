import type { WeeklyTherapeuticPlan } from '../types';
import { isCloudflareMode } from '../utils/appMode';
import { supabaseInsert, supabaseSelect, supabasePatch } from './supabaseClient';

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

// Mirrors the server-side ID generator so audit IDs look consistent.
function generateId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TM-${ts}-${rnd}`;
}

function hashPatient(patientData: Record<string, unknown>): string {
  const seed = `${String(patientData.diagnosis ?? '')}|${String(patientData.weightKg ?? '')}|${String(patientData.age ?? '')}`;
  const h = seed.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  return Math.abs(h).toString(36).toUpperCase().padStart(8, '0');
}

function rowToRecord(row: Record<string, unknown>): PlanRecord {
  return {
    id:                     String(row.id ?? ''),
    createdAt:              String(row.created_at ?? ''),
    updatedAt:              String(row.updated_at ?? ''),
    diagnosis:              String(row.diagnosis ?? ''),
    patientHash:            String(row.patient_hash ?? ''),
    stageReached:           (row.stage_reached as 1 | 2 | 3) ?? 1,
    status:                 (row.status as PlanStatus) ?? 'DRAFT',
    clinicalAlignmentScore: Number(row.clinical_alignment_score ?? 0),
    generatedBy:            String(row.generated_by ?? ''),
    reviewedBy:             row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewerCredentials:    row.reviewer_credentials ? String(row.reviewer_credentials) : undefined,
    reviewNotes:            row.review_notes ? String(row.review_notes) : undefined,
    approvedAt:             row.approved_at ? String(row.approved_at) : undefined,
    nrsRiskLevel:           row.nrs_risk_level ? (row.nrs_risk_level as NrsRisk) : undefined,
    nrsScore:               row.nrs_score != null ? Number(row.nrs_score) : undefined,
  };
}

function rowToFullRecord(row: Record<string, unknown>): PlanRecordFull {
  return {
    ...rowToRecord(row),
    plan: JSON.parse(String(row.plan_json ?? '{}')),
  };
}

export async function savePlan(
  plan: WeeklyTherapeuticPlan,
  patientData: Record<string, unknown>,
  stageReached: 1 | 2 | 3,
  nrsRiskLevel?: NrsRisk,
  nrsScore?: number,
): Promise<string> {
  if (isCloudflareMode) {
    try {
      const id = generateId();
      const now = new Date().toISOString();
      await supabaseInsert('plan_audit_log', {
        id,
        created_at: now,
        updated_at: now,
        diagnosis: String(patientData.diagnosis ?? ''),
        patient_hash: hashPatient(patientData),
        plan_json: JSON.stringify(plan),
        stage_reached: stageReached,
        status: 'DRAFT',
        clinical_alignment_score: plan.clinicalAlignmentScore ?? 0,
        generated_by: 'Clinical Engine (Cloudflare)',
        nrs_risk_level: nrsRiskLevel ?? null,
        nrs_score: nrsScore ?? null,
      });
      return id;
    } catch {
      return '';
    }
  }

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
  if (isCloudflareMode) {
    const now = new Date().toISOString();
    await supabasePatch('plan_audit_log', `id=eq.${encodeURIComponent(planId)}`, {
      status: req.status,
      reviewed_by: req.reviewedBy,
      reviewer_credentials: req.reviewerCredentials,
      review_notes: req.reviewNotes,
      updated_at: now,
      approved_at: req.status === 'APPROVED' ? now : null,
    });
    return;
  }

  const res = await fetch(`/api/internal/plans/${planId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Failed to submit review');
}

export async function getPlanHistory(): Promise<PlanRecord[]> {
  if (isCloudflareMode) {
    try {
      const rows = await supabaseSelect<Record<string, unknown>>(
        'plan_audit_log',
        'order=created_at.desc&limit=100',
      );
      return rows.map(rowToRecord);
    } catch {
      return [];
    }
  }

  const res = await fetch('/api/internal/plans/history');
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json() as Promise<PlanRecord[]>;
}

export async function getPlanById(id: string): Promise<PlanRecordFull | null> {
  if (isCloudflareMode) {
    try {
      const rows = await supabaseSelect<Record<string, unknown>>(
        'plan_audit_log',
        `id=eq.${encodeURIComponent(id)}`,
      );
      const row = rows[0];
      if (!row) return null;
      return rowToFullRecord(row);
    } catch {
      return null;
    }
  }

  const res = await fetch(`/api/internal/plans/${id}`);
  if (!res.ok) return null;
  return res.json() as Promise<PlanRecordFull>;
}
