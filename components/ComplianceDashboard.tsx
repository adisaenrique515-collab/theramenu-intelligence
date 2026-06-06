
import React from 'react';
import { ChevronRight, ClipboardCheck, Database, FileCheck2, GraduationCap, ShieldCheck, Stethoscope } from 'lucide-react';
import { Badge, Button, Card, ProgressBar } from './thera/ui';

const ComplianceDashboard: React.FC = () => {
  const standards = [
    { id: 'FNC.1', title: 'Nutritional Screening', status: 'READY', description: 'Screening within 24h of admission implemented via NRS-2002 module.' },
    { id: 'FNC.2', title: 'Therapeutic Diet Orders', status: 'READY', description: 'AI-generated menus mapped to physician diagnosis and clinical rules.' },
    { id: 'FNC.3', title: 'Food Safety & Handling', status: 'PARTIAL', description: 'HACCP temperature standards generated; real-time logging required.' },
    { id: 'FNC.4', title: 'Patient Education', status: 'READY', description: 'Automated therapeutic rationale and patient-facing summaries.' },
    { id: 'FNC.5', title: 'Clinical Oversight', status: 'ACTION REQUIRED', description: 'Requires Registered Dietitian (RD) digital signature workflow.' },
  ];

  const standardIcons: Record<string, typeof ClipboardCheck> = {
    'FNC.1': ClipboardCheck,
    'FNC.2': Stethoscope,
    'FNC.3': ShieldCheck,
    'FNC.4': GraduationCap,
    'FNC.5': FileCheck2,
  };

  const statusTone = (status: string): 'emerald' | 'amber' | 'red' => {
    if (status === 'READY') return 'emerald';
    if (status === 'PARTIAL') return 'amber';
    return 'red';
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">JCI Compliance Dashboard</h1>
        <p className="text-slate-500 mt-2">Joint Commission International - Food and Nutrition Care (FNC) Readiness</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card accent className="p-6">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Overall Readiness</div>
          <div className="text-4xl font-bold text-blue-600">82%</div>
          <div className="mt-4">
            <ProgressBar value={82} max={100} tone="blue" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Clinical Accuracy</div>
          <div className="text-4xl font-bold text-emerald-600">98.4%</div>
          <p className="text-xs text-slate-500 mt-2">Based on Clinical Alignment Scores</p>
        </Card>
        <Card className="p-6">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Audit Risk</div>
          <div className="text-4xl font-bold text-amber-600">LOW</div>
          <p className="text-xs text-slate-500 mt-2">3 minor gaps identified</p>
        </Card>
      </div>

      <div className="space-y-4">
        {standards.map((std) => {
          const Icon = standardIcons[std.id];
          return (
            <Card key={std.id} className="p-6">
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                  <Icon className="h-6 w-6 text-slate-500" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900">{std.title}</h3>
                    <Badge tone={statusTone(std.status)}>{std.status}</Badge>
                  </div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">{std.id}</div>
                  <p className="text-sm text-slate-500 leading-relaxed">{std.description}</p>
                </div>
                <button className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600" aria-label={`View ${std.id} compliance details`}>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-12 overflow-hidden bg-slate-900 p-8 text-white">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-4">Ready for Production?</h2>
          <p className="text-slate-400 max-w-2xl mb-8 leading-relaxed">
            TheraMenu is currently in **Clinical Validation Phase**. To move to full production, you must connect a persistent database (Firebase) to store RD signatures and patient logs, fulfilling the JCI requirement for "Documented Evidence of Care."
          </p>
          <div className="flex space-x-4">
            <Button>
              <Database className="h-4 w-4" aria-hidden />
              Request JCI Audit Export
            </Button>
            <Button variant="ghost" className="bg-slate-800 text-white hover:bg-slate-700">
              Connect Hospital EMR
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ComplianceDashboard;
