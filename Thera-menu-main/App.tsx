import React, { useState } from 'react';
import Header from './components/Header';
import TherapeuticForm from './components/TherapeuticForm';
import MenuResult from './components/MenuResult';
import DiagnosisDB from './components/DiagnosisDB';
import ChatBot from './components/ChatBot';
import NutritionalScreening from './components/NutritionalScreening';
import ComplianceDashboard from './components/ComplianceDashboard';
import { generatePlanViaInternalApi } from './services/localClinicalApi';
import { refineMenuWithClaude } from './services/claudeService';
import { enrichPlanWithUsdaData } from './services/usdaFoodDataService';
import { PatientData } from './components/TherapeuticForm';
import { WeeklyTherapeuticPlan } from './types';
import { executionMode } from './utils/appMode';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generator' | 'db' | 'logs' | 'screening' | 'compliance'>('generator');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WeeklyTherapeuticPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'form' | 'result'>('form');
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | null>(null);
  const [lastSuccessfulStage, setLastSuccessfulStage] = useState<1 | 2 | 3 | null>(null);

  const handleGenerate = async (originalMenu: string, diagnosis: string, patientDetails: string, patientData: PatientData) => {
    setLoading(true);
    setError(null);
    setCurrentStage(null);
    setLastSuccessfulStage(null);
    setMobileView('result');
    try {
      // 1 ── Deterministic plan from local clinical engine
      setCurrentStage(1);
      const localPlan = await generatePlanViaInternalApi({
        diagnosis,
        patientDetails,
        patientData,
      });
      setLastSuccessfulStage(1);

      let latestPlan: WeeklyTherapeuticPlan = localPlan;

      // 2 ── Claude AI clinical review + narrative refinement (graceful degradation)
      setCurrentStage(2);
      try {
        latestPlan = await refineMenuWithClaude(localPlan, diagnosis, patientDetails);
        setLastSuccessfulStage(2);
      } catch (stage2Err) {
        console.warn('[Stage 2] Claude refinement failed; using local plan:', stage2Err);
      }

      // 3 ── USDA FoodData Central live nutrient enrichment (graceful degradation)
      setCurrentStage(3);
      try {
        latestPlan = await enrichPlanWithUsdaData(latestPlan);
        setLastSuccessfulStage(3);
      } catch (stage3Err) {
        console.warn('[Stage 3] USDA enrichment failed; using prior plan:', stage3Err);
      }

      setResult(latestPlan);
      setCurrentStage(null);

      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: unknown) {
      console.error(err);
      setCurrentStage(null);
      const errorMessage = err instanceof Error ? err.message : '';

      let message = 'Plan generation failed. ';
      if (errorMessage.includes('Nutrition DB')) {
        message += 'The nutrition database may not be ready. Please try again.';
      } else if (errorMessage.includes('Missing required fields')) {
        message += 'Invalid patient data provided.';
      } else {
        message += errorMessage || 'Check patient inputs or internal API status.';
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans selection:bg-blue-100">
      <Header activeTab={activeTab} onTabChange={setActiveTab} executionMode={executionMode} />

      {activeTab === 'generator' && (
        <main className="mx-auto max-w-7xl px-4 pt-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className={`no-print space-y-8 lg:col-span-4 lg:sticky lg:top-24 ${mobileView === 'result' ? 'hidden lg:block' : ''}`}>
              <div className="group relative overflow-hidden rounded-xl bg-slate-900 p-8 text-white shadow-2xl">
                <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:bg-blue-500/20"></div>
                <div className="mb-6 flex items-center space-x-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-blue-400">System Core Online</span>
                </div>
                <h2 className="mb-4 text-3xl font-black uppercase italic leading-none tracking-tighter">
                  Clinical
                  <br />
                  Engine
                </h2>
                <p className="mb-8 text-xs font-medium leading-relaxed text-slate-400">
                  Deterministic clinical engine → Claude AI review → USDA FDC live nutrient data. PHI is processed locally; only anonymised meal plans are sent for AI refinement.
                </p>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-8">
                  <div className="space-y-1">
                    <p className="text-2xl font-black italic tracking-tighter">07</p>
                    <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Cycle Days</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black italic tracking-tighter">21</p>
                    <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Meal Audits</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black italic tracking-tighter">
                      99<span className="text-xs">%</span>
                    </p>
                    <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Local Only</p>
                  </div>
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
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back to Generator Inputs
                </button>
              </div>

              {!result && !loading ? (
                <div className="no-print flex min-h-[600px] h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
                    <i className="fas fa-clipboard-list text-2xl text-gray-400"></i>
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900">Protocol Pending</h3>
                  <p className="max-w-sm text-sm leading-relaxed text-gray-500">Submit a diagnosis to generate a comprehensive weekly nutritional strategy.</p>
                </div>
              ) : null}

              {loading && (
                <div className="relative no-print flex min-h-[600px] h-full flex-col items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <div className="absolute left-0 right-0 top-0 h-1 bg-gray-100">
                    <div className="h-full animate-[loading_2s_ease-in-out_infinite] bg-blue-600" style={{width: `${currentStage ? (currentStage / 3) * 100 : 33}%`}}></div>
                  </div>
                  <style>{`
                      @keyframes loading {
                          0% { width: 0%; left: 0%; }
                          50% { width: 100%; left: 0%; }
                          100% { width: 0%; left: 100%; }
                      }
                  `}</style>
                  <div className="relative mb-6 h-20 w-20">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-600 border-t-transparent duration-1000"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-spinner animate-pulse text-xl text-blue-600"></i>
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {currentStage ? `Stage ${currentStage}/3: ` : ''}Synthesis Underway...
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                    {currentStage === 1 && 'Synthesizing 21 Therapeutic Meals • Balancing Weekly Micro-Nutrients • Applying Logic Overlay'}
                    {currentStage === 2 && 'Claude AI reviewing clinical narratives • Enriching therapeutic rationale'}
                    {currentStage === 3 && 'Fetching live USDA nutrient data • Enriching detailed nutrient profiles'}
                    {!currentStage && 'Initializing clinical synthesis...'}
                  </p>
                </div>
              )}

              {result && !loading && (
                <div id="result-section" className="pb-12">
                  <MenuResult plan={result} />
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {activeTab === 'db' && <DiagnosisDB />}
      {activeTab === 'logs' && (
        <div className="mx-auto max-w-4xl py-20 text-center">
          <i className="fas fa-folder-open mb-4 text-4xl text-gray-300"></i>
          <h2 className="text-xl font-semibold text-gray-900">Clinical Repository</h2>
          <p className="mt-2 text-sm text-gray-500">Historical 7-day protocols are archived here for clinical oversight.</p>
        </div>
      )}
      {activeTab === 'screening' && (
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <NutritionalScreening />
        </div>
      )}
      {activeTab === 'compliance' && <ComplianceDashboard />}
      <ChatBot />
    </div>
  );
};

export default App;
