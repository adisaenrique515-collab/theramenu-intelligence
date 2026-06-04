
import React, { useState } from 'react';

interface ScreeningResult {
  score: number;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  action: string;
}

const NutritionalScreening: React.FC = () => {
  const [scores, setScores] = useState({
    nutritionalStatus: 0,
    severityOfIllness: 0,
    ageOver70: false
  });

  const calculateRisk = (): ScreeningResult => {
    const total = scores.nutritionalStatus + scores.severityOfIllness + (scores.ageOver70 ? 1 : 0);
    if (total >= 3) return { score: total, risk: 'HIGH', action: 'Immediate Dietitian Referral Required' };
    if (total >= 1) return { score: total, risk: 'MODERATE', action: 'Monitor & Re-screen in 3 days' };
    return { score: total, risk: 'LOW', action: 'Routine Hospital Diet' };
  };

  const result = calculateRisk();

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Nutritional Risk Screening (NRS-2002)</h2>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">JCI Standard FNC.1 Compliance</p>
        </div>
        <div className={`px-4 py-1 rounded-full text-[10px] font-bold tracking-tighter ${
          result.risk === 'HIGH' ? 'bg-red-100 text-red-700' : 
          result.risk === 'MODERATE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          STATUS: {result.risk} RISK
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Nutritional Status (Impairment)</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
              onChange={(e) => setScores({...scores, nutritionalStatus: parseInt(e.target.value)})}
            >
              <option value="0">Absent (Normal status)</option>
              <option value="1">Mild (Wt loss &gt;5% in 3mo or Intake 50-75%)</option>
              <option value="2">Moderate (Wt loss &gt;5% in 2mo or BMI 18.5-20.5)</option>
              <option value="3">Severe (Wt loss &gt;5% in 1mo or BMI &lt;18.5)</option>
            </select>
          </section>

          <section>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Severity of Illness (Stress)</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
              onChange={(e) => setScores({...scores, severityOfIllness: parseInt(e.target.value)})}
            >
              <option value="0">Absent (Normal requirements)</option>
              <option value="1">Mild (Hip fracture, Chronic complications)</option>
              <option value="2">Moderate (Major surgery, Stroke, Severe pneumonia)</option>
              <option value="3">Severe (Head injury, Bone marrow transplant, ICU)</option>
            </select>
          </section>

          <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <input 
              type="checkbox" 
              id="age"
              className="w-4 h-4 text-blue-600 rounded"
              onChange={(e) => setScores({...scores, ageOver70: e.target.checked})}
            />
            <label htmlFor="age" className="text-sm font-medium text-blue-900">Patient is ≥ 70 years old (+1 point)</label>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-[10px] font-mono uppercase tracking-[0.2em] mb-4">Clinical Assessment</h3>
            <div className="text-5xl font-bold mb-2">{result.score}</div>
            <div className="text-slate-400 text-sm">Total NRS Score</div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800">
            <div className="text-xs text-slate-500 uppercase font-mono mb-2">Recommended Action</div>
            <div className={`text-lg font-semibold ${result.risk === 'HIGH' ? 'text-red-400' : 'text-emerald-400'}`}>
              {result.action}
            </div>
          </div>

          <button className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center space-x-2">
            <i className="fas fa-file-medical"></i>
            <span>Log to Patient Record</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NutritionalScreening;
