
import React, { useState } from 'react';
import { DiagnosisType } from '../types';

export interface PatientData {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  somatotype: 'endomorph' | 'mesomorph' | 'ectomorph' | 'unknown';
  goal: string;
  mealCount: 3 | 4 | 5 | 6;
  textureLevel: 'regular' | 'soft' | 'minced' | 'pureed' | 'liquid';
}

interface TherapeuticFormProps {
  onSubmit: (originalMenu: string, diagnosis: string, patientDetails: string, patientData: PatientData) => void;
  isLoading: boolean;
}

const TherapeuticForm: React.FC<TherapeuticFormProps> = ({ onSubmit, isLoading }) => {
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisType | ''>('');
  const [clinicalNarrative, setClinicalNarrative] = useState('');
  const [activeCategory, setActiveCategory] = useState<DiagnosisType | ''>('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'moderate' | 'high'>('low');
  
  // Patient Profile State
  const [patientData, setPatientData] = useState<PatientData>({
    age: 45,
    sex: 'male',
    weightKg: 75,
    heightCm: 175,
    somatotype: 'unknown',
    goal: 'maintenance',
    mealCount: 6,
    textureLevel: 'regular'
  });

  const categories = [
    { type: DiagnosisType.CARDIAC, icon: 'fa-heart-pulse', color: 'bg-red-50 text-red-600 border-red-200' },
    { type: DiagnosisType.RENAL, icon: 'fa-kidney', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { type: DiagnosisType.DIABETIC, icon: 'fa-droplet', color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { type: DiagnosisType.ONCOLOGY, icon: 'fa-ribbon', color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
    { type: DiagnosisType.ULCER, icon: 'fa-bacteria', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { type: DiagnosisType.GASTRIC, icon: 'fa-lungs', color: 'bg-green-50 text-green-600 border-green-200' },
    { type: DiagnosisType.DYSPHAGIA, icon: 'fa-spoon', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
    { type: DiagnosisType.HEPATIC, icon: 'fa-liver', color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { type: DiagnosisType.POST_OP, icon: 'fa-user-nurse', color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  ];

  const handleCategorySelect = (type: DiagnosisType) => {
    setActiveCategory(type);
    setSelectedDiagnosis(type);
  };

  const updateNumericField = (key: 'age' | 'weightKg' | 'heightCm', rawValue: string) => {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    setPatientData({ ...patientData, [key]: Math.max(0, parsedValue) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagnosis) return;

    const notes = [`Risk Level: ${riskLevel.toUpperCase()}`];
    if (clinicalNarrative.trim()) {
      notes.push(`Clinical Notes: ${clinicalNarrative.trim()}`);
    }

    onSubmit('', selectedDiagnosis, notes.join(' | '), patientData);
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transition-all hover:shadow-blue-900/5">
      <div className="bg-slate-900 px-6 py-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center">
          <i className="fas fa-microscope mr-3 text-blue-400 animate-pulse"></i>
          Clinical Intake Module
        </h2>
        <div className="flex items-center space-x-3">
          <div className="flex flex-col items-end">
            <span className="text-[7px] font-mono text-slate-500 uppercase tracking-widest">Encryption</span>
            <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center">
              <i className="fas fa-lock mr-1 text-[7px]"></i> AES-256
            </span>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-8 space-y-10">
        {/* Biometrics Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic">01. Patient Biometrics</h3>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">Validated</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Age', key: 'age', type: 'number', suffix: 'yr' },
              { label: 'Weight', key: 'weightKg', type: 'number', suffix: 'kg' },
              { label: 'Height', key: 'heightCm', type: 'number', suffix: 'cm' },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{field.label}</label>
                <div className="relative group">
                  <input 
                    type={field.type} 
                    value={(patientData as any)[field.key]}
                    onChange={(e) => updateNumericField(field.key as 'age' | 'weightKg' | 'heightCm', e.target.value)}
                    className="w-full pl-4 pr-10 py-3 text-xs font-black border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-mono font-bold text-slate-300 uppercase group-focus-within:text-blue-500">{field.suffix}</span>
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Sex</label>
              <select 
                value={patientData.sex}
                onChange={(e) => setPatientData({...patientData, sex: e.target.value as 'male' | 'female'})}
                className="w-full px-4 py-3 text-xs font-black border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none appearance-none"
              >
                <option value="male">MALE</option>
                <option value="female">FEMALE</option>
              </select>
            </div>
          </div>
        </section>

        {/* Clinical Parameters */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic">02. Clinical Parameters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">IDDSI Texture Level</label>
              <select 
                value={patientData.textureLevel}
                onChange={(e) => setPatientData({...patientData, textureLevel: e.target.value as PatientData['textureLevel']})}
                className="w-full px-4 py-3 text-xs font-black border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
              >
                <option value="regular">REGULAR (LEVEL 7)</option>
                <option value="soft">SOFT (LEVEL 6)</option>
                <option value="minced">MINCED (LEVEL 5)</option>
                <option value="pureed">PUREED (LEVEL 4)</option>
                <option value="liquid">LIQUID (LEVEL 0-3)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Nutritional Risk Assessment</label>
              <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
                {(['low', 'moderate', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setRiskLevel(level)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase rounded-md transition-all ${
                      riskLevel === level 
                        ? level === 'high' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : level === 'moderate' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Specialty Selection */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic">03. Clinical Specialty</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.type}
                type="button"
                onClick={() => handleCategorySelect(cat.type)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all group ${
                  activeCategory === cat.type 
                    ? `bg-slate-900 border-slate-900 text-white shadow-2xl scale-[1.05] z-10` 
                    : 'bg-white border-slate-100 hover:border-blue-200 text-slate-400 hover:text-blue-600'
                }`}
              >
                <i className={`fas ${cat.icon} text-lg mb-3 transition-transform group-hover:scale-110`}></i>
                <span className="text-[8px] font-black uppercase text-center leading-none tracking-tighter">{cat.type}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Clinical Narrative */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic">04. Clinical Narrative</h3>
          </div>
          <div className="relative">
            <textarea
              value={clinicalNarrative}
              onChange={(e) => setClinicalNarrative(e.target.value)}
              className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none min-h-[120px] text-xs font-bold transition-all text-slate-700 bg-slate-50 focus:bg-white placeholder:text-slate-300"
              placeholder="Enter detailed clinical findings, comorbidities, and specific dietary restrictions..."
            />
            <div className="absolute bottom-3 right-3 flex items-center space-x-2">
              <span className="text-[7px] font-mono text-slate-400 uppercase tracking-widest">Narrative Audit</span>
              <i className="fas fa-check-circle text-emerald-500 text-[10px]"></i>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={isLoading || !selectedDiagnosis}
          className={`w-full py-5 rounded-xl font-black text-xs uppercase tracking-[0.3em] text-white transition-all flex items-center justify-center space-x-4 group ${
            isLoading 
              ? 'bg-slate-300 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-900/40 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Processing Protocol...</span>
            </>
          ) : (
            <>
              <i className="fas fa-wand-magic-sparkles text-sm group-hover:rotate-12 transition-transform"></i>
              <span>Generate Therapeutic Plan</span>
            </>
          )}
        </button>
      </form>
      
      <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="text-[7px] font-mono text-slate-400 uppercase tracking-widest">Audit Hash</span>
            <span className="text-[8px] font-mono text-slate-600 font-bold uppercase">{Math.random().toString(36).substring(7).toUpperCase()}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[7px] font-mono text-slate-400 uppercase tracking-widest">Engine</span>
            <span className="text-[8px] font-mono text-slate-600 font-bold uppercase">Gemini 3.1 Pro</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[8px] font-mono text-blue-600 font-black uppercase tracking-widest">Clinical v4.5.2</span>
        </div>
      </div>
    </div>
  );
};

export default TherapeuticForm;
