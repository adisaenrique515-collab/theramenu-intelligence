import React, { useEffect, useState } from 'react';
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
import { CheckCircle2, ClipboardCheck, Loader2, X } from 'lucide-react';
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
import { ShadowSafetyReportCard } from './components/ShadowSafetyReportCard';
import { buildShadowSafetyReport } from './services/shadowSafetyGateService';
import type { ShadowSafetyReport } from './types';

type TabId = 'generator' | 'plan' | 'db' | 'logs' | 'screening' | 'compliance';

const appToShellTab: Record<TabId, TabKey> = {
  generator: 'generator',
  plan: 'plan',
  db: 'diagnosis',
  logs: 'audit',
  screening: 'screening',
  compliance: 'compliance',
};

interface NrsResult {
  score: number;
  risk: NrsRisk;
}

interface KitchenNotice {
  title: string;
  description: string;
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

const workflowStages = [
  { id: 1, label: 'Clinical engine', description: 'Deterministic protocol synthesis' },
  { id: 2, label: 'AI refinement', description: 'Clinical narrative review' },
  { id: 3, label: 'Nutrient enrichment', description: 'USDA data pass' },
] as const;

function WorkflowStatusPanel({
  currentStage,
  lastSuccessfulStage,
}: {
  currentStage: 1 | 2 | 3 | null;
  lastSuccessfulStage: 1 | 2 | 3 | null;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">Workflow running</p>
          <h2 className="text-base font-semibold text-slate-900">Generating therapeutic plan</h2>
        </div>
        <Badge tone="blue">Stage {currentStage ?? 1}/3</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {workflowStages.map((stage) => {
          const complete = lastSuccessfulStage !== null && stage.id <= lastSuccessfulStage;
          const active = currentStage === stage.id;
          return (
            <div
              key={stage.id}
              className={
                'rounded-lg border px-4 py-3 ' +
                (complete
                  ? 'border-emerald-200 bg-emerald-50'
                  : active
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-slate-200 bg-slate-50')
              }
            >
              <div className="flex items-center gap-2">
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-slate-300 bg-white" aria-hidden />
                )}
                <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{stage.description}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
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
  const [kitchenNotice, setKitchenNotice]     = useState<KitchenNotice | null>(null);
  const [nrsResult, setNrsResult]             = useState<NrsResult | null>(null);
  const [lastPatientData, setLastPatientData] = useState<Record<string, unknown>>({});
  const [shadowSafetyReport, setShadowSafetyReport] = useState<ShadowSafetyReport | null>(null);

  const hasGeneratedPlan = !!result;
  const canOpenKitchen = hasGeneratedPlan && (planStatus === 'APPROVED' || planStatus === 'SENT_TO_KITCHEN');

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
    setKitchenNotice(null);
    setShadowSafetyReport(null);
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

  useEffect(() => {
    if (!result) {
      setShadowSafetyReport(null);
      return;
    }

    setShadowSafetyReport(buildShadowSafetyReport(result, { planId, planStatus, reviewedBy }));
  }, [planId, planStatus, result, reviewedBy]);

  const handleScreeningComplete = (score: number, risk: NrsRisk) => {
    setNrsResult({ score, risk });
  };

  const handleReviewStatusChange = (status: PlanStatus, by: string) => {
    setPlanStatus(status);
    setReviewedBy(by);
    setKitchenNotice(null);
  };

  const handleLoadHistoryPlan = (record: { plan: WeeklyTherapeuticPlan; id: string; status: PlanStatus; reviewedBy?: string }) => {
    setResult(record.plan);
    setPlanId(record.id);
    setPlanStatus(record.status);
    setReviewedBy(record.reviewedBy ?? '');
    setKitchenNotice(null);
    setActiveTab('generator');
    setMobileView('result');
  };

  const openClinicalAssistant = () => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Open clinical assistant"]')?.click();
    });
  };

  const handleKitchenOutputRequest = () => {
    if (canOpenKitchen) {
      setKitchenNotice(null);
      setShowKitchen(true);
      return;
    }

    setShowKitchen(false);
    setActiveTab('generator');
    setMobileView(hasGeneratedPlan ? 'result' : 'form');
    setKitchenNotice(
      hasGeneratedPlan
        ? {
            title: 'Dietitian approval required',
            description: 'Kitchen Output is available only after the plan is approved or sent to kitchen.',
          }
        : {
            title: 'No generated plan',
            description: 'Generate a therapeutic plan before opening Kitchen Output.',
          },
    );
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
      setActiveTab('plan');
      setMobileView('result');
      return;
    }
    if (tab === 'kitchen') {
      handleKitchenOutputRequest();
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
          planStatus === 'APPROVED' || planStatus === 'SENT_TO_KITCHEN' ? 'approved'
          : planStatus === 'REJECTED' ? 'rejected'
          : planStatus === 'PENDING_REVIEW' ? 'pending_review'
          : 'draft',
      }
    : null;

  const planStatusSummary = result ? {
    validationTone: result.validationReport ? (result.validationReport.passed ? 'emerald' : 'red') : 'slate',
    validationLabel: result.validationReport ? (result.validationReport.passed ? 'Passed' : 'Review required') : 'Not available',
    validationDetail: result.validationReport?.summary
      ? `${result.validationReport.summary.nutrientChecksPassed}/${result.validationReport.summary.nutrientChecksTotal} nutrient checks passed`
      : 'Validation report has not been attached to this plan.',
    protocolLabel:
      result.therapeuticEngine?.recommendedDiets?.map((diet) => diet.code).join(', ') ||
      result.compoundDietCodes?.join(', ') ||
      result.diagnosis,
    reviewLabel:
      planStatus === 'APPROVED' ? 'Approved'
      : planStatus === 'SENT_TO_KITCHEN' ? 'Sent to kitchen'
      : planStatus === 'REJECTED' ? 'Rejected'
      : planStatus === 'PENDING_REVIEW' ? 'Pending review'
      : 'Draft',
    kitchenLabel: canOpenKitchen ? 'Eligible' : 'Blocked',
    kitchenDetail: canOpenKitchen
      ? 'Kitchen Output is available for this plan.'
      : 'Dietitian approval is required before Kitchen Output.',
  } : null;

  const renderPlanStatusShell = () => {
    if (!result || !planStatusSummary) return null;

    return (
      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={planStatusTone(planStatus)}>{planStatus.replace('_', ' ')}</Badge>
              {result.carePathLabel && <Badge tone="emerald">{result.carePathLabel}</Badge>}
              {result.engineMode && <Badge tone="blue">{result.engineMode}</Badge>}
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{result.diagnosis}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Plan ID:{' '}
                <span className="font-mono font-semibold text-slate-800">{planId ?? 'Not saved'}</span>
              </span>
              <span>
                Texture:{' '}
                <span className="font-mono font-semibold text-slate-800">{result.constraints?.textureLevel ?? 'Regular'}</span>
              </span>
              <span>
                Alignment:{' '}
                <span className="font-mono font-semibold text-slate-800">{result.clinicalAlignmentScore}%</span>
              </span>
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
            <Button
              type="button"
              onClick={handleKitchenOutputRequest}
              className={canOpenKitchen ? 'bg-emerald-600 hover:bg-emerald-700' : undefined}
            >
              Kitchen sheet
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Review status',
              value: planStatusSummary.reviewLabel,
              detail: reviewedBy ? `Signed by ${reviewedBy}` : 'Dietitian sign-off controls remain unchanged.',
              tone: planStatusTone(planStatus),
            },
            {
              label: 'Kitchen eligibility',
              value: planStatusSummary.kitchenLabel,
              detail: planStatusSummary.kitchenDetail,
              tone: canOpenKitchen ? 'emerald' : 'amber',
            },
            {
              label: 'Validation',
              value: planStatusSummary.validationLabel,
              detail: planStatusSummary.validationDetail,
              tone: planStatusSummary.validationTone,
            },
            {
              label: 'Protocol',
              value: planStatusSummary.protocolLabel,
              detail: result.constraints?.nutrientTargets ?? 'Current weekly plan remains the clinical source of truth.',
              tone: 'blue',
            },
          ].map((item) => (
            <Card key={item.label} className="bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                <Badge tone={item.tone as 'slate' | 'blue' | 'emerald' | 'amber' | 'red'}>{item.value}</Badge>
              </div>
              <p className="line-clamp-3 text-xs leading-5 text-slate-600">{item.detail}</p>
            </Card>
          ))}
        </div>
      </Card>
    );
  };

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
          {kitchenNotice && !result && (
            <StateView
              compact
              kind="warning"
              title={kitchenNotice.title}
              description={kitchenNotice.description}
            />
          )}
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
                  <div className="space-y-4">
                    <WorkflowStatusPanel currentStage={currentStage} lastSuccessfulStage={lastSuccessfulStage} />
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
                  </div>
                )}

                {result && !loading && (
                  <div id="result-section" className="space-y-4 pb-12">
                    {kitchenNotice && (
                      <StateView
                        compact
                        kind="warning"
                        title={kitchenNotice.title}
                        description={kitchenNotice.description}
                      />
                    )}

                    {renderPlanStatusShell()}

                    {shadowSafetyReport && <ShadowSafetyReportCard report={shadowSafetyReport} />}

                    <MenuResult plan={result} />
                  </div>
                )}
              </>
            }
          />
        </main>
      )}

      {activeTab === 'plan' && (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {!result ? (
            <StateView
              kind="empty"
              title="No plan generated yet"
              description="Complete the Generator to synthesize a therapeutic weekly plan before opening the Plan workflow."
              actions={(
                <Button type="button" onClick={() => setActiveTab('generator')}>
                  Open generator
                </Button>
              )}
            />
          ) : (
            <div id="result-section" className="space-y-4 pb-12">
              {kitchenNotice && (
                <StateView
                  compact
                  kind="warning"
                  title={kitchenNotice.title}
                  description={kitchenNotice.description}
                />
              )}
              {renderPlanStatusShell()}
              {shadowSafetyReport && <ShadowSafetyReportCard report={shadowSafetyReport} />}
              <MenuResult plan={result} />
            </div>
          )}
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
