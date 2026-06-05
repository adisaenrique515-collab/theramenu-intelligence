import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card } from "./ui";

/**
 * Renders backend-determined export eligibility and an export action.
 *
 * The component does not decide eligibility — `exportBlocked`, `reasons`,
 * and the button's behaviour come from the parent (which derives them from
 * a backend response). Status is conveyed through icons, labels, and
 * accessible text in addition to color.
 */
export function ExportStatusCard({
  exportBlocked,
  reasons = [],
  onExport,
  exporting = false,
  actionLabel = "Print / Save PDF",
  blockedTitle = "Export blocked",
  allowedTitle = "Export allowed",
  blockedDescription,
  allowedDescription,
  extra,
}: {
  exportBlocked: boolean;
  reasons?: string[];
  onExport?: () => void;
  exporting?: boolean;
  actionLabel?: string;
  blockedTitle?: string;
  allowedTitle?: string;
  blockedDescription?: ReactNode;
  allowedDescription?: ReactNode;
  extra?: ReactNode;
}) {
  const blocked = exportBlocked;
  const Icon = blocked ? ShieldAlert : ShieldCheck;
  const wrap = blocked
    ? "border-red-300 bg-red-50/60"
    : "border-emerald-300 bg-emerald-50/60";
  const iconColor = blocked ? "text-red-700" : "text-emerald-700";
  const titleColor = blocked ? "text-red-900" : "text-emerald-900";
  const subColor = blocked ? "text-red-800" : "text-emerald-800";
  const statusText = blocked ? blockedTitle : allowedTitle;

  return (
    <Card className={"flex flex-col gap-3 border p-4 " + wrap}>
      <div
        className="flex items-start gap-3"
        role="status"
        aria-live="polite"
      >
        <Icon className={"mt-0.5 h-6 w-6 " + iconColor} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className={"flex items-center gap-2 text-sm font-semibold " + titleColor}>
            <span>{statusText}</span>
            <span
              className={
                "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide " +
                (blocked
                  ? "bg-red-100 text-red-800"
                  : "bg-emerald-100 text-emerald-800")
              }
            >
              {blocked ? "blocked" : "allowed"}
            </span>
          </div>
          {(blocked ? blockedDescription : allowedDescription) && (
            <div className={"mt-1 text-xs " + subColor}>
              {blocked ? blockedDescription : allowedDescription}
            </div>
          )}
          {blocked && reasons.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-900">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span aria-hidden className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-red-700" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {!blocked && reasons.length === 0 && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              <span>All checks passed.</span>
            </div>
          )}
        </div>
      </div>

      {(onExport || extra) && (
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          {extra}
          {onExport && (
            <Button
              variant="primary"
              onClick={onExport}
              disabled={blocked || exporting}
              aria-disabled={blocked || exporting}
              title={blocked ? reasons.join(" · ") : undefined}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {exporting ? "Requesting export…" : actionLabel}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}