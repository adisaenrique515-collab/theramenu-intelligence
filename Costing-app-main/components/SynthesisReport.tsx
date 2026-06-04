
import React, { useEffect, useMemo, useState } from 'react';
import { loadProtocols, evaluateMeal, parseFlagsFromLocation, type EvaluationFinding } from '../lib/protocols';
import { RecipeData } from '../types';
import { computePerPortion } from '../lib/usda';
import { motion } from 'motion/react';

interface Props {
  data: RecipeData;
  heroImage?: string;
  scale: number;
  unitCosts: number[];
  sellingPrice: number;
}

const SynthesisReport: React.FC<Props> = ({ data, heroImage, scale, unitCosts, sellingPrice }) => {
  const getScaledQty = (qty: number) => qty * scale;
  const getIngredientTotal = (idx: number, qty: number) => qty * scale * (unitCosts[idx] || 0);
  
  const totalBatchCost = data.ingredients.reduce((acc, ing, idx) => acc + getIngredientTotal(idx, ing.qty), 0);
  const costPerPlate = totalBatchCost / ((data.portions * scale) || 1);
  const foodCostPercentage = sellingPrice > 0 ? (costPerPlate / sellingPrice) * 100 : 0;
  const contributionMargin = sellingPrice - costPerPlate;

  
    const [auditFindings, setAuditFindings] = useState<EvaluationFinding[] | null>(null);
  const [patientFlags, setPatientFlags] = useState<string[]>(() => parseFlagsFromLocation(window.location));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [ds, per] = await Promise.all([
          loadProtocols(),
          computePerPortion(data, scale)
        ]);
        const audited = { ...data, totals: per } as RecipeData;
        const findings = evaluateMeal(audited, patientFlags, ds);
        if (mounted) setAuditFindings(findings);
      } catch (e) {
        console.error('Protocols or USDA eval failed', e);
      }
    })();
    return () => { mounted = false };
  }, [data, patientFlags, scale]);
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white shadow-2xl max-w-4xl mx-auto min-h-screen p-12 text-gray-900 border border-gray-200 print:p-0 print:shadow-none print:border-none"
    >
      {/* Dynamic Header */}
      <motion.div variants={itemVariants} className="border-b-8 border-black pb-8 mb-10 flex justify-between items-start">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 tracking-tighter uppercase">AUSTRALIAN MARKET</span>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Recipe // {data.recipeId}</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter uppercase leading-none mb-4">
            {data.recipeName}
          </h1>
          <p className="text-gray-400 font-mono text-[10px] uppercase tracking-[0.3em]">
            Recipe Report // {data.timestamp || new Date().toLocaleDateString('en-AU')}
          </p>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-[40px] font-black leading-none mb-1 tabular-nums italic">$AUD</div>
          <div className="text-[10px] font-bold text-gray-400 uppercase border-t border-gray-100 pt-1">Standard Currency</div>
        </div>
      </motion.div>

            {/* Clinical Audit Panel */}
      {auditFindings && (
        <motion.div variants={itemVariants} className="mb-8 border-2 border-black rounded-sm overflow-hidden">
          <div className="bg-gray-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
            <span>Clinical Audit</span>
            <span className="text-gray-300">Active flags: {patientFlags.length > 0 ? patientFlags.join(', ') : 'none'}</span>
          </div>
          <div className="bg-white divide-y">
            {auditFindings.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 italic">No findings for current flags.</div>
            ) : (
              auditFindings.slice(0,6).map((f, i) => (
                <div key={i} className="p-3 text-sm flex items-start gap-3">
                  <span className={`mt-0.5 inline-block w-2 h-2 rounded-full ${f.severity==='critical' ? 'bg-red-600' : f.severity==='warning' ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                  <div>
                    <div className="font-bold text-gray-800">{f.message}</div>
                    {f.suggestion && <div className="text-gray-500 text-xs">Suggestion: {f.suggestion} <a href={`?view=protocols&protocol=${f.protocolId}`} className="text-blue-600 underline ml-2">View spec</a></div>}
                    {f.matched && f.matched.length > 0 && <div className="text-[10px] text-gray-400 mt-1">Matched: {f.matched.slice(0,5).join(', ')}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}      {/* Ingredients Grid */}
      <motion.div variants={itemVariants} className="mb-16">
        <div className="flex items-center gap-4 mb-8">
          <h3 className="bg-black text-white px-4 py-1 font-black uppercase tracking-widest text-[10px]">
            INGREDIENTS
          </h3>
          <div className="flex-1 h-[2px] bg-gray-100"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4">
          {data.ingredients.map((ing, idx) => (
            <div key={idx} className="flex justify-between items-center border-b border-gray-100 pb-2 group">
              <div className="flex flex-col">
                <span className="text-sm font-black text-gray-800 uppercase tracking-tight group-hover:text-red-600 transition-colors">
                  Ã¢â‚¬Â¢ {ing.qty === 0 ? '' : `${getScaledQty(ing.qty).toFixed(3)} `}{ing.unit !== 'to taste' ? `${ing.unit} ` : ''}{ing.name}{ing.unit === 'to taste' ? ' to taste' : ''}
                </span>
                {ing.marketSource && <span className="text-[8px] text-gray-400 font-mono italic">{ing.marketSource}</span>}
              </div>
              <div className="text-right">
                <div className="text-[9px] text-gray-400 font-bold uppercase tabular-nums">@ ${unitCosts[idx]?.toFixed(2)} / UNIT</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Instruction Set */}
      <motion.div variants={itemVariants} className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <h3 className="bg-black text-white px-4 py-1 font-black uppercase tracking-widest text-[10px]">
            METHOD
          </h3>
          <div className="flex-1 h-[2px] bg-gray-100"></div>
        </div>
        <div className="space-y-8">
          {data.instructions.map((step, idx) => (
            <div key={idx} className="flex gap-8 group">
              <span className="text-4xl font-black text-gray-100 font-mono leading-none group-hover:text-red-100 transition-colors">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed uppercase pt-1 border-l-2 border-gray-50 pl-6 group-hover:border-red-600 transition-all">
                {step}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Operational Intelligence Section */}
      {data.analysis && (
        <motion.div variants={itemVariants} className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="bg-black text-white px-4 py-1 font-black uppercase tracking-widest text-[10px]">
              OPERATIONAL INTELLIGENCE
            </h3>
            <div className="flex-1 h-[2px] bg-gray-100"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Structural Stability */}
            <div className="bg-gray-50 p-4 border-l-4 border-black">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">Structural Stability</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold">FSDI Score:</span>
                  <span className="font-mono">{data.analysis.structuralStability.fsdi}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold">Acid Balance:</span>
                  <span className="font-mono">{data.analysis.structuralStability.acidBalance}</span>
                </div>
                <div className="text-[10px] text-red-600 font-bold uppercase mt-1">
                  Risk: {data.analysis.structuralStability.fragilityRisk}
                </div>
              </div>
            </div>

            {/* Yield & Scaling */}
            <div className="bg-gray-50 p-4 border-l-4 border-black">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">Yield & Scaling</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold">RawÃ¢â€ â€™TrimÃ¢â€ â€™Cook:</span>
                  <span className="font-mono">{data.analysis.yieldConversion.rawToTrimCookRatio}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold">Cost Factor:</span>
                  <span className="font-mono">{data.analysis.yieldConversion.costFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold">Portion Multi:</span>
                  <span className="font-mono">{data.analysis.yieldConversion.portionMultiplier.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Inventory Intelligence */}
            <div className="bg-gray-50 p-4 border-l-4 border-black">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">Inventory Intelligence</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold">Turnover Ratio:</span>
                  <span className="font-mono">{data.analysis.inventoryIntelligence.recommendedTurnoverRatio}x</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold">Target Age:</span>
                  <span className="font-mono">{data.analysis.inventoryIntelligence.targetAverageAgeDays}d</span>
                </div>
                <div className="text-[9px] text-gray-500 italic mt-1">
                  {data.analysis.inventoryIntelligence.parLevelGuidance}
                </div>
              </div>
            </div>

            {/* Menu Engineering */}
            <div className="bg-black text-white p-4 flex flex-col justify-center">
              <h4 className="text-[10px] font-black uppercase opacity-50 mb-2">Menu Classification</h4>
              <div className="text-3xl font-black italic tracking-tighter text-red-500">
                {data.analysis.menuEngineering.classification}
              </div>
              <div className="flex justify-between text-[9px] opacity-70 uppercase mt-1 tracking-widest">
                <span>Rank: #{data.analysis.menuEngineering.contributionRank}</span>
                <span>Pop: {data.analysis.menuEngineering.popularityIndex}%</span>
              </div>
            </div>
          </div>

          {/* Cost Intelligence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <div className="bg-white border-2 border-black p-4">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-1">Net Cost / Plate</h4>
              <div className="text-2xl font-black tabular-nums">${costPerPlate.toFixed(2)}</div>
            </div>
            <div className="bg-white border-2 border-black p-4">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-1">Contribution Margin</h4>
              <div className="text-2xl font-black tabular-nums text-emerald-600">${contributionMargin.toFixed(2)}</div>
            </div>
            <div className="bg-white border-2 border-black p-4">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-1">Food Cost %</h4>
              <div className={`text-2xl font-black tabular-nums ${foodCostPercentage > 35 ? 'text-red-600' : 'text-emerald-600'}`}>
                {foodCostPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white border-2 border-black p-4">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-1">Break-even (Covers)</h4>
              <div className="text-2xl font-black tabular-nums">{data.analysis.costIntelligence.breakEvenPointCovers}</div>
            </div>
          </div>

          {/* Control Protocols */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-900 text-white rounded-sm border-l-4 border-red-600">
              <h4 className="text-[10px] font-black uppercase opacity-50 mb-2">Procurement Forecast</h4>
              <p className="text-xs leading-relaxed italic font-mono">
                "{data.analysis.procurementForecast}"
              </p>
            </div>
            <div className="p-4 bg-gray-100 border-l-4 border-blue-600">
              <h4 className="text-[10px] font-black uppercase text-gray-400 mb-2">Control Protocols (SOP)</h4>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                {data.analysis.controlProtocols.map((protocol, i) => (
                  <li key={i} className="text-[10px] font-bold uppercase flex items-center gap-1">
                    <span className="text-blue-600">Ã¢â‚¬Âº</span> {protocol}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Market Sources Grounding */}
      {data.sourceUrls && data.sourceUrls.length > 0 && (
        <motion.div variants={itemVariants} className="mb-16 p-6 bg-gray-50 border-l-4 border-black no-print">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Verification Intelligence (Live Australian Retail)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.sourceUrls.slice(0, 4).map((source, i) => (
              <a key={i} href={source.uri} target="_blank" rel="noreferrer" className="text-[9px] font-mono text-blue-600 hover:text-black truncate flex items-center gap-2">
                <span className="text-gray-300">/</span> {source.title || source.uri}
              </a>
            ))}
          </div>
        </motion.div>
      )}

      {/* Safety & Protocol Footer */}
      <motion.div variants={itemVariants} className="pt-10 border-t-8 border-black grid grid-cols-2 gap-12 font-mono text-[10px] uppercase">
        <div className="space-y-2">
          <p className="font-black text-red-600 tracking-tighter">Critical Control Point (CCP):</p>
          <p className="text-gray-500 leading-tight">{data.ccp || 'Monitor Core Temp / Active Sanitation Required'}</p>
        </div>
        <div className="space-y-2 text-right">
          <p className="font-black tracking-tighter">Quality Assurance:</p>
          <p className="text-gray-500 leading-tight">Master Sample Comparison Compulsory Per Service Cycle</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-16 text-center">
        <div className="inline-block bg-black text-white px-8 py-2 text-[10px] font-black uppercase tracking-[0.6em] italic">
          RECIPE // COMPLETED
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SynthesisReport;











