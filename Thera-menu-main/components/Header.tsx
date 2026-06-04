import React from 'react';
import { ExecutionMode } from '../utils/appMode';

interface HeaderProps {
  activeTab: 'generator' | 'db' | 'logs' | 'screening' | 'compliance';
  onTabChange: (tab: 'generator' | 'db' | 'logs' | 'screening' | 'compliance') => void;
  executionMode: ExecutionMode;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, executionMode }) => {
  const modeLabel = executionMode === 'MOCK' ? 'LOCAL PHI' : 'LIVE';
  const modeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0f172a] px-6 py-2 shadow-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex cursor-pointer items-center space-x-4" onClick={() => onTabChange('generator')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <i className="fas fa-microscope text-lg"></i>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <h1 className="flex items-center text-lg font-bold leading-none tracking-tight text-white">
              THERAMENU
              <span className="ml-2 rounded border border-blue-500/30 bg-blue-500/20 px-1.5 py-0.5 text-[8px] font-mono text-blue-400">v4.5.0</span>
            </h1>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">Clinical Dietary Intelligence Engine</p>
          </div>
        </div>

        <nav className="hidden items-center space-x-1 lg:flex">
          {[
            { id: 'generator', label: 'Protocol Generator', icon: 'fa-wand-magic-sparkles' },
            { id: 'db', label: 'Blueprint', icon: 'fa-sitemap' },
            { id: 'screening', label: 'JCI Screening', icon: 'fa-clipboard-check' },
            { id: 'compliance', label: 'Compliance', icon: 'fa-shield-halved' },
            { id: 'logs', label: 'Audit Logs', icon: 'fa-clock-rotate-left' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as 'generator' | 'db' | 'logs' | 'screening' | 'compliance')}
              className={`flex items-center space-x-2 rounded px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${tab.icon} text-[10px]`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-6">
          <div className="hidden flex-col items-end border-r border-slate-800 pr-6 xl:flex">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">System Status</span>
            <div className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              <span className="font-mono text-[10px] font-bold text-emerald-400">OFFLINE READY</span>
            </div>
            <span className={`mt-1 rounded border px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${modeClass}`}>
              {modeLabel}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-bold leading-none text-white">Doctor / Dietitian</p>
              <p className="mt-1 font-mono text-[8px] uppercase text-slate-500">Unassigned</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-800 font-mono text-xs text-blue-400 transition-colors hover:bg-slate-700">
              --
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
