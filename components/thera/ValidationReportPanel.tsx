import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, StateView } from "./ui";
import type {
  ValidatePlanResponse,
  ValidationIssue,
  ValidationSeverity,
} from "./types";

/**
 * Renders a backend ValidatePlanResponse. The component never derives,
 * formats, or invents clinical reasoning — only the fields present on
 * the response are displayed.
 */
export function ValidationReportPanel({
  response,
  loading = false,
  error = null,
  title = "Validation Report",
  actions,
}: {
  response: ValidatePlanResponse | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        {actions}
      </div>
      <Body response={response} loading={loading} error={error} />
    </Card>
  );
}

const SEVERITY_ORDER: ValidationSeverity[] = ["blocker", "warning", "info"];
const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  blocker: "Blocker issues",
  warning: "Warnings",
  info: "Information",
};
const SEVERITY_STYLES: Record<
  ValidationSeverity,
  { wrap: string; chip: string; Icon: typeof AlertOctagon }
> = {
  blocker: {
    wrap: "border-red-300 bg-red-50/60",
    chip: "bg-red-100 text-red-800",
    Icon: AlertOctagon,
  },
  warning: {
    wrap: "border-amber-300 bg-amber-50/60",
    chip: "bg-amber-100 text-amber-800",
    Icon: AlertTriangle,
  },
  info: {
    wrap: "border-slate-200 bg-slate-50/60",
    chip: "bg-slate-100 text-slate-700",
    Icon: Info,
  },
};

function Body({
  response,
  loading,
  error,
}: {
  response: ValidatePlanResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <StateView
        compact
        kind="error"
        title="Validation failed"
        description={error}
      />
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span role="status" aria-live="polite">
          Validating plan…
        </span>
      </div>
    );
  }
  if (!response) {
    return (
      <StateView
        compact
        kind="empty"
        title="No validation report"
        description="The backend has not returned a validation report for this plan yet."
      />
    );
  }

  if (response.issues.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3"
      >
        <CheckCircle2
          className="mt-0.5 h-5 w-5 text-emerald-700"
          aria-hidden
        />
        <div>
          <div className="text-sm font-semibold text-emerald-900">
            Validation passed
          </div>
          <div className="text-xs text-emerald-800">
            The backend reports no issues for the current plan.
          </div>
        </div>
      </div>
    );
  }

  const groups: Record<ValidationSeverity, ValidationIssue[]> = {
    blocker: [],
    warning: [],
    info: [],
  };
  for (const issue of response.issues) groups[issue.severity].push(issue);

  return (
    <div className="space-y-3">
      <Summary response={response} counts={groups} />
      {SEVERITY_ORDER.map((sev) =>
        groups[sev].length === 0 ? null : (
          <SeverityGroup key={sev} severity={sev} issues={groups[sev]} />
        ),
      )}
    </div>
  );
}

function Summary({
  response,
  counts,
}: {
  response: ValidatePlanResponse;
  counts: Record<ValidationSeverity, ValidationIssue[]>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {SEVERITY_ORDER.map((sev) => {
        const n = counts[sev].length;
        if (n === 0) return null;
        const { chip, Icon } = SEVERITY_STYLES[sev];
        return (
          <span
            key={sev}
            className={"inline-flex items-center gap-1 rounded px-2 py-0.5 " + chip}
          >
            <Icon className="h-3 w-3" aria-hidden />
            <span className="sr-only">{SEVERITY_LABEL[sev]}: </span>
            {n} {sev}
          </span>
        );
      })}
      <span className="ml-auto font-mono text-[10px] text-slate-500">
        protocol {response.protocol.id} · v{response.protocol.version}
      </span>
    </div>
  );
}

function SeverityGroup({
  severity,
  issues,
}: {
  severity: ValidationSeverity;
  issues: ValidationIssue[];
}) {
  const { wrap, chip, Icon } = SEVERITY_STYLES[severity];
  return (
    <section className={"rounded-md border p-3 " + wrap}>
      <header className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden />
        <h4 className="text-xs font-semibold uppercase tracking-wide">
          {SEVERITY_LABEL[severity]}
          <span
            className={"ml-2 rounded px-1.5 py-0.5 font-mono text-[10px] " + chip}
          >
            {issues.length}
          </span>
        </h4>
      </header>
      <ul className="space-y-2">
        {issues.map((issue, i) => (
          <IssueRow key={`${issue.code}-${i}`} issue={issue} />
        ))}
      </ul>
    </section>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const path = [issue.day, issue.mealTime, issue.slot]
    .filter(Boolean)
    .join(" › ");
  const hasMetric =
    issue.observedValue !== undefined || issue.expectedValue !== undefined;
  return (
    <li className="rounded border border-current/10 bg-white p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-slate-900">{issue.message}</div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-500">
          {issue.code}
        </span>
      </div>
      {path && (
        <div className="mt-1 font-mono text-[10px] text-slate-500">{path}</div>
      )}
      {issue.clinicalReason && (
        <div className="mt-1 text-slate-700">{issue.clinicalReason}</div>
      )}
      {hasMetric && (
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-700">
          {issue.observedValue !== undefined && (
            <div>
              <dt className="inline text-slate-500">observed: </dt>
              <dd className="inline">
                {String(issue.observedValue)}
                {issue.unit ? ` ${issue.unit}` : ""}
              </dd>
            </div>
          )}
          {issue.expectedValue !== undefined && (
            <div>
              <dt className="inline text-slate-500">expected: </dt>
              <dd className="inline">
                {String(issue.expectedValue)}
                {issue.unit ? ` ${issue.unit}` : ""}
              </dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}
