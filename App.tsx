import React, { useState } from 'react';
import TherapeuticForm from './components/TherapeuticForm';
import MenuResult from './components/MenuResult';
import DiagnosisDB from './components/DiagnosisDB';
import ChatBot from './components/ChatBot';
import NutritionalScreening from './components/NutritionalScreening';
import ComplianceDashboard from './components/ComplianceDashboard';
import PlanHistory from './components/PlanHistory';
import DietitianReview from './components/DietitianReview';
import KitchenSheet from './components/KitchenSheet';
import { Header as TheraHeader, type TabKey } from './components/thera/Header';
import { Badge, Button, Card, StateView } from './components/thera/ui';
import { CheckCircle2, ClipboardCheck, X } from 'lucide-react';
import { generatePlanViaInternalApi } from './services/localClinicalApi';
import { refineMenuWithClaude } from './services/claudeService';
import { enrichPlanWithUsdaData } from './services/usdaFoodDataService';
import { savePlan, type PlanStatus, type NrsRisk } from './services/planAuditService';
import { PatientData } from './components/TherapeuticForm';
import { WeeklyTherapeuticPlan } from './types';
import { executionMode } from './utils/appMode';
import { WorkflowStepper } from './components/thera/WorkflowStepper';
import { Disclaimer } from './components/thera/ui';
import type { GeneratedPlan } from './components/thera/types';
import GeneratorShell from './components/GeneratorShell';

type TabId = 'generator' | 'db' | 'logs' | 'screening' | 'compliance';

const appToShellTab: Record<TabId, TabKey> = {
  generator: 'generator',
  db: 'diagnosis',
  logs: 'audit',
  screening: 'screening',
  compliance: 'compliance',
};

interface NrsResult {
  score: number;
  risk: NrsRisk;
}

const nrsRiskTone = (risk: NrsRisk): 'emerald' | 'amber' | 'red' => {
  if (risk === 'HIGH') return 'red';
  if (risk === 'MODERATE') return 'amber';
  return 'emerald';
};

const planStatusTone = (status: PlanStatus): 'slate' | 'blue' | 'emerald' | 'amber' | 'red' => {
  if (status === 'APPROVED') return 'emerald';
  if (status === 'SENT_TO_KITCHEN') return 'blue';
  if (status === 'REJECTED') return 'red';
  if (status === 'PENDING_REVIEW') return 'amber';
  return 'slate';
};

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

  const openClinicalAssistant = () => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Open clinical assistant"]')?.click();
    });
  };

  const handleShellTabChange = (tab: TabKey) => {
    if (tab === 'diagnosis') {
      setActiveTab('db');
      return;
    }
    if (tab === 'audit') {
      setActiveTab('logs');
      return;
    }
    if (tab === 'screening' || tab === 'compliance' || tab === 'generator') {
      setActiveTab(tab);
      return;
    }
    if (tab === 'plan') {
      setActiveTab('generator');
      setMobileView('result');
      return;
    }
    if (tab === 'kitchen') {
      if (result && planStatus === 'APPROVED') {
        setShowKitchen(true);
      }
      setActiveTab('generator');
      setMobileView('result');
      return;
    }
    if (tab === 'ai') {
      openClinicalAssistant();
      return;
    }
    setActiveTab('generator');
  };

  const shellPlan: GeneratedPlan | null = result
    ? {
        reviewStatus:
          planStatus === 'APPROVED' ? 'approved'
          : planStatus === 'REJECTED' ? 'rejected'
          : planStatus === 'PENDING_REVIEW' ? 'pending_review'
          : 'draft',
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans selection:bg-blue-100">
      <TheraHeader
        active={appToShellTab[activeTab]}
        onChange={handleShellTabChange}
        rightSlot={(
          <div className="flex flex-col items-end text-right">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">System Status</span>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-emerald-300">
              {executionMode === 'MOCK' ? 'LOCAL PHI' : 'LIVE'}
            </span>
          </div>
        )}
      />

      <WorkflowStepper
        activeTab={appToShellTab[activeTab]}
        plan={shellPlan}
        onJump={handleShellTabChange}
      />

      {/* ── Generator tab ─────────────────────────────────────────────────── */}
      {activeTab === 'generator' && (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <GeneratorShell
            form={<TherapeuticForm onSubmit={handleGenerate} isLoading={loading} />}
            error={error}
            loading={loading}
            hasResult={!!result}
            mobileView={mobileView}
            onBackToForm={() => setMobileView('form')}
            lastPatientData={lastPatientData}
            onScreeningClick={!nrsResult ? () => setActiveTab('screening') : undefined}
            nrsSlot={nrsResult && (
              <Card className="mb-6 flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <ClipboardCheck className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">NRS-2002 screening complete</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={nrsRiskTone(nrsResult.risk)}>{nrsResult.risk} risk</Badge>
                      <span className="text-xs text-slate-500">Score {nrsResult.score}</span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNrsResult(null)}
                  className="min-h-10 px-3"
                  aria-label="Clear NRS screening result"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </Card>
            )}
            resultSlot={
              <>
                {loading && (
                  <StateView
                    kind="loading"
                    title={`${currentStage ? `Stage ${currentStage}/3: ` : ''}Synthesis Underway`}
                    description={
                      currentStage === 1 ? 'Synthesizing 21 therapeutic meals. Applying clinical protocol filters.' :
                      currentStage === 2 ? 'Claude AI reviewing clinical narratives. Enriching therapeutic rationale.' :
                      currentStage === 3 ? 'Fetching live USDA nutrient data. Enriching detailed nutrient profiles.' :
                      'Initializing clinical synthesis.'
                    }
                  />
                )}

                {result && !loading && (
                  <div id="result-section" className="space-y-4 pb-12">
                    {/* Workflow status bar */}
                    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={planStatusTone(planStatus)}>{planStatus.replace('_', ' ')}</Badge>
                          {planId && (
                            <span className="font-mono text-xs text-slate-500">
                              ID: <span className="font-semibold text-blue-700">{planId}</span>
                            </span>
                          )}
                        </div>
                        {reviewedBy && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                            <span>{reviewedBy}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {planId && planStatus === 'DRAFT' && (
                          <Button type="button" onClick={() => setShowReview(true)}>
                            Dietitian review
                          </Button>
                        )}
                        {planStatus === 'APPROVED' && (
                          <Button
                            type="button"
                            onClick={() => setShowKitchen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Kitchen sheet
                          </Button>
                        )}
                      </div>
                    </Card>

                    <MenuResult plan={result} />
                  </div>
                )}
              </>
            }
          />
        </main>
      )}

      {activeTab === 'db'         && <DiagnosisDB />}
      {activeTab === 'screening'  && <NutritionalScreening onScreeningComplete={handleScreeningComplete} />}
      {activeTab === 'compliance' && <ComplianceDashboard />}
      {activeTab === 'logs'       && (
        <PlanHistory onLoadPlan={(r) => handleLoadHistoryPlan({ plan: r.plan, id: r.id, status: r.status, reviewedBy: r.reviewedBy })} />
      )}

      <ChatBot />

      <Disclaimer />

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
