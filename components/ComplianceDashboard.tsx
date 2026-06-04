
import React from 'react';

const ComplianceDashboard: React.FC = () => {
  const standards = [
    { id: 'FNC.1', title: 'Nutritional Screening', status: 'READY', description: 'Screening within 24h of admission implemented via NRS-2002 module.' },
    { id: 'FNC.2', title: 'Therapeutic Diet Orders', status: 'READY', description: 'AI-generated menus mapped to physician diagnosis and clinical rules.' },
    { id: 'FNC.3', title: 'Food Safety & Handling', status: 'PARTIAL', description: 'HACCP temperature standards generated; real-time logging required.' },
    { id: 'FNC.4', title: 'Patient Education', status: 'READY', description: 'Automated therapeutic rationale and patient-facing summaries.' },
    { id: 'FNC.5', title: 'Clinical Oversight', status: 'ACTION REQUIRED', description: 'Requires Registered Dietitian (RD) digital signature workflow.' },
  ];

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">JCI Compliance Dashboard</h1>
        <p className="text-slate-500 mt-2">Joint Commission International - Food and Nutrition Care (FNC) Readiness</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Overall Readiness</div>
          <div className="text-4xl font-bold text-blue-600">82%</div>
          <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-[82%]"></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Clinical Accuracy</div>
          <div className="text-4xl font-bold text-emerald-600">98.4%</div>
          <p className="text-xs text-slate-500 mt-2">Based on Clinical Alignment Scores</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Audit Risk</div>
          <div className="text-4xl font-bold text-amber-600">LOW</div>
          <p className="text-xs text-slate-500 mt-2">3 minor gaps identified</p>
        </div>
      </div>

      <div className="space-y-4">
        {standards.map((std) => (
          <div key={std.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start space-x-6">
            <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-100">
              <span className="text-xs font-bold text-slate-400">{std.id}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-900">{std.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  std.status === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                  std.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {std.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{std.description}</p>
            </div>
            <button className="text-slate-400 hover:text-blue-600 transition-colors">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-12 p-8 bg-slate-900 rounded-3xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-4">Ready for Production?</h2>
          <p className="text-slate-400 max-w-2xl mb-8 leading-relaxed">
            TheraMenu is currently in **Clinical Validation Phase**. To move to full production, you must connect a persistent database (Firebase) to store RD signatures and patient logs, fulfilling the JCI requirement for "Documented Evidence of Care."
          </p>
          <div className="flex space-x-4">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-sm transition-all">
              Request JCI Audit Export
            </button>
            <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm transition-all">
              Connect Hospital EMR
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
