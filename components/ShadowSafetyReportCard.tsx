import { AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert } from 'lucide-react';
import type { ShadowSafetyGateResult, ShadowSafetyGateStatus, ShadowSafetyReport } from '../types';
import { Badge, Card } from './thera/ui';

function statusTone(status: ShadowSafetyGateStatus): 'slate' | 'blue' | 'emerald' | 'amber' | 'red' {
  if (status === 'pass') return 'emerald';
  if (status === 'block') return 'red';
  if (status === 'warn') return 'amber';
  if (status === 'pending') return 'blue';
  return 'slate';
}

function statusIcon(status: ShadowSafetyGateStatus) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (status === 'block') return <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden />;
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />;
  if (status === 'pending') return <Clock className="h-4 w-4 text-blue-600" aria-hidden />;
  return <Info className="h-4 w-4 text-slate-500" aria-hidden />;
}

function formatStatus(status: ShadowSafetyGateStatus): string {
  return status.replace('_', ' ');
}

function GateCard({ gate }: { gate: ShadowSafetyGateResult }) {
  return (
    <Card className="bg-slate-50 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {statusIcon(gate.status)}
          <p className="min-w-0 text-xs font-semibold text-slate-900">{gate.label}</p>
        </div>
        <Badge tone={statusTone(gate.status)}>{formatStatus(gate.status)}</Badge>
      </div>
      <p className="text-xs leading-5 text-slate-600">{gate.summary}</p>
      {gate.findings.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] leading-4 text-slate-500">
          {gate.findings.slice(0, 3).map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ShadowSafetyReportCard({ report }: { report: ShadowSafetyReport }) {
  const counts = report.gates.reduce<Record<ShadowSafetyGateStatus, number>>(
    (acc, gate) => {
      acc[gate.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, block: 0, pending: 0, not_configured: 0 },
  );

  return (
    <Card className="space-y-4 border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="amber">Not enforced</Badge>
            <Badge tone={statusTone(report.overallStatus)}>{formatStatus(report.overallStatus)}</Badge>
          </div>
          <h2 className="text-base font-semibold text-slate-900">{report.disclaimer}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            These checks are advisory in Phase S1. They do not block generation, approval, printability,
            Kitchen Output, PDF export, persistence, or candidate selection.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">{counts.pass} pass</Badge>
          <Badge tone="amber">{counts.warn} warn</Badge>
          <Badge tone="red">{counts.block} shadow block</Badge>
          <Badge tone="blue">{counts.pending} pending</Badge>
          <Badge tone="slate">{counts.not_configured} not configured</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report.gates.map((gate) => (
          <GateCard key={gate.code} gate={gate} />
        ))}
      </div>
    </Card>
  );
}
