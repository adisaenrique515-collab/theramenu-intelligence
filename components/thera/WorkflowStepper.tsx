import {
  ClipboardList,
  Stethoscope,
  Database,
  Sparkles,
  ShieldCheck,
  UserCheck,
  ChefHat,
  History,
} from "lucide-react";
import type { TabKey } from "./Header";
import type { GeneratedPlan } from "@/lib/types";

type Step = {
  key: string;
  label: string;
  tab: TabKey;
  icon: typeof ClipboardList;
};

const STEPS: Step[] = [
  { key: "assess", label: "Patient Assessment", tab: "generator", icon: ClipboardList },
  { key: "protocol", label: "Clinical Protocol", tab: "generator", icon: Stethoscope },
  { key: "foods", label: "Approved Foods", tab: "diagnosis", icon: Database },
  { key: "generate", label: "Slot Generation", tab: "plan", icon: Sparkles },
  { key: "validate", label: "Nutrient & Texture Validation", tab: "compliance", icon: ShieldCheck },
  { key: "review", label: "Dietitian Review", tab: "plan", icon: UserCheck },
  { key: "kitchen", label: "Kitchen-Ready Output", tab: "kitchen", icon: ChefHat },
  { key: "audit", label: "Audit Trail", tab: "audit", icon: History },
];

function currentStepIndex(activeTab: TabKey, plan: GeneratedPlan | null): number {
  if (activeTab === "audit") return 7;
  if (activeTab === "kitchen") return 6;
  if (activeTab === "compliance") return 4;
  if (activeTab === "diagnosis" || activeTab === "screening") return 2;
  if (activeTab === "plan") {
    if (plan?.reviewStatus === "approved" || plan?.reviewStatus === "rejected") return 5;
    if (plan) return 3;
    return 3;
  }
  if (activeTab === "ai") return 5;
  return 0;
}

export function WorkflowStepper({
  activeTab,
  plan,
  onJump,
}: {
  activeTab: TabKey;
  plan: GeneratedPlan | null;
  onJump: (t: TabKey) => void;
}) {
  const current = currentStepIndex(activeTab, plan);
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < current;
          const active = i === current;
          return (
            <div key={s.key} className="flex items-center">
              <button
                onClick={() => onJump(s.tab)}
                className={
                  "group flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors " +
                  (active
                    ? "bg-blue-50 text-blue-700"
                    : done
                      ? "text-emerald-700 hover:bg-emerald-50"
                      : "text-slate-500 hover:bg-slate-50")
                }
                title={`Go to ${s.label}`}
              >
                <span
                  className={
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold " +
                    (active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : done
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300 bg-white text-slate-500")
                  }
                >
                  {done ? "✓" : i + 1}
                </span>
                <Icon className="h-3.5 w-3.5 opacity-70" />
                <span className="font-mono uppercase tracking-wider">
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={
                    "mx-1 h-px w-4 " +
                    (i < current ? "bg-emerald-400" : "bg-slate-200")
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}