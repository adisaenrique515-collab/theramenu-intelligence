import { Card, StateView } from "./ui";
import type { CalcTargetsResponse } from "@/lib/api";

type Status = NonNullable<CalcTargetsResponse["approvalStatus"]>;

const STATUS_TONE: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

/**
 * Renders backend-supplied clinical targets and protocol metadata.
 *
 * The component is purely presentational: every value, label, warning and
 * status badge comes from `response`. It never derives, formats clinical
 * thresholds, or infers approval state.
 */
export function ClinicalTargetsPreview({
  response,
  loading = false,
  error = null,
  title = "Clinical Targets",
}: {
  response: CalcTargetsResponse | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
}) {
  return (
    <Card className="p-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <Body response={response} loading={loading} error={error} />
    </Card>
  );
}

function Body({
  response,
  loading,
  error,
}: {
  response: CalcTargetsResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <StateView
        compact
        kind="error"
        title="Could not load targets"
        description={error}
      />
    );
  }
  if (loading) {
    return <StateView compact kind="loading" title="Loading clinical targets…" />;
  }
  if (!response) {
    return (
      <StateView
        compact
        kind="empty"
        title="No targets available"
        description="The backend has not returned targets for this patient yet."
      />
    );
  }

  const { targets, protocol, approvalStatus, warnings } = response;
  const entries = Object.entries(targets) as Array<[string, number | string]>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] text-slate-500">
          Protocol <span className="text-slate-700">{protocol.id}</span> · v
          {protocol.version}
        </div>
        {approvalStatus && (
          <span
            className={
              "rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide " +
              STATUS_TONE[approvalStatus]
            }
          >
            {approvalStatus.replace("_", " ")}
          </span>
        )}
      </div>

      <dl className="space-y-3">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-baseline justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0"
          >
            <dt className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
              {key}
            </dt>
            <dd className="font-mono text-base font-semibold text-slate-900">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>

      {warnings && warnings.length > 0 && (
        <StateView
          compact
          kind="warning"
          title="Backend warnings"
          items={warnings}
        />
      )}
    </div>
  );
}