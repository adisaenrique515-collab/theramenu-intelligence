import { CheckCircle2, Clock, FileEdit, XCircle } from "lucide-react";
import type { PlanReviewStatus } from "@/lib/types";
import { Card } from "./ui";

const STATUS: Record<
  PlanReviewStatus,
  {
    label: string;
    description: string;
    icon: typeof CheckCircle2;
    cls: string;
    iconCls: string;
  }
> = {
  draft: {
    label: "Draft",
    description: "Plan has not yet been submitted for dietitian review.",
    icon: FileEdit,
    cls: "border-slate-300 bg-slate-50",
    iconCls: "text-slate-600",
  },
  pending_review: {
    label: "Pending dietitian review",
    description: "Awaiting clinical sign-off before export.",
    icon: Clock,
    cls: "border-amber-300 bg-amber-50/60",
    iconCls: "text-amber-700",
  },
  approved: {
    label: "Approved",
    description: "Dietitian sign-off complete.",
    icon: CheckCircle2,
    cls: "border-emerald-300 bg-emerald-50/60",
    iconCls: "text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    description: "Dietitian rejected this plan.",
    icon: XCircle,
    cls: "border-red-300 bg-red-50/60",
    iconCls: "text-red-700",
  },
};

/**
 * Presentational card showing the backend-reported dietitian sign-off
 * status. Pure display — never mutates state or infers status.
 */
export function SignOffStatusCard({
  status,
  reviewer,
  signedAt,
  notes,
}: {
  status?: PlanReviewStatus | null;
  reviewer?: string;
  signedAt?: string;
  notes?: string;
}) {
  if (!status) return null;
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <Card className={"flex items-start gap-3 border p-4 " + s.cls}>
      <Icon className={"mt-0.5 h-6 w-6 shrink-0 " + s.iconCls} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {s.label}
          </span>
          <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-700">
            {status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-700">{s.description}</p>
        {(reviewer || signedAt) && (
          <dl className="mt-2 grid grid-cols-1 gap-1 font-mono text-[11px] text-slate-600 sm:grid-cols-2">
            {reviewer && (
              <div>
                <dt className="inline text-slate-500">Reviewer · </dt>
                <dd className="inline text-slate-900">{reviewer}</dd>
              </div>
            )}
            {signedAt && (
              <div>
                <dt className="inline text-slate-500">Signed · </dt>
                <dd className="inline text-slate-900">
                  {new Date(signedAt).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        )}
        {notes && (
          <p className="mt-2 rounded border border-slate-200 bg-white/70 p-2 text-xs italic text-slate-700">
            {notes}
          </p>
        )}
      </div>
    </Card>
  );
}