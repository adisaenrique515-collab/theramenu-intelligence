import React, { useState } from 'react';
import { submitReview, type PlanStatus } from '../services/planAuditService';
import type { WeeklyTherapeuticPlan } from '../types';

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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-black uppercase italic tracking-tighter text-slate-900">Dietitian Review</h2>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-0.5">Plan ID: {planId}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${
              currentStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
              currentStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>{currentStatus.replace('_', ' ')}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all">
              <i className="fas fa-times text-slate-500 text-xs"></i>
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* Plan summary */}
          <div className="bg-slate-900 rounded-xl p-5 text-white">
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-3">Protocol Summary</p>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-4">{plan.diagnosis}</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Alignment', value: `${plan.clinicalAlignmentScore}%` },
                { label: 'Texture', value: plan.constraints?.textureLevel ?? '—' },
                { label: 'Care Path', value: plan.carePathLabel ?? '—' },
                { label: 'Engine', value: plan.engineMode ?? 'LOCAL' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-sm font-black uppercase">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Day 1 nutrient snapshot */}
          {activeDay && (
            <div>
              <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">Day 1 Nutrient Audit ({activeDay.dayName})</p>
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
                    <div key={stat.label} className={`rounded-lg p-3 border ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-lg font-black text-slate-900">{Math.round(stat.actual ?? 0)}</p>
                      <p className="text-[9px] text-slate-400">/ {Math.round(stat.target ?? 0)}{stat.unit}</p>
                      {pct !== null && <p className={`text-[9px] font-bold mt-0.5 ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{pct}%</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation issues */}
          {plan.validationReport && !plan.validationReport.passed && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-[9px] font-mono font-bold text-red-600 uppercase tracking-widest">Validation Issues</p>
              {plan.validationReport.issues.map((issue, i) => (
                <p key={i} className="text-xs text-red-700 leading-relaxed">• {issue}</p>
              ))}
            </div>
          )}

          {/* Rationale */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-[9px] font-mono font-bold text-blue-600 uppercase tracking-widest mb-2">Clinical Rationale</p>
            <p className="text-xs text-slate-700 leading-relaxed italic">{plan.rationale}</p>
          </div>

          {/* Reviewer sign-off */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <p className="text-sm font-bold text-slate-900">Dietitian Sign-Off</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reviewedBy}
                  onChange={(e) => setReviewedBy(e.target.value)}
                  placeholder="e.g. Dr. Jane Odhiambo"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Credentials <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                  placeholder="e.g. RD, MSc Clinical Nutrition"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Clinical Notes / Modifications
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Document any modifications made, clinical observations, or recommendations for the kitchen team…"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 font-medium">{error}</p>
            )}

            <div className="flex items-center justify-between pt-2">
              <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-all">
                Cancel
              </button>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => submit('REJECTED')}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
                >
                  <i className="fas fa-times-circle mr-2"></i>Reject
                </button>
                <button
                  onClick={() => submit('PENDING_REVIEW')}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-widest hover:bg-amber-100 transition-all disabled:opacity-50"
                >
                  <i className="fas fa-pen mr-2"></i>Request Changes
                </button>
                <button
                  onClick={() => submit('APPROVED')}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                >
                  {submitting ? <i className="fas fa-spinner animate-spin mr-2"></i> : <i className="fas fa-check-circle mr-2"></i>}
                  Approve Protocol
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DietitianReview;
