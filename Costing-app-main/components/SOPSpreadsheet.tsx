
import React, { useState } from 'react';
import { RecipeData } from '../types';
import { motion } from 'motion/react';

interface Props {
  data: RecipeData;
  scale: number;
  setScale: (v: number) => void;
  unitCosts: number[];
  setUnitCosts: (v: number[]) => void;
  sellingPrice: number;
  setSellingPrice: (v: number) => void;
}

const SOPSpreadsheet: React.FC<Props> = ({ 
  data, 
  scale, setScale, 
  unitCosts, setUnitCosts, 
  sellingPrice, setSellingPrice 
}) => {
  const [selectedCell, setSelectedCell] = useState<string>("B2");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const currency = "AUD";

  const handleUnitCostChange = (idx: number, val: string) => {
    const newCosts = [...unitCosts];
    newCosts[idx] = parseFloat(val) || 0;
    setUnitCosts(newCosts);
  };

  const getScaledQty = (qty: number) => qty * scale;
  const getIngredientTotal = (idx: number) => getScaledQty(data.ingredients[idx].qty) * (unitCosts[idx] || 0);
  
  const totalBatchCost = unitCosts.reduce((acc, _, idx) => acc + getIngredientTotal(idx), 0);
  const costPerPlate = totalBatchCost / ((data.portions * scale) || 1);
  const foodCostPercentage = sellingPrice > 0 ? (costPerPlate / sellingPrice) * 100 : 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-[#f0f0f0] min-h-screen p-4 font-mono-custom text-[11px] select-none"
    >
      {/* Excel Style Toolbar */}
      <motion.div variants={itemVariants} className="bg-white border border-gray-300 mb-4 p-2 flex items-center gap-4 shadow-sm rounded no-print">
        <div className="flex items-center gap-2 border-r pr-4 border-gray-200">
          <span className="text-gray-400 font-bold uppercase text-[9px]">Production Volume:</span>
          <input 
            type="number" 
            value={scale} 
            onChange={(e) => setScale(Math.max(0.1, parseFloat(e.target.value) || 1))}
            className="w-16 border border-red-200 px-2 py-1 rounded text-red-700 font-black focus:ring-2 focus:ring-red-500"
            step="0.5"
          />
          <span className="text-[10px] text-gray-400 italic">Total Portions: {(data.portions * scale).toFixed(0)}</span>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <div className="bg-gray-100 border px-2 py-1 text-gray-500 w-12 text-center font-bold">{selectedCell}</div>
          <div className="flex-1 bg-white border px-2 py-1 text-gray-800 italic">
            {selectedCell === "F10" ? "fx: =TOTAL_BATCH_COST / TOTAL_PORTIONS" : `Editing: ${data.recipeName}`}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-1.5 rounded hover:bg-black font-bold flex items-center gap-2 shadow-sm">
            PRINT SOP
          </button>
        </div>
      </motion.div>

      {/* Main Analysis Sheet */}
      <motion.div variants={itemVariants} className="bg-white border border-gray-400 shadow-2xl overflow-x-auto print:shadow-none print-reset">
        <table className="w-full border-collapse table-fixed min-w-[1100px]">
          <thead>
            <tr className="bg-[#f3f3f3] text-[9px] text-gray-400">
              <th className="w-10 border border-gray-300"></th>
              {alphabet.slice(0, 8).map((char) => (
                <th key={char} className="border border-gray-300 py-0.5 text-center font-normal">{char}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">1</td>
              <td colSpan={8} className="border border-gray-300 bg-gray-900 text-white px-4 py-3">
                <div className="flex justify-between items-center">
                  <div className="text-xl font-black tracking-widest uppercase">PLATE ECONOMICS ENGINE (AUD)</div>
                  <div className="text-right text-[9px] font-mono opacity-60 italic uppercase tracking-widest">Live Market Integrated</div>
                </div>
              </td>
            </tr>

            <tr>
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">2</td>
              <td colSpan={2} className="border border-gray-300 bg-gray-50 px-3 py-2 font-bold uppercase text-gray-500">Master Product</td>
              <td colSpan={4} className="border border-gray-300 px-3 py-2 text-xl font-black text-red-600 uppercase tracking-tighter">{data.recipeName}</td>
              <td className="border border-gray-300 bg-gray-50 px-3 py-2 font-bold uppercase text-gray-500">Unit Portion Size</td>
              <td className="border border-gray-300 px-3 py-2 font-black text-red-600 text-lg uppercase">1 PLATE</td>
            </tr>

            <tr className="bg-gray-100 text-gray-700 font-black text-[10px] text-center uppercase tracking-wider">
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400 italic">3</td>
              <td colSpan={3} className="border border-gray-300 py-2">Constituent Ingredients</td>
              <td className="border border-gray-300 py-2">Unit</td>
              <td className="border border-gray-300 py-2">Batch Qty</td>
              <td className="border border-gray-300 py-2 bg-yellow-50 text-yellow-800 italic">Market Price (AUD)</td>
              <td colSpan={2} className="border border-gray-300 py-2 bg-red-600 text-white">Line Total Cost</td>
            </tr>

            {data.ingredients.map((ing, idx) => (
              <motion.tr variants={itemVariants} key={idx} className="hover:bg-blue-50 transition-colors">
                <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">{4+idx}</td>
                <td colSpan={3} className="border border-gray-300 px-3 py-2 font-bold text-gray-800">
                  {ing.name}
                  {ing.marketSource && <div className="text-[8px] text-gray-400 font-normal italic">Source: {ing.marketSource}</div>}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-gray-500 font-bold uppercase">{ing.unit}</td>
                <td className="border border-gray-300 px-3 py-2 text-right tabular-nums text-gray-600">{ing.qty === 0 ? '-' : getScaledQty(ing.qty).toFixed(3)}</td>
                <td className="border border-gray-300 p-0 bg-yellow-50/30">
                  <input 
                    type="number"
                    value={unitCosts[idx] || 0}
                    onChange={(e) => handleUnitCostChange(idx, e.target.value)}
                    className="w-full h-full border-none bg-transparent px-3 py-2 text-right focus:outline-none focus:bg-yellow-100 font-black text-blue-600"
                    onFocus={() => setSelectedCell(`E${4+idx}`)}
                  />
                </td>
                <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right font-black bg-red-50 text-red-700 tabular-nums">
                  {getIngredientTotal(idx).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </motion.tr>
            ))}

            <motion.tr variants={itemVariants}>
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">#</td>
              <td colSpan={5} className="border border-gray-300 bg-gray-50"></td>
              <td className="border border-gray-300 bg-gray-800 text-white font-bold px-3 py-2 text-right uppercase">TOTAL BATCH COST</td>
              <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right font-black text-xl bg-red-100 text-red-700 border-l-4 border-red-600">
                {totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </motion.tr>

            <motion.tr variants={itemVariants} className="bg-black text-white">
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">FIN</td>
              <td colSpan={8} className="border border-gray-800 px-4 py-3 uppercase font-black italic tracking-widest text-[12px] text-center">
                Financial Analysis Summary (Per Single Plate Sold)
              </td>
            </motion.tr>

            <motion.tr variants={itemVariants}>
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">M1</td>
              <td colSpan={3} className="border border-gray-300 bg-gray-50 p-4">
                <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tighter">Current Batch Yield</div>
                <div className="text-3xl font-black text-gray-900">{(data.portions * scale).toFixed(0)} <span className="text-xs text-gray-400">Plates</span></div>
              </td>
              <td colSpan={2} className="border border-gray-300 bg-red-600 p-4 text-white">
                <div className="text-[10px] font-bold opacity-70 mb-1 uppercase tracking-tighter">NET COST PER PLATE</div>
                <div className="text-3xl font-black tabular-nums font-mono">${costPerPlate.toFixed(2)}</div>
              </td>
              <td colSpan={3} className="border border-gray-300 bg-emerald-600 p-4 text-white">
                <div className="text-[10px] font-bold opacity-70 mb-1 uppercase tracking-tighter">PROPOSED SELLING PRICE</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black">$</span>
                  <input 
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="bg-transparent border-b-2 border-emerald-400 text-3xl font-black focus:outline-none w-full tabular-nums"
                  />
                </div>
              </td>
            </motion.tr>

            <motion.tr variants={itemVariants}>
              <td className="bg-[#f3f3f3] border border-gray-300 text-center text-gray-400">M2</td>
              <td colSpan={4} className="border border-gray-300 bg-gray-50 px-4 py-4">
                <div className="text-[10px] font-black uppercase text-gray-400 mb-2">Margin Distribution Profile</div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden flex">
                    <div style={{ width: `${foodCostPercentage}%` }} className="bg-red-500 h-full"></div>
                    <div className="flex-1 bg-emerald-500 h-full"></div>
                  </div>
                  <div className="text-xs font-black">{(100 - foodCostPercentage).toFixed(1)}% MARGIN</div>
                </div>
              </td>
              <td colSpan={4} className="border border-gray-300 px-4 py-4 text-center">
                <div className="text-[10px] font-black uppercase text-gray-400 mb-1">FOOD COST %</div>
                <div className={`text-4xl font-black ${foodCostPercentage > 35 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {foodCostPercentage.toFixed(1)}%
                </div>
              </td>
            </motion.tr>
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
};

export default SOPSpreadsheet;
