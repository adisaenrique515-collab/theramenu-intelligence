
import React from 'react';
import { ExecutionMode } from '../utils/appMode';

interface HeaderProps {
  activeTab: 'generator' | 'db' | 'logs' | 'screening' | 'compliance';
  onTabChange: (tab: 'generator' | 'db' | 'logs' | 'screening' | 'compliance') => void;
  executionMode: ExecutionMode;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, executionMode }) => {
  const modeLabel = executionMode === 'MOCK' ? 'MOCK DATA' : 'LIVE GEMINI';
  const modeClass =
    executionMode === 'MOCK'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <header className="bg-[#0f172a] border-b border-slate-800 px-6 py-2 sticky top-0 z-50 shadow-xl">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4 cursor-pointer" onClick={() => onTabChange('generator')}>
          <div className="w-9 h-9 bg-blue-600 rounded-md flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <i className="fas fa-microscope text-lg"></i>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <h1 className="text-lg font-bold text-white leading-none tracking-tight flex items-center">
              THERAMENU
              <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-mono rounded border border-blue-500/30">v4.5.0</span>
            </h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-mono mt-1">Clinical Dietary Intelligence Engine</p>
          </div>
        </div>
        
        <nav className="hidden lg:flex items-center space-x-1">
          {[
            { id: 'generator', label: 'Protocol Generator', icon: 'fa-wand-magic-sparkles' },
            { id: 'db', label: 'Diagnosis DB', icon: 'fa-database' },
            { id: 'screening', label: 'JCI Screening', icon: 'fa-clipboard-check' },
            { id: 'compliance', label: 'Compliance', icon: 'fa-shield-halved' },
            { id: 'logs', label: 'Audit Logs', icon: 'fa-clock-rotate-left' },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className={`flex items-center space-x-2 text-[10px] font-mono font-bold px-4 py-2 rounded transition-all uppercase tracking-wider ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <i className={`fas ${tab.icon} text-[10px]`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-6">
          <div className="hidden xl:flex flex-col items-end border-r border-slate-800 pr-6">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">System Status</span>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">OPERATIONAL</span>
            </div>
            <span className={`mt-1 px-2 py-0.5 rounded border text-[9px] font-mono font-bold tracking-widest ${modeClass}`}>
              {modeLabel}
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-white leading-none">Dr. Enrique</p>
              <p className="text-[8px] font-mono text-slate-500 uppercase mt-1">Chief Dietitian</p>
            </div>
            <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-mono text-xs cursor-pointer hover:bg-slate-700 transition-colors">
              AE
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
