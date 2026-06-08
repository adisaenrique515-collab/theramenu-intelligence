import React, { useState } from 'react';
import { DiagnosisType } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { Badge, Button, Card, Input, Select } from './thera/ui';

export interface PatientData {
  age: number;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  somatotype: 'endomorph' | 'mesomorph' | 'ectomorph' | 'unknown';
  goal: string;
  mealCount: 3 | 4 | 5 | 6;
  textureLevel: 'regular' | 'soft' | 'minced' | 'pureed' | 'liquid';
  riskLevel: 'low' | 'moderate' | 'high';
  eGfr: number;
  acrMgG: number;
  potassiumMmolL: number;
  diabetesType: 'type1' | 'type2';
  yearsSinceDiagnosis: number;
  a1cPercent: number;
  fastingHours: number;
  usesCgm: boolean;
  selfMonitoring: boolean;
  pregnant: boolean;
  multipleDailyInsulin: boolean;
  basalInsulin: boolean;
  prandialInsulin: boolean;
  sglt2Inhibitor: boolean;
  metformin: boolean;
  olderSulfonylurea: boolean;
  modernSulfonylurea: boolean;
  insulinSecretagogue: boolean;
  hypoglycemiaAwarenessImpaired: boolean;
  severeHypoglycemiaLast4Weeks: boolean;
  recentDkaOrHhs: boolean;
  hypertension: boolean;
  heartFailure: boolean;
  onDialysis: boolean;
  malnourished: boolean;
  macrovascularStatus: 'none' | 'stable' | 'unstable';
  egfrBand: 'gte45' | '30to45' | 'lt30';
  neuropathy: boolean;
  footComplications: boolean;
  footInjuryLogged: boolean;
  retinopathy: boolean;
  proliferativeRetinopathy: boolean;
  cognitiveImpairment: boolean;
  hasHomeSupport: boolean;
  physicalLabor: 'low' | 'moderate' | 'high';
  fastingEducation: boolean;
  eatingPattern: 'balanced' | 'low_carb' | 'mediterranean' | 'ketogenic';
  alcoholUse: boolean;
  magnesiumSupplement: boolean;
  chromiumSupplement: boolean;
  cinnamonSupplement: boolean;
  aloeSupplement: boolean;
  betaCaroteneSupplement: boolean;
  intentionalUnderdosing: boolean;
  repeatedDkaHospitalizations: boolean;
  suicidalityPositive: boolean;
  sdohWorriedFoodRunout: boolean;
  sdohFoodDidNotLast: boolean;
}

interface TherapeuticFormProps {
  onSubmit: (originalMenu: string, diagnosis: string, patientDetails: string, patientData: PatientData) => void;
  isLoading: boolean;
}

const DEFAULT_PATIENT: PatientData = {
  age: 45,
  sex: 'male',
  weightKg: 75,
  heightCm: 175,
  somatotype: 'unknown',
  goal: 'maintenance',
  mealCount: 6,
  textureLevel: 'regular',
  riskLevel: 'low',
  eGfr: 45,
  acrMgG: 30,
  potassiumMmolL: 4.8,
  diabetesType: 'type2',
  yearsSinceDiagnosis: 8,
  a1cPercent: 8.1,
  fastingHours: 0,
  usesCgm: true,
  selfMonitoring: true,
  pregnant: false,
  multipleDailyInsulin: false,
  basalInsulin: false,
  prandialInsulin: false,
  sglt2Inhibitor: false,
  metformin: true,
  olderSulfonylurea: false,
  modernSulfonylurea: false,
  insulinSecretagogue: false,
  hypoglycemiaAwarenessImpaired: false,
  severeHypoglycemiaLast4Weeks: false,
  recentDkaOrHhs: false,
  hypertension: false,
  heartFailure: false,
  onDialysis: false,
  malnourished: false,
  macrovascularStatus: 'none',
  egfrBand: 'gte45',
  neuropathy: false,
  footComplications: false,
  footInjuryLogged: false,
  retinopathy: false,
  proliferativeRetinopathy: false,
  cognitiveImpairment: false,
  hasHomeSupport: true,
  physicalLabor: 'low',
  fastingEducation: true,
  eatingPattern: 'balanced',
  alcoholUse: false,
  magnesiumSupplement: false,
  chromiumSupplement: false,
  cinnamonSupplement: false,
  aloeSupplement: false,
  betaCaroteneSupplement: false,
  intentionalUnderdosing: false,
  repeatedDkaHospitalizations: false,
  suicidalityPositive: false,
  sdohWorriedFoodRunout: false,
  sdohFoodDidNotLast: false,
};

const categories = [
  { type: DiagnosisType.CARDIAC, icon: 'fa-heart-pulse' },
  { type: DiagnosisType.RENAL, icon: 'fa-kidney' },
  { type: DiagnosisType.DIABETIC, icon: 'fa-droplet' },
  { type: DiagnosisType.ONCOLOGY, icon: 'fa-ribbon' },
  { type: DiagnosisType.ULCER, icon: 'fa-bacteria' },
  { type: DiagnosisType.GASTRIC, icon: 'fa-lungs' },
  { type: DiagnosisType.DYSPHAGIA, icon: 'fa-spoon' },
  { type: DiagnosisType.HEPATIC, icon: 'fa-liver' },
  { type: DiagnosisType.POST_OP, icon: 'fa-user-nurse' },
  { type: DiagnosisType.H_PYLORI, icon: 'fa-biohazard' },
];

const booleanLabel = (value: keyof PatientData, label: string) => ({ value, label });

const medicationFlags = [
  booleanLabel('multipleDailyInsulin', 'Multiple daily insulin'),
  booleanLabel('basalInsulin', 'Basal insulin'),
  booleanLabel('prandialInsulin', 'Prandial insulin'),
  booleanLabel('sglt2Inhibitor', 'SGLT2 inhibitor'),
  booleanLabel('metformin', 'Metformin'),
  booleanLabel('olderSulfonylurea', 'Older sulfonylurea'),
  booleanLabel('modernSulfonylurea', 'Modern sulfonylurea'),
  booleanLabel('insulinSecretagogue', 'Insulin secretagogue'),
] as const;

const complicationFlags = [
  booleanLabel('hypoglycemiaAwarenessImpaired', 'Impaired hypoglycemia awareness'),
  booleanLabel('severeHypoglycemiaLast4Weeks', 'Severe hypoglycemia in last 4 weeks'),
  booleanLabel('recentDkaOrHhs', 'Recent DKA/HHS'),
  booleanLabel('neuropathy', 'Peripheral neuropathy'),
  booleanLabel('footComplications', 'Foot complications'),
  booleanLabel('footInjuryLogged', 'Current foot injury'),
  booleanLabel('retinopathy', 'Retinopathy'),
  booleanLabel('proliferativeRetinopathy', 'Proliferative retinopathy'),
  booleanLabel('cognitiveImpairment', 'Cognitive impairment'),
] as const;

const supplementFlags = [
  booleanLabel('magnesiumSupplement', 'Magnesium'),
  booleanLabel('chromiumSupplement', 'Chromium'),
  booleanLabel('cinnamonSupplement', 'Cinnamon'),
  booleanLabel('aloeSupplement', 'Aloe vera'),
  booleanLabel('betaCaroteneSupplement', 'Beta-carotene'),
] as const;

const behavioralFlags = [
  booleanLabel('alcoholUse', 'Alcohol logged'),
  booleanLabel('intentionalUnderdosing', 'Intentional underdosing for weight loss'),
  booleanLabel('repeatedDkaHospitalizations', 'Repeated DKA hospitalizations'),
  booleanLabel('suicidalityPositive', 'Positive suicidality screen'),
  booleanLabel('pregnant', 'Pregnancy with diabetes'),
] as const;

const sdohFlags = [
  booleanLabel('sdohWorriedFoodRunout', 'Food may run out before more money is available'),
  booleanLabel('sdohFoodDidNotLast', 'Food did not last and there was no money to replace it'),
] as const;

const sectionTitleClass = 'text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic';
const fieldLabelClass = 'block text-[8px] font-black text-slate-400 uppercase tracking-widest';
const inputClass = 'bg-slate-50 text-xs font-black';

const TherapeuticForm: React.FC<TherapeuticFormProps> = ({ onSubmit, isLoading }) => {
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisType | ''>('');
  const [clinicalNarrative, setClinicalNarrative] = useState('');
  const [activeCategory, setActiveCategory] = useState<DiagnosisType | ''>('');
  const [patientData, setPatientData] = useState<PatientData>(DEFAULT_PATIENT);

  const isDiabetes = selectedDiagnosis === DiagnosisType.DIABETIC;

  const setField = <K extends keyof PatientData>(key: K, value: PatientData[K]) => {
    setPatientData((current) => ({ ...current, [key]: value }));
  };

  const updateNumericField = (
    key: 'age' | 'weightKg' | 'heightCm' | 'eGfr' | 'acrMgG' | 'potassiumMmolL' | 'yearsSinceDiagnosis' | 'a1cPercent' | 'fastingHours',
    rawValue: string,
  ) => {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) return;
    setField(key, Math.max(0, parsedValue) as PatientData[typeof key]);
  };

  const handleCategorySelect = (type: DiagnosisType) => {
    setActiveCategory(type);
    setSelectedDiagnosis(type);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiagnosis) return;

    const notes = [`Risk Level: ${patientData.riskLevel.toUpperCase()}`];
    if (isDiabetes) {
      notes.push(`Diabetes Type: ${patientData.diabetesType.toUpperCase()}`);
      notes.push(`Fasting Hours: ${patientData.fastingHours}`);
    }
    if (clinicalNarrative.trim()) {
      notes.push(`Clinical Notes: ${clinicalNarrative.trim()}`);
    }

    onSubmit('', selectedDiagnosis, notes.join(' | '), patientData);
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-blue-900/5">
      <div className="relative flex items-center justify-between overflow-hidden bg-slate-900 px-6 py-5">
        <div className="absolute left-0 top-0 h-1 w-full bg-blue-600"></div>
        <h2 className="flex items-center text-[10px] font-black uppercase tracking-[0.3em] text-white">
          <i className="fas fa-microscope mr-3 animate-pulse text-blue-400"></i>
          Clinical Intake Module
        </h2>
        <div className="flex items-center space-x-3">
          <div className="flex flex-col items-end">
            <span className="font-mono text-[7px] uppercase tracking-widest text-slate-500">PHI Boundary</span>
            <Badge tone="emerald">Local Only</Badge>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 p-8">
        <CollapsibleSection title="Patient Biometrics" subtitle="ADIME Intake" number="01" defaultOpen={true}>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { label: 'Age', key: 'age', suffix: 'yr' },
              { label: 'Weight', key: 'weightKg', suffix: 'kg' },
              { label: 'Height', key: 'heightCm', suffix: 'cm' },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className={fieldLabelClass}>{field.label}</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={patientData[field.key as 'age' | 'weightKg' | 'heightCm']}
                    onChange={(e) => updateNumericField(field.key as 'age' | 'weightKg' | 'heightCm', e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] font-bold uppercase text-slate-300">
                    {field.suffix}
                  </span>
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>Sex</label>
              <Select value={patientData.sex} onChange={(e) => setField('sex', e.target.value as PatientData['sex'])} className={inputClass}>
                <option value="male">MALE</option>
                <option value="female">FEMALE</option>
              </Select>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Core Clinical Parameters" number="02">

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>IDDSI Texture Level</label>
              <Select value={patientData.textureLevel} onChange={(e) => setField('textureLevel', e.target.value as PatientData['textureLevel'])} className={inputClass}>
                <option value="regular">REGULAR (LEVEL 7)</option>
                <option value="soft">SOFT (LEVEL 6)</option>
                <option value="minced">MINCED (LEVEL 5)</option>
                <option value="pureed">PUREED (LEVEL 4)</option>
                <option value="liquid">LIQUID (LEVEL 0-3)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>Nutritional Risk Assessment</label>
              <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                {(['low', 'moderate', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setField('riskLevel', level)}
                    className={`flex-1 rounded-md py-2 text-[9px] font-black uppercase transition-all ${
                      patientData.riskLevel === level
                        ? level === 'high'
                          ? 'bg-red-600 text-white'
                          : level === 'moderate'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>eGFR</label>
              <div className="relative">
                <Input type="number" value={patientData.eGfr} onChange={(e) => updateNumericField('eGfr', e.target.value)} className={`${inputClass} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] font-bold uppercase text-slate-300">ml/min</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>ACR</label>
              <div className="relative">
                <Input type="number" value={patientData.acrMgG} onChange={(e) => updateNumericField('acrMgG', e.target.value)} className={`${inputClass} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] font-bold uppercase text-slate-300">mg/g</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelClass}>Serum Potassium</label>
              <div className="relative">
                <Input type="number" step="0.1" value={patientData.potassiumMmolL} onChange={(e) => updateNumericField('potassiumMmolL', e.target.value)} className={`${inputClass} pr-14`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[8px] font-bold uppercase text-slate-300">mmol/L</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              booleanLabel('hypertension', 'Hypertension'),
              booleanLabel('heartFailure', 'Chronic heart failure'),
              booleanLabel('onDialysis', 'Dialysis active'),
              booleanLabel('malnourished', 'Malnourished / at risk'),
            ].map((flag) => (
              <label key={flag.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input type="checkbox" checked={patientData[flag.value] as boolean} onChange={(e) => setField(flag.value, e.target.checked as PatientData[typeof flag.value])} />
                <span className="text-xs font-semibold text-slate-700">{flag.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className={sectionTitleClass}>03. Clinical Specialty</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {categories.map((cat) => (
              <button
                key={cat.type}
                type="button"
                onClick={() => handleCategorySelect(cat.type)}
                className={`group flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all ${
                  activeCategory === cat.type
                    ? 'z-10 scale-[1.05] border-slate-900 bg-slate-900 text-white shadow-2xl'
                    : 'border-slate-100 bg-white text-slate-400 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                <i className={`fas ${cat.icon} mb-3 text-lg transition-transform group-hover:scale-110`}></i>
                <span className="text-center text-[8px] font-black uppercase leading-none tracking-tighter">{cat.type}</span>
              </button>
            ))}
          </div>
        </section>

        {isDiabetes && (
          <section className="space-y-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className={sectionTitleClass}>04. Diabetes Risk Engine</h3>
              <span className="font-mono text-[8px] uppercase tracking-widest text-slate-400">ADA 2026 Local Logic</span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Diabetes Type</label>
                <Select value={patientData.diabetesType} onChange={(e) => setField('diabetesType', e.target.value as PatientData['diabetesType'])} className={inputClass}>
                  <option value="type1">TYPE 1</option>
                  <option value="type2">TYPE 2</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Years Since Diagnosis</label>
                <Input type="number" value={patientData.yearsSinceDiagnosis} onChange={(e) => updateNumericField('yearsSinceDiagnosis', e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>A1C %</label>
                <Input type="number" step="0.1" value={patientData.a1cPercent} onChange={(e) => updateNumericField('a1cPercent', e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Fasting Hours</label>
                <Input type="number" value={patientData.fastingHours} onChange={(e) => updateNumericField('fastingHours', e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>eGFR Band</label>
                <Select value={patientData.egfrBand} onChange={(e) => setField('egfrBand', e.target.value as PatientData['egfrBand'])} className={inputClass}>
                  <option value="gte45">eGFR &gt;= 45</option>
                  <option value="30to45">eGFR 30-45</option>
                  <option value="lt30">eGFR &lt; 30</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Macrovascular Status</label>
                <Select value={patientData.macrovascularStatus} onChange={(e) => setField('macrovascularStatus', e.target.value as PatientData['macrovascularStatus'])} className={inputClass}>
                  <option value="none">NONE</option>
                  <option value="stable">STABLE</option>
                  <option value="unstable">UNSTABLE</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Physical Labor</label>
                <Select value={patientData.physicalLabor} onChange={(e) => setField('physicalLabor', e.target.value as PatientData['physicalLabor'])} className={inputClass}>
                  <option value="low">LOW</option>
                  <option value="moderate">MODERATE</option>
                  <option value="high">HIGH</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabelClass}>Eating Pattern</label>
                <Select value={patientData.eatingPattern} onChange={(e) => setField('eatingPattern', e.target.value as PatientData['eatingPattern'])} className={inputClass}>
                  <option value="balanced">BALANCED</option>
                  <option value="mediterranean">MEDITERRANEAN</option>
                  <option value="low_carb">LOW CARB</option>
                  <option value="ketogenic">KETOGENIC</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Medication Profile</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {medicationFlags.map((flag) => (
                    <label key={flag.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <input type="checkbox" checked={patientData[flag.value] as boolean} onChange={(e) => setField(flag.value, e.target.checked as PatientData[typeof flag.value])} />
                      <span className="text-xs font-semibold text-slate-700">{flag.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Monitoring & Fasting</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    booleanLabel('usesCgm', 'CGM active'),
                    booleanLabel('selfMonitoring', 'Self-monitoring active'),
                    booleanLabel('fastingEducation', 'Fasting-focused education completed'),
                    booleanLabel('hasHomeSupport', 'Home support available'),
                  ].map((flag) => (
                    <label key={flag.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <input type="checkbox" checked={patientData[flag.value] as boolean} onChange={(e) => setField(flag.value, e.target.checked as PatientData[typeof flag.value])} />
                      <span className="text-xs font-semibold text-slate-700">{flag.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Complications & Safety</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {complicationFlags.map((flag) => (
                    <label key={flag.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <input type="checkbox" checked={patientData[flag.value] as boolean} onChange={(e) => setField(flag.value, e.target.checked as PatientData[typeof flag.value])} />
                      <span className="text-xs font-semibold text-slate-700">{flag.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Supplements & Behavioral Flags</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[...supplementFlags, ...behavioralFlags].map((flag) => (
                    <label key={flag.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <input type="checkbox" checked={patientData[flag.value] as boolean} onChange={(e) => setField(flag.value, e.target.checked as PatientData[typeof flag.value])} />
                      <span className="text-xs font-semibold text-slate-700">{flag.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Social Determinants of Health</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {sdohFlags.map((flag) => (
                  <label key={flag.value} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <input type="checkbox" checked={patientData[flag.value] as boolean} onChange={(e) => setField(flag.value, e.target.checked as PatientData[typeof flag.value])} />
                    <span className="text-xs font-semibold text-slate-700">{flag.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className={sectionTitleClass}>{isDiabetes ? '05. Clinical Narrative' : '04. Clinical Narrative'}</h3>
          </div>
          <div className="relative">
            <textarea
              value={clinicalNarrative}
              onChange={(e) => setClinicalNarrative(e.target.value)}
              className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5"
              placeholder="Enter clinical findings, comorbidities, distress language, medication changes, fasting status, and specific diet restrictions."
            />
            <div className="absolute bottom-3 right-3 flex items-center space-x-2">
              <span className="font-mono text-[7px] uppercase tracking-widest text-slate-400">Local Narrative Store</span>
              <i className="fas fa-check-circle text-[10px] text-emerald-500"></i>
            </div>
          </div>
        </section>

        <Button
          type="submit"
          disabled={isLoading || !selectedDiagnosis}
          variant="primary"
          className={`group flex w-full items-center justify-center space-x-4 rounded-xl py-5 text-xs font-black uppercase tracking-[0.3em] text-white transition-all ${
            isLoading ? 'cursor-not-allowed bg-slate-300' : 'bg-blue-600 shadow-2xl shadow-blue-900/40 active:scale-[0.98] hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Processing Local Engine...</span>
            </>
          ) : (
            <>
              <i className="fas fa-server text-sm transition-transform group-hover:rotate-12"></i>
              <span>Generate Offline Therapeutic Plan</span>
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="font-mono text-[7px] uppercase tracking-widest text-slate-400">Audit Hash</span>
            <span className="font-mono text-[8px] font-bold uppercase text-slate-600">{Math.random().toString(36).substring(7).toUpperCase()}</span>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="font-mono text-[7px] uppercase tracking-widest text-slate-400">Engine</span>
            <span className="font-mono text-[8px] font-bold uppercase text-slate-600">Local Internal API</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-[8px] font-black uppercase tracking-widest text-blue-600">Clinical Local v5.0</span>
        </div>
      </div>
    </Card>
  );
};

export default TherapeuticForm;
