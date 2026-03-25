import type { PaperStatus, RunStatus } from "../types";

const variants: Record<PaperStatus | RunStatus, string> = {
  pending: "border-white/10 bg-white/5 text-slate-200",
  running: "border-violet-400/40 bg-violet-400/15 text-violet-200",
  completed: "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-100",
  completed_with_errors: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  failed: "border-rose-400/40 bg-rose-400/15 text-rose-200",
};

export function StatusBadge({ status }: { status: PaperStatus | RunStatus }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${variants[status]}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
