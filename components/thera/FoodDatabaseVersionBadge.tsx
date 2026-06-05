import { Database } from "lucide-react";

/**
 * Presentational badge displaying the backend-reported food database
 * version. Renders nothing if no version is provided.
 */
export function FoodDatabaseVersionBadge({
  version,
  className = "",
}: {
  version?: string;
  className?: string;
}) {
  if (!version) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-700 " +
        className
      }
    >
      <Database className="h-3 w-3" aria-hidden />
      <span className="sr-only">Food database version</span>
      <span>Food DB</span>
      <span className="text-slate-900">{version}</span>
    </span>
  );
}