import React, { useState } from 'react';
import { Badge, Button, Card, Label, Select } from './thera/ui';

interface ScreeningResult {
  score: number;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  action: string;
}

interface NutritionalScreeningProps {
  onScreeningComplete?: (score: number, risk: 'LOW' | 'MODERATE' | 'HIGH') => void;
}

const NutritionalScreening: React.FC<NutritionalScreeningProps> = ({ onScreeningComplete }) => {
  const [scores, setScores] = useState({
    nutritionalStatus: 0,
    severityOfIllness: 0,
    ageOver70: false,
  });

  const calculateRisk = (): ScreeningResult => {
    const total = scores.nutritionalStatus + scores.severityOfIllness + (scores.ageOver70 ? 1 : 0);
    if (total >= 3) return { score: total, risk: 'HIGH', action: 'Immediate Dietitian Referral Required' };
    if (total >= 1) return { score: total, risk: 'MODERATE', action: 'Monitor & Re-screen in 3 days' };
    return { score: total, risk: 'LOW', action: 'Routine Hospital Diet' };
  };

  const result = calculateRisk();
  const riskTone = result.risk === 'HIGH' ? 'red' : result.risk === 'MODERATE' ? 'amber' : 'emerald';

  return (
    <Card accent className="mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Nutritional Risk Screening (NRS-2002)</h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-500">JCI Standard FNC.1 Compliance</p>
        </div>
        <Badge tone={riskTone}>STATUS: {result.risk} RISK</Badge>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <section>
            <Label htmlFor="nutritional-status">Nutritional Status (Impairment)</Label>
            <Select
              id="nutritional-status"
              value={scores.nutritionalStatus}
              onChange={(e) => setScores({ ...scores, nutritionalStatus: parseInt(e.target.value) })}
            >
              <option value="0">Absent (Normal status)</option>
              <option value="1">Mild (Wt loss &gt;5% in 3mo or Intake 50-75%)</option>
              <option value="2">Moderate (Wt loss &gt;5% in 2mo or BMI 18.5-20.5)</option>
              <option value="3">Severe (Wt loss &gt;5% in 1mo or BMI &lt;18.5)</option>
            </Select>
          </section>

          <section>
            <Label htmlFor="severity-of-illness">Severity of Illness (Stress)</Label>
            <Select
              id="severity-of-illness"
              value={scores.severityOfIllness}
              onChange={(e) => setScores({ ...scores, severityOfIllness: parseInt(e.target.value) })}
            >
              <option value="0">Absent (Normal requirements)</option>
              <option value="1">Mild (Hip fracture, Chronic complications)</option>
              <option value="2">Moderate (Major surgery, Stroke, Severe pneumonia)</option>
              <option value="3">Severe (Head injury, Bone marrow transplant, ICU)</option>
            </Select>
          </section>

          <div className="flex items-center space-x-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <input
              type="checkbox"
              id="age"
              checked={scores.ageOver70}
              className="h-4 w-4 rounded text-blue-600"
              onChange={(e) => setScores({ ...scores, ageOver70: e.target.checked })}
            />
            <label htmlFor="age" className="text-sm font-medium text-blue-900">
              Patient is 70 years or older (+1 point)
            </label>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg bg-slate-900 p-6 text-white">
          <div>
            <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Clinical Assessment</h3>
            <div className="mb-2 text-5xl font-bold">{result.score}</div>
            <div className="text-sm text-slate-400">Total NRS Score</div>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-8">
            <div className="mb-2 font-mono text-xs uppercase text-slate-500">Recommended Action</div>
            <div className={`text-lg font-semibold ${result.risk === 'HIGH' ? 'text-red-400' : 'text-emerald-400'}`}>
              {result.action}
            </div>
          </div>

          <Button className="mt-8 w-full" onClick={() => onScreeningComplete?.(result.score, result.risk)}>
            <i className="fas fa-check-circle"></i>
            <span>Confirm & Apply to Next Plan</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default NutritionalScreening;
