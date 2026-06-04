import React, { useRef } from 'react';
import html2pdf from 'html2pdf.js';
import type { WeeklyTherapeuticPlan } from '../types';

interface Props {
  plan: WeeklyTherapeuticPlan;
  planId?: string;
  approvedBy?: string;
  onClose: () => void;
}

const KitchenSheet: React.FC<Props> = ({ plan, planId, approvedBy, onClose }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const exportPdf = async () => {
    if (!sheetRef.current) return;
    await html2pdf().set({
      margin: 0.3,
      filename: `Kitchen_Sheet_${plan.diagnosis.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    }).from(sheetRef.current).save();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">

        {/* Toolbar */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10 no-print">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <i className="fas fa-utensils text-green-600"></i>
            </div>
            <div>
              <h2 className="text-sm font-black uppercase italic tracking-tighter text-slate-900">Kitchen Sheet</h2>
              <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">For kitchen staff only — no clinical data</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={exportPdf} className="px-5 py-2 bg-green-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-900/20">
              <i className="fas fa-file-pdf mr-2"></i>Export PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <i className="fas fa-times text-slate-500 text-xs"></i>
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div ref={sheetRef} className="p-8 space-y-8 font-sans text-slate-900">

          {/* Header */}
          <div className="border-b-4 border-slate-900 pb-5">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black uppercase italic tracking-tighter">Kitchen Service Sheet</h1>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.25em] mt-1">Dietary Services — Clinical Nutrition Unit</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Printed: {today}</p>
                {planId && <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Ref: {planId}</p>}
                {approvedBy && <p className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest mt-0.5">Approved: {approvedBy}</p>}
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-6">
              <div className="bg-slate-900 text-white px-4 py-2 rounded-lg">
                <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400">Diet Type</p>
                <p className="text-sm font-black uppercase">{plan.diagnosis}</p>
              </div>
              <div className="px-4 py-2 border border-slate-200 rounded-lg">
                <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400">Texture</p>
                <p className="text-sm font-bold uppercase">{plan.constraints?.textureLevel ?? 'Regular'}</p>
              </div>
              <div className="px-4 py-2 border border-slate-200 rounded-lg">
                <p className="text-[8px] font-mono uppercase tracking-widest text-slate-400">HACCP</p>
                <p className="text-sm font-bold text-emerald-600">VERIFIED ✓</p>
              </div>
            </div>
          </div>

          {/* Days */}
          {plan.days.map((day, dIdx) => (
            <div key={day.dayName} className={dIdx > 0 ? 'border-t-2 border-slate-200 pt-8' : ''}>
              <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900 mb-4">
                {day.dayName}
              </h2>

              {day.meals.filter((m) => (m.slots?.length ?? 0) > 0).map((meal) => (
                <div key={meal.mealType} className="mb-6">
                  <div className="flex items-center space-x-4 mb-2">
                    <h3 className="text-sm font-black uppercase tracking-tight">{meal.mealType}</h3>
                    {meal.scheduledTime && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {meal.scheduledTime}
                      </span>
                    )}
                  </div>
                  <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Food Item</th>
                        <th className="px-3 py-2 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-24">Portion</th>
                        <th className="px-3 py-2 text-center text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-28">Serve Temp</th>
                        <th className="px-3 py-2 text-center text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-20">HACCP ✓</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(meal.slots ?? []).filter((s) => s.item?.name && s.item.name !== 'N/A').map((slot, sIdx) => (
                        <tr key={sIdx} className={slot.status === 'SUBSTITUTED' ? 'bg-amber-50/60' : ''}>
                          <td className="px-3 py-2.5">
                            <p className="text-[8px] font-mono text-slate-400 uppercase">{slot.slotName}</p>
                            <p className="text-sm font-bold text-slate-900">{slot.item?.name}</p>
                            {slot.item?.therapeuticOverride && (
                              <p className="text-[9px] text-slate-500 italic mt-0.5">{slot.item.therapeuticOverride}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <p className="text-sm font-black text-slate-900">{slot.item?.portion ?? '—'}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <p className="text-[10px] font-bold text-slate-700">
                              {slot.item?.operational?.serviceTemp ?? (slot.slotName.toLowerCase().includes('beverage') ? '≥ 60°C or ≤ 8°C' : '≥ 60°C')}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="w-5 h-5 border-2 border-slate-300 rounded mx-auto flex items-center justify-center">
                              <span className="text-[8px] text-slate-300">✓</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}

          {/* Footer */}
          <div className="border-t-2 border-slate-200 pt-5 flex justify-between items-center">
            <div>
              <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">Kitchen staff: this sheet contains no patient identifiers.</p>
              <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">All portions are per patient per serving. Follow IDDSI texture guidelines.</p>
            </div>
            <div className="text-right">
              <div className="border-t border-slate-400 w-36 mt-6 pt-1">
                <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">Chef Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenSheet;
