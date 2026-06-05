import React, { useState } from 'react';
import { CheckCircle2, Loader2, PenLine, X, XCircle } from 'lucide-react';
import { submitReview, type PlanStatus } from '../services/planAuditService';
import type { WeeklyTherapeuticPlan } from '../types';
import { Badge, Button, Card, Input, StateView } from './thera/ui';

interface Props {
  planId: string;
  plan: WeeklyTherapeuticPlan;
  currentStatus: PlanStatus;
  onStatusChange: (status: PlanStatus, reviewedBy: string, credentials: string) => void;
  onClose: () => void;
}

const DietitianReview: React.FC<Props> = ({ planId, plan, currentStatus, onStatusChange, onClose }) => {
  const [reviewedBy, setReviewedBy]           = useState('');
  const [credentials, setCredentials]         = useState('');
  const [notes, setNotes]                     = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  const activeDay = plan.days[0];

  const statusTone = (status: PlanStatus): 'emerald' | 'amber' | 'red' | 'slate' => {
    if (status === 'APPROVED' || status === 'SENT_TO_KITCHEN') return 'emerald';
    if (status === 'REJECTED') return 'red';
    if (status === 'DRAFT') return 'slate';
    return 'amber';
  };

  const submit = async (status: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW' | 'SENT_TO_KITCHEN') => {
    if (!reviewedBy.trim()) { setError('Reviewer name is required.'); return; }
    if (!credentials.trim()) { setError('Credentials are required (e.g. RD, MSc).'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await submitReview(planId, { status, reviewedBy: reviewedBy.trim(), reviewerCredentials: credentials.trim(), reviewNotes: notes.trim() });
      onStatusChange(status, reviewedBy.trim(), credentials.trim());
      onClose();
    } catch {
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-white px-8 py-5">
          <div>
            <h2 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">Dietitian Review</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">Plan ID: {planId}</p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge tone={statusTone(currentStatus)}>{currentStatus.replace('_', ' ')}</Badge>
            <Button onClick={onClose} variant="ghost" className="h-8 min-h-0 w-8 rounded-full bg-slate-100 p-0" aria-label="Close dietitian review">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-6 px-8 py-6">

          {/* Plan summary */}
          <Card className="bg-slate-900 p-5 text-white">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-slate-400">Protocol Summary</p>
            <h3 className="mb-4 text-2xl font-black uppercase italic tracking-tighter">{plan.diagnosis}</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Alignment', value: `${plan.clinicalAlignmentScore}%` },
                { label: 'Texture', value: plan.constraints?.textureLevel ?? '-' },
                { label: 'Care Path', value: plan.carePathLabel ?? '-' },
                { label: 'Engine', value: plan.engineMode ?? 'LOCAL' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">{s.label}</p>
                  <p className="text-sm font-black uppercase">{s.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Day 1 nutrient snapshot */}
          {activeDay && (
            <div>
              <p className="mb-3 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">Day 1 Nutrient Audit ({activeDay.dayName})</p>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Calories', actual: activeDay.totals?.caloriesKcal, target: activeDay.dailyTargets?.caloriesKcal, unit: 'kcal' },
                  { label: 'Protein',  actual: activeDay.totals?.proteinG,     target: activeDay.dailyTargets?.proteinG,     unit: 'g' },
                  { label: 'Sodium',   actual: activeDay.totals?.sodiumMg,     target: activeDay.dailyTargets?.sodiumMg,     unit: 'mg' },
                  { label: 'Potassium',actual: activeDay.totals?.potassiumMg,  target: activeDay.dailyTargets?.potassiumMg,  unit: 'mg' },
                  { label: 'Fibre',    actual: activeDay.totals?.fiberG,       target: activeDay.dailyTargets?.fiberG,       unit: 'g' },
                ].map((stat) => {
                  const pct = stat.target ? Math.round(((stat.actual ?? 0) / stat.target) * 100) : null;
                  const ok = pct !== null && pct >= 80 && pct <= 130;
                  return (
                    <Card key={stat.label} className={`p-3 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
                      <p className="text-lg font-black text-slate-900">{Math.round(stat.actual ?? 0)}</p>
                      <p className="text-[9px] text-slate-400">/ {Math.round(stat.target ?? 0)}{stat.unit}</p>
                      {pct !== null && <p className={`mt-0.5 text-[9px] font-bold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{pct}%</p>}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation issues */}
          {plan.validationReport && !plan.validationReport.passed && (
            <StateView
              compact
              kind="error"
              title="Validation Issues"
              items={plan.validationReport.issues}
            />
          )}

          {/* Rationale */}
          <Card className="bg-blue-50 p-4">
            <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-blue-600">Clinical Rationale</p>
            <p className="text-xs italic leading-relaxed text-slate-700">{plan.rationale}</p>
          </Card>

          {/* Reviewer sign-off */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <p className="text-sm font-bold text-slate-900">Dietitian Sign-Off</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={reviewedBy}
                  onChange={(e) => setReviewedBy(e.target.value)}
                  placeholder="e.g. Dr. Jane Odhiambo"
                  className="bg-slate-50"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Credentials <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                  placeholder="e.g. RD, MSc Clinical Nutrition"
                  className="bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Clinical Notes / Modifications
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Document any modifications made, clinical observations, or recommendations for the kitchen team..."
                className="w-full resize-none rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {error && (
              <StateView compact kind="error" title={error} />
            )}

            <div className="flex items-center justify-between pt-2">
              <Button onClick={onClose} variant="ghost">
                Cancel
              </Button>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => submit('REJECTED')}
                  disabled={submitting}
                  variant="danger"
                  className="text-xs font-bold uppercase tracking-widest"
                >
                  <XCircle className="h-4 w-4" aria-hidden />Reject
                </Button>
                <Button
                  onClick={() => submit('PENDING_REVIEW')}
                  disabled={submitting}
                  variant="secondary"
                  className="border-amber-200 bg-amber-50 text-xs font-bold uppercase tracking-widest text-amber-700 hover:bg-amber-100"
                >
                  <PenLine className="h-4 w-4" aria-hidden />Request Changes
                </Button>
                <Button
                  onClick={() => submit('APPROVED')}
                  disabled={submitting}
                  className="bg-emerald-600 text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-900/20 hover:bg-emerald-700"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  Approve Protocol
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DietitianReview;
