import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  number?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  number,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const sectionTitleClass = 'text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic';

  return (
    <section className="space-y-6 border border-slate-100 rounded-lg p-6 hover:border-blue-200 transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          {number && <span className="text-xl font-black text-slate-300 group-hover:text-blue-400 transition-colors">{number}</span>}
          <div className="text-left">
            <h3 className={`${sectionTitleClass} group-hover:text-blue-600 transition-colors`}>{title}</h3>
            {subtitle && <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-1">{subtitle}</p>}
          </div>
        </div>
        <i
          className={`fas fa-chevron-down text-slate-400 group-hover:text-blue-500 transition-all transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        ></i>
      </button>

      {isOpen && <div className="space-y-6 pt-2">{children}</div>}
    </section>
  );
};

export default CollapsibleSection;
