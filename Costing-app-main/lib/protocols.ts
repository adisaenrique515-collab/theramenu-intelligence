// src/lib/protocols.ts
import type { RecipeData } from "../types";

export type RuleType = "numeric_threshold" | "contains_any" | "excludes_all" | "keyword_flag" | "texture_allow_list";

export interface Rule {
  id: string;
  type: RuleType;
  subject: "meal_totals" | "ingredients" | "meal_meta";
  path: string;
  operator: "<=" | ">=" | "=" | "!=" | "includes" | "excludes";
  value: any;
  severity: "info" | "warning" | "critical";
  message: string;
  suggestion?: string;
}

export interface ProtocolDef {
  id: string;
  name: string;
  category: string;
  triggers: string[];
  rules: Rule[];
}

export interface ProtocolDataset {
  version: string;
  updated?: string;
  protocols: ProtocolDef[];
}

export interface LexiconsDataset {
  version: string;
  [k: string]: any;
}

export interface BudgetsDataset {
  version: string;
  budgets: Record<string, number>;
}

export interface EvaluationFinding {
  protocolId: string;
  ruleId: string;
  severity: "info" | "warning" | "critical";
  message: string;
  suggestion?: string;
  matched?: string[];
  value?: number | string | null;
}

export interface LoadedProtocols {
  protocols: ProtocolDataset;
  lexicons: LexiconsDataset;
  budgets: BudgetsDataset | null;
}

const norm = (s: any) => String(s ?? "").toLowerCase().trim();

const getAtPath = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as any)[p];
  }
  return cur;
};

export async function loadProtocols(): Promise<LoadedProtocols> {
  const [protocols, lexicons, budgets] = await Promise.all([
    fetch("/protocols/clinical_protocols.json").then(r => r.json()),
    fetch("/protocols/lexicons.json").then(r => r.json()),
    fetch("/protocols/default_budgets.json").then(r => r.json()).catch(() => null)
  ]);
  return { protocols, lexicons, budgets } as LoadedProtocols;
}

export function parseFlagsFromLocation(loc: Location): string[] {
  const usp = new URLSearchParams(loc.search);
  const raw = usp.get("flags");
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function evaluateMeal(recipe: RecipeData, patientFlags: string[], ds: LoadedProtocols): EvaluationFinding[] {
  const findings: EvaluationFinding[] = [];
  const protos = ds.protocols?.protocols || [];

  // Normalize ingredient names
  const ingNames = (recipe.ingredients || []).map(i => norm(i.name));

  for (const p of protos) {
    if (p.triggers && p.triggers.length > 0) {
      const anyTrig = p.triggers.some(t => patientFlags.includes(t));
      if (!anyTrig) continue; // respect triggers
    }

    for (const r of (p.rules || [])) {
      if (r.subject === "ingredients" && (r.type === "contains_any" || r.type === "keyword_flag")) {
        const vals: string[] = Array.isArray(r.value) ? r.value : [r.value];
        const nv = vals.map(norm);
        const matched = ingNames.filter(n => nv.some(v => n.includes(v)));
        if (matched.length > 0) {
          findings.push({ protocolId: p.id, ruleId: r.id, severity: r.severity, message: r.message, suggestion: r.suggestion, matched });
        }
      } else if (r.subject === "meal_totals" && r.type === "numeric_threshold") {
        const v = getAtPath(recipe as any, r.path) ?? getAtPath((recipe as any).analysis || {}, r.path);
        if (typeof v === "number") {
          const n = Number(r.value);
          let hit = false;
          if (r.operator === "<=") hit = !(v <= n);
          else if (r.operator === ">=") hit = !(v >= n);
          else if (r.operator === "=") hit = !(v === n);
          else if (r.operator === "!=") hit = !(v !== n);
          if (hit) findings.push({ protocolId: p.id, ruleId: r.id, severity: r.severity, message: r.message, suggestion: r.suggestion, value: v });
        }
      } else if (r.subject === "meal_meta" && r.type === "texture_allow_list") {
        const v = getAtPath(recipe as any, r.path);
        if (typeof v === "string") {
          if (r.operator === "=" && norm(v) !== norm(r.value)) {
            findings.push({ protocolId: p.id, ruleId: r.id, severity: r.severity, message: r.message, suggestion: r.suggestion, value: v });
          }
        }
      }
    }
  }

  return findings;
}
