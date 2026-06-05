import { FileCheck2 } from "lucide-react";

/**
 * Presentational badge that displays the backend-reported clinical
 * protocol version. Renders only what the backend supplies.
 */
export function ProtocolVersionBadge({
  version,
  protocolId,
  className = "",
}: {
  version?: string;
  protocolId?: string;
  className?: string;
}) {
  if (!version) return null;
  return (
    <span
      title={protocolId ? `Protocol ${protocolId}` : undefined}
      className={
        "inline-flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-blue-800 " +
        className
      }
    >
      <FileCheck2 className="h-3 w-3" aria-hidden />
      <span className="sr-only">Protocol version</span>
      <span>Protocol</span>
      <span className="text-blue-900">v{version}</span>
    </span>
  );
}