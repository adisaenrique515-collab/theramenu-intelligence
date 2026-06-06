import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Stethoscope } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ProtocolCode, ProtocolConfig } from '../types';
import { getActiveProtocolCodes, getProtocolConfig } from '../services/protocolAdapter';
import { Badge, Button, Card } from './thera/ui';

const DIAGNOSIS_TO_PROTOCOL: Record<string, ProtocolCode> = {
  CARDIAC: 'CARDIAC',
  RENAL: 'RENAL_STAGE_3',
  DIABETIC: 'T2DM',
  GASTRIC: 'GASTRIC',
  'LOW FAT': 'GENERAL_HOSPITAL',
  'H. PYLORI': 'H_PYLORI',
  HEPATIC: 'HEPATIC',
  'PEPTIC ULCER': 'PEPTIC_ULCER',
  'POST-OPERATIVE': 'GENERAL_HOSPITAL',
};

function loadProtocol(code: ProtocolCode): ProtocolConfig | null {
  try {
    return getProtocolConfig(code);
  } catch {
    return null;
  }
}

function CompactTarget({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export function ProtocolPanel({ diagnosis }: { diagnosis?: string }) {
  const [expanded, setExpanded] = useState(true);
  const activeCodes = useMemo(() => getActiveProtocolCodes(), []);
  const protocolCode = diagnosis ? DIAGNOSIS_TO_PROTOCOL[diagnosis] : undefined;
  const config = protocolCode ? loadProtocol(protocolCode) : null;
  const preferCount = config?.foodRules.filter((rule) => rule.rule_type === 'prefer').length ?? 0;
  const avoidCount = config?.foodRules.filter((rule) => rule.rule_type === 'avoid').length ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Stethoscope className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">Protocol Panel</h3>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Client schema registry
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-9 px-2"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'Collapse protocol panel' : 'Expand protocol panel'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={config ? 'emerald' : 'slate'}>{config ? 'protocol loaded' : 'awaiting diagnosis'}</Badge>
            <Badge tone="blue">{activeCodes.length} active protocols</Badge>
          </div>

          {config ? (
            <>
              <div>
                <p className="text-base font-semibold text-slate-900">{config.protocol.protocol_name}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-slate-500">
                  {config.protocol.protocol_code} / {config.protocol.family}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-2">
                <CompactTarget label="Texture" value={config.protocol.default_texture} />
                <CompactTarget label="Meals" value={`${config.protocol.default_meal_count}/day`} />
                <CompactTarget label="Sodium" value={`${config.targets.sodium_max_mg} mg`} />
                <CompactTarget label="Fiber" value={`${config.targets.fiber_min_g} g min`} />
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Prefer rules</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-900">{preferCount}</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700">Avoid rules</p>
                  <p className="mt-1 text-lg font-semibold text-amber-900">{avoidCount}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Select a diagnosis in the intake form to preview the active protocol, targets, and food-rule counts.
            </div>
          )}

          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-xs leading-5 text-slate-600">
              This panel reads the same client-side schema currently used by production generation. It does not change
              food eligibility, scoring, or nutrient calculations.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            <span>Derived from current therapeutic schema adapter data.</span>
          </div>
        </div>
      )}
    </Card>
  );
}
