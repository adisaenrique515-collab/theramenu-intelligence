import type { ReactNode } from "react";
import {
  Inbox,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Ban,
  Info,
} from "lucide-react";

export function Card({
  children,
  className = "",
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border border-slate-200 bg-white shadow-sm " +
        (accent ? "border-t-4 border-t-blue-600 " : "") +
        className
      }
    >
      {children}
    </div>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-widest text-slate-500"
    >
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50 " +
        (props.className ?? "")
      }
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode },
) {
  return (
    <select
      {...props}
      className={
        "min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 " +
        (props.className ?? "")
      }
    >
      {props.children}
    </select>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: Record<string, string> = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300",
    secondary:
      "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      {...rest}
      className={
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors " +
        styles[variant] +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={
        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "blue",
  label,
}: {
  value: number;
  max: number;
  tone?: "blue" | "emerald" | "amber" | "red";
  label?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  const colors: Record<string, string> = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
  };
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
          {label}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={"h-full rounded-full " + colors[tone]}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Disclaimer() {
  return (
    <div className="sticky bottom-0 z-30 border-t border-amber-300 bg-amber-50/95 px-4 py-2 text-center text-xs font-medium text-amber-900 backdrop-blur">
      All generated plans require qualified dietitian or clinician validation
      before patient use.
    </div>
  );
}

export type StateKind =
  | "empty"
  | "loading"
  | "error"
  | "warning"
  | "blocker"
  | "success"
  | "info";

const STATE_STYLES: Record<
  StateKind,
  {
    icon: typeof Inbox;
    iconClass: string;
    border: string;
    bg: string;
    title: string;
  }
> = {
  empty: {
    icon: Inbox,
    iconClass: "text-slate-300",
    border: "border-slate-200",
    bg: "bg-white",
    title: "text-slate-700",
  },
  loading: {
    icon: Loader2,
    iconClass: "text-blue-500 animate-spin",
    border: "border-slate-200",
    bg: "bg-white",
    title: "text-slate-700",
  },
  error: {
    icon: AlertOctagon,
    iconClass: "text-red-600",
    border: "border-l-4 border-l-red-600 border-slate-200",
    bg: "bg-red-50/40",
    title: "text-red-800",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    border: "border-l-4 border-l-amber-500 border-slate-200",
    bg: "bg-amber-50/40",
    title: "text-amber-900",
  },
  blocker: {
    icon: Ban,
    iconClass: "text-red-700",
    border: "border-l-4 border-l-red-700 border-slate-200",
    bg: "bg-red-50",
    title: "text-red-900",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    border: "border-l-4 border-l-emerald-600 border-slate-200",
    bg: "bg-emerald-50/40",
    title: "text-emerald-800",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-600",
    border: "border-l-4 border-l-blue-600 border-slate-200",
    bg: "bg-blue-50/40",
    title: "text-blue-900",
  },
};

export function StateView({
  kind,
  title,
  description,
  items,
  actions,
  compact = false,
}: {
  kind: StateKind;
  title: string;
  description?: ReactNode;
  items?: ReactNode[];
  actions?: ReactNode;
  compact?: boolean;
}) {
  const s = STATE_STYLES[kind];
  const Icon = s.icon;
  if (compact) {
    return (
      <div
        role={kind === "error" || kind === "blocker" ? "alert" : "status"}
        className={
          "flex items-start gap-3 rounded-lg border p-4 " + s.border + " " + s.bg
        }
      >
        <Icon className={"mt-0.5 h-5 w-5 shrink-0 " + s.iconClass} />
        <div className="min-w-0 flex-1">
          <h4 className={"text-sm font-semibold " + s.title}>{title}</h4>
          {description && (
            <div className="mt-1 text-sm text-slate-700">{description}</div>
          )}
          {items && items.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    );
  }
  return (
    <div
      role={kind === "error" || kind === "blocker" ? "alert" : "status"}
      className={
        "flex flex-col items-center justify-center rounded-xl border bg-white px-6 py-16 text-center " +
        s.border
      }
    >
      <Icon className={"mb-4 h-12 w-12 " + s.iconClass} />
      <h3 className={"text-lg font-semibold " + s.title}>{title}</h3>
      {description && (
        <div className="mt-2 max-w-md text-sm text-slate-600">{description}</div>
      )}
      {items && items.length > 0 && (
        <ul className="mt-4 max-w-lg list-disc space-y-1 pl-5 text-left text-sm text-slate-700">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}