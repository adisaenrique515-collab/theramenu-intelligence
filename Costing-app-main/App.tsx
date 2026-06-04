import React, { useState, useCallback } from "react";
import { RecipeData, ViewMode } from "./types";
import { extractRecipeData } from "./services/geminiService";
import SynthesisReport from "./components/SynthesisReport";
import ProtocolsAdmin from "./components/ProtocolsAdmin";
import SOPSpreadsheet from "./components/SOPSpreadsheet";
import { motion, AnimatePresence } from "motion/react";
import { Download, Upload, RefreshCw, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const App: React.FC = () => {
  React.useEffect(() => { try { const usp = new URLSearchParams(window.location.search); if (usp.get("view") === "protocols") setViewMode(ViewMode.PROTOCOLS); } catch {} }, []);
  const [recipeData, setRecipeData] = useState<RecipeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.SYNTHESIS);
  const [previewImage, setPreviewImage] = useState<string | undefined>();
  const [fileMime, setFileMime] = useState<string>("image/png");
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState<number>(1);
  const [unitCosts, setUnitCosts] = useState<number[]>([]);
  const [sellingPrice, setSellingPrice] = useState<number>(0);

  const reset = useCallback(() => {
    setRecipeData(null);
    setScale(1);
    setUnitCosts([]);
    setSellingPrice(0);
    setPreviewImage(undefined);
    setError(null);
    setViewMode(ViewMode.SYNTHESIS);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setFileMime(file.type);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);
      try {
        const data = await extractRecipeData(base64, file.type);
        setRecipeData(data);
        setScale(1);
        setUnitCosts(data.ingredients.map(i => i.unitCost || 0));
        setSellingPrice(data.proposedSellingPrice || 0);
      } catch (err: any) {
        setError(err.message || "Failed to process recipe. Please try again.");
        console.error(err);
      } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  }, []);

  const downloadCSV = useCallback(() => {
    if (!recipeData) return;
    const currency = "AUD";
    const getScaledQty = (qty: number) => qty * scale;
    const getIngredientTotal = (idx: number) => getScaledQty(recipeData.ingredients[idx].qty) * (unitCosts[idx] || 0);
    const totalBatchCost = recipeData.ingredients.reduce((acc, _, idx) => acc + getIngredientTotal(idx), 0);
    const costPerPlate = totalBatchCost / ((recipeData.portions * scale) || 1);
    const foodCostPercentage = sellingPrice > 0 ? (costPerPlate / sellingPrice) * 100 : 0;
    const rows = [
      ["AUSTRALIAN PLATE COST ANALYSIS - VIXEL INTELLIGENCE"],
      ["Recipe Name", recipeData.recipeName],
      ["Recipe ID", recipeData.recipeId],
      ["Yield (Total Portions)", recipeData.portions * scale],
      ["Currency", currency],
      [],
      ["INGREDIENT BREAKDOWN"],
      ["Name","Unit","Base Qty","Scaled Qty",`Market Cost (${currency})`,`Line Total (${currency})`],
      ...recipeData.ingredients.map((ing, idx) => [ing.name, ing.unit, ing.qty, getScaledQty(ing.qty).toFixed(3), (unitCosts[idx] || 0).toFixed(2), getIngredientTotal(idx).toFixed(2)]),
      [],
      ["FINANCIAL ANALYSIS (PER SINGLE PLATE SOLD)"],
      ["Total Batch Production Cost", totalBatchCost.toFixed(2)],
      ["NET COST PER PLATE", costPerPlate.toFixed(2)],
      ["Proposed Selling Price", sellingPrice.toFixed(2)],
      ["Target Food Cost %", `${foodCostPercentage.toFixed(2)}%`],
      ["Gross Margin %", `${(100 - foodCostPercentage).toFixed(2)}%`],
    ];
    const csvRows = rows.map(row => row.map(cell => JSON.stringify(String(cell))).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + csvRows;
    const a = document.createElement('a'); a.href = encodeURI(csvContent); a.download = `${recipeData.recipeName.replace(/\s+/g,'_')}_AUD_Plate_Costing.csv`; a.click();
  }, [recipeData, scale, unitCosts, sellingPrice]);

  const downloadPDF = useCallback(async () => {
    if (!recipeData) return;
    const element = document.getElementById('report-container');
    if (!element) return;
    try {
      setLoading(true);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff', width: element.scrollWidth, height: element.scrollHeight, windowWidth: element.scrollWidth });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth)/2, 20, imgWidth, imgHeight);
      pdf.save(`${recipeData.recipeName.replace(/\s+/g,'_')}_Report.pdf`);
    } finally { setLoading(false); }
  }, [recipeData]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="bg-black text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono uppercase tracking-widest">Vixel Engine</div>
          <div className="w-[1px] h-6 bg-gray-800 mx-2"></div>
          <button onClick={reset} className="text-[10px] text-gray-400 hover:text-white font-bold border-b border-gray-700 tracking-widest uppercase whitespace-nowrap flex items-center gap-1"><RefreshCw size={12}/> New</button>
          <button onClick={() => setViewMode(ViewMode.SYNTHESIS)} className={`ml-3 px-3 py-1.5 rounded-md text-xs font-bold ${viewMode===ViewMode.SYNTHESIS?'bg-white text-black':'bg-gray-800'}`}><FileText className="inline mr-1" size={14}/> Synthesis</button>
          <button onClick={() => setViewMode(ViewMode.SPREADSHEET)} className={`ml-2 px-3 py-1.5 rounded-md text-xs font-bold ${viewMode===ViewMode.SPREADSHEET?'bg-white text-black':'bg-gray-800'}`}><FileSpreadsheet className="inline mr-1" size={14}/> Spreadsheet</button>
          <button onClick={() => setViewMode(ViewMode.PROTOCOLS)} className={`ml-2 px-3 py-1.5 rounded-md text-xs font-bold ${viewMode===ViewMode.PROTOCOLS?'bg-white text-black':'bg-gray-800'}`}>Protocols</button>
        </div>
        <div className="flex items-center gap-2">
          {recipeData && viewMode!==ViewMode.PROTOCOLS && (<>
            <button onClick={downloadCSV} className="px-3 py-1.5 rounded bg-white text-black text-xs font-bold flex items-center gap-1"><Download size={14}/> CSV</button>
            <button onClick={downloadPDF} className="px-3 py-1.5 rounded bg-white text-black text-xs font-bold flex items-center gap-1"><Download size={14}/> PDF</button>
          </>)}
          {!recipeData && (
            <label className="px-3 py-1.5 rounded bg-white text-black text-xs font-bold flex items-center gap-1 cursor-pointer">
              <Upload size={14}/> Upload
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-6 print:p-0 bg-gray-50">
        <AnimatePresence mode="wait">
          {viewMode === ViewMode.PROTOCOLS ? (
            <motion.div key="protocols" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full">
              <ProtocolsAdmin/>
            </motion.div>
          ) : !recipeData && !loading ? (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-xl w-full text-center space-y-8">
              <div className="space-y-4">
                <h2 className="text-5xl font-black tracking-tighter text-gray-900 uppercase">Plate <span className="text-red-600 italic">Economics</span></h2>
                <p className="text-gray-500 text-lg leading-relaxed max-w-md mx-auto italic font-light">Australian Market Analysis Engine.</p>
              </div>
              <div className="relative group">
                <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" id="recipe-upload" />
                <label htmlFor="recipe-upload" className="cursor-pointer block p-12 border-2 border-dashed border-gray-300 rounded-2xl bg-white hover:border-red-500 hover:bg-red-50 transition-all duration-300 group-hover:shadow-2xl">
                  <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 group-hover:rotate-12 transition-transform shadow-inner"><Upload size={32} /></div>
                  <span className="block text-xl font-bold text-gray-800 mb-1 uppercase tracking-tight">Upload Master Card</span>
                  <span className="text-xs text-gray-400 uppercase tracking-widest font-mono">PDF / Image / Screenshot</span>
                </label>
              </div>
              {error && (<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm font-medium">{error}</motion.div>)}
            </motion.div>
          ) : loading ? (
            <motion.div key="loading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center text-red-600"><Loader2 size={48} className="animate-spin" /></div>
              <div className="space-y-2">
                <p className="font-black tracking-[0.2em] text-gray-900 uppercase animate-pulse">Deep Financial Synthesis</p>
                <p className="text-gray-400 text-[10px] font-mono uppercase tracking-widest">Processing...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="content" id="report-container" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full h-full">
              {viewMode === ViewMode.SYNTHESIS && recipeData && (
                <SynthesisReport data={recipeData} heroImage={previewImage} scale={scale} unitCosts={unitCosts} sellingPrice={sellingPrice} />
              )}
              {viewMode === ViewMode.SPREADSHEET && recipeData && (
                <SOPSpreadsheet data={recipeData} scale={scale} setScale={setScale} unitCosts={unitCosts} setUnitCosts={setUnitCosts} sellingPrice={sellingPrice} setSellingPrice={setSellingPrice} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!recipeData && viewMode!==ViewMode.PROTOCOLS && (
        <footer className="py-8 bg-transparent text-center">
          <p className="text-[10px] font-mono text-gray-400 tracking-[0.3em] uppercase">Vixel Engine</p>
        </footer>
      )}
    </div>
  );
};

export default App;



