import type { PlanMetadata } from "@/lib/api";
import type { PlanReviewStatus } from "@/lib/types";
import { Card } from "./ui";
import { ProtocolVersionBadge } from "./ProtocolVersionBadge";
import { FoodDatabaseVersionBadge } from "./FoodDatabaseVersionBadge";
import { ValidationStatusBadge } from "./ValidationStatusBadge";
import { SignOffStatusCard } from "./SignOffStatusCard";

/**
 * Aggregated, presentational view for dietitian review.
 *
 * Displays only backend-provided metadata — protocol/food-DB/engine
 * versions, validation status, deterministic plan hash, alignment score,
 * generation timestamp and sign-off status. Renders nothing it has to
 * infer.
 */
export function DietitianReviewPanel({
  metadata,
  patientCode,
  signOffStatus,
  reviewer,
  signedAt,
  notes,
  title = "Dietitian Review",
}: {
  metadata?: PlanMetadata | null;
  patientCode?: string;
  /** Optional override; otherwise derived from metadata.signOffStatus. */
  signOffStatus?: PlanReviewStatus;
  reviewer?: string;
  signedAt?: string;
  notes?: string;
  title?: string;
}) {
  const status = signOffStatus ?? metadata?.signOffStatus;
  return (
    <Card accent className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h3>
          {patientCode && (
            <p className="font-mono text-[11px] text-slate-500">
              Patient {patientCode}
            </p>
          )}
        </div>
        {metadata && (
          <ValidationStatusBadge status={metadata.validationStatus} />
        )}
      </header>

      {metadata && (
        <div className="flex flex-wrap gap-2">
          <ProtocolVersionBadge version={metadata.protocolVersion} />
          <FoodDatabaseVersionBadge version={metadata.foodDatabaseVersion} />
          <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-700">
            <span>Engine</span>
            <span className="text-slate-900">{metadata.engineVersion}</span>
          </span>
        </div>
      )}

      {metadata && (
        <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Generated
            </dt>
            <dd className="font-mono text-slate-900">
              {new Date(metadata.generatedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Plan Hash
            </dt>
            <dd className="font-mono text-slate-900 break-all">
              {metadata.planHash}
            </dd>
          </div>
          {typeof metadata.clinicalAlignmentScore === "number" && (
            <div className="sm:col-span-2">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Clinical Alignment Score
              </dt>
              <dd className="flex items-center gap-2">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(
                    metadata.clinicalAlignmentScore * 100,
                  )}
                >
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${Math.max(0, Math.min(100, metadata.clinicalAlignmentScore * 100))}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-slate-900">
                  {(metadata.clinicalAlignmentScore * 100).toFixed(0)}%
                </span>
              </dd>
            </div>
          )}
          {metadata.exportBlocked && (
            <div className="sm:col-span-2">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-red-700">
                Export Blocked
              </dt>
              <dd className="text-red-800">
                {metadata.exportBlockedReasons &&
                metadata.exportBlockedReasons.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {metadata.exportBlockedReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <span>Export is currently blocked by the backend.</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      <SignOffStatusCard
        status={status}
        reviewer={reviewer ?? metadata?.signOffReviewer}
        signedAt={signedAt ?? metadata?.signOffAt}
        notes={notes}
      />
    </Card>
  );
}