import React, { useState } from 'react';
import Header from './components/Header';
import TherapeuticForm from './components/TherapeuticForm';
import MenuResult from './components/MenuResult';
import DiagnosisDB from './components/DiagnosisDB';
import ChatBot from './components/ChatBot';
import NutritionalScreening from './components/NutritionalScreening';
import ComplianceDashboard from './components/ComplianceDashboard';
import PlanHistory from './components/PlanHistory';
import DietitianReview from './components/DietitianReview';
import KitchenSheet from './components/KitchenSheet';
import { generatePlanViaInternalApi } from './services/localClinicalApi';
import { refineMenuWithClaude } from './services/claudeService';
import { enrichPlanWithUsdaData } from './services/usdaFoodDataService';
import { savePlan, type PlanStatus, type NrsRisk } from './services/planAuditService';
import { PatientData } from './components/TherapeuticForm';
import { WeeklyTherapeuticPlan } from './types';
import { executionMode } from './utils/appMode';

type TabId = 'generator' | 'db' | 'logs' | 'screening' | 'compliance';

interface NrsResult {
  score: number;
  risk: NrsRisk;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab]             = useState<TabId>('generator');
  const [loading, setLoading]                 = useState(false);
  const [result, setResult]                   = useState<WeeklyTherapeuticPlan | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [mobileView, setMobileView]           = useState<'form' | 'result'>('form');
  const [currentStage, setCurrentStage]       = useState<1 | 2 | 3 | null>(null);
  const [lastSuccessfulStage, setLastSuccessfulStage] = useState<1 | 2 | 3 | null>(null);

  // Audit trail + review state
  const [planId, setPlanId]                   = useState<string | null>(null);
  const [planStatus, setPlanStatus]           = useState<PlanStatus>('DRAFT');
  const [reviewedBy, setReviewedBy]           = useState<string>('');
  const [showReview, setShowReview]           = useState(false);
  const [showKitchen, setShowKitchen]         = useState(false);
  const [nrsResult, setNrsResult]             = useState<NrsResult | null>(null);
  const [lastPatientData, setLastPatientData] = useState<Record<string, unknown>>({});

  const handleGenerate = async (
    _originalMenu: string,
    diagnosis: string,
    patientDetails: string,
    patientData: PatientData,
  ) => {
    setLoading(true);
    setError(null);
    setCurrentStage(null);
    setLastSuccessfulStage(null);
    setPlanId(null);
    setPlanStatus('DRAFT');
    setReviewedBy('');
    setMobileView('result');
    setLastPatientData({ ...patientData, diagnosis } as Record<string, unknown>);

    try {
      // Stage 1 — deterministic local clinical engine
      setCurrentStage(1);
      const localPlan = await generatePlanViaInternalApi({ diagnosis, patientDetails, patientData });
      setLastSuccessfulStage(1);

      let latestPlan: WeeklyTherapeuticPlan = localPlan;

      // Stage 2 — Claude AI refinement (graceful degradation)
      setCurrentStage(2);
      try {
        latestPlan = await refineMenuWithClaude(localPlan, diagnosis, patientDetails);
        setLastSuccessfulStage(2);
      } catch (stage2Err) {
        console.warn('[Stage 2] Claude refinement failed; using local plan:', stage2Err);
      }

      // Stage 3 — USDA FDC nutrient enrichment (graceful degradation)
      setCurrentStage(3);
      try {
        latestPlan = await enrichPlanWithUsdaData(latestPlan);
        setLastSuccessfulStage(3);
      } catch (stage3Err) {
        console.warn('[Stage 3] USDA enrichment failed; using prior plan:', stage3Err);
      }

      setResult(latestPlan);
      setCurrentStage(null);

      // Persist to audit trail
      const stageReached = lastSuccessfulStage ?? 1;
      const id = await savePlan(
        latestPlan,
        { ...patientData, diagnosis } as Record<string, unknown>,
        stageReached as 1 | 2 | 3,
        nrsResult?.risk,
        nrsResult?.score,
      );
      if (id) setPlanId(id);

      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: unknown) {
      console.error(err);
      setCurrentStage(null);
      const msg = err instanceof Error ? err.message : '';
      let message = 'Plan generation failed. ';
      if (msg.includes('Nutrition DB')) message += 'The nutrition database may not be ready. Please try again.';
      else if (msg.includes('Missing required fields')) message += 'Invalid patient data provided.';
      else message += msg || 'Check patient inputs or internal API status.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleScreeningComplete = (score: number, risk: NrsRisk) => {
    setNrsResult({ score, risk });
  };

  const handleReviewStatusChange = (status: PlanStatus, by: string) => {
    setPlanStatus(status);
    setReviewedBy(by);
  };

  const handleLoadHistoryPlan = (record: { plan: WeeklyTherapeuticPlan; id: string; status: PlanStatus; reviewedBy?: string }) => {
    setResult(record.plan);
    setPlanId(record.id);
    setPlanStatus(record.status);
    setReviewedBy(record.reviewedBy ?? '');
    setActiveTab('generator');
    setMobileView('result');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans selection:bg-blue-100">
      <Header activeTab={activeTab} onTabChange={setActiveTab} executionMode={executionMode} />

      {/* ── Generator tab ─────────────────────────────────────────────────── */}
      {activeTab === 'generator' && (
        <main className="mx-auto max-w-7xl px-4 pt-8">

          {/* NRS screening banner */}
          {nrsResult && (
            <div className={`mb-6 flex items-center justify-between rounded-xl border px-5 py-3 ${
              nrsResult.risk === 'HIGH'     ? 'border-red-200 bg-red-50'    :
              nrsResult.risk === 'MODERATE' ? 'border-amber-200 bg-amber-50' :
                                              'border-emerald-200 bg-emerald-50'
            }`}>
              <div className="flex items-center space-x-3">
                <i className={`fas fa-clipboard-check text-lg ${
                  nrsResult.risk === 'HIGH' ? 'text-red-500' : nrsResult.risk === 'MODERATE' ? 'text-amber-500' : 'text-emerald-500'
                }`}></i>
                <div>
                  <span className="text-xs font-bold text-slate-700">NRS-2002 Screening Complete — </span>
                  <span className={`text-xs font-black ${
                    nrsResult.risk === 'HIGH' ? 'text-red-700' : nrsResult.risk === 'MODERATE' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>{nrsResult.risk} RISK (score {nrsResult.score})</span>
                </div>
              </div>
              <button onClick={() => setNrsResult(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className={`no-print space-y-8 lg:col-span-4 lg:sticky lg:top-24 ${mobileView === 'result' ? 'hidden lg:block' : ''}`}>
              <div className="group relative overflow-hidden rounded-xl bg-slate-900 p-8 text-white shadow-2xl">
                <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:bg-blue-500/20"></div>
                <div className="mb-6 flex items-center space-x-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-blue-400">System Core Online</span>
                </div>
                <h2 className="mb-4 text-3xl font-black uppercase italic leading-none tracking-tighter">Clinical<br/>Engine</h2>
                <p className="mb-8 text-xs font-medium leading-relaxed text-slate-400">
                  Deterministic engine → Claude AI review → USDA FDC enrichment → Dietitian sign-off → Kitchen output.
                </p>
                <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-8">
                  <div className="space-y-1"><p className="text-2xl font-black italic tracking-tighter">07</p><p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Cycle Days</p></div>
                  <div className="space-y-1"><p className="text-2xl font-black italic tracking-tighter">21</p><p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Meal Audits</p></div>
                  <div className="space-y-1"><p className="text-2xl font-black italic tracking-tighter">99<span className="text-xs">%</span></p><p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Local Only</p></div>
                </div>
              </div>
              <TherapeuticForm onSubmit={handleGenerate} isLoading={loading} />
              {error && (
                <div className="animate-in slide-in-from-bottom-4 duration-300 flex flex-col space-y-3 rounded-xl border border-red-500/20 bg-red-950/10 p-6 text-sm text-red-900 shadow-xl">
                  <div className="flex items-center font-black uppercase italic tracking-tighter text-red-600">
                    <i className="fas fa-triangle-exclamation mr-3"></i>
                    <span>Clinical Exception</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-red-800/80">{error}</p>
                </div>
              )}
            </div>

            <div className={`lg:col-span-8 ${mobileView === 'form' ? 'hidden lg:block' : ''}`}>
              <div className="mb-4 lg:hidden">
                <button
                  onClick={() => setMobileView('form')}
                  className="flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm hover:text-gray-900"
                >
                  <i className="fas fa-arrow-left mr-2"></i>Back to Generator Inputs
                </button>
              </div>

              {!result && !loading && (
                <div className="no-print flex min-h-[600px] h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                    <i className="fas fa-clipboard-list text-2xl text-gray-400"></i>
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900">Protocol Pending</h3>
                  <p className="max-w-sm text-sm leading-relaxed text-gray-500">Submit a diagnosis to generate a comprehensive weekly nutritional strategy.</p>
                  {!nrsResult && (
                    <button
                      onClick={() => setActiveTab('screening')}
                      className="mt-6 px-5 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-widest hover:bg-blue-100 transition-all"
                    >
                      <i className="fas fa-clipboard-check mr-2"></i>Complete NRS-2002 Screening First
                    </button>
                  )}
                </div>
              )}

              {loading && (
                <div className="relative no-print flex min-h-[600px] h-full flex-col items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <div className="absolute left-0 right-0 top-0 h-1 bg-gray-100">
                    <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${currentStage ? (currentStage / 3) * 100 : 10}%` }}></div>
                  </div>
                  <div className="relative mb-6 h-20 w-20">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-spinner animate-pulse text-xl text-blue-600"></i>
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {currentStage ? `Stage ${currentStage}/3: ` : ''}Synthesis Underway…
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                    {currentStage === 1 && 'Synthesizing 21 therapeutic meals · Applying clinical protocol filters'}
                    {currentStage === 2 && 'Claude AI reviewing clinical narratives · Enriching therapeutic rationale'}
                    {currentStage === 3 && 'Fetching live USDA nutrient data · Enriching detailed nutrient profiles'}
                    {!currentStage && 'Initializing clinical synthesis…'}
                  </p>
                </div>
              )}

              {result && !loading && (
                <div id="result-section" className="pb-12 space-y-4">
                  {/* Workflow status bar */}
                  <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3 shadow-sm">
                    <div className="flex items-center space-x-4">
                      {planId && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ID: <span className="text-blue-600 font-bold">{planId}</span>
                        </span>
                      )}
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${
                        planStatus === 'APPROVED'        ? 'bg-emerald-100 text-emerald-700' :
                        planStatus === 'SENT_TO_KITCHEN' ? 'bg-blue-100 text-blue-700' :
                        planStatus === 'REJECTED'        ? 'bg-red-100 text-red-700' :
                        planStatus === 'PENDING_REVIEW'  ? 'bg-amber-100 text-amber-700' :
                                                           'bg-slate-100 text-slate-600'
                      }`}>
                        {planStatus.replace('_', ' ')}
                      </span>
                      {reviewedBy && (
                        <span className="text-[10px] text-slate-500">
                          <i className="fas fa-check-circle text-emerald-500 mr-1"></i>{reviewedBy}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {planId && planStatus === 'DRAFT' && (
                        <button
                          onClick={() => setShowReview(true)}
                          className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all"
                        >
                          <i className="fas fa-user-doctor mr-1.5"></i>Dietitian Review
                        </button>
                      )}
                      {planStatus === 'APPROVED' && (
                        <button
                          onClick={() => setShowKitchen(true)}
                          className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all"
                        >
                          <i className="fas fa-utensils mr-1.5"></i>Kitchen Sheet
                        </button>
                      )}
                    </div>
                  </div>

                  <MenuResult plan={result} />
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {activeTab === 'db'         && <DiagnosisDB />}
      {activeTab === 'screening'  && <NutritionalScreening onScreeningComplete={handleScreeningComplete} />}
      {activeTab === 'compliance' && <ComplianceDashboard />}
      {activeTab === 'logs'       && (
        <PlanHistory onLoadPlan={(r) => handleLoadHistoryPlan({ plan: r.plan, id: r.id, status: r.status, reviewedBy: r.reviewedBy })} />
      )}

      <ChatBot />

      {/* Dietitian review modal */}
      {showReview && result && planId && (
        <DietitianReview
          planId={planId}
          plan={result}
          currentStatus={planStatus}
          onStatusChange={(status, by) => handleReviewStatusChange(status, by)}
          onClose={() => setShowReview(false)}
        />
      )}

      {/* Kitchen sheet modal */}
      {showKitchen && result && (
        <KitchenSheet
          plan={result}
          planId={planId ?? undefined}
          approvedBy={reviewedBy || undefined}
          onClose={() => setShowKitchen(false)}
        />
      )}
    </div>
  );
};

export default App;
