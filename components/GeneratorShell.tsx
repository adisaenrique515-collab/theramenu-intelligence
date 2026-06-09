import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardCheck,
  Database,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Badge, Button, Card, StateView } from './thera/ui';
import { isCloudflareMode } from '../utils/appMode';
import { ProtocolPanel } from './ProtocolPanel';

interface ComputedTargets {
  label: string;
  value: string;
}

function buildGenerationSummary(p: Record<string, unknown>): ComputedTargets[] {
  const diagnosis = typeof p.diagnosis === 'string' && p.diagnosis ? p.diagnosis : 'Awaiting diagnosis';
  const texture = typeof p.textureLevel === 'string' && p.textureLevel ? p.textureLevel : 'Form default';
  const mealCount = Number(p.mealCount);
  const riskLevel = typeof p.riskLevel === 'string' && p.riskLevel ? p.riskLevel : 'Form default';

  return [
    { label: 'Diagnosis route', value: diagnosis },
    { label: 'Texture', value: texture },
    { label: 'Meals per day', value: Number.isFinite(mealCount) && mealCount > 0 ? String(mealCount) : 'Form default' },
    { label: 'Risk level', value: riskLevel },
  ];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="font-mono text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

interface GeneratorShellProps {
  form: React.ReactNode;
  resultSlot: React.ReactNode;
  mobileView: 'form' | 'result';
  onBackToForm: () => void;
  error: string | null;
  loading: boolean;
  hasResult: boolean;
  lastPatientData: Record<string, unknown>;
  nrsSlot?: React.ReactNode;
  onScreeningClick?: () => void;
}

export default function GeneratorShell({
  form,
  resultSlot,
  mobileView,
  onBackToForm,
  error,
  loading,
  hasResult,
  lastPatientData,
  nrsSlot,
  onScreeningClick,
}: GeneratorShellProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const generationSummary = buildGenerationSummary(lastPatientData);
  const showSidebar = !hasResult && !loading;
  const diagnosis = typeof lastPatientData.diagnosis === 'string' ? lastPatientData.diagnosis : undefined;

  return (
    <>
      {nrsSlot}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section
          className={`no-print space-y-5 lg:sticky lg:top-28 ${
            sidebarCollapsed ? 'lg:col-span-4' : 'lg:col-span-5'
          } ${mobileView === 'result' ? 'hidden lg:block' : ''}`}
        >
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Workflow Input</p>
              <h1 className="text-base font-semibold text-slate-900">Clinical Generator</h1>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="hidden min-h-9 px-2 lg:inline-flex"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? 'Expand generator sidebar' : 'Collapse generator sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelRightOpen className="h-4 w-4" aria-hidden />
              ) : (
                <PanelRightClose className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>

          {!sidebarCollapsed && (
            <Card accent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Document Intake</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Upload a referral or menu document to pre-fill the patient form.
                  </p>
                </div>
                <Badge tone="blue">Step 1</Badge>
              </div>

              <label
                htmlFor="doc-file-input"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
              >
                <Upload className="mb-3 h-7 w-7 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Drop a PDF or image, or click to browse</span>
                <span className="mt-1 text-xs text-slate-500">PDF, JPG, PNG - max 20 MB</span>
                {fileName && (
                  <span className="mt-3 inline-flex items-center gap-2 rounded bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
                    <FileText className="h-3.5 w-3.5" />
                    {fileName}
                  </span>
                )}
                <input
                  ref={fileRef}
                  id="doc-file-input"
                  type="file"
                  accept="application/pdf,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFileName(f.name);
                      setExtracted(false);
                    }
                  }}
                />
              </label>

              {fileName && (
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setExtracted(true)}
                    className="min-h-9 px-3 text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Extract Data
                  </Button>
                  {extracted && (
                    <span className="text-xs text-emerald-700">
                      Document queued. Fill patient fields manually for now.
                    </span>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card accent className={sidebarCollapsed ? 'p-4' : 'p-5'}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Patient Profile</h2>
                {sidebarCollapsed && (
                  <p className="mt-1 text-xs text-slate-500">Document intake hidden. Patient form remains active.</p>
                )}
              </div>
              <Badge tone="blue">Step 2</Badge>
            </div>
            {form}
            {error && (
              <div className="mt-4">
                <StateView compact kind="error" title="Clinical Exception" description={error} />
              </div>
            )}
          </Card>
        </section>

        <section className={`${sidebarCollapsed ? 'lg:col-span-8' : 'lg:col-span-7'} ${mobileView === 'form' ? 'hidden lg:block' : ''}`}>
          {mobileView === 'result' && (
            <div className="mb-4 lg:hidden">
              <Button type="button" variant="secondary" onClick={onBackToForm} className="w-full">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to generator inputs
              </Button>
            </div>
          )}

          {showSidebar ? (
            <div className="space-y-4">
              <ProtocolPanel diagnosis={diagnosis} />

              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Generation Summary
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Uses the current TheraMenu clinical protocol engine. Target math is shown after generation from
                      the produced plan.
                    </p>
                  </div>
                  <Badge tone="blue">Read only</Badge>
                </div>
                <dl className="space-y-4">
                  {generationSummary.map((item) => (
                    <Stat key={item.label} label={item.label} value={item.value} />
                  ))}
                </dl>
                <p className="mt-6 text-xs leading-5 text-slate-500">
                  Meal plans remain in draft status until dietitian review. Kitchen Output is gated by approval.
                </p>
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Dataset Status</h3>
                </div>
                <p className="text-sm text-slate-700">
                  <span className="font-mono text-lg font-semibold text-slate-900">
                    {isCloudflareMode ? 'Supabase' : 'Local'}
                  </span>{' '}
                  clinical engine ready. Protocol previews are read-only in this milestone.
                </p>
              </Card>

              <StateView
                kind="empty"
                title="Protocol Pending"
                description="Submit a diagnosis to generate a comprehensive weekly nutritional strategy."
                actions={
                  onScreeningClick && (
                    <Button type="button" variant="secondary" onClick={onScreeningClick}>
                      <ClipboardCheck className="h-4 w-4" aria-hidden />
                      Complete NRS-2002 screening first
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            resultSlot
          )}
        </section>
      </div>
    </>
  );
}
