import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { PlanValidationStatus } from "./types";

const STATUS: Record<
  PlanValidationStatus,
  { label: string; icon: typeof CheckCircle2; cls: string; aria: string }
> = {
  pending: {
    label: "Validation pending",
    icon: Loader2,
    cls: "border-slate-200 bg-slate-50 text-slate-700",
    aria: "Validation pending",
  },
  passed: {
    label: "Validation passed",
    icon: CheckCircle2,
    cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
    aria: "Validation passed",
  },
  warnings: {
    label: "Validation warnings",
    icon: AlertTriangle,
    cls: "border-amber-200 bg-amber-50 text-amber-900",
    aria: "Validation warnings present",
  },
  blocked: {
    label: "Validation blocked",
    icon: Ban,
    cls: "border-red-200 bg-red-50 text-red-800",
    aria: "Validation blocked",
  },
};

/**
 * Presentational badge for backend-reported validation status. Uses icon +
 * text so status is not conveyed by color alone.
 */
export function ValidationStatusBadge({
  status,
  className = "",
}: {
  status?: PlanValidationStatus | null;
  className?: string;
}) {
  if (!status) return null;
  const s = STATUS[status];
  const Icon = s.icon;
  const spin = status === "pending" ? "animate-spin" : "";
  return (
    <span
      role="status"
      aria-label={s.aria}
      className={
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider " +
        s.cls +
        " " +
        className
      }
    >
      <Icon className={"h-3 w-3 " + spin} aria-hidden />
      <span>{s.label}</span>
    </span>
  );
}
