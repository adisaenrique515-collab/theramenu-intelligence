import React, { useEffect, useState, useCallback } from 'react';
import { getPlanHistory, getPlanById, type PlanRecord, type PlanRecordFull } from '../services/planAuditService';

const STATUS_STYLES: Record<string, string> = {
  DRAFT:           'bg-slate-100 text-slate-600',
  PENDING_REVIEW:  'bg-amber-100 text-amber-700',
  APPROVED:        'bg-emerald-100 text-emerald-700',
  SENT_TO_KITCHEN: 'bg-blue-100 text-blue-700',
  REJECTED:        'bg-red-100 text-red-700',
};

const STAGE_LABELS: Record<number, string> = {
  1: 'Local Engine',
  2: '+ Claude AI',
  3: '+ USDA FDC',
};

const NRS_STYLES: Record<string, string> = {
  LOW:      'bg-emerald-100 text-emerald-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  HIGH:     'bg-red-100 text-red-700',
};

interface Props {
  onLoadPlan?: (plan: PlanRecordFull) => void;
}

const PlanHistory: React.FC<Props> = ({ onLoadPlan }) => {
  const [records, setRecords] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PlanRecordFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlanHistory();
      setRecords(data);
    } catch {
      // silent fail — history is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSelect = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); setSelectedRecord(null); return; }
    setSelectedId(id);
    setLoadingDetail(true);
    const full = await getPlanById(id);
    setSelectedRecord(full);
    setLoadingDetail(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Audit Log</h2>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-1">JCI-compliant plan history — {records.length} records</p>
        </div>
        <button onClick={fetchHistory} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">
          <i className="fas fa-rotate mr-2"></i>Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <i className="fas fa-spinner animate-spin mr-3"></i>
          <span className="text-sm font-mono">Loading audit records…</span>
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          <i className="fas fa-clock-rotate-left text-3xl mb-3"></i>
          <p className="text-sm font-semibold">No plans generated yet</p>
          <p className="text-xs mt-1">Generate a protocol to create the first audit record.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Plan ID', 'Date', 'Diagnosis', 'NRS', 'Score', 'Stage', 'Status', 'Reviewed By', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map((r) => (
                <React.Fragment key={r.id}>
                  <tr
                    onClick={() => handleSelect(r.id)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedId === r.id ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-[10px] text-blue-600 font-bold">{r.id}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}<br/>
                      <span className="text-slate-400 text-[9px]">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-semibold text-slate-900 max-w-[140px] truncate">{r.diagnosis}</td>
                    <td className="px-4 py-3">
                      {r.nrsRiskLevel ? (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${NRS_STYLES[r.nrsRiskLevel]}`}>
                          {r.nrsRiskLevel} {r.nrsScore !== undefined ? `(${r.nrsScore})` : ''}
                        </span>
                      ) : <span className="text-slate-300 text-[9px]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-black ${r.clinicalAlignmentScore >= 90 ? 'text-emerald-600' : r.clinicalAlignmentScore >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                        {r.clinicalAlignmentScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">{STAGE_LABELS[r.stageReached]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {r.reviewedBy ? (
                        <span>{r.reviewedBy}<br/><span className="text-slate-400 text-[9px]">{r.reviewerCredentials}</span></span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <i className={`fas fa-chevron-${selectedId === r.id ? 'up' : 'down'} text-slate-300 text-[10px]`}></i>
                    </td>
                  </tr>

                  {selectedId === r.id && (
                    <tr>
                      <td colSpan={9} className="px-6 py-6 bg-slate-50">
                        {loadingDetail ? (
                          <div className="flex items-center text-slate-400 text-sm">
                            <i className="fas fa-spinner animate-spin mr-2"></i>Loading plan details…
                          </div>
                        ) : selectedRecord ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                              {[
                                { label: 'Generated', value: new Date(selectedRecord.createdAt).toLocaleString() },
                                { label: 'Patient Hash', value: selectedRecord.patientHash },
                                { label: 'Approved', value: selectedRecord.approvedAt ? new Date(selectedRecord.approvedAt).toLocaleString() : '—' },
                                { label: 'Alignment', value: `${selectedRecord.clinicalAlignmentScore}%` },
                              ].map((item) => (
                                <div key={item.label} className="bg-white rounded-lg p-3 border border-slate-200">
                                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                  <p className="text-xs font-semibold text-slate-900">{item.value}</p>
                                </div>
                              ))}
                            </div>
                            {selectedRecord.reviewNotes && (
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Dietitian Notes</p>
                                <p className="text-xs text-slate-700 leading-relaxed italic">{selectedRecord.reviewNotes}</p>
                              </div>
                            )}
                            {onLoadPlan && selectedRecord.plan && (
                              <button
                                onClick={() => onLoadPlan(selectedRecord)}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
                              >
                                <i className="fas fa-arrow-up-right-from-square mr-2"></i>Load This Plan
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Could not load plan details.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlanHistory;
