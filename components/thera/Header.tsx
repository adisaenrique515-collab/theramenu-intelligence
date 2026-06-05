import type { ReactNode } from "react";

export type TabKey =
  | "generator"
  | "plan"
  | "diagnosis"
  | "screening"
  | "compliance"
  | "kitchen"
  | "audit"
  | "ai";

const TABS: { key: TabKey; label: string }[] = [
  { key: "generator", label: "Generator" },
  { key: "plan", label: "Plan" },
  { key: "diagnosis", label: "Diagnosis DB" },
  { key: "screening", label: "Screening" },
  { key: "compliance", label: "Compliance" },
  { key: "kitchen", label: "Kitchen Output" },
  { key: "audit", label: "Audit Trail" },
  { key: "ai", label: "Dietitian AI" },
];

export function Header({
  active,
  onChange,
  rightSlot,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  rightSlot?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              TheraMenu
            </h1>
            <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-300">
              v1.0
            </span>
            <span className="hidden text-sm text-slate-400 sm:block">
              Clinical Dietary Intelligence
            </span>
          </div>
          {rightSlot}
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-2" aria-label="Primary">
          {TABS.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={
                  "min-h-[44px] whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white")
                }
                aria-current={isActive ? "page" : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}