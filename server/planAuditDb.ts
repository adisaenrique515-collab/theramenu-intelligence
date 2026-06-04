import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import type { WeeklyTherapeuticPlan } from '../types.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data', 'local-db');
const PLANS_DB_PATH = path.join(DATA_DIR, 'theramenu-plans.sqlite');

export type PlanStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SENT_TO_KITCHEN' | 'REJECTED';
export type NrsRisk = 'LOW' | 'MODERATE' | 'HIGH';

export interface PlanAuditRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  diagnosis: string;
  patientHash: string;
  plan: WeeklyTherapeuticPlan;
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

function openDb(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(PLANS_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_audit_log (
      id                       TEXT PRIMARY KEY,
      created_at               TEXT NOT NULL,
      updated_at               TEXT NOT NULL,
      diagnosis                TEXT NOT NULL,
      patient_hash             TEXT NOT NULL,
      plan_json                TEXT NOT NULL,
      stage_reached            INTEGER NOT NULL DEFAULT 1,
      status                   TEXT NOT NULL DEFAULT 'DRAFT',
      clinical_alignment_score INTEGER NOT NULL DEFAULT 0,
      generated_by             TEXT NOT NULL,
      reviewed_by              TEXT,
      reviewer_credentials     TEXT,
      review_notes             TEXT,
      approved_at              TEXT,
      nrs_risk_level           TEXT,
      nrs_score                INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_audit_created   ON plan_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_status    ON plan_audit_log(status);
    CREATE INDEX IF NOT EXISTS idx_audit_diagnosis ON plan_audit_log(diagnosis);
  `);
  return db;
}

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

function rowToRecord(row: Record<string, unknown>): PlanAuditRecord {
  return {
    id:                     row.id as string,
    createdAt:              row.created_at as string,
    updatedAt:              row.updated_at as string,
    diagnosis:              row.diagnosis as string,
    patientHash:            row.patient_hash as string,
    plan:                   JSON.parse(row.plan_json as string) as WeeklyTherapeuticPlan,
    stageReached:           row.stage_reached as 1 | 2 | 3,
    status:                 row.status as PlanStatus,
    clinicalAlignmentScore: row.clinical_alignment_score as number,
    generatedBy:            row.generated_by as string,
    reviewedBy:             row.reviewed_by as string | undefined,
    reviewerCredentials:    row.reviewer_credentials as string | undefined,
    reviewNotes:            row.review_notes as string | undefined,
    approvedAt:             row.approved_at as string | undefined,
    nrsRiskLevel:           row.nrs_risk_level as NrsRisk | undefined,
    nrsScore:               row.nrs_score as number | undefined,
  };
}

export function savePlanAudit(
  plan: WeeklyTherapeuticPlan,
  patientData: Record<string, unknown>,
  stageReached: 1 | 2 | 3,
  nrsRiskLevel?: NrsRisk,
  nrsScore?: number,
): string {
  const db = openDb();
  const id = generateId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO plan_audit_log
      (id, created_at, updated_at, diagnosis, patient_hash, plan_json,
       stage_reached, status, clinical_alignment_score, generated_by, nrs_risk_level, nrs_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)
  `).run(
    id, now, now,
    plan.diagnosis,
    hashPatient(patientData),
    JSON.stringify(plan),
    stageReached,
    plan.clinicalAlignmentScore,
    plan.preparedBy ?? 'TheraMenu Clinical Engine',
    nrsRiskLevel ?? null,
    nrsScore !== undefined ? nrsScore : null,
  );
  db.close();
  return id;
}

export function updatePlanReview(
  id: string,
  status: PlanStatus,
  reviewedBy: string,
  reviewerCredentials: string,
  reviewNotes: string,
): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE plan_audit_log
    SET status = ?, reviewed_by = ?, reviewer_credentials = ?, review_notes = ?,
        approved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    status,
    reviewedBy,
    reviewerCredentials,
    reviewNotes,
    status === 'APPROVED' || status === 'SENT_TO_KITCHEN' ? now : null,
    now,
    id,
  );
  db.close();
}

export function getPlanHistory(limit = 100): Omit<PlanAuditRecord, 'plan'>[] {
  const db = openDb();
  const rows = db.prepare(`
    SELECT id, created_at, updated_at, diagnosis, patient_hash, stage_reached,
           status, clinical_alignment_score, generated_by, reviewed_by,
           reviewer_credentials, review_notes, approved_at, nrs_risk_level, nrs_score
    FROM plan_audit_log ORDER BY created_at DESC LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  db.close();
  return rows.map((row) => ({ ...rowToRecord({ ...row, plan_json: '{}' }), plan: undefined as unknown as WeeklyTherapeuticPlan }));
}

export function getPlanById(id: string): PlanAuditRecord | null {
  const db = openDb();
  const row = db.prepare('SELECT * FROM plan_audit_log WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  db.close();
  return row ? rowToRecord(row) : null;
}
