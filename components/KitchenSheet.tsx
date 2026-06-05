import React, { useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { FileText, Utensils, X } from 'lucide-react';
import type { WeeklyTherapeuticPlan } from '../types';
import { Badge, Button, Card } from './thera/ui';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto">

        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-white px-6 py-4 no-print">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
              <Utensils className="h-4 w-4 text-green-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase italic tracking-tighter text-slate-900">Kitchen Sheet</h2>
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">For kitchen staff only - no clinical data</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={exportPdf} className="bg-green-600 text-xs font-bold uppercase tracking-widest shadow-lg shadow-green-900/20 hover:bg-green-700">
              <FileText className="h-4 w-4" aria-hidden />Export PDF
            </Button>
            <Button onClick={onClose} variant="ghost" className="h-8 min-h-0 w-8 rounded-full bg-slate-100 p-0" aria-label="Close kitchen sheet">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        {/* Printable content */}
        <div ref={sheetRef} className="space-y-8 p-8 font-sans text-slate-900">

          {/* Header */}
          <div className="border-b-4 border-slate-900 pb-5">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-black uppercase italic tracking-tighter">Kitchen Service Sheet</h1>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Dietary Services - Clinical Nutrition Unit</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Printed: {today}</p>
                {planId && <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-slate-400">Ref: {planId}</p>}
                {approvedBy && <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-emerald-600">Approved: {approvedBy}</p>}
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-6">
              <Card className="bg-slate-900 px-4 py-2 text-white">
                <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">Diet Type</p>
                <p className="text-sm font-black uppercase">{plan.diagnosis}</p>
              </Card>
              <Card className="px-4 py-2">
                <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">Texture</p>
                <p className="text-sm font-bold uppercase">{plan.constraints?.textureLevel ?? 'Regular'}</p>
              </Card>
              <Card className="px-4 py-2">
                <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">HACCP</p>
                <Badge tone="emerald">Verified</Badge>
              </Card>
            </div>
          </div>

          {/* Days */}
          {plan.days.map((day, dIdx) => (
            <div key={day.dayName} className={dIdx > 0 ? 'border-t-2 border-slate-200 pt-8' : ''}>
              <h2 className="mb-4 text-lg font-black uppercase italic tracking-tight text-slate-900">
                {day.dayName}
              </h2>

              {day.meals.filter((m) => (m.slots?.length ?? 0) > 0).map((meal) => (
                <div key={meal.mealType} className="mb-6">
                  <div className="mb-2 flex items-center space-x-4">
                    <h3 className="text-sm font-black uppercase tracking-tight">{meal.mealType}</h3>
                    {meal.scheduledTime && (
                      <Badge tone="slate">{meal.scheduledTime}</Badge>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-3 py-2 text-left font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">Food Item</th>
                          <th className="w-24 px-3 py-2 text-right font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">Portion</th>
                          <th className="w-28 px-3 py-2 text-center font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">Serve Temp</th>
                          <th className="w-20 px-3 py-2 text-center font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">HACCP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(meal.slots ?? []).filter((s) => s.item?.name && s.item.name !== 'N/A').map((slot, sIdx) => (
                          <tr key={sIdx} className={slot.status === 'SUBSTITUTED' ? 'bg-amber-50/60' : ''}>
                            <td className="px-3 py-2.5">
                              <p className="font-mono text-[8px] uppercase text-slate-400">{slot.slotName}</p>
                              <p className="text-sm font-bold text-slate-900">{slot.item?.name}</p>
                              {slot.item?.therapeuticOverride && (
                                <p className="mt-0.5 text-[9px] italic text-slate-500">{slot.item.therapeuticOverride}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <p className="text-sm font-black text-slate-900">{slot.item?.portion ?? '-'}</p>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <p className="text-[10px] font-bold text-slate-700">
                                {slot.item?.operational?.serviceTemp ?? (slot.slotName.toLowerCase().includes('beverage') ? '>= 60C or <= 8C' : '>= 60C')}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="mx-auto flex h-5 w-5 items-center justify-center rounded border-2 border-slate-300">
                                <span className="text-[8px] text-slate-300">OK</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Footer */}
          <div className="flex items-center justify-between border-t-2 border-slate-200 pt-5">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">Kitchen staff: this sheet contains no patient identifiers.</p>
              <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">All portions are per patient per serving. Follow IDDSI texture guidelines.</p>
            </div>
            <div className="text-right">
              <div className="mt-6 w-36 border-t border-slate-400 pt-1">
                <p className="font-mono text-[8px] uppercase tracking-widest text-slate-400">Chef Signature</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default KitchenSheet;
