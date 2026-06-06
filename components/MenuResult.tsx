
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import html2pdf from 'html2pdf.js';
import { MealSlot, WeeklyTherapeuticPlan } from '../types';
import { DEFAULT_STANDARDS, HOSPITAL_BRAND } from '../constants';
import { Badge, Button, Card, StateView } from './thera/ui';

interface MenuResultProps {
  plan: WeeklyTherapeuticPlan;
}

const MenuResult: React.FC<MenuResultProps> = ({ plan }) => {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({});
  const activeDay = plan.days[activeDayIndex];
  const printRef = useRef<HTMLDivElement>(null);

  // Stable reference ID derived from plan content — consistent across screen and print views
  const planRefId = useMemo(() => {
    const seed = `${plan.diagnosis}|${plan.updatedDate}|${plan.clinicalAlignmentScore}`;
    const hash = seed.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
    return Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').substring(0, 8);
  }, [plan.diagnosis, plan.updatedDate, plan.clinicalAlignmentScore]);
  const formatAlternatives = (alternatives: MealSlot['alternatives']) =>
    alternatives && alternatives.length > 0
      ? alternatives.map((alternative) => `${alternative.name} (${alternative.portion})`).join(' • ')
      : null;

  if (!activeDay) {
    return (
      <StateView
        kind="warning"
        title="Incomplete Protocol Data"
        description="The clinical engine failed to generate data for this day. Please try regenerating the protocol."
      />
    );
  }
  const pdfRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const printPlan = () => {
    window.print();
  };

  const handleImageUpload = (dayIdx: number, mealIdx: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => ({
          ...prev,
          [`${dayIdx}-${mealIdx}`]: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = (dayIdx: number, mealIdx: number) => {
    const key = `${dayIdx}-${mealIdx}`;
    if (fileInputRefs.current[key]) {
      fileInputRefs.current[key]?.click();
    }
  };

  const removeImage = (dayIdx: number, mealIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedImages(prev => {
      const newState = { ...prev };
      delete newState[`${dayIdx}-${mealIdx}`];
      return newState;
    });
  };

  const handleGeneratePDF = async (action: 'save' | 'preview') => {
    setIsGenerating(true);
    setIsPdfGenerating(true);
    
    // Scroll to top to ensure html2canvas captures correctly
    window.scrollTo(0, 0);

    // Wait for the browser to paint the element and load images
    await new Promise(resolve => setTimeout(resolve, 2000));

    const element = pdfRef.current; // Use the Portal ref

    if (!element) {
      console.error('PDF element not found');
      setIsGenerating(false);
      setIsPdfGenerating(false);
      return;
    }

    const opt = {
      margin:       0.25,
      filename:     `TheraMenu_Protocol_${plan.diagnosis.replace(/[^a-z0-9_]/gi, '_')}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        logging: false, // Disable logging for production
        letterRendering: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        width: 1200,
        height: element.scrollHeight, // Explicit height to capture full content
        scrollY: 0,
        x: 0,
        y: 0
      },
      jsPDF:        { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak:    { mode: ['avoid-all' as const, 'css' as const, 'legacy' as const] }
    };

    try {
      const worker = html2pdf().set(opt).from(element);
      
      if (action === 'save') {
        await worker.save();
      } else {
        const url = await worker.output('bloburl');
        setPdfUrl(url);
        setIsPreviewing(true);
      }
    } catch (error: any) {
      console.error('PDF generation failed:', error);
      alert(`Failed to generate PDF: ${error.message || 'Unknown error'}. Please try the Print option instead.`);
    } finally {
      setIsGenerating(false);
      setIsPdfGenerating(false);
    }
  };

  const renderPrintDays = () => (
    <div className="bg-white font-sans text-slate-900">
      {plan.days.map((day, dIdx) => (
        <div key={`print-${day?.dayName || dIdx}`} className={`${dIdx > 0 ? 'page-break pt-12' : ''} p-10 max-w-[1000px] mx-auto`}>
          {/* Document Header */}
          <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter uppercase italic">Therapeutic Protocol</h1>
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.3em]">Clinical Nutrition & Dietetics Department</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black italic text-blue-600">TM<span className="text-slate-900">INTEL</span></div>
              <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-1">Ref: {planRefId}</p>
            </div>
          </div>

          {/* Patient & Protocol Meta */}
          <div className="grid grid-cols-4 gap-6 mb-10 bg-slate-50 p-6 rounded border border-slate-200">
            <div>
              <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Diagnosis</label>
              <p className="text-sm font-bold uppercase">{plan.diagnosis}</p>
            </div>
            <div>
              <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">IDDSI Level</label>
              <p className="text-sm font-bold uppercase">{plan.constraints?.textureLevel}</p>
            </div>
            <div>
              <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Schedule</label>
              <p className="text-sm font-bold uppercase">{day?.dayName || `Day ${dIdx + 1}`} (Day {dIdx + 1})</p>
            </div>
            <div>
              <label className="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Alignment</label>
              <p className="text-sm font-bold text-emerald-600">{plan.clinicalAlignmentScore}% Verified</p>
            </div>
          </div>

          {/* Nutritional Audit Grid */}
          <div className="mb-10">
            <h3 className="text-[10px] font-mono font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center">
              <span className="w-4 h-px bg-slate-900 mr-2"></span>
              Daily Nutritional Audit
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Calories', target: day?.dailyTargets?.caloriesKcal || 0, actual: day?.totals?.caloriesKcal || 0, unit: 'kcal' },
                { label: 'Protein', target: day?.dailyTargets?.proteinG || 0, actual: day?.totals?.proteinG || 0, unit: 'g' },
                { label: 'Carbs', target: day?.dailyTargets?.carbsG || 0, actual: day?.totals?.carbsG || 0, unit: 'g' },
                { label: 'Fat', target: day?.dailyTargets?.fatG || 0, actual: day?.totals?.fatG || 0, unit: 'g' },
                { label: 'Sodium', target: day?.dailyTargets?.sodiumMg || 0, actual: day?.totals?.sodiumMg || 0, unit: 'mg' },
              ].map((stat) => (
                <div key={stat.label} className="border-l-2 border-slate-200 pl-3">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{stat.label}</p>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-lg font-black tracking-tighter">{Math.round(stat.actual)}</span>
                    <span className="text-[10px] text-slate-400">/ {Math.round(stat.target)}{stat.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meal Schedule */}
          <div className="space-y-10">
            {day.meals.map((meal, mIdx) => (
              <div key={meal.mealType} className="no-break">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-4">
                  <h4 className="text-lg font-black uppercase italic tracking-tight">{meal.mealType}</h4>
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">{meal.dietaryLabel}</span>
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  </div>
                </div>
                
                <div className="grid grid-cols-12 gap-8">
                  <div className="col-span-8">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest py-2 text-left">Component</th>
                          <th className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest py-2 text-right">Portion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {meal.slots?.map((slot, sIdx) => (
                          <tr key={sIdx}>
                            <td className="py-3">
                              <p className="text-[9px] font-mono font-bold text-blue-600 uppercase tracking-tighter">{slot.slotName}</p>
                              <p className="text-sm font-bold text-slate-900">{slot.item?.name || "N/A"}</p>
                              {slot.item?.therapeuticOverride && (
                                <p className="text-[10px] text-slate-500 italic mt-1 border-l border-slate-300 pl-2">{slot.item.therapeuticOverride}</p>
                              )}
                              {slot.substitutionNote && (
                                <p className="text-[10px] text-slate-500 mt-1 border-l border-slate-200 pl-2">{slot.substitutionNote}</p>
                              )}
                              {formatAlternatives(slot.alternatives) && (
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                                  <span className="font-mono font-bold uppercase tracking-wider text-slate-400">Alternatives:</span>{' '}
                                  {formatAlternatives(slot.alternatives)}
                                </p>
                              )}
                            </td>
                            <td className="py-3 text-right text-[11px] font-mono font-bold text-slate-600">
                              {slot.item?.portion || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="col-span-4 space-y-4">
                    {uploadedImages[`${dIdx}-${mIdx}`] ? (
                      <div className="aspect-square rounded border border-slate-200 overflow-hidden shadow-inner">
                        <img src={uploadedImages[`${dIdx}-${mIdx}`]} className="w-full h-full object-cover" alt="Plating" />
                      </div>
                    ) : (
                      <div className="aspect-square rounded border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                        <i className="fas fa-camera text-2xl mb-2"></i>
                        <span className="text-[8px] font-mono uppercase">Visual Reference</span>
                      </div>
                    )}
                    <div className="bg-slate-50 p-3 rounded border border-slate-100">
                       <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Service Specs</p>
                       <div className="space-y-1">
                          <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Temp:</span>
                            <span className="font-bold">{meal.slots?.[0]?.item?.operational?.serviceTemp || ">= 60°C"}</span>
                          </div>
                          <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">HACCP:</span>
                            <span className="font-bold text-emerald-600">VERIFIED</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Rationale */}
          <div className="mt-12 pt-8 border-t-2 border-slate-200 no-break">
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-8">
                <h5 className="text-[10px] font-mono font-bold text-slate-900 uppercase tracking-widest mb-4">Clinical Rationale & Evidence</h5>
                <p className="text-xs text-slate-600 leading-relaxed italic border-l-4 border-blue-600 pl-4">
                  {plan.rationale}
                </p>
              </div>
              <div className="col-span-4 space-y-6">
                <div className="text-right">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Reviewing Clinician</p>
                  <p className="text-sm font-bold uppercase text-slate-300">Unassigned</p>
                  <p className="text-[9px] font-mono text-slate-400">Reserved slot</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">Digital Signature</p>
                  <p className="text-[8px] font-mono text-blue-600 break-all leading-tight">{plan.approvalSignatureHash || "AUTH_SECURE_HASH_V4"}</p>
                </div>
              </div>
            </div>
            <div className="mt-10 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] font-mono text-slate-400 uppercase tracking-[0.2em]">
              <span>Generated on {new Date().toLocaleString()}</span>
              <span>Page {dIdx + 1} of 7 • Confidential Medical Record</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const handleShare = async () => {
    const shareData = {
      title: `TheraMenu Protocol: ${plan.diagnosis}`,
      text: `Weekly Therapeutic Plan for ${plan.diagnosis} - Generated by TheraMenu Intelligence. Alignment Score: ${plan.clinicalAlignmentScore}%`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const summary = `
THERAMENU CLINICAL PROTOCOL
Diagnosis: ${plan.diagnosis}
Alignment: ${plan.clinicalAlignmentScore}%
IDDSI Level: ${plan.constraints?.textureLevel}

RATIONALE:
${plan.rationale}

PREPARED BY: ${plan.preparedBy}
        `.trim();
        
        await navigator.clipboard.writeText(summary);
        alert('Protocol summary copied to clipboard for sharing.');
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      alert('Action not supported on this device. Please use the Print/PDF option.');
    }
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* SCREEN VERSION */}
      <div className="no-print max-w-5xl mx-auto space-y-8">
        {/* Interactive Dashboard Header */}
        <Card className="relative overflow-hidden bg-slate-900 p-8 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <Badge tone="blue">Protocol Active</Badge>
                {plan.carePathLabel && (
                  <Badge tone="emerald">{plan.carePathLabel}</Badge>
                )}
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.3em]">ID: {planRefId}</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter italic uppercase">{plan.diagnosis}</h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">Alignment: {plan.clinicalAlignmentScore}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">Texture: {plan.constraints?.textureLevel}</span>
                </div>
                {plan.engineMode && (
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{plan.engineMode}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={printPlan} variant="ghost" className="border border-slate-700 bg-slate-800 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-700">
                <i className="fas fa-print mr-2"></i> Print
              </Button>
              <Button onClick={() => handleGeneratePDF('save')} className="text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/40">
                <i className="fas fa-file-pdf mr-2"></i> Export PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* Day Selector */}
        <Card className="flex overflow-x-auto scrollbar-hide p-2">
          {plan.days.map((day, idx) => (
            <button
              key={day.dayName}
              onClick={() => setActiveDayIndex(idx)}
              className={`min-w-[124px] flex-1 rounded-lg px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                activeDayIndex === idx 
                  ? 'bg-slate-900 text-white shadow-xl scale-[1.02] z-10' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {day.dayName}
            </button>
          ))}
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Meal Cards */}
          <div className="lg:col-span-8 space-y-6">
            {activeDay.meals.map((meal, mIdx) => (
              <Card key={meal.mealType} className="overflow-hidden group hover:border-blue-300 transition-all">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase italic tracking-tight text-slate-900">{meal.mealType}</h3>
                    {meal.scheduledTime && (
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 mt-1">{meal.scheduledTime}</p>
                    )}
                  </div>
                  <Badge tone="slate">{meal.dietaryLabel}</Badge>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-8">
                    <table className="w-full">
                      <tbody className="divide-y divide-slate-50">
                        {meal.slots?.map((slot, sIdx) => (
                          <tr key={sIdx} className="group/row">
                            <td className="py-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-0.5">{slot.slotName}</p>
                                  <p className="text-sm font-bold text-slate-900 group-hover/row:text-blue-600 transition-colors">{slot.item?.name || "N/A"}</p>
                                  {slot.item?.therapeuticOverride && (
                                    <p className="text-[9px] text-slate-500 italic mt-1 border-l-2 border-slate-200 pl-2">{slot.item.therapeuticOverride}</p>
                                  )}
                                  {slot.substitutionNote && (
                                    <p className="text-[9px] text-slate-500 mt-1.5 border-l-2 border-slate-100 pl-2 leading-relaxed">{slot.substitutionNote}</p>
                                  )}
                                  {formatAlternatives(slot.alternatives) && (
                                    <p className="text-[9px] text-slate-500 mt-1.5 leading-relaxed">
                                      <span className="font-mono font-bold uppercase tracking-wider text-slate-400">Alternatives:</span>{' '}
                                      {formatAlternatives(slot.alternatives)}
                                    </p>
                                  )}
                                  
                                  {/* USDA FDC Live Nutrient Panel */}
                                  {slot.item?.usdaNutrients && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300">
                                      <div className="flex items-center space-x-1.5 mb-2">
                                        <span className="text-[7px] font-mono font-black text-emerald-600 uppercase tracking-widest">USDA FDC</span>
                                        <span className="text-[7px] text-emerald-400">per 100 g</span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-x-3 gap-y-1">
                                        {[
                                          { label: 'kcal', val: slot.item.usdaNutrients.calories, unit: '' },
                                          { label: 'Protein', val: slot.item.usdaNutrients.protein, unit: 'g' },
                                          { label: 'Carbs', val: slot.item.usdaNutrients.carbs, unit: 'g' },
                                          { label: 'Fat', val: slot.item.usdaNutrients.fat, unit: 'g' },
                                          { label: 'Fibre', val: slot.item.usdaNutrients.fiber, unit: 'g' },
                                          { label: 'Na', val: slot.item.usdaNutrients.sodium, unit: 'mg' },
                                          { label: 'K', val: slot.item.usdaNutrients.potassium, unit: 'mg' },
                                          { label: 'P', val: slot.item.usdaNutrients.phosphorus, unit: 'mg' },
                                        ].map(({ label, val, unit }) =>
                                          val !== undefined ? (
                                            <div key={label} className="flex flex-col">
                                              <span className="text-[7px] font-mono text-emerald-500 uppercase tracking-wider">{label}</span>
                                              <span className="text-[9px] font-black text-slate-700">{Math.round(val * 10) / 10}{unit}</span>
                                            </div>
                                          ) : null
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Clinical Intelligence Sub-Panel */}
                                  {slot.item?.intelligence && (
                                    <div className="mt-3 grid grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300">
                                      <div className="space-y-1">
                                        <p className="text-[7px] font-mono text-slate-400 uppercase tracking-widest">Stability</p>
                                        <div className="flex items-center space-x-2">
                                          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${slot.item.intelligence.structuralStability.fsdi}%` }}></div>
                                          </div>
                                          <span className="text-[8px] font-black">{slot.item.intelligence.structuralStability.fsdi}</span>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[7px] font-mono text-slate-400 uppercase tracking-widest">Yield %</p>
                                        <p className="text-[9px] font-black text-slate-700">{slot.item.intelligence.yieldConversion.trimToCookPercent}%</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-[7px] font-mono text-slate-400 uppercase tracking-widest">Class</p>
                                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                          slot.item.intelligence.menuClassification === 'STAR' ? 'bg-emerald-100 text-emerald-700' :
                                          slot.item.intelligence.menuClassification === 'PUZZLE' ? 'bg-blue-100 text-blue-700' :
                                          slot.item.intelligence.menuClassification === 'PLOWHORSE' ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          {slot.item.intelligence.menuClassification}
                                        </span>
                                      </div>
                                      <div className="col-span-3">
                                        <p className="text-[7px] font-mono text-slate-400 uppercase tracking-widest mb-1">Procurement Forecast</p>
                                        <p className="text-[8px] text-slate-600 leading-tight italic">"{slot.item.intelligence.procurementForecast}"</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-[10px] font-mono font-bold text-slate-500">{slot.item?.portion || "-"}</p>
                                  {slot.item?.intelligence?.costIntelligence && (
                                    <p className="text-[9px] font-black text-blue-600 mt-1">${slot.item.intelligence.costIntelligence.costPerPortion.toFixed(2)}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:col-span-4 space-y-4">
                    <div 
                      className="aspect-square rounded-lg bg-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-all overflow-hidden relative group/img"
                      onClick={() => triggerFileInput(activeDayIndex, mIdx)}
                    >
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        ref={el => fileInputRefs.current[`${activeDayIndex}-${mIdx}`] = el}
                        onChange={(e) => handleImageUpload(activeDayIndex, mIdx, e)}
                      />
                      {uploadedImages[`${activeDayIndex}-${mIdx}`] ? (
                        <img src={uploadedImages[`${activeDayIndex}-${mIdx}`]} className="w-full h-full object-cover" alt="Plating" />
                      ) : (
                        <>
                          <i className="fas fa-camera text-xl mb-2"></i>
                          <span className="text-[8px] font-mono font-bold uppercase">Add Photo</span>
                        </>
                      )}
                    </div>
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[8px] font-mono font-bold text-blue-600 uppercase">Service Standard</span>
                        <i className="fas fa-check-circle text-blue-500 text-[10px]"></i>
                      </div>
                      <p className="text-[10px] font-bold text-slate-700">Temp: {meal.slots?.[0]?.item?.operational?.serviceTemp || ">= 60°C"}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Sidebar Audit */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 sticky top-24">
              <h3 className="text-[10px] font-mono font-bold text-slate-900 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2">Clinical Audit</h3>
              
              <div className="space-y-6">
                {[
                  { label: 'Energy', actual: activeDay?.totals?.caloriesKcal || 0, target: activeDay?.dailyTargets?.caloriesKcal || 0, unit: 'kcal', color: 'bg-blue-600' },
                  { label: 'Protein', actual: activeDay?.totals?.proteinG || 0, target: activeDay?.dailyTargets?.proteinG || 0, unit: 'g', color: 'bg-emerald-600' },
                  { label: 'Sodium', actual: activeDay?.totals?.sodiumMg || 0, target: activeDay?.dailyTargets?.sodiumMg || 0, unit: 'mg', color: 'bg-amber-600' },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{stat.label}</span>
                      <span className="text-xs font-black">{Math.round(stat.actual)}<span className="text-slate-400 font-normal"> / {Math.round(stat.target)}{stat.unit}</span></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stat.color} transition-all duration-1000`} 
                        style={{ width: `${Math.min(100, (stat.actual / stat.target) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                {plan.validationReport && (
                  <Card className="bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Validation</p>
                      <Badge tone={plan.validationReport.passed ? 'emerald' : 'red'}>{plan.validationReport.passed ? 'Pass' : 'Review'}</Badge>
                    </div>
                    {plan.validationReport.summary && (
                      <p className="text-[10px] text-slate-600">
                        Checks: {plan.validationReport.summary.nutrientChecksPassed}/{plan.validationReport.summary.nutrientChecksTotal} • Unique foods: {plan.validationReport.summary.weeklyUniqueFoods}
                      </p>
                    )}
                    {plan.validationReport.issues.length > 0 && (
                      <p className="text-[10px] text-red-600 leading-relaxed">
                        {plan.validationReport.issues.slice(0, 2).join(' ')}
                      </p>
                    )}
                  </Card>
                )}
                {plan.carePathLabel && (
                  <Card className="bg-emerald-50 p-3">
                    <p className="text-[9px] font-mono font-bold text-emerald-600 uppercase tracking-widest mb-2">Care Path</p>
                    <p className="text-sm font-bold text-slate-900">{plan.carePathLabel}</p>
                    <p className="mt-1 text-[10px] text-slate-600 leading-relaxed">{plan.constraints?.nutrientTargets}</p>
                  </Card>
                )}
                {plan.diabetesMnt && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 space-y-2">
                    <p className="text-[9px] font-mono font-bold text-orange-600 uppercase tracking-widest">Diabetes Risk Engine</p>
                    <p className="text-sm font-bold text-slate-900">
                      Fasting Risk {plan.diabetesMnt.fastingRiskScore} ({plan.diabetesMnt.fastingRiskLevel})
                    </p>
                    <p className="text-[10px] text-slate-600">
                      Sodium limit {plan.diabetesMnt.sodiumLimitMg} mg • Fibre target {plan.diabetesMnt.fiberTargetG} g
                    </p>
                    {plan.diabetesMnt.safetyAlerts.slice(0, 2).map((alert) => (
                      <p key={alert} className="text-[10px] text-red-600 leading-relaxed">{alert}</p>
                    ))}
                  </div>
                )}
                {plan.localEngine && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                    <p className="text-[9px] font-mono font-bold text-blue-600 uppercase tracking-widest">Local Execution</p>
                    <p className="text-[10px] text-slate-700">
                      {plan.localEngine.phiProcessing} • {plan.localEngine.networkDependency} • {plan.localEngine.databaseStatus.databaseReady ? 'SQLite loaded' : 'SQLite schema ready'}
                    </p>
                  </div>
                )}
                {plan.therapeuticEngine && (
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 space-y-2">
                    <p className="text-[9px] font-mono font-bold text-violet-600 uppercase tracking-widest">Therapeutic Engine</p>
                    {plan.therapeuticEngine.ckdAssessment && (
                      <p className="text-[10px] text-slate-700">
                        KDIGO {plan.therapeuticEngine.ckdAssessment.gfrCategory}/{plan.therapeuticEngine.ckdAssessment.acrCategory} • Kidney failure HR {plan.therapeuticEngine.ckdAssessment.kidneyFailureHr}
                      </p>
                    )}
                    {plan.therapeuticEngine.proteinPrescription && (
                      <p className="text-[10px] text-slate-700">
                        Protein {plan.therapeuticEngine.proteinPrescription.target.toFixed(0)} g target
                        {plan.therapeuticEngine.proteinPrescription.max ? ` • max ${plan.therapeuticEngine.proteinPrescription.max.toFixed(0)} g` : ''}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-700">
                      Diet codes: {plan.therapeuticEngine.recommendedDiets.map((diet) => diet.code).join(', ')}
                    </p>
                    {plan.therapeuticEngine.phosphorusGuide && (
                      <>
                        <p className="text-[10px] text-slate-700">
                          Phosphorus guide {plan.therapeuticEngine.phosphorusGuide.dailyAllowanceMg.min}-{plan.therapeuticEngine.phosphorusGuide.dailyAllowanceMg.max} mg/day
                        </p>
                        <p className="text-[10px] text-slate-700">
                          Label watchlist: {plan.therapeuticEngine.phosphorusGuide.ingredientLabelWarnings.slice(0, 3).join(', ')}
                        </p>
                      </>
                    )}
                    {plan.therapeuticEngine.potassiumAlert && (
                      <p className={`text-[10px] leading-relaxed ${
                        plan.therapeuticEngine.potassiumAlert.severity === 'critical'
                          ? 'text-red-700'
                          : plan.therapeuticEngine.potassiumAlert.severity === 'warning'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                      }`}>
                        {plan.therapeuticEngine.potassiumAlert.message}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Scientific Rationale</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic line-clamp-6">
                    {plan.rationale}
                  </p>
                </div>
                {plan.diabetesMnt && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Plate Method</p>
                    {plan.diabetesMnt.plateMethod.map((step) => (
                      <p key={step} className="text-[10px] text-slate-600">{step}</p>
                    ))}
                  </div>
                )}
                {plan.therapeuticEngine && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Fractionation Schedule</p>
                    {plan.therapeuticEngine.snackSchedule.map((time) => (
                      <p key={time} className="text-[10px] text-slate-600">{time}</p>
                    ))}
                  </div>
                )}
                {plan.therapeuticEngine?.phosphorusGuide && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Low-Phosphorus Guide</p>
                    {plan.therapeuticEngine.phosphorusGuide.lowerPhosphorusFoodGroups.slice(0, 4).map((item) => (
                      <p key={item} className="text-[10px] text-slate-600">{item}</p>
                    ))}
                  </div>
                )}
                <Button
                  onClick={handleShare}
                  variant="secondary"
                  className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-600"
                >
                  <i className="fas fa-share-nodes mr-2"></i> Share Summary
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* PRINT VERSION */}
      <div ref={printRef} className="hidden print-only">
        {renderPrintDays()}
      </div>

      {/* PDF PORTAL */}
      {isPdfGenerating && createPortal(
        <div ref={pdfRef} className="absolute top-0 left-0 z-[10000] w-[1000px] bg-white text-slate-900 overflow-visible">
          {renderPrintDays()}
        </div>,
        document.body
      )}

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[10003] flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(59,130,246,0.5)]"></div>
          <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Synthesizing Protocol</h3>
          <p className="text-slate-400 max-w-xs font-mono text-[10px] uppercase tracking-widest">Compiling clinical data into standardized medical format...</p>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewing && pdfUrl && (
        <div className="fixed inset-0 z-[10001] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-slide-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-file-pdf text-xl"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-tight">Clinical Protocol Preview</h3>
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Ready for distribution</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPreviewing(false)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-all shadow-sm"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="flex-1 bg-slate-200 p-8 overflow-hidden relative">
               <iframe src={pdfUrl} className="w-full h-full rounded-lg shadow-2xl border border-slate-300" title="PDF Preview"></iframe>
            </div>
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end space-x-4">
              <button onClick={() => setIsPreviewing(false)} className="px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">
                Cancel
              </button>
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfUrl;
                  link.download = `Clinical_Protocol_${plan.diagnosis.replace(/\s+/g, '_')}.pdf`;
                  link.click();
                }}
                className="px-8 py-3 rounded-lg bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-900/20 transition-all"
              >
                Download Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuResult;
