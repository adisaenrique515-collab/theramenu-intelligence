import { History } from "lucide-react";
import type { AuditSummary } from "./types";
import { Card, StateView } from "./ui";

/**
 * Presentational summary of a backend-provided audit roll-up.
 *
 * Shows totals, last-event timestamp and per-event-type counts exactly as
 * the backend returns them. Never recomputes counts on the client.
 */
export function AuditSummaryCard({
  summary,
  loading = false,
  error = null,
  title = "Audit Summary",
}: {
  summary?: AuditSummary | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
}) {
  return (
    <Card accent className="p-5">
      <header className="mb-3 flex items-center gap-3">
        <History className="h-5 w-5 text-blue-600" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h3>
          {summary?.patientCode && (
            <p className="font-mono text-[11px] text-slate-500">
              Patient {summary.patientCode}
            </p>
          )}
        </div>
      </header>

      {error ? (
        <StateView
          compact
          kind="error"
          title="Could not load audit summary"
          description={error}
        />
      ) : loading ? (
        <StateView compact kind="loading" title="Loading audit summary…" />
      ) : !summary || summary.totals.total === 0 ? (
        <StateView
          compact
          kind="empty"
          title="No audit activity yet"
          description="Workflow events will appear here once the backend records them."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Total events
              </div>
              <div className="font-mono text-xl font-semibold text-slate-900">
                {summary.totals.total}
              </div>
            </div>
            {summary.lastEventAt && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Last event
                </div>
                <div className="font-mono text-xs text-slate-900">
                  {new Date(summary.lastEventAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {summary.totals.byEventType &&
            Object.keys(summary.totals.byEventType).length > 0 && (
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  Events by type
                </div>
                <ul className="flex flex-wrap gap-2">
                  {Object.entries(summary.totals.byEventType).map(([k, v]) => (
                    <li
                      key={k}
                      className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700"
                    >
                      <span>{k}</span>
                      <span className="text-slate-900">· {v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </Card>
  );
}
