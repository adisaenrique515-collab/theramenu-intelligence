
import React, { useState } from 'react';
import Header from './components/Header';
import TherapeuticForm from './components/TherapeuticForm';
import MenuResult from './components/MenuResult';
import DiagnosisDB from './components/DiagnosisDB';
import ChatBot from './components/ChatBot';
import NutritionalScreening from './components/NutritionalScreening';
import ComplianceDashboard from './components/ComplianceDashboard';
import { transformMenu } from './services/geminiService';
import { generateWeeklyPlan, PatientProfile, DiagnosisCode } from './services/clinicalEngine';
import { enrichPlanWithUsdaData } from './services/usdaFoodDataService';
import { PatientData } from './components/TherapeuticForm';
import { WeeklyTherapeuticPlan, DiagnosisType } from './types';
import { executionMode, hasConfiguredApiKey, isMockMode } from './utils/appMode';

type ApiStudioBridge = {
  hasSelectedApiKey?: () => Promise<boolean>;
  openSelectKey?: () => Promise<void>;
};

type AppWindow = Window & { aistudio?: ApiStudioBridge };

const DIAGNOSIS_CODE_BY_TYPE: Record<string, DiagnosisCode> = {
  [DiagnosisType.CARDIAC]: 'CARDIAC',
  [DiagnosisType.RENAL]: 'RENAL_STAGE_3',
  [DiagnosisType.DIABETIC]: 'T2DM',
  [DiagnosisType.GASTRIC]: 'GASTRIC',
  [DiagnosisType.LOW_FAT]: 'LOW_FAT',
  [DiagnosisType.H_PYLORI]: 'H_PYLORI',
  [DiagnosisType.HEPATIC]: 'LIVER_SUPPORT',
  [DiagnosisType.ULCER]: 'PEPTIC_ULCER',
  [DiagnosisType.POST_OP]: 'POST_OP_SOFT',
  [DiagnosisType.DYSPHAGIA]: 'POST_OP_SOFT',
};

const normalizeGoal = (goal: string): PatientProfile['goal'] => {
  if (goal === 'weight_loss' || goal === 'weight_gain' || goal === 'maintenance') {
    return goal;
  }
  return 'maintenance';
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generator' | 'db' | 'logs' | 'screening' | 'compliance'>('generator');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WeeklyTherapeuticPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'form' | 'result'>('form');
  const [hasApiKey, setHasApiKey] = useState(isMockMode || hasConfiguredApiKey);

  React.useEffect(() => {
    const checkApiKey = async () => {
      try {
        if (isMockMode) {
          setHasApiKey(true);
          return;
        }

        const studio = (window as AppWindow).aistudio;
        if (studio?.hasSelectedApiKey) {
          const hasSelectedKey = await studio.hasSelectedApiKey();
          setHasApiKey(hasSelectedKey || hasConfiguredApiKey);
          return;
        }

        setHasApiKey(hasConfiguredApiKey);
      } catch (e) {
        console.error('Error checking API key:', e);
        setHasApiKey(isMockMode || hasConfiguredApiKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    const studio = (window as AppWindow).aistudio;
    if (studio?.openSelectKey && studio?.hasSelectedApiKey) {
      await studio.openSelectKey();
      const hasKey = await studio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center border border-gray-200">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-key text-blue-600 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">API Key Required</h2>
          <p className="text-gray-600 mb-8 text-sm leading-relaxed">
            To generate clinical protocols, please select a valid Google Cloud Project with the Gemini API enabled.
            This ensures secure, compliant access to the intelligence engine.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center space-x-2"
          >
            <span>Select API Key</span>
            <i className="fas fa-arrow-right text-xs"></i>
          </button>
          <p className="mt-6 text-xs text-gray-400">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
              View Billing Documentation
            </a>
          </p>
        </div>
      </div>
    );
  }

  const handleGenerate = async (originalMenu: string, diagnosis: string, patientDetails: string, patientData: PatientData) => {
    setLoading(true);
    setError(null);
    setMobileView('result'); // Switch to result view on mobile
    try {
      const mappedDiagnosis = DIAGNOSIS_CODE_BY_TYPE[diagnosis] || 'GENERAL_HOSPITAL';

      const profile: PatientProfile = {
        age: patientData.age,
        sex: patientData.sex,
        weightKg: patientData.weightKg,
        heightCm: patientData.heightCm,
        diagnosis: mappedDiagnosis,
        somatotype: patientData.somatotype,
        goal: normalizeGoal(patientData.goal),
        textureLevel: patientData.textureLevel,
        mealCount: patientData.mealCount
      };

      // 2. Generate Math-First Plan
      const clinicalPlan = generateWeeklyPlan(profile);

      // 3. Use Gemini to refine and map to UI structure
      const menu = await transformMenu(JSON.stringify(clinicalPlan), diagnosis, patientDetails);
      const menuWithUsdaData = await enrichPlanWithUsdaData(menu);
      setResult(menuWithUsdaData);
      
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setError("API Quota Exceeded (429). Please check your Google Gemini API billing details or wait a moment before trying again.");
      } else if (errorMessage.includes("Requested entity was not found")) {
        setError("API Configuration Error. Please ensure your API key is correctly configured for this model.");
      } else if (errorMessage.includes('invalid JSON')) {
        setError('Plan transformation returned invalid JSON. Retry in mock mode or verify model output settings.');
      } else {
        setError("Clinical synthesis for weekly protocol failed. Check input parameters.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 selection:bg-blue-100 bg-[#f8fafc] font-sans">
      <Header activeTab={activeTab} onTabChange={setActiveTab} executionMode={executionMode} />
      
      {activeTab === 'generator' && (
        <main className="max-w-7xl mx-auto px-4 pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Side: Intelligence Panel */}
            <div className={`lg:col-span-4 space-y-8 no-print lg:sticky top-24 ${mobileView === 'result' ? 'hidden lg:block' : ''}`}>
              <div className="bg-slate-900 rounded-xl shadow-2xl p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <span className="text-[10px] font-mono font-black text-blue-400 uppercase tracking-[0.3em]">System Core Online</span>
                </div>
                <h2 className="text-3xl font-black tracking-tighter italic uppercase mb-4 leading-none">
                  Clinical<br/>Intelligence
                </h2>
                <p className="text-slate-400 text-xs leading-relaxed mb-8 font-medium">
                  Evidence-based catering synthesis. The engine audits 
                  21 meal slots against clinical targets and IDDSI safety standards.
                </p>
                
                <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-8">
                  <div className="space-y-1">
                      <p className="text-2xl font-black italic tracking-tighter">07</p>
                      <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Cycle Days</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-2xl font-black italic tracking-tighter">21</p>
                      <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Meal Audits</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-2xl font-black italic tracking-tighter">99<span className="text-xs">%</span></p>
                      <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Accuracy</p>
                  </div>
                </div>
              </div>

              <TherapeuticForm onSubmit={handleGenerate} isLoading={loading} />
              
              {error && (
                <div className="bg-red-950/10 border border-red-500/20 text-red-900 p-6 rounded-xl text-sm flex flex-col space-y-3 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center font-black uppercase tracking-tighter italic text-red-600">
                    <i className="fas fa-triangle-exclamation mr-3"></i>
                    <span>Clinical Exception</span>
                  </div>
                  <p className="text-xs text-red-800/80 leading-relaxed font-medium">{error}</p>
                  {error.includes("429") && (
                    <a 
                      href="https://ai.google.dev/gemini-api/docs/billing" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] font-black uppercase tracking-widest text-white bg-red-600 py-3 px-6 rounded-lg text-center hover:bg-red-700 transition-all mt-2 shadow-lg shadow-red-900/20"
                    >
                      Check API Billing Status
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Right Side: Result Output */}
            <div className={`lg:col-span-8 ${mobileView === 'form' ? 'hidden lg:block' : ''}`}>
              
              {/* Mobile Back Button */}
              <div className="lg:hidden mb-4">
                <button 
                  onClick={() => setMobileView('form')}
                  className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 bg-white px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm w-full justify-center"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back to Generator Inputs
                </button>
              </div>

              {!result && !loading ? (
                <div className="h-full min-h-[600px] border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 bg-white p-12 text-center no-print">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-200">
                    <i className="fas fa-clipboard-list text-2xl text-gray-400"></i>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Protocol Pending</h3>
                  <p className="text-sm text-gray-500 max-w-sm leading-relaxed">Submit a diagnosis to generate a comprehensive weekly nutritional strategy.</p>
                </div>
              ) : null}

              {loading && (
                <div className="h-full min-h-[600px] bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center p-12 text-center no-print overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
                      <div className="h-full bg-blue-600 animate-[loading_2s_ease-in-out_infinite]"></div>
                  </div>
                  <style>{`
                      @keyframes loading {
                          0% { width: 0%; left: 0%; }
                          50% { width: 100%; left: 0%; }
                          100% { width: 0%; left: 100%; }
                      }
                  `}</style>
                  <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin duration-1000"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                          <i className="fas fa-spinner text-blue-600 text-xl animate-pulse"></i>
                      </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Synthesis Underway...</h3>
                  <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                    Synthesizing 21 Therapeutic Meals • Balancing Weekly Micro-Nutrients • Applying Logic Overlay
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
        <div className="max-w-4xl mx-auto py-20 text-center">
          <i className="fas fa-folder-open text-4xl text-gray-300 mb-4"></i>
          <h2 className="text-xl font-semibold text-gray-900">Clinical Repository</h2>
          <p className="text-gray-500 mt-2 text-sm">Historical 7-day protocols are archived here for clinical oversight.</p>
        </div>
      )}
      {activeTab === 'screening' && (
        <div className="max-w-7xl mx-auto px-4 pt-8">
          <NutritionalScreening />
        </div>
      )}
      {activeTab === 'compliance' && <ComplianceDashboard />}
      <ChatBot />
    </div>
  );
};

export default App;
